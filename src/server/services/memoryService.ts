import crypto from "crypto";
import { dbGet, dbRun, dbAll } from "../db.js";
import { MemoryItem, MemorySettings, MemoryType, MemoryImportance, MemorySource } from "../../types/index.js";

// Helper to format tags: lowercase, trimmed, unique, max 20 tags, each max 40 chars
export function formatAndValidateTags(tagsInput: any): string[] {
  if (!Array.isArray(tagsInput)) {
    return [];
  }
  const formatted = tagsInput
    .map((tag) => String(tag).trim().toLowerCase())
    .filter((tag) => tag.length > 0 && tag.length <= 40);
  
  // Make unique and limit to 20 tags
  const uniqueTags = Array.from(new Set(formatted));
  return uniqueTags.slice(0, 20);
}

// Ensure Memory Settings Exist
export async function getOrCreateMemorySettings(userId: string): Promise<MemorySettings> {
  const row = await dbGet("SELECT * FROM memory_settings WHERE user_id = ?", [userId]);
  const now = new Date().toISOString();

  if (!row) {
    // Create defaults
    await dbRun(
      `INSERT INTO memory_settings (
        user_id, memory_enabled, auto_capture_enabled, memory_injection_enabled, 
        summarize_conversations_enabled, max_memories_in_context, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, 1, 0, 1, 1, 8, now, now]
    );

    return {
      user_id: userId,
      memory_enabled: true,
      auto_capture_enabled: false,
      memory_injection_enabled: true,
      summarize_conversations_enabled: true,
      max_memories_in_context: 8,
      created_at: now,
      updated_at: now,
    };
  }

  return {
    user_id: row.user_id,
    memory_enabled: Boolean(row.memory_enabled),
    auto_capture_enabled: Boolean(row.auto_capture_enabled),
    memory_injection_enabled: Boolean(row.memory_injection_enabled),
    summarize_conversations_enabled: Boolean(row.summarize_conversations_enabled),
    max_memories_in_context: row.max_memories_in_context,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// Update Memory Settings
export async function updateMemorySettings(
  userId: string,
  updates: Partial<Omit<MemorySettings, "user_id" | "created_at" | "updated_at">>
): Promise<MemorySettings> {
  // Ensure default exists first
  await getOrCreateMemorySettings(userId);

  const now = new Date().toISOString();
  
  // Fetch current
  const current = await dbGet("SELECT * FROM memory_settings WHERE user_id = ?", [userId]);

  const memory_enabled = updates.memory_enabled !== undefined ? (updates.memory_enabled ? 1 : 0) : current.memory_enabled;
  const auto_capture_enabled = updates.auto_capture_enabled !== undefined ? (updates.auto_capture_enabled ? 1 : 0) : current.auto_capture_enabled;
  const memory_injection_enabled = updates.memory_injection_enabled !== undefined ? (updates.memory_injection_enabled ? 1 : 0) : current.memory_injection_enabled;
  const summarize_conversations_enabled = updates.summarize_conversations_enabled !== undefined ? (updates.summarize_conversations_enabled ? 1 : 0) : current.summarize_conversations_enabled;
  
  let max_memories_in_context = current.max_memories_in_context;
  if (updates.max_memories_in_context !== undefined) {
    max_memories_in_context = Math.min(20, Math.max(1, updates.max_memories_in_context));
  }

  await dbRun(
    `UPDATE memory_settings 
     SET memory_enabled = ?, auto_capture_enabled = ?, memory_injection_enabled = ?, 
         summarize_conversations_enabled = ?, max_memories_in_context = ?, updated_at = ?
     WHERE user_id = ?`,
    [
      memory_enabled,
      auto_capture_enabled,
      memory_injection_enabled,
      summarize_conversations_enabled,
      max_memories_in_context,
      now,
      userId,
    ]
  );

  console.log(`[Dev Log] Memory settings updated for user ${userId}`);

  return {
    user_id: userId,
    memory_enabled: Boolean(memory_enabled),
    auto_capture_enabled: Boolean(auto_capture_enabled),
    memory_injection_enabled: Boolean(memory_injection_enabled),
    summarize_conversations_enabled: Boolean(summarize_conversations_enabled),
    max_memories_in_context,
    created_at: current.created_at,
    updated_at: now,
  };
}

// Enterprise Encryption Utilities
const ENCRYPTION_KEY = process.env.MEMORY_ENCRYPTION_KEY || "astra-enterprise-memory-secure-key-32"; // 32 chars
const IV_LENGTH = 16;

export function encryptContent(text: string): string {
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = crypto.createHash("sha256").update(ENCRYPTION_KEY).digest();
    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    return iv.toString("hex") + ":" + encrypted;
  } catch (err) {
    console.error("Encryption error:", err);
    return text;
  }
}

export function decryptContent(text: string): string {
  try {
    if (!text.includes(":")) return text;
    const parts = text.split(":");
    const iv = Buffer.from(parts.shift() || "", "hex");
    const encryptedText = parts.join(":");
    const key = crypto.createHash("sha256").update(ENCRYPTION_KEY).digest();
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    console.error("Decryption error:", err);
    return text;
  }
}

// Enterprise Audit Logging
export async function writeAuditLog(
  userId: string,
  action: string,
  memoryId?: string,
  details?: string
): Promise<void> {
  try {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await dbRun(
      `INSERT INTO audit_logs (id, user_id, action, memory_id, details, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, userId, action, memoryId || null, details || null, now]
    );
  } catch (err: any) {
    console.error("Failed to write audit log:", err.message);
  }
}

// Helper to convert DB memory row to MemoryItem interface
export function dbRowToMemoryItem(row: any): MemoryItem {
  let tags: string[] = [];
  try {
    tags = JSON.parse(row.tags || "[]");
  } catch (e) {
    tags = [];
  }

  // Decrypt content if it was encrypted
  let decryptedContent = row.content;
  if (Boolean(row.is_encrypted) && row.content) {
    decryptedContent = decryptContent(row.content);
  }

  return {
    id: row.id,
    user_id: row.user_id,
    type: row.type as MemoryType,
    title: row.title,
    content: decryptedContent,
    source: row.source as MemorySource,
    importance: row.importance as MemoryImportance,
    tags,
    pinned: Boolean(row.pinned),
    archived: Boolean(row.archived),
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_used_at: row.last_used_at || undefined,
    
    // Enterprise Extensions
    confidence_score: row.confidence_score !== undefined ? row.confidence_score : 100,
    expires_at: row.expires_at || undefined,
    expiration_enabled: Boolean(row.expiration_enabled),
    parent_id: row.parent_id || undefined,
    times_recalled: row.times_recalled !== undefined ? row.times_recalled : 0,
    last_recalled: row.last_recalled || undefined,
    average_retrieval_rank: row.average_retrieval_rank !== undefined ? row.average_retrieval_rank : 0.0,
    retrieval_success: row.retrieval_success !== undefined ? row.retrieval_success : 0,
    last_retrieved_at: row.last_retrieved_at || undefined,
    last_edited_at: row.last_edited_at || undefined,
    last_injected_at: row.last_injected_at || undefined,
    status: (row.status || "approved") as any,
    is_encrypted: Boolean(row.is_encrypted),
  };
}

// Create a Memory Item
export async function createMemory(
  userId: string,
  data: {
    type: MemoryType;
    title: string;
    content: string;
    source?: MemorySource;
    importance?: MemoryImportance;
    tags?: string[];
    pinned?: boolean;
    archived?: boolean;
    
    // Enterprise Extensions
    confidence_score?: number;
    expires_at?: string;
    expiration_enabled?: boolean;
    parent_id?: string;
    status?: "pending" | "approved" | "rejected";
    is_encrypted?: boolean;
  }
): Promise<MemoryItem> {
  // Validations
  if (!data.title || data.title.trim().length === 0) {
    throw new Error("Memory title is required");
  }
  if (data.title.length > 120) {
    throw new Error("Memory title cannot exceed 120 characters");
  }
  if (!data.content || data.content.trim().length === 0) {
    throw new Error("Memory content is required");
  }
  if (data.content.length > 5000) {
    throw new Error("Memory content cannot exceed 5000 characters");
  }

  const validTypes: MemoryType[] = [
    "preference",
    "personal_fact",
    "project",
    "instruction",
    "note",
    "custom_command",
    "conversation_summary",
  ];
  if (!validTypes.includes(data.type)) {
    throw new Error(`Invalid memory type: ${data.type}`);
  }

  const importance: MemoryImportance = data.importance || "medium";
  const validImportance: MemoryImportance[] = ["low", "medium", "high"];
  if (!validImportance.includes(importance)) {
    throw new Error(`Invalid importance: ${importance}`);
  }

  const source: MemorySource = data.source || "manual";
  
  // Set dynamic confidence defaults based on source if not provided
  let confidence_score = data.confidence_score;
  if (confidence_score === undefined) {
    if (source === "manual") confidence_score = 100;
    else if (source === "summary") confidence_score = 70;
    else if (source === "chat") confidence_score = 50;
    else confidence_score = 50;
  }

  // Set default status. High-confidence are approved, low-confidence are pending.
  const status = data.status || (confidence_score >= 70 ? "approved" : "pending");

  // Determine auto-encryption for sensitive items
  const sensitiveKeywords = ["password", "key", "secret", "token", "credential", "config", "private"];
  const isSensitive = sensitiveKeywords.some(keyword => 
    data.title.toLowerCase().includes(keyword) || 
    data.content.toLowerCase().includes(keyword)
  );
  const is_encrypted = data.is_encrypted !== undefined ? data.is_encrypted : isSensitive;

  const tags = formatAndValidateTags(data.tags);
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  const pinned = data.pinned ? 1 : 0;
  const archived = data.archived ? 1 : 0;
  const expiration_enabled = data.expiration_enabled ? 1 : 0;

  // Encrypt content if needed
  const finalContent = is_encrypted ? encryptContent(data.content.trim()) : data.content.trim();

  await dbRun(
    `INSERT INTO memory_items (
      id, user_id, type, title, content, source, importance, tags, pinned, archived, created_at, updated_at,
      confidence_score, expires_at, expiration_enabled, parent_id, status, is_encrypted,
      times_recalled, average_retrieval_rank, retrieval_success
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0.0, 0)`,
    [
      id,
      userId,
      data.type,
      data.title.trim(),
      finalContent,
      source,
      importance,
      JSON.stringify(tags),
      pinned,
      archived,
      now,
      now,
      confidence_score,
      data.expires_at || null,
      expiration_enabled,
      data.parent_id || null,
      status,
      is_encrypted ? 1 : 0,
    ]
  );

  console.log(`[Dev Log] Memory created: ${id} | Title: ${data.title} | User: ${userId}`);

  // Write audit log
  await writeAuditLog(userId, "Created", id, `Memory "${data.title}" created. Confidence: ${confidence_score}, Status: ${status}`);

  return {
    id,
    user_id: userId,
    type: data.type,
    title: data.title.trim(),
    content: data.content.trim(),
    source,
    importance,
    tags,
    pinned: Boolean(pinned),
    archived: Boolean(archived),
    created_at: now,
    updated_at: now,
    confidence_score,
    expires_at: data.expires_at || undefined,
    expiration_enabled: Boolean(expiration_enabled),
    parent_id: data.parent_id || undefined,
    times_recalled: 0,
    last_recalled: undefined,
    average_retrieval_rank: 0.0,
    retrieval_success: 0,
    status,
    is_encrypted,
  };
}

// Update a Memory Item
export async function updateMemory(
  userId: string,
  id: string,
  data: Partial<{
    type: MemoryType;
    title: string;
    content: string;
    importance: MemoryImportance;
    tags: string[];
    pinned: boolean;
    archived: boolean;
    last_used_at: string;
    
    // Enterprise Extensions
    confidence_score: number;
    expires_at: string;
    expiration_enabled: boolean;
    parent_id: string;
    times_recalled: number;
    last_recalled: string;
    average_retrieval_rank: number;
    retrieval_success: number;
    last_retrieved_at: string;
    last_edited_at: string;
    last_injected_at: string;
    status: "pending" | "approved" | "rejected";
    is_encrypted: boolean;
  }>
): Promise<MemoryItem> {
  const existing = await dbGet("SELECT * FROM memory_items WHERE id = ? AND user_id = ?", [id, userId]);
  if (!existing) {
    throw new Error("Memory item not found or unauthorized");
  }

  const now = new Date().toISOString();
  const fieldsToUpdate: string[] = [];
  const params: any[] = [];

  if (data.title !== undefined) {
    if (data.title.trim().length === 0) throw new Error("Title cannot be empty");
    if (data.title.length > 120) throw new Error("Title cannot exceed 120 characters");
    fieldsToUpdate.push("title = ?");
    params.push(data.title.trim());
  }

  // Encrypt content if it is updated and is_encrypted is true
  const currentlyEncrypted = data.is_encrypted !== undefined ? data.is_encrypted : Boolean(existing.is_encrypted);
  if (data.content !== undefined) {
    if (data.content.trim().length === 0) throw new Error("Content cannot be empty");
    if (data.content.length > 5000) throw new Error("Content cannot exceed 5000 characters");
    fieldsToUpdate.push("content = ?");
    const finalContent = currentlyEncrypted ? encryptContent(data.content.trim()) : data.content.trim();
    params.push(finalContent);
  } else if (data.is_encrypted !== undefined && data.is_encrypted !== Boolean(existing.is_encrypted)) {
    // Encryption status changed but content didn't. We decrypt existing content and re-encrypt or vice versa.
    let currentRaw = existing.content;
    if (existing.is_encrypted) {
      currentRaw = decryptContent(existing.content);
    }
    const finalContent = data.is_encrypted ? encryptContent(currentRaw) : currentRaw;
    fieldsToUpdate.push("content = ?");
    params.push(finalContent);
  }

  if (data.is_encrypted !== undefined) {
    fieldsToUpdate.push("is_encrypted = ?");
    params.push(data.is_encrypted ? 1 : 0);
  }

  if (data.type !== undefined) {
    const validTypes: MemoryType[] = [
      "preference",
      "personal_fact",
      "project",
      "instruction",
      "note",
      "custom_command",
      "conversation_summary",
    ];
    if (!validTypes.includes(data.type)) throw new Error(`Invalid type: ${data.type}`);
    fieldsToUpdate.push("type = ?");
    params.push(data.type);
  }

  if (data.importance !== undefined) {
    const validImportance: MemoryImportance[] = ["low", "medium", "high"];
    if (!validImportance.includes(data.importance)) throw new Error(`Invalid importance: ${data.importance}`);
    fieldsToUpdate.push("importance = ?");
    params.push(data.importance);
  }

  if (data.tags !== undefined) {
    const formatted = formatAndValidateTags(data.tags);
    fieldsToUpdate.push("tags = ?");
    params.push(JSON.stringify(formatted));
  }

  if (data.pinned !== undefined) {
    fieldsToUpdate.push("pinned = ?");
    params.push(data.pinned ? 1 : 0);
  }

  if (data.archived !== undefined) {
    fieldsToUpdate.push("archived = ?");
    params.push(data.archived ? 1 : 0);
  }

  if (data.last_used_at !== undefined) {
    fieldsToUpdate.push("last_used_at = ?");
    params.push(data.last_used_at);
  }

  // Enterprise Extensions
  if (data.confidence_score !== undefined) {
    fieldsToUpdate.push("confidence_score = ?");
    params.push(data.confidence_score);
  }

  if (data.expires_at !== undefined) {
    fieldsToUpdate.push("expires_at = ?");
    params.push(data.expires_at || null);
  }

  if (data.expiration_enabled !== undefined) {
    fieldsToUpdate.push("expiration_enabled = ?");
    params.push(data.expiration_enabled ? 1 : 0);
  }

  if (data.parent_id !== undefined) {
    fieldsToUpdate.push("parent_id = ?");
    params.push(data.parent_id || null);
  }

  if (data.times_recalled !== undefined) {
    fieldsToUpdate.push("times_recalled = ?");
    params.push(data.times_recalled);
  }

  if (data.last_recalled !== undefined) {
    fieldsToUpdate.push("last_recalled = ?");
    params.push(data.last_recalled || null);
  }

  if (data.average_retrieval_rank !== undefined) {
    fieldsToUpdate.push("average_retrieval_rank = ?");
    params.push(data.average_retrieval_rank);
  }

  if (data.retrieval_success !== undefined) {
    fieldsToUpdate.push("retrieval_success = ?");
    params.push(data.retrieval_success);
  }

  if (data.last_retrieved_at !== undefined) {
    fieldsToUpdate.push("last_retrieved_at = ?");
    params.push(data.last_retrieved_at || null);
  }

  if (data.last_edited_at !== undefined) {
    fieldsToUpdate.push("last_edited_at = ?");
    params.push(data.last_edited_at || null);
  }

  if (data.last_injected_at !== undefined) {
    fieldsToUpdate.push("last_injected_at = ?");
    params.push(data.last_injected_at || null);
  }

  if (data.status !== undefined) {
    fieldsToUpdate.push("status = ?");
    params.push(data.status);
  }

  if (fieldsToUpdate.length === 0) {
    return dbRowToMemoryItem(existing);
  }

  fieldsToUpdate.push("updated_at = ?");
  params.push(now);

  // Set last_edited_at if visual update occurred
  const isVisualChange = data.title !== undefined || data.content !== undefined || data.importance !== undefined || data.tags !== undefined;
  if (isVisualChange) {
    fieldsToUpdate.push("last_edited_at = ?");
    params.push(now);
  }

  // WHERE criteria params
  params.push(id, userId);

  const query = `UPDATE memory_items SET ${fieldsToUpdate.join(", ")} WHERE id = ? AND user_id = ?`;
  await dbRun(query, params);

  console.log(`[Dev Log] Memory updated: ${id} | User: ${userId}`);

  // Create audit log description based on updates
  const updateDetails: string[] = [];
  if (data.title !== undefined) updateDetails.push(`title`);
  if (data.content !== undefined) updateDetails.push(`content`);
  if (data.pinned !== undefined) updateDetails.push(`pinned=${data.pinned}`);
  if (data.archived !== undefined) updateDetails.push(`archived=${data.archived}`);
  if (data.status !== undefined) updateDetails.push(`status=${data.status}`);
  if (data.is_encrypted !== undefined) updateDetails.push(`encrypted=${data.is_encrypted}`);

  await writeAuditLog(userId, "Edited", id, `Memory updated. Changed: ${updateDetails.join(", ") || "system statistics"}`);

  const updatedRow = await dbGet("SELECT * FROM memory_items WHERE id = ? AND user_id = ?", [id, userId]);
  return dbRowToMemoryItem(updatedRow);
}

// Delete a Memory Item
export async function deleteMemory(userId: string, id: string): Promise<void> {
  const existing = await dbGet("SELECT id, title FROM memory_items WHERE id = ? AND user_id = ?", [id, userId]);
  if (!existing) {
    throw new Error("Memory item not found or unauthorized");
  }

  await dbRun("DELETE FROM memory_items WHERE id = ? AND user_id = ?", [id, userId]);
  console.log(`[Dev Log] Memory deleted: ${id} | User: ${userId}`);

  // Write audit log
  await writeAuditLog(userId, "Deleted", id, `Memory "${existing.title}" deleted.`);
}

// Get Single Memory
export async function getMemory(userId: string, id: string): Promise<MemoryItem> {
  const existing = await dbGet("SELECT * FROM memory_items WHERE id = ? AND user_id = ?", [id, userId]);
  if (!existing) {
    throw new Error("Memory item not found or unauthorized");
  }
  return dbRowToMemoryItem(existing);
}

// Query memories with filter, sorting, pagination
export async function queryMemories(
  userId: string,
  filters: {
    type?: MemoryType;
    tag?: string;
    pinned?: boolean;
    archived?: boolean;
    importance?: MemoryImportance;
    searchQuery?: string;
    status?: "pending" | "approved" | "rejected" | "all";
  },
  options: {
    sortBy?: "updated_at" | "created_at" | "last_used_at" | "importance" | "confidence_score";
    sortOrder?: "ASC" | "DESC";
    limit?: number;
    offset?: number;
  } = {}
): Promise<MemoryItem[]> {
  const selectQuery = "SELECT * FROM memory_items WHERE user_id = ?";
  const params: any[] = [userId];
  const conditions: string[] = [];

  if (filters.type) {
    conditions.push("type = ?");
    params.push(filters.type);
  }

  if (filters.pinned !== undefined) {
    conditions.push("pinned = ?");
    params.push(filters.pinned ? 1 : 0);
  }

  if (filters.archived !== undefined) {
    conditions.push("archived = ?");
    params.push(filters.archived ? 1 : 0);
  }

  if (filters.importance) {
    conditions.push("importance = ?");
    params.push(filters.importance);
  }

  // Handle status filter: default is "approved" only, unless explicitly "all" or specific
  if (filters.status && filters.status !== "all") {
    conditions.push("status = ?");
    params.push(filters.status);
  } else if (!filters.status) {
    // If no status specified, default to showing "approved" memories (backward compatibility)
    conditions.push("status = 'approved'");
  }

  let finalQuery = selectQuery;
  if (conditions.length > 0) {
    finalQuery += " AND " + conditions.join(" AND ");
  }

  const rows = await dbAll(finalQuery, params);
  let items = rows.map(dbRowToMemoryItem);

  // Filter by tag if requested
  if (filters.tag) {
    const searchTag = filters.tag.toLowerCase().trim();
    items = items.filter((item) => item.tags.includes(searchTag));
  }

  // Filter by tag or query search
  if (filters.searchQuery) {
    const q = filters.searchQuery.toLowerCase().trim();
    items = items.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.content.toLowerCase().includes(q) ||
        item.tags.some((t) => t.includes(q))
    );
  }

  // Sorting
  const sortBy = options.sortBy || "updated_at";
  const order = options.sortOrder || "DESC";

  items.sort((a, b) => {
    let comparison = 0;

    if (sortBy === "importance") {
      const weight = { high: 3, medium: 2, low: 1 };
      comparison = weight[a.importance] - weight[b.importance];
    } else if (sortBy === "confidence_score") {
      comparison = a.confidence_score - b.confidence_score;
    } else {
      const valA = a[sortBy] || "";
      const valB = b[sortBy] || "";
      comparison = String(valA).localeCompare(String(valB));
    }

    return order === "DESC" ? -comparison : comparison;
  });

  // Pagination
  const limit = options.limit !== undefined ? options.limit : 1000;
  const offset = options.offset !== undefined ? options.offset : 0;
  
  return items.slice(offset, offset + limit);
}
