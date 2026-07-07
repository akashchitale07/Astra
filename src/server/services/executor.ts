import { exec } from "child_process";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import { dbGet } from "../db.js";
import { decryptApiKey } from "../utils/crypto.js";
import { VariablesService } from "./variables.js";
import { ConditionsService } from "./conditions.js";
import { NotificationsService } from "./notifications.js";
import { WorkflowValidator } from "./workflowValidator.js";

export const ExecutorService = {
  /**
   * Evaluates and executes a single workflow node.
   */
  async executeNode(
    node: any,
    userId: string,
    runId: string,
    variablesState: Record<string, any>
  ): Promise<{
    success: boolean;
    nextBranch?: string;
    error?: string;
    updatedVariables?: Record<string, any>;
  }> {
    const config = node.config || {};
    const mergedVars = await VariablesService.getMergedVariables(userId, null, variablesState);

    // Substitute node configurations using the VariablesService
    const substitutedConfig: Record<string, any> = {};
    for (const [key, val] of Object.entries(config)) {
      if (typeof val === "string") {
        substitutedConfig[key] = VariablesService.substitute(val, mergedVars);
      } else {
        substitutedConfig[key] = val;
      }
    }

    try {
      switch (node.type) {
        case "start":
        case "end":
          return { success: true };

        case "delay": {
          const duration = Number(substitutedConfig.duration) || 1000;
          await new Promise((resolve) => setTimeout(resolve, duration));
          return { success: true };
        }

        case "condition": {
          const branch = ConditionsService.evaluateNode(node.config, mergedVars);
          return { success: true, nextBranch: branch };
        }

        case "switch": {
          const branch = ConditionsService.evaluateNode(node.config, mergedVars);
          return { success: true, nextBranch: branch };
        }

        case "loop": {
          const loopVar = config.variable_name || "loop_index";
          const startVal = Number(substitutedConfig.start) || 0;
          const endVal = Number(substitutedConfig.end) || 5;
          const currentVal =
            variablesState[loopVar] !== undefined ? Number(variablesState[loopVar]) : startVal;

          if (currentVal < endVal) {
            const nextVal = currentVal + 1;
            return {
              success: true,
              nextBranch: "loop_body",
              updatedVariables: { [loopVar]: currentVal, [`${loopVar}_next`]: nextVal }
            };
          } else {
            return {
              success: true,
              nextBranch: "loop_end"
            };
          }
        }

        case "variable": {
          const varName = substitutedConfig.name;
          const rawVal = substitutedConfig.value;
          let evaluatedVal: any = rawVal;
          if (substitutedConfig.value_type === "number") {
            evaluatedVal = Number(rawVal);
          } else if (substitutedConfig.value_type === "boolean") {
            evaluatedVal = rawVal === "true" || rawVal === true;
          }
          if (!varName) {
            return { success: false, error: "Variable name is missing." };
          }
          return { success: true, updatedVariables: { [varName]: evaluatedVal } };
        }

        case "notification": {
          const message = substitutedConfig.message || "Notification from workflow node";
          await NotificationsService.createNotification(userId, message, "in_app", runId);
          return { success: true };
        }

        case "ai_prompt": {
          const promptText = substitutedConfig.prompt;
          const outVar = substitutedConfig.variable_name || "ai_response";
          if (!promptText) {
            return { success: false, error: "AI Prompt text is missing." };
          }

          // Fetch API key from user settings or fallback to env
          const userSet = await dbGet<{ encrypted_api_key: string | null }>(
            "SELECT encrypted_api_key FROM user_settings WHERE user_id = ?",
            [userId]
          );
          let key = process.env.GEMINI_API_KEY;
          if (userSet && userSet.encrypted_api_key) {
            try {
              key = decryptApiKey(userSet.encrypted_api_key);
            } catch (err) {
              console.error("Failed to decrypt user settings key for AI node:", err);
            }
          }

          if (!key) {
            return {
              success: false,
              error: "Gemini API key is not configured. Go to Settings > Secrets to provide one."
            };
          }

          const ai = new GoogleGenAI({
            apiKey: key,
            httpOptions: {
              headers: { "User-Agent": "aistudio-build" }
            }
          });

          const response = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: promptText
          });

          const resText = response.text || "";
          return { success: true, updatedVariables: { [outVar]: resText } };
        }

        case "browser_action": {
          const action = substitutedConfig.action || "open";
          const outVar = substitutedConfig.variable_name || "browser_output";
          if (action === "search") {
            const query = substitutedConfig.query || "Astra automation";
            return {
              success: true,
              updatedVariables: { [outVar]: `Simulated search results for query: "${query}"` }
            };
          } else {
            const url = substitutedConfig.url || "https://example.com";
            return {
              success: true,
              updatedVariables: { [outVar]: `Simulated navigation to URL: "${url}"` }
            };
          }
        }

        case "computer_action": {
          const command = substitutedConfig.command;
          if (!command) {
            return { success: false, error: "Command string is missing." };
          }

          // Safety validation using WorkflowValidator
          const validation = WorkflowValidator.validate([node], []);
          if (!validation.valid) {
            return { success: false, error: validation.errors.join(" | ") };
          }

          const ctrlSet = await dbGet<{ dry_run_default: number }>(
            "SELECT dry_run_default FROM computer_control_settings WHERE user_id = ?",
            [userId]
          );
          const isDryRun = ctrlSet ? ctrlSet.dry_run_default === 1 : true;

          if (isDryRun) {
            console.log(`[DRY RUN] Simulating computer command: ${command}`);
            return {
              success: true,
              updatedVariables: { command_output: `[Dry Run] Simulated output of "${command}"` }
            };
          }

          const output = await new Promise<string>((resolve, reject) => {
            exec(command, { timeout: 30000 }, (error, stdout, stderr) => {
              if (error) {
                reject(new Error(stderr || error.message));
              } else {
                resolve(stdout || stderr);
              }
            });
          });

          return { success: true, updatedVariables: { command_output: output.trim() } };
        }

        case "file_action": {
          const action = substitutedConfig.action || "read";
          const pathStr = substitutedConfig.path;
          const outVar = substitutedConfig.variable_name || "file_output";

          if (!pathStr) {
            return { success: false, error: "File path is missing." };
          }

          const validation = WorkflowValidator.validate([node], []);
          if (!validation.valid) {
            return { success: false, error: validation.errors.join(" | ") };
          }

          if (action === "read") {
            if (!fs.existsSync(pathStr)) {
              return { success: false, error: `File not found at path "${pathStr}"` };
            }
            const data = fs.readFileSync(pathStr, "utf8");
            return { success: true, updatedVariables: { [outVar]: data } };
          } else if (action === "write") {
            const content = substitutedConfig.content || "";
            const dir = pathStr.substring(0, pathStr.lastIndexOf("/"));
            if (dir && !fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(pathStr, content, "utf8");
            return { success: true };
          } else if (action === "list") {
            if (!fs.existsSync(pathStr)) {
              return { success: false, error: `Directory not found at path "${pathStr}"` };
            }
            const files = fs.readdirSync(pathStr);
            return { success: true, updatedVariables: { [outVar]: files } };
          }

          return { success: false, error: `Unknown file action: ${action}` };
        }

        case "http_request": {
          const url = substitutedConfig.url;
          const method = substitutedConfig.method || "GET";
          const headersStr = substitutedConfig.headers || "{}";
          const body = substitutedConfig.body || "";
          const outVar = substitutedConfig.variable_name || "http_response";

          if (!url) {
            return { success: false, error: "HTTP URL is missing." };
          }

          let headers: any = {};
          try {
            headers = JSON.parse(headersStr);
          } catch {
            // ignore JSON parse errors
          }

          const fetchConfig: any = { method, headers };
          if (["POST", "PUT", "PATCH"].includes(method)) {
            fetchConfig.body = body;
          }

          const response = await fetch(url, fetchConfig);
          const responseText = await response.text();
          let jsonVal: any = responseText;
          try {
            jsonVal = JSON.parse(responseText);
          } catch {
            // Keep as raw text
          }

          return { success: true, updatedVariables: { [outVar]: jsonVal } };
        }

        case "script_runner": {
          const script = substitutedConfig.script || "";
          const outVar = substitutedConfig.variable_name || "script_output";

          const runScript = (code: string, context: any) => {
            const fn = new Function(...Object.keys(context), `return (${code})`);
            return fn(...Object.values(context));
          };

          const output = runScript(script, { vars: mergedVars });
          return { success: true, updatedVariables: { [outVar]: output } };
        }

        case "user_input": {
          return { success: true, nextBranch: "paused" };
        }

        case "wait": {
          const duration = Number(substitutedConfig.duration) || 5000;
          await new Promise((resolve) => setTimeout(resolve, duration));
          return { success: true };
        }

        default:
          return { success: false, error: `Unsupported node type: ${node.type}` };
      }
    } catch (err: any) {
      return { success: false, error: err.message || "Execution error" };
    }
  }
};
