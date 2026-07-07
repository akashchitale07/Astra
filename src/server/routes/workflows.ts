import { Router, Response } from "express";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth.js";
import { dbGet, dbAll, dbRun } from "../db.js";
import { HistoryService } from "../services/history.js";
import { WorkflowEngineService } from "../services/workflowEngine.js";
import { QueueService } from "../services/queue.js";
import { TemplatesService } from "../services/templates.js";
import { NotificationsService } from "../services/notifications.js";
import { WorkflowValidator } from "../services/workflowValidator.js";
import { GoogleGenAI } from "@google/genai";
import { decryptApiKey } from "../utils/crypto.js";

const router = Router();
const generateId = () =>
  Math.random().toString(36).substring(2, 15) + Date.now().toString(36);

// 1. Get Workflow Dashboard Statistics
router.get("/stats", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id as string;
    const stats = await HistoryService.getDashboardStats(userId);
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch stats" });
  }
});

// 2. Get Templates
router.get("/templates", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const templates = await TemplatesService.getTemplates();
    res.json(templates);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch templates" });
  }
});

// 3. Install Template
router.post("/templates/:id/install", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id as string;
    const templateId = req.params.id;

    const template = await dbGet<any>("SELECT * FROM workflow_templates WHERE id = ?", [templateId]);
    if (!template) {
      res.status(404).json({ error: "Template not found" });
      return;
    }

    const workflowId = generateId();
    const createdAt = new Date().toISOString();

    // 1. Insert Workflow
    await dbRun(
      `INSERT INTO workflows (id, user_id, name, description, is_active, created_at, updated_at, trigger_type, trigger_config, version)
       VALUES (?, ?, ?, ?, 1, ?, ?, 'manual', NULL, 1)`,
      [workflowId, userId, `${template.name} (Copy)`, template.description, createdAt, createdAt]
    );

    // 2. Insert Nodes
    const nodes = JSON.parse(template.nodes_data || "[]");
    for (const node of nodes) {
      await dbRun(
        `INSERT INTO workflow_nodes (id, workflow_id, type, label, config, position_x, position_y)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          node.id === "start" || node.id === "end" ? `${node.id}_${generateId()}` : node.id,
          workflowId,
          node.type,
          node.label,
          JSON.stringify(node.config || {}),
          node.position_x,
          node.position_y
        ]
      );
    }

    // 3. Insert Edges (map old IDs to preserve links if we regenerated them, but templates keep static IDs so we insert them directly)
    const edges = JSON.parse(template.edges_data || "[]");
    for (const edge of edges) {
      await dbRun(
        `INSERT INTO workflow_edges (id, workflow_id, source_node_id, target_node_id, source_handle, target_handle)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          generateId(),
          workflowId,
          edge.source_node_id,
          edge.target_node_id,
          edge.source_handle || null,
          edge.target_handle || null
        ]
      );
    }

    // 4. Insert default variables
    const vars = JSON.parse(template.variables_data || "[]");
    for (const v of vars) {
      await dbRun(
        `INSERT INTO workflow_variables (id, workflow_id, user_id, name, value, type, scope)
         VALUES (?, ?, ?, ?, ?, 'string', 'workflow')`,
        [generateId(), workflowId, userId, v.name, v.value]
      );
    }

    res.json({ success: true, workflowId });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to install template" });
  }
});

// 4. List Workflows
router.get("/", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id as string;
    const list = await dbAll<any>(
      "SELECT * FROM workflows WHERE user_id = ? ORDER BY updated_at DESC",
      [userId]
    );
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to list workflows" });
  }
});

// 5. Get a single Workflow details
router.get("/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id as string;
    const id = req.params.id;

    const workflow = await dbGet<any>("SELECT * FROM workflows WHERE id = ? AND user_id = ?", [
      id,
      userId
    ]);
    if (!workflow) {
      res.status(404).json({ error: "Workflow not found" });
      return;
    }

    const nodes = await dbAll<any>("SELECT * FROM workflow_nodes WHERE workflow_id = ?", [id]);
    const edges = await dbAll<any>("SELECT * FROM workflow_edges WHERE workflow_id = ?", [id]);
    const variables = await dbAll<any>(
      "SELECT * FROM workflow_variables WHERE workflow_id = ? AND user_id = ?",
      [id, userId]
    );
    const schedules = await dbAll<any>(
      "SELECT * FROM workflow_schedules WHERE workflow_id = ? AND user_id = ?",
      [id, userId]
    );

    res.json({
      ...workflow,
      nodes: nodes.map((n) => ({ ...n, config: n.config ? JSON.parse(n.config) : {} })),
      edges,
      variables,
      schedules: schedules.map((s) => ({
        ...s,
        schedule_config: s.schedule_config ? JSON.parse(s.schedule_config) : {}
      }))
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch workflow details" });
  }
});

// 6. Create or Save Workflow
router.post("/", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id as string;
    const { name, description } = req.body;

    const id = generateId();
    const now = new Date().toISOString();

    await dbRun(
      `INSERT INTO workflows (id, user_id, name, description, is_active, created_at, updated_at, trigger_type, trigger_config, version)
       VALUES (?, ?, ?, ?, 1, ?, ?, 'manual', NULL, 1)`,
      [id, userId, name || "New Workflow", description || "", now, now]
    );

    // Create default start and end node
    await dbRun(
      `INSERT INTO workflow_nodes (id, workflow_id, type, label, config, position_x, position_y)
       VALUES (?, ?, 'start', 'Start', '{}', 150, 200)`,
      [`start_${generateId()}`, id]
    );
    await dbRun(
      `INSERT INTO workflow_nodes (id, workflow_id, type, label, config, position_x, position_y)
       VALUES (?, ?, 'end', 'End', '{}', 600, 200)`,
      [`end_${generateId()}`, id]
    );

    res.json({ id, name, description });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to create workflow" });
  }
});

// 7. Update/Save Workflow (graph nodes & edges)
router.put("/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id as string;
    const id = req.params.id;
    const { name, description, is_active, trigger_type, trigger_config, nodes, edges, variables, schedules } = req.body;

    const workflow = await dbGet<any>("SELECT * FROM workflows WHERE id = ? AND user_id = ?", [
      id,
      userId
    ]);
    if (!workflow) {
      res.status(404).json({ error: "Workflow not found" });
      return;
    }

    // Run structural validator first
    const validation = WorkflowValidator.validate(nodes || [], edges || []);
    if (!validation.valid) {
      res.status(400).json({ error: validation.errors.join(" | ") });
      return;
    }

    const now = new Date().toISOString();

    // 1. Update basic info
    await dbRun(
      `UPDATE workflows
       SET name = ?, description = ?, is_active = ?, trigger_type = ?, trigger_config = ?, updated_at = ?, version = version + 1
       WHERE id = ? AND user_id = ?`,
      [
        name || workflow.name,
        description !== undefined ? description : workflow.description,
        is_active !== undefined ? (is_active ? 1 : 0) : workflow.is_active,
        trigger_type || workflow.trigger_type,
        trigger_config ? JSON.stringify(trigger_config) : null,
        now,
        id,
        userId
      ]
    );

    // 2. Refresh Nodes
    await dbRun("DELETE FROM workflow_nodes WHERE workflow_id = ?", [id]);
    if (nodes && Array.isArray(nodes)) {
      for (const node of nodes) {
        await dbRun(
          `INSERT INTO workflow_nodes (id, workflow_id, type, label, config, position_x, position_y)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            node.id,
            id,
            node.type,
            node.label || node.type,
            JSON.stringify(node.config || {}),
            node.position_x || 0,
            node.position_y || 0
          ]
        );
      }
    }

    // 3. Refresh Edges
    await dbRun("DELETE FROM workflow_edges WHERE workflow_id = ?", [id]);
    if (edges && Array.isArray(edges)) {
      for (const edge of edges) {
        await dbRun(
          `INSERT INTO workflow_edges (id, workflow_id, source_node_id, target_node_id, source_handle, target_handle)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            generateId(),
            id,
            edge.source_node_id,
            edge.target_node_id,
            edge.source_handle || null,
            edge.target_handle || null
          ]
        );
      }
    }

    // 4. Refresh Variables
    await dbRun("DELETE FROM workflow_variables WHERE workflow_id = ? AND user_id = ?", [id, userId]);
    if (variables && Array.isArray(variables)) {
      for (const v of variables) {
        await dbRun(
          `INSERT INTO workflow_variables (id, workflow_id, user_id, name, value, type, scope)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [generateId(), id, userId, v.name, v.value, v.type || "string", v.scope || "workflow"]
        );
      }
    }

    // 5. Refresh Schedules
    await dbRun("DELETE FROM workflow_schedules WHERE workflow_id = ? AND user_id = ?", [id, userId]);
    if (schedules && Array.isArray(schedules)) {
      for (const s of schedules) {
        const nextRun = SchedulerService.calculateNextRun(s.schedule_type, s.schedule_config || {});
        await dbRun(
          `INSERT INTO workflow_schedules (id, workflow_id, user_id, schedule_type, schedule_config, last_run_at, next_run_at, is_active, created_at)
           VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
          [
            generateId(),
            id,
            userId,
            s.schedule_type,
            JSON.stringify(s.schedule_config || {}),
            nextRun.toISOString(),
            s.is_active !== undefined ? (s.is_active ? 1 : 0) : 1,
            now
          ]
        );
      }
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to update workflow" });
  }
});

// 8. Delete Workflow
router.delete("/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id as string;
    const id = req.params.id;

    const result = await dbRun("DELETE FROM workflows WHERE id = ? AND user_id = ?", [id, userId]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to delete workflow" });
  }
});

// 9. Manual Execution Run Trigger
router.post("/:id/run", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id as string;
    const workflowId = req.params.id;
    const initialVars = req.body.variables || {};

    const workflow = await dbGet<any>("SELECT * FROM workflows WHERE id = ? AND user_id = ?", [
      workflowId,
      userId
    ]);
    if (!workflow) {
      res.status(404).json({ error: "Workflow not found" });
      return;
    }

    const runId = await WorkflowEngineService.createRun(workflowId, userId, initialVars);
    QueueService.enqueue(runId, userId);

    res.json({ success: true, runId });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to start workflow execution" });
  }
});

// 10. List Runs
router.get("/runs", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id as string;
    const runs = await dbAll<any>(
      `SELECT r.*, w.name as workflow_name
       FROM workflow_runs r
       JOIN workflows w ON r.workflow_id = w.id
       WHERE r.user_id = ?
       ORDER BY r.started_at DESC`,
      [userId]
    );
    res.json(runs);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch runs" });
  }
});

// 11. Get Run Logs & Details
router.get("/runs/:runId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id as string;
    const runId = req.params.runId;

    const run = await dbGet<any>(
      `SELECT r.*, w.name as workflow_name
       FROM workflow_runs r
       JOIN workflows w ON r.workflow_id = w.id
       WHERE r.id = ? AND r.user_id = ?`,
      [runId, userId]
    );
    if (!run) {
      res.status(404).json({ error: "Run not found" });
      return;
    }

    const logs = await dbAll<any>(
      "SELECT * FROM workflow_logs WHERE run_id = ? ORDER BY created_at ASC",
      [runId]
    );

    res.json({
      ...run,
      logs
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch run details" });
  }
});

// 12. Resume execution
router.post("/runs/:runId/resume", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id as string;
    const runId = req.params.runId;
    const userInputVars = req.body.variables || {};

    // Run this asynchronously
    WorkflowEngineService.resumeRun(runId, userId, userInputVars).catch((err) =>
      console.error("Async resume run error:", err)
    );

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to resume run" });
  }
});

// 13. Cancel execution
router.post("/runs/:runId/cancel", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id as string;
    const runId = req.params.runId;

    await WorkflowEngineService.cancelRun(runId, userId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to cancel run" });
  }
});

// 14. List Notifications
router.get("/notifications", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id as string;
    const list = await NotificationsService.getNotifications(userId);
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to list notifications" });
  }
});

// 15. Mark Notification Read
router.post("/notifications/:id/read", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id as string;
    const id = req.params.id;

    if (id === "all") {
      await NotificationsService.markAllAsRead(userId);
    } else {
      await NotificationsService.markAsRead(id, userId);
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to update notification" });
  }
});

// 16. Natural Language to Workflow Generator (AI)
router.post("/generate", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id as string;
    const { prompt } = req.body;

    if (!prompt) {
      res.status(400).json({ error: "Prompt is missing." });
      return;
    }

    // Fetch API key from DB or environment
    const userSet = await dbGet<{ encrypted_api_key: string | null }>(
      "SELECT encrypted_api_key FROM user_settings WHERE user_id = ?",
      [userId]
    );
    let key = process.env.GEMINI_API_KEY;
    if (userSet && userSet.encrypted_api_key) {
      try {
        key = decryptApiKey(userSet.encrypted_api_key);
      } catch (err) {
        console.error("Failed to decrypt API key for generator:", err);
      }
    }

    if (!key) {
      res.status(400).json({
        error: "Gemini API key is not configured. Go to Settings > Secrets to provide one."
      });
      return;
    }

    const ai = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: { "User-Agent": "aistudio-build" }
      }
    });

    const aiSystemPrompt = `
      You are an expert automation architect that translates natural language prompts into high-quality workflow diagrams.
      Generate a JSON representation of a workflow containing nodes, edges, and default variables.

      Available Node Types:
      - start: Entry point of workflow.
      - end: Terminal point.
      - delay: Delays execution. Config: { duration: number_ms }
      - condition: Simple logical branches. Config: { logicalOperator: 'AND'|'OR', rules: [{ field: string, operator: 'equals'|'contains'|'gt'|'lt', value: string }] } (edges source_handle must be "true" or "false")
      - switch: Evaluates a field and branches. Config: { field: string, cases: [{ value: string, targetHandle: string }] }
      - loop: Loops index. Config: { variable_name: string, start: number, end: number } (edges source_handle are "loop_body" and "loop_end")
      - variable: Defines/updates a variable. Config: { name: string, value: string, value_type: 'string'|'number'|'boolean' }
      - notification: Generates an alert. Config: { message: string }
      - ai_prompt: Triggers a Gemini call. Config: { prompt: string, variable_name: string }
      - browser_action: Triggers browser simulator. Config: { action: 'open'|'search', url: string, query: string, variable_name: string }
      - computer_action: Safe terminal scripts. Config: { command: string }
      - file_action: Safe file management. Config: { action: 'read'|'write'|'list', path: string, content: string, variable_name: string }
      - http_request: Fetches third party endpoints. Config: { method: 'GET'|'POST', url: string, headers: string_json, body: string, variable_name: string }
      - script_runner: Simple JS interpreter. Config: { script: string, variable_name: string }
      - user_input: Pauses workflow and prompts user for verification. Config: { message: string }
      - wait: Timeout. Config: { duration: number_ms }

      Format Output as clean JSON ONLY without backticks, with schema:
      {
        "name": "Descriptive workflow name",
        "description": "Descriptive workflow description",
        "nodes": [
          { "id": "start", "type": "start", "label": "Start", "position_x": 100, "position_y": 200, "config": {} },
          ... other nodes layout
        ],
        "edges": [
          { "source_node_id": "start", "target_node_id": "next_node", "source_handle": null, "target_handle": null }
        ],
        "variables": [
          { "name": "variableName", "value": "defaultValue" }
        ]
      }
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Translate the following prompt into a visual automation workflow JSON diagram:\n\nPrompt: "${prompt}"`,
      config: {
        systemInstruction: aiSystemPrompt,
        responseMimeType: "application/json"
      }
    });

    const resText = response.text || "";
    const parsed = JSON.parse(resText.trim());
    res.json(parsed);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to generate workflow with AI" });
  }
});

export default router;
