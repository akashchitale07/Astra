const BASE_URL = "/api";

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem("astra_token");
  
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
  };

  // If we are sending JSON data, attach appropriate Content-Type
  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  // Attach authorization bearer token if logged in
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // Session expired or unauthorized, trigger a custom logout event or clean storage
    localStorage.removeItem("astra_token");
    localStorage.removeItem("astra_user");
    // Only reload if we are not already on the login or signup page to avoid infinite redirect loops
    if (!window.location.pathname.includes("/login") && !window.location.pathname.includes("/signup")) {
      window.location.href = "/login?expired=true";
    }
    throw new Error("Session expired. Please log in again.");
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || response.statusText || "Something went wrong");
  }

  return data as T;
}

export const api = {
  get: <T = any>(endpoint: string, options?: RequestInit) =>
    apiRequest<T>(endpoint, { ...options, method: "GET" }),
    
  post: <T = any>(endpoint: string, body?: any, options?: RequestInit) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: "POST",
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
    
  put: <T = any>(endpoint: string, body?: any, options?: RequestInit) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: "PUT",
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
    
  delete: <T = any>(endpoint: string, options?: RequestInit) =>
    apiRequest<T>(endpoint, { ...options, method: "DELETE" }),

  // Phase 3 Memory System Client APIs
  getMemories: (filters?: Record<string, any>) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== "") {
          params.append(key, String(val));
        }
      });
    }
    const queryStr = params.toString() ? `?${params.toString()}` : "";
    return apiRequest<{ memories: any[] }>(`/memory${queryStr}`, { method: "GET" });
  },
  
  getMemory: (id: string) => 
    apiRequest<{ memory: any }>(`/memory/${id}`, { method: "GET" }),
    
  createMemory: (data: any) => 
    apiRequest<{ memory: any }>("/memory", { method: "POST", body: JSON.stringify(data) }),
    
  updateMemory: (id: string, data: any) => 
    apiRequest<{ memory: any; message: string }>(`/memory/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    
  deleteMemory: (id: string) => 
    apiRequest<{ message: string }>(`/memory/${id}`, { method: "DELETE" }),
    
  searchMemories: (query: string, limit?: number) => 
    apiRequest<{ memories: any[] }>("/memory/search", { method: "POST", body: JSON.stringify({ query, limit }) }),
    
  getMemorySettings: () => 
    apiRequest<{ settings: any }>("/memory/settings", { method: "GET" }),
    
  updateMemorySettings: (data: any) => 
    apiRequest<{ settings: any; message: string }>("/memory/settings", { method: "PATCH", body: JSON.stringify(data) }),
    
  summarizeConversation: (conversationId: string) => 
    apiRequest<{ summary: any; suggestions: any[] }>(`/memory/conversations/${conversationId}/summarize`, { method: "POST" }),

  getConversationSuggestions: (conversationId: string) => 
    apiRequest<{ suggestions: any[] }>(`/memory/conversations/${conversationId}/suggestions`, { method: "GET" }),

  importMemories: (memories: any[]) => 
    apiRequest<{ importedCount: number; message: string }>("/memory/import", { method: "POST", body: JSON.stringify({ memories }) }),

  getMemoryAnalytics: () => 
    apiRequest<{ analytics: any }>("/memory/analytics", { method: "GET" }),

  getAuditLogs: () => 
    apiRequest<{ logs: any[] }>("/memory/audit-logs", { method: "GET" }),

  runMemoryMaintenance: () => 
    apiRequest<{ message: string; prunedCount: number; clearedCount: number; mergedCount: number }>("/memory/maintenance", { method: "POST" }),

  bulkUpdateMemories: (ids: string[], updates: any) => 
    apiRequest<{ message: string; updatedCount: number }>("/memory/bulk", { method: "POST", body: JSON.stringify({ ids, updates }) }),
};

