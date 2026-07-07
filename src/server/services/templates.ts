import { dbRun, dbAll, dbGet } from "../db.js";

export const DEFAULT_TEMPLATES = [
  {
    id: "temp_morning_routine",
    name: "Morning Routine",
    description: "Launch your daily productivity tools, fetch weather and top news automatically.",
    nodes_data: JSON.stringify([
      { id: "start", type: "start", label: "Start", position_x: 100, position_y: 100 },
      {
        id: "weather_prompt",
        type: "ai_prompt",
        label: "Get Weather",
        position_x: 300,
        position_y: 100,
        config: { prompt: "Provide a quick weather summary for today.", variable_name: "weather_info" }
      },
      {
        id: "open_browser",
        type: "browser_action",
        label: "Open Mail",
        position_x: 500,
        position_y: 100,
        config: { url: "https://mail.google.com", action: "open" }
      },
      {
        id: "notify",
        type: "notification",
        label: "Alert",
        position_x: 700,
        position_y: 100,
        config: { message: "Morning Routine completed! Weather info: {{weather_info}}" }
      },
      { id: "end", type: "end", label: "End", position_x: 900, position_y: 100 }
    ]),
    edges_data: JSON.stringify([
      { id: "e1", source_node_id: "start", target_node_id: "weather_prompt" },
      { id: "e2", source_node_id: "weather_prompt", target_node_id: "open_browser" },
      { id: "e3", source_node_id: "open_browser", target_node_id: "notify" },
      { id: "e4", source_node_id: "notify", target_node_id: "end" }
    ]),
    variables_data: JSON.stringify([])
  },
  {
    id: "temp_downloads_organizer",
    name: "Downloads Organizer",
    description: "Scan your downloads folder and group files by category (documents, images, archives).",
    nodes_data: JSON.stringify([
      { id: "start", type: "start", label: "Start", position_x: 100, position_y: 100 },
      {
        id: "list_files",
        type: "file_action",
        label: "List Downloads",
        position_x: 300,
        position_y: 100,
        config: { path: "./downloads", action: "list", variable_name: "downloaded_files" }
      },
      { id: "end", type: "end", label: "End", position_x: 500, position_y: 100 }
    ]),
    edges_data: JSON.stringify([
      { id: "e1", source_node_id: "start", target_node_id: "list_files" },
      { id: "e2", source_node_id: "list_files", target_node_id: "end" }
    ]),
    variables_data: JSON.stringify([])
  },
  {
    id: "temp_research_assistant",
    name: "Research Assistant",
    description: "Search the web for a topic and use AI to compile a detailed report.",
    nodes_data: JSON.stringify([
      { id: "start", type: "start", label: "Start", position_x: 100, position_y: 100 },
      {
        id: "search",
        type: "browser_action",
        label: "Web Search",
        position_x: 300,
        position_y: 100,
        config: { action: "search", query: "{{workflow.topic}}", variable_name: "search_results" }
      },
      {
        id: "ai_summary",
        type: "ai_prompt",
        label: "AI Report Builder",
        position_x: 500,
        position_y: 100,
        config: {
          prompt: "Compile a research report on {{workflow.topic}} based on these web search results: {{search_results}}",
          variable_name: "research_report"
        }
      },
      {
        id: "write_file",
        type: "file_action",
        label: "Save Report",
        position_x: 700,
        position_y: 100,
        config: { action: "write", path: "./research_report.txt", content: "{{research_report}}" }
      },
      { id: "end", type: "end", label: "End", position_x: 900, position_y: 100 }
    ]),
    edges_data: JSON.stringify([
      { id: "e1", source_node_id: "start", target_node_id: "search" },
      { id: "e2", source_node_id: "search", target_node_id: "ai_summary" },
      { id: "e3", source_node_id: "ai_summary", target_node_id: "write_file" },
      { id: "e4", source_node_id: "write_file", target_node_id: "end" }
    ]),
    variables_data: JSON.stringify([{ name: "topic", value: "Generative AI Agent Workflows", scope: "workflow" }])
  },
  {
    id: "temp_cybersecurity_log_analysis",
    name: "Cybersecurity Log Analysis",
    description: "Analyze auth log files, find failed logins, and raise critical alerts.",
    nodes_data: JSON.stringify([
      { id: "start", type: "start", label: "Start", position_x: 100, position_y: 100 },
      {
        id: "read_log",
        type: "file_action",
        label: "Read Auth Logs",
        position_x: 300,
        position_y: 100,
        config: { action: "read", path: "./logs/auth.log", variable_name: "auth_log_content" }
      },
      {
        id: "filter_alerts",
        type: "condition",
        label: "Check Suspicious Activity",
        position_x: 500,
        position_y: 100,
        config: {
          logicalOperator: "AND",
          rules: [{ field: "auth_log_content", operator: "contains", value: "failed password" }]
        }
      },
      {
        id: "raise_alert",
        type: "notification",
        label: "Raise Alert",
        position_x: 700,
        position_y: 50,
        config: { message: "CRITICAL: Multiple failed SSH attempts found!" }
      },
      { id: "end", type: "end", label: "End", position_x: 900, position_y: 100 }
    ]),
    edges_data: JSON.stringify([
      { id: "e1", source_node_id: "start", target_node_id: "read_log" },
      { id: "e2", source_node_id: "read_log", target_node_id: "filter_alerts" },
      { id: "e3", source_node_id: "filter_alerts", target_node_id: "raise_alert", source_handle: "true" },
      { id: "e4", source_node_id: "filter_alerts", target_node_id: "end", source_handle: "false" },
      { id: "e5", source_node_id: "raise_alert", target_node_id: "end" }
    ]),
    variables_data: JSON.stringify([])
  },
  {
    id: "temp_github_sync",
    name: "GitHub Sync",
    description: "Pull updates from a target GitHub repository, sync local workspace, and log status.",
    nodes_data: JSON.stringify([
      { id: "start", type: "start", label: "Start", position_x: 100, position_y: 100 },
      {
        id: "pull_repo",
        type: "computer_action",
        label: "Git Pull",
        position_x: 300,
        position_y: 100,
        config: { command: "git pull origin main" }
      },
      { id: "end", type: "end", label: "End", position_x: 500, position_y: 100 }
    ]),
    edges_data: JSON.stringify([
      { id: "e1", source_node_id: "start", target_node_id: "pull_repo" },
      { id: "e2", source_node_id: "pull_repo", target_node_id: "end" }
    ]),
    variables_data: JSON.stringify([])
  },
  {
    id: "temp_daily_backup",
    name: "Daily Backup",
    description: "Archive workspace configurations and upload/compress state databases.",
    nodes_data: JSON.stringify([
      { id: "start", type: "start", label: "Start", position_x: 100, position_y: 100 },
      {
        id: "tar_backup",
        type: "computer_action",
        label: "Compress Workspace",
        position_x: 300,
        position_y: 100,
        config: { command: "tar -czf backup.tar.gz src/" }
      },
      { id: "end", type: "end", label: "End", position_x: 500, position_y: 100 }
    ]),
    edges_data: JSON.stringify([
      { id: "e1", source_node_id: "start", target_node_id: "tar_backup" },
      { id: "e2", source_node_id: "tar_backup", target_node_id: "end" }
    ]),
    variables_data: JSON.stringify([])
  },
  {
    id: "temp_open_work_apps",
    name: "Open Work Apps",
    description: "Launch work tools like Chrome, Slack, or VS Code instantly.",
    nodes_data: JSON.stringify([
      { id: "start", type: "start", label: "Start", position_x: 100, position_y: 100 },
      {
        id: "open_apps",
        type: "computer_action",
        label: "Open Workspace Apps",
        position_x: 300,
        position_y: 100,
        config: { command: "code ." }
      },
      { id: "end", type: "end", label: "End", position_x: 500, position_y: 100 }
    ]),
    edges_data: JSON.stringify([
      { id: "e1", source_node_id: "start", target_node_id: "open_apps" },
      { id: "e2", source_node_id: "open_apps", target_node_id: "end" }
    ]),
    variables_data: JSON.stringify([])
  },
  {
    id: "temp_screenshot_logger",
    name: "Screenshot Logger",
    description: "Simulate capturing desktop state at intervals for visual monitoring.",
    nodes_data: JSON.stringify([
      { id: "start", type: "start", label: "Start", position_x: 100, position_y: 100 },
      {
        id: "screenshot",
        type: "computer_action",
        label: "Log Desktop State",
        position_x: 300,
        position_y: 100,
        config: { command: "echo 'Desktop visual state log taken'" }
      },
      { id: "end", type: "end", label: "End", position_x: 500, position_y: 100 }
    ]),
    edges_data: JSON.stringify([
      { id: "e1", source_node_id: "start", target_node_id: "screenshot" },
      { id: "e2", source_node_id: "screenshot", target_node_id: "end" }
    ]),
    variables_data: JSON.stringify([])
  }
];

export const TemplatesService = {
  /**
   * Seeds default templates if none exist in the database.
   */
  async seedTemplates(): Promise<void> {
    try {
      const existing = await dbGet("SELECT COUNT(*) as count FROM workflow_templates");
      if (existing && (existing as any).count > 0) {
        return; // already seeded
      }

      for (const t of DEFAULT_TEMPLATES) {
        await dbRun(
          `INSERT INTO workflow_templates (id, name, description, nodes_data, edges_data, variables_data, is_system, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
          [t.id, t.name, t.description, t.nodes_data, t.edges_data, t.variables_data, new Date().toISOString()]
        );
      }
      console.log("Pre-built workflow templates seeded successfully.");
    } catch (err) {
      console.error("Error seeding templates:", err);
    }
  },

  /**
   * Returns all system and user templates.
   */
  async getTemplates(): Promise<any[]> {
    return await dbAll("SELECT * FROM workflow_templates");
  }
};
