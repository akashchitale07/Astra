export interface WorkflowNode {
  id: string;
  type: string;
  label: string;
  config: any;
}

export interface WorkflowEdge {
  id: string;
  source_node_id: string;
  target_node_id: string;
}

export const WorkflowValidator = {
  /**
   * Performs static analysis on a workflow to find structural errors and safety issues.
   */
  validate(nodes: WorkflowNode[], edges: WorkflowEdge[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 1. Basic checks
    const startNodes = nodes.filter((n) => n.type === "start");
    if (startNodes.length === 0) {
      errors.push("Workflow must have at least one Start node.");
    }

    // 2. Cycle detection / Infinite Loop check
    const hasCycle = this.detectCycles(nodes, edges);
    if (hasCycle) {
      const hasPauseNodeInLoop = nodes.some((n) =>
        ["delay", "user_input", "wait"].includes(n.type)
      );
      if (!hasPauseNodeInLoop) {
        errors.push(
          "Infinite loop detected: The workflow contains a cyclic feedback loop without any Delay, User Input, or Wait node to prevent CPU exhaustion."
        );
      }
    }

    // 3. Node-specific safety validations
    for (const node of nodes) {
      const config = node.config || {};

      if (node.type === "computer_action" || node.type === "script_runner") {
        const cmd = String(config.command || "").toLowerCase();
        const dangerousPatterns = [
          "rm -rf",
          "mkfs",
          "dd if=",
          "fork bomb",
          ":(){ :|:& };:",
          "shutdown",
          "reboot",
          "chmod 777",
          "chown",
          "passwd"
        ];
        for (const pattern of dangerousPatterns) {
          if (cmd.includes(pattern)) {
            errors.push(
              `Safety violation in node "${node.label}": Dangerous command pattern "${pattern}" is prohibited.`
            );
          }
        }
      }

      if (node.type === "file_action") {
        const filePath = String(config.path || "").toLowerCase();
        const unsafePaths = ["/etc/", "/var/", "/usr/", "/bin/", "/boot/", "/root/", "/sys/", "/proc/", ".."];
        for (const up of unsafePaths) {
          if (filePath.includes(up)) {
            errors.push(
              `Safety violation in node "${node.label}": Accessing system or parent directory path "${up}" is forbidden.`
            );
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  },

  /**
   * Depth First Search to find loops (cycles) in directed graphs.
   */
  detectCycles(nodes: WorkflowNode[], edges: WorkflowEdge[]): boolean {
    const adj: Record<string, string[]> = {};
    for (const n of nodes) {
      adj[n.id] = [];
    }
    for (const e of edges) {
      if (adj[e.source_node_id]) {
        adj[e.source_node_id].push(e.target_node_id);
      }
    }

    const visited: Record<string, number> = {}; // 0 = unvisited, 1 = visiting, 2 = visited
    const dfs = (u: string): boolean => {
      visited[u] = 1;
      const neighbors = adj[u] || [];
      for (const v of neighbors) {
        if (visited[v] === 1) return true; // cycle found
        if (visited[v] !== 2) {
          if (dfs(v)) return true;
        }
      }
      visited[u] = 2;
      return false;
    };

    for (const n of nodes) {
      if (!visited[n.id]) {
        if (dfs(n.id)) return true;
      }
    }
    return false;
  }
};
