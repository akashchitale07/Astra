export interface User {
  id: string;
  email: string;
  display_name: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface UserSettings {
  theme: "dark" | "light";
  api_key_masked: string;
}

export interface UploadedFile {
  fileId: string;
  filename: string;
  contentType: string;
  extractionStatus: "success" | "failed";
  hasText: boolean;
}

export type MemoryType =
  | "preference"
  | "personal_fact"
  | "project"
  | "instruction"
  | "note"
  | "custom_command"
  | "conversation_summary";

export type MemoryImportance = "low" | "medium" | "high";

export type MemorySource = "manual" | "chat" | "summary" | "system";

export interface MemoryItem {
  id: string;
  user_id: string;
  type: MemoryType;
  title: string;
  content: string;
  source: MemorySource;
  importance: MemoryImportance;
  tags: string[];
  pinned: boolean;
  archived: boolean;
  created_at: string;
  updated_at: string;
  last_used_at?: string;
  
  // Enterprise Extensions
  confidence_score: number;
  expires_at?: string;
  expiration_enabled: boolean;
  parent_id?: string;
  times_recalled: number;
  last_recalled?: string;
  average_retrieval_rank: number;
  retrieval_success: number;
  last_retrieved_at?: string;
  last_edited_at?: string;
  last_injected_at?: string;
  status: "pending" | "approved" | "rejected";
  is_encrypted: boolean;
}

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  memory_id?: string;
  details?: string;
  created_at: string;
}

export interface DashboardAnalytics {
  totalCount: number;
  pinnedCount: number;
  archivedCount: number;
  expiredCount: number;
  categoryCounts: Record<string, number>;
  mostRetrieved: MemoryItem[];
  leastRetrieved: MemoryItem[];
  growthData: { date: string; count: number }[];
  recentActivity: AuditLog[];
}

export interface MemorySettings {
  user_id: string;
  memory_enabled: boolean;
  auto_capture_enabled: boolean;
  memory_injection_enabled: boolean;
  summarize_conversations_enabled: boolean;
  max_memories_in_context: number;
  created_at: string;
  updated_at: string;
}

export interface ConversationSummary {
  id: string;
  user_id: string;
  conversation_id: string;
  summary: string;
  key_facts: string[];
  created_at: string;
  updated_at: string;
}

export interface MemorySearchRequest {
  query?: string;
  type?: MemoryType;
  tag?: string;
  pinned?: boolean;
  archived?: boolean;
  importance?: MemoryImportance;
}

export interface MemorySearchResponse {
  memories: MemoryItem[];
}

export interface MemoryImportPreview {
  validCount: number;
  invalidCount: number;
  preview: Partial<MemoryItem>[];
}

// Phase 4 Computer Control
export interface ComputerControlSettings {
  control_enabled: boolean;
  dry_run_default: boolean;
  require_double_confirm_highrisk: boolean;
  created_at: string;
  updated_at: string;
}

export interface AllowedDirectory {
  path: string;
  created_at: string;
}

export interface AllowedApp {
  app_name: string;
  app_path: string;
  created_at: string;
}

export interface PairingInfo {
  device_name: string;
  created_at: string;
  last_seen_at?: string;
  token_masked: string;
  token: string;
}

export interface ActionAuditLog {
  id: string;
  user_id: string;
  action_type: string;
  target: string;
  args?: string; // Redacted JSON string
  status: string;
  dry_run: boolean;
  created_at: string;
}

export interface ComputerActionPayload {
  action: string;
  args: Record<string, any>;
  dry_run: boolean;
  allowed_directories?: string[];
  allowed_apps?: AllowedApp[];
}

