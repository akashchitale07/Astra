import { dbRun, dbGet, dbAll } from "../db.js";
import { ExecutorService } from "./executor.js";
import { NotificationsService } from "./notifications.js";

const generateId = () =>
  Math.random().toString(36).substring(2, 15) + Date.now().toString(36);

export const WorkflowEngineService = {
  /**
   * Initializes a pending run inside the database.
   */
  async createRun(
    workflowId: string,
    userId: string,
    initialVars: Record<string, any> = {}
  ): Promise<string> {
    const runId = generateId();
    const createdAt = new Date().toISOString();
    await dbRun(
      `INSERT INTO workflow_runs (id, workflow_id, user_id, status, started_at, variables_state)
       VALUES (?, ?, ?, 'pending', ?, ?)`,
      [runId, workflowId, userId, createdAt, JSON.stringify(initialVars)]
    );
    return runId;
  },

  /**
   * Appends execution trace log to database.
   */
  async log(
    runId: string,
    nodeId: string | null,
    level: "info" | "warn" | "error" | "debug",
    message: string
  ): Promise<void> {
    const id = generateId();
    const createdAt = new Date().toISOString();
    await dbRun(
      "INSERT INTO workflow_logs (id, run_id, node_id, level, message, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      [id, runId, nodeId, level, message, createdAt]
    );
    console.log(
      `[Workflow Log] Run ${runId} | Node ${nodeId || "SYSTEM"} | ${level.toUpperCase()}: ${message}`
    );
  },

  /**
   * Starts a workflow execution process.
   */
  async startRun(runId: string, userId: string): Promise<void> {
    const run = await dbGet<any>("SELECT * FROM workflow_runs WHERE id = ?", [runId]);
    if (!run) return;

    await dbRun("UPDATE workflow_runs SET status = 'running' WHERE id = ?", [runId]);
    await this.log(runId, null, "info", "Starting workflow execution.");

    try {
      const dbNodes = await dbAll<any>("SELECT * FROM workflow_nodes WHERE workflow_id = ?", [
        run.workflow_id
      ]);
      const dbEdges = await dbAll<any>("SELECT * FROM workflow_edges WHERE workflow_id = ?", [
        run.workflow_id
      ]);

      const nodes = dbNodes.map((n) => ({
        ...n,
        config: n.config ? JSON.parse(n.config) : {}
      }));
      const edges = dbEdges;

      const startNode = nodes.find((n) => n.type === "start");
      if (!startNode) {
        throw new Error("No Start node found in this workflow.");
      }

      const variablesState = JSON.parse(run.variables_state || "{}");
      await this.executeFromNode(startNode.id, nodes, edges, runId, userId, variablesState);
    } catch (err: any) {
      const errorMsg = err.message || "Failed to start run";
      await dbRun(
        "UPDATE workflow_runs SET status = 'failed', completed_at = ?, error_message = ? WHERE id = ?",
        [new Date().toISOString(), errorMsg, runId]
      );
      await this.log(runId, null, "error", `Workflow failed: ${errorMsg}`);
      await NotificationsService.createNotification(
        userId,
        `Workflow run failed: ${errorMsg}`,
        "failed",
        runId
      );
    }
  },

  /**
   * Core state machine transition function. Evaluates the current node, retries if failed,
   * handles branching, pause operations, and forks execution for parallel paths.
   */
  async executeFromNode(
    nodeId: string,
    nodes: any[],
    edges: any[],
    runId: string,
    userId: string,
    variablesState: Record<string, any>
  ): Promise<void> {
    const run = await dbGet<any>("SELECT status, started_at FROM workflow_runs WHERE id = ?", [runId]);
    if (run && ["failed", "cancelled", "paused"].includes(run.status)) {
      return; // Execution terminated early
    }

    const node = nodes.find((n) => n.id === nodeId);
    if (!node) {
      await this.log(runId, null, "warn", `Node with ID ${nodeId} not found. Terminating path.`);
      return;
    }

    await dbRun("UPDATE workflow_runs SET current_node_id = ?, variables_state = ? WHERE id = ?", [
      nodeId,
      JSON.stringify(variablesState),
      runId
    ]);
    await this.log(runId, nodeId, "info", `Executing node: "${node.label}" (${node.type})`);

    const config = node.config || {};
    const maxRetries = Number(config.retries) || 0;
    const retryDelay = Number(config.retry_delay) || 1000;
    let attempts = 0;
    let executionResult: any = null;

    while (attempts <= maxRetries) {
      executionResult = await ExecutorService.executeNode(node, userId, runId, variablesState);
      if (executionResult.success) {
        break;
      }
      attempts++;
      if (attempts <= maxRetries) {
        await this.log(
          runId,
          nodeId,
          "warn",
          `Node failed: ${executionResult.error}. Retrying in ${retryDelay}ms... (Attempt ${attempts}/${maxRetries})`
        );
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }

    if (!executionResult.success) {
      if (config.continue_after_failure) {
        await this.log(
          runId,
          nodeId,
          "warn",
          `Node execution failed but Continue After Failure is enabled: ${executionResult.error}`
        );
        executionResult = { success: true };
      } else {
        await this.log(runId, nodeId, "error", `Node execution failed: ${executionResult.error}`);
        await dbRun(
          "UPDATE workflow_runs SET status = 'failed', completed_at = ?, error_message = ? WHERE id = ?",
          [new Date().toISOString(), executionResult.error || "Node error", runId]
        );
        await NotificationsService.createNotification(
          userId,
          `Workflow failed at node "${node.label}"`,
          "failed",
          runId
        );
        return;
      }
    }

    if (executionResult.updatedVariables) {
      variablesState = { ...variablesState, ...executionResult.updatedVariables };
    }

    // Check for pause conditions
    if (node.type === "user_input" || executionResult.nextBranch === "paused") {
      await dbRun("UPDATE workflow_runs SET status = 'paused', variables_state = ? WHERE id = ?", [
        JSON.stringify(variablesState),
        runId
      ]);
      await this.log(runId, nodeId, "info", "Workflow execution paused, waiting for user input.");
      await NotificationsService.createNotification(
        userId,
        `Workflow run is paused waiting for your input: "${node.label}"`,
        "approval_required",
        runId
      );
      return;
    }

    // Find outgoing edges
    const outgoing = edges.filter((e) => e.source_node_id === nodeId);
    if (outgoing.length === 0) {
      await this.log(runId, nodeId, "info", "Path completed. No more connected nodes.");

      const currentRun = await dbGet<any>("SELECT status FROM workflow_runs WHERE id = ?", [runId]);
      if (currentRun && currentRun.status === "running") {
        const completedAt = new Date().toISOString();
        const duration = Date.now() - new Date(run.started_at).getTime();
        await dbRun(
          "UPDATE workflow_runs SET status = 'completed', completed_at = ?, duration = ? WHERE id = ?",
          [completedAt, duration, runId]
        );
        await this.log(runId, null, "info", "Workflow completed successfully.");
        await NotificationsService.createNotification(
          userId,
          "Workflow run completed successfully!",
          "finished",
          runId
        );
      }
      return;
    }

    let nextNodesToRun: any[] = [];

    if (executionResult.nextBranch) {
      const match = outgoing.find((e) => e.source_handle === executionResult.nextBranch);
      if (match) {
        nextNodesToRun.push(match.target_node_id);
      } else {
        const defMatch = outgoing.find((e) => e.source_handle === "default" || !e.source_handle);
        if (defMatch) {
          nextNodesToRun.push(defMatch.target_node_id);
        }
      }
    } else {
      // Parallel Execution: Run all targets concurrently using Promise.all
      nextNodesToRun = outgoing.map((e) => e.target_node_id);
    }

    if (nextNodesToRun.length === 0) {
      await this.log(runId, nodeId, "info", "No matching branch edges to execute.");
      return;
    }

    if (nextNodesToRun.length === 1) {
      await this.executeFromNode(nextNodesToRun[0], nodes, edges, runId, userId, variablesState);
    } else {
      await this.log(
        runId,
        nodeId,
        "info",
        `Forking parallel execution paths: ${nextNodesToRun.length} concurrent nodes.`
      );
      await Promise.all(
        nextNodesToRun.map((tId) =>
          this.executeFromNode(tId, nodes, edges, runId, userId, { ...variablesState })
        )
      );
    }
  },

  /**
   * Resumes a paused execution run.
   */
  async resumeRun(
    runId: string,
    userId: string,
    userInputVars: Record<string, any> = {}
  ): Promise<void> {
    const run = await dbGet<any>("SELECT * FROM workflow_runs WHERE id = ? AND status = 'paused'", [
      runId
    ]);
    if (!run) {
      throw new Error("Cannot resume. Run is not in paused state.");
    }

    await dbRun("UPDATE workflow_runs SET status = 'running' WHERE id = ?", [runId]);
    await this.log(
      runId,
      run.current_node_id,
      "info",
      "Resuming workflow execution after user input."
    );

    const dbNodes = await dbAll<any>("SELECT * FROM workflow_nodes WHERE workflow_id = ?", [
      run.workflow_id
    ]);
    const dbEdges = await dbAll<any>("SELECT * FROM workflow_edges WHERE workflow_id = ?", [
      run.workflow_id
    ]);

    const nodes = dbNodes.map((n) => ({
      ...n,
      config: n.config ? JSON.parse(n.config) : {}
    }));
    const edges = dbEdges;

    let variablesState = JSON.parse(run.variables_state || "{}");
    variablesState = { ...variablesState, ...userInputVars };

    const outgoing = edges.filter((e) => e.source_node_id === run.current_node_id);
    const targets = outgoing.map((e) => e.target_node_id);

    if (targets.length === 0) {
      await dbRun(
        "UPDATE workflow_runs SET status = 'completed', completed_at = ? WHERE id = ?",
        [new Date().toISOString(), runId]
      );
      await this.log(runId, null, "info", "Workflow completed on resume.");
      return;
    }

    await Promise.all(
      targets.map((tId) =>
        this.executeFromNode(tId, nodes, edges, runId, userId, variablesState)
      )
    );
  },

  /**
   * Cancels an active or pending run.
   */
  async cancelRun(runId: string, userId: string): Promise<void> {
    await dbRun(
      "UPDATE workflow_runs SET status = 'cancelled', completed_at = ? WHERE id = ? AND user_id = ?",
      [new Date().toISOString(), runId, userId]
    );
    await this.log(runId, null, "warn", "Workflow execution cancelled by user.");
  }
};
