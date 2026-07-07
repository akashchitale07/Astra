import { dbGet, dbAll } from "../db.js";

export const VariablesService = {
  /**
   * Merges all available variable scopes into a single flat key-value dictionary.
   */
  async getMergedVariables(
    userId: string,
    workflowId?: string | null,
    runVariablesState: Record<string, any> = {}
  ): Promise<Record<string, any>> {
    const vars: Record<string, any> = {};

    // 1. System Variables
    const now = new Date();
    vars["system.current_time"] = now.toLocaleTimeString();
    vars["system.current_date"] = now.toLocaleDateString();
    vars["system.platform"] = process.platform;
    vars["system.now"] = now.toISOString();

    // 2. Date/Time Variables
    vars["datetime.now"] = now.toISOString();
    vars["datetime.today"] = now.toISOString().split("T")[0];
    vars["datetime.hour"] = now.getHours();
    vars["datetime.minute"] = now.getMinutes();

    // 3. Database Variables (Global & Workflow)
    try {
      const dbVars = await dbAll<{
        name: string;
        value: string;
        scope: string;
      }>(
        "SELECT name, value, scope FROM workflow_variables WHERE user_id = ? AND (workflow_id IS NULL OR workflow_id = ?)",
        [userId, workflowId || ""]
      );

      for (const row of dbVars) {
        let val: any = row.value;
        try {
          if (row.value) {
            val = JSON.parse(row.value);
          }
        } catch {
          // Keep as string
        }
        if (row.scope === "global") {
          vars[`global.${row.name}`] = val;
        } else if (row.scope === "workflow") {
          vars[`workflow.${row.name}`] = val;
        } else {
          vars[row.name] = val;
        }
      }
    } catch (err) {
      console.error("Error loading DB variables:", err);
    }

    // 4. Run-level local/temp/AI variables state
    for (const [key, val] of Object.entries(runVariablesState)) {
      vars[key] = val;
    }

    return vars;
  },

  /**
   * Replaces placeholders of format {{key}} with their values.
   */
  substitute(text: string, vars: Record<string, any>): string {
    if (!text || typeof text !== "string") return text;
    return text.replace(/\{\{([^}]+)\}\}/g, (match, expression) => {
      const key = expression.trim();
      if (vars[key] !== undefined) {
        return typeof vars[key] === "object" ? JSON.stringify(vars[key]) : String(vars[key]);
      }
      return match;
    });
  }
};
