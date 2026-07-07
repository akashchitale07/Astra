import sqlite3 from "sqlite3";
import path from "path";
import fs from "fs";

// Parse DATABASE_URL from process.env, defaulting to sqlite:///./astra.db
const dbUrl = process.env.DATABASE_URL || "sqlite:///./astra.db";
let dbPath = "astra.db";

if (dbUrl.startsWith("sqlite:///")) {
  dbPath = dbUrl.replace("sqlite:///", "");
} else if (dbUrl.startsWith("sqlite://")) {
  dbPath = dbUrl.replace("sqlite://", "");
}

// Ensure the directory for the DB exists
const fullDbPath = path.resolve(process.cwd(), dbPath);
const dbDir = path.dirname(fullDbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

console.log(`Connecting to SQLite database at: ${fullDbPath}`);

const db = new sqlite3.Database(fullDbPath);

// Promisified helper methods for DB operations
export function dbRun(sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        console.error(`DB Run Error: ${err.message} | SQL: ${sql} | Params:`, params);
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
}

export function dbGet<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        console.error(`DB Get Error: ${err.message} | SQL: ${sql} | Params:`, params);
        reject(err);
      } else {
        resolve((row as T) || null);
      }
    });
  });
}

export function dbAll<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error(`DB All Error: ${err.message} | SQL: ${sql} | Params:`, params);
        reject(err);
      } else {
        resolve((rows as T[]) || []);
      }
    });
  });
}

// Database initialization
export async function initDatabase(): Promise<void> {
  // Create User table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      hashed_password TEXT NOT NULL,
      display_name TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  // Create Conversation table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);

  // Create Message table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE
    )
  `);

  // Create UserSettings table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS user_settings (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL,
      encrypted_api_key TEXT,
      api_key_masked TEXT,
      theme TEXT NOT NULL DEFAULT 'dark',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);

  // Create UploadedFile table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS uploaded_files (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      conversation_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      content_type TEXT NOT NULL,
      file_path TEXT NOT NULL,
      extracted_text TEXT,
      extraction_status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE
    )
  `);

  // Phase 3 Memory Tables: Create memory_items table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS memory_items (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      source TEXT NOT NULL,
      importance TEXT NOT NULL,
      tags TEXT, -- JSON string array
      pinned INTEGER NOT NULL DEFAULT 0,
      archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_used_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);

  // Safe helper to run migrations (add columns)
  const addColumnSafe = async (table: string, column: string, typeAndConstraint: string) => {
    try {
      await dbRun(`ALTER TABLE ${table} ADD COLUMN ${column} ${typeAndConstraint}`);
      console.log(`Successfully added column ${column} to table ${table}.`);
    } catch (err: any) {
      if (err.message.includes("duplicate column name") || err.message.includes("already exists")) {
        // Safe to ignore if column already exists
      } else {
        console.error(`Error adding column ${column} to ${table}:`, err.message);
      }
    }
  };

  // Add new columns to memory_items
  await addColumnSafe("memory_items", "confidence_score", "INTEGER NOT NULL DEFAULT 100");
  await addColumnSafe("memory_items", "expires_at", "TEXT");
  await addColumnSafe("memory_items", "expiration_enabled", "INTEGER NOT NULL DEFAULT 0");
  await addColumnSafe("memory_items", "parent_id", "TEXT");
  await addColumnSafe("memory_items", "times_recalled", "INTEGER NOT NULL DEFAULT 0");
  await addColumnSafe("memory_items", "last_recalled", "TEXT");
  await addColumnSafe("memory_items", "average_retrieval_rank", "REAL NOT NULL DEFAULT 0.0");
  await addColumnSafe("memory_items", "retrieval_success", "INTEGER NOT NULL DEFAULT 0");
  await addColumnSafe("memory_items", "last_retrieved_at", "TEXT");
  await addColumnSafe("memory_items", "last_edited_at", "TEXT");
  await addColumnSafe("memory_items", "last_injected_at", "TEXT");
  await addColumnSafe("memory_items", "status", "TEXT NOT NULL DEFAULT 'approved'");
  await addColumnSafe("memory_items", "is_encrypted", "INTEGER NOT NULL DEFAULT 0");

  // Create audit_logs table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      memory_id TEXT,
      details TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);

  // Create performance indexes
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_memory_items_user_id ON memory_items(user_id)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_memory_items_status ON memory_items(status)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_memory_items_parent_id ON memory_items(parent_id)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id)`);

  // Create memory_settings table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS memory_settings (
      user_id TEXT PRIMARY KEY,
      memory_enabled INTEGER NOT NULL DEFAULT 1,
      auto_capture_enabled INTEGER NOT NULL DEFAULT 0,
      memory_injection_enabled INTEGER NOT NULL DEFAULT 1,
      summarize_conversations_enabled INTEGER NOT NULL DEFAULT 1,
      max_memories_in_context INTEGER NOT NULL DEFAULT 8,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);

  // Create conversation_summaries table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS conversation_summaries (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      conversation_id TEXT NOT NULL,
      summary TEXT NOT NULL,
      key_facts TEXT, -- JSON string array
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE
    )
  `);

  // Phase 4 Computer Control Tables
  await dbRun(`
    CREATE TABLE IF NOT EXISTS agent_pairings (
      user_id TEXT NOT NULL,
      token TEXT NOT NULL,
      device_name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_seen_at TEXT,
      PRIMARY KEY (user_id, token),
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS allowed_directories (
      user_id TEXT NOT NULL,
      path TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, path),
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS allowed_apps (
      user_id TEXT NOT NULL,
      app_name TEXT NOT NULL,
      app_path TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, app_name, app_path),
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS action_audit_log (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      target TEXT NOT NULL,
      args TEXT, -- redacted JSON
      status TEXT NOT NULL,
      dry_run INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS computer_control_settings (
      user_id TEXT PRIMARY KEY,
      control_enabled INTEGER NOT NULL DEFAULT 0,
      dry_run_default INTEGER NOT NULL DEFAULT 1,
      require_double_confirm_highrisk INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);

  await dbRun(`CREATE INDEX IF NOT EXISTS idx_action_audit_log_user_id ON action_audit_log(user_id)`);

  // Phase 5 Internet Intelligence Tables
  await dbRun(`
    CREATE TABLE IF NOT EXISTS data_source_settings (
      user_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 0,
      encrypted_api_key TEXT,
      config TEXT, -- JSON string config
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, provider),
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS web_cache (
      id TEXT PRIMARY KEY,
      cache_key TEXT UNIQUE NOT NULL,
      source TEXT,
      content TEXT,
      fetched_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS research_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      query TEXT NOT NULL,
      sources TEXT, -- JSON string array
      summary TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS external_request_log (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);

  await dbRun(`CREATE INDEX IF NOT EXISTS idx_data_source_settings_user ON data_source_settings(user_id)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_web_cache_key ON web_cache(cache_key)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_research_sessions_user ON research_sessions(user_id)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_external_request_log_user ON external_request_log(user_id)`);

  // Phase 5 Workflow Management Tables
  await dbRun(`
    CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      trigger_type TEXT NOT NULL DEFAULT 'manual',
      trigger_config TEXT, -- JSON config
      version INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS workflow_nodes (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      type TEXT NOT NULL,
      label TEXT NOT NULL,
      config TEXT, -- JSON config
      position_x REAL NOT NULL,
      position_y REAL NOT NULL,
      FOREIGN KEY (workflow_id) REFERENCES workflows (id) ON DELETE CASCADE
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS workflow_edges (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      source_node_id TEXT NOT NULL,
      target_node_id TEXT NOT NULL,
      source_handle TEXT,
      target_handle TEXT,
      FOREIGN KEY (workflow_id) REFERENCES workflows (id) ON DELETE CASCADE
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS workflow_variables (
      id TEXT PRIMARY KEY,
      workflow_id TEXT,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      value TEXT,
      type TEXT NOT NULL, -- string, number, boolean, json
      scope TEXT NOT NULL, -- global, workflow, local, system, datetime, ai, temporary
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (workflow_id) REFERENCES workflows (id) ON DELETE CASCADE
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS workflow_runs (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      status TEXT NOT NULL, -- pending, running, completed, failed, paused, cancelled
      current_node_id TEXT,
      variables_state TEXT, -- JSON state snapshot
      started_at TEXT NOT NULL,
      completed_at TEXT,
      duration INTEGER,
      error_message TEXT,
      FOREIGN KEY (workflow_id) REFERENCES workflows (id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS workflow_logs (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      node_id TEXT,
      level TEXT NOT NULL, -- info, warn, error, debug
      message TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (run_id) REFERENCES workflow_runs (id) ON DELETE CASCADE
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS workflow_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      nodes_data TEXT NOT NULL, -- JSON
      edges_data TEXT NOT NULL, -- JSON
      variables_data TEXT, -- JSON
      is_system INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS workflow_schedules (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      schedule_type TEXT NOT NULL, -- once, hourly, daily, weekly, monthly, cron
      schedule_config TEXT NOT NULL, -- JSON
      last_run_at TEXT,
      next_run_at TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      FOREIGN KEY (workflow_id) REFERENCES workflows (id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS workflow_notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      run_id TEXT,
      type TEXT NOT NULL, -- finished, failed, approval_required, in_app, desktop
      message TEXT NOT NULL,
      read_status INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (run_id) REFERENCES workflow_runs (id) ON DELETE CASCADE
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS workflow_versions (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      version_number INTEGER NOT NULL,
      nodes_data TEXT NOT NULL, -- JSON
      edges_data TEXT NOT NULL, -- JSON
      created_at TEXT NOT NULL,
      FOREIGN KEY (workflow_id) REFERENCES workflows (id) ON DELETE CASCADE
    )
  `);

  // Add Workflow specific indexes
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_workflows_user ON workflows(user_id)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow ON workflow_runs(workflow_id)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_workflow_runs_user ON workflow_runs(user_id)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_workflow_logs_run ON workflow_logs(run_id)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_workflow_schedules_workflow ON workflow_schedules(workflow_id)`);

  console.log("Database tables initialized successfully.");
}
