import React, { useState, useEffect } from "react";
import Layout from "../components/Layout.js";
import { MemoryCard } from "../components/MemoryCard.js";
import { MemoryEditor } from "../components/MemoryEditor.js";
import { MemoryFilters } from "../components/MemoryFilters.js";
import { MemorySettings } from "../components/MemorySettings.js";
import { api } from "../api/client.js";
import { MemoryItem, MemorySettings as IMemorySettings } from "../types/index.js";
import {
  Brain,
  Plus,
  Download,
  Upload,
  Sliders,
  Database,
  Search,
  Sparkles,
  Info,
  Loader2,
  AlertCircle,
  HelpCircle,
  BarChart3,
  CheckCircle,
  XCircle,
  Trash2,
  Zap,
  Calendar,
  Clock,
  ChevronRight,
  RefreshCw,
  ShieldAlert,
  ArrowRight,
  Pin,
} from "lucide-react";

interface FilterState {
  searchQuery: string;
  type: string;
  importance: string;
  pinned: string;
  archived: string;
  sortBy: string;
  sortOrder: "ASC" | "DESC";
}

const initialFilters: FilterState = {
  searchQuery: "",
  type: "all",
  importance: "all",
  pinned: "all",
  archived: "false", // Exclude archived by default
  sortBy: "updated_at",
  sortOrder: "DESC",
};

export default function Memory() {
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [pendingMemories, setPendingMemories] = useState<MemoryItem[]>([]);
  const [settings, setSettings] = useState<IMemorySettings | null>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filter & Search states
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [selectedTag, setSelectedTag] = useState<string>("");
  const [availableTags, setAvailableTags] = useState<string[]>([]);

  // Active editor states
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingMemory, setEditingMemory] = useState<MemoryItem | null>(null);

  // Tab View
  const [activeTab, setActiveTab] = useState<"memories" | "review" | "analytics" | "settings">("memories");

  // Selection states for Bulk Actions (Review Center)
  const [selectedPendingIds, setSelectedPendingIds] = useState<string[]>([]);
  const [isMaintenanceRunning, setIsMaintenanceRunning] = useState(false);

  // Fetch all memories and settings
  const fetchAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch settings
      const settingsRes = await api.getMemorySettings();
      if (settingsRes && settingsRes.settings) {
        setSettings(settingsRes.settings);
      }

      // 2. Fetch active memories based on filters
      await fetchMemories();

      // 3. Fetch pending memories for review center
      await fetchPendingMemories();

      // 4. Fetch memory analytics
      await fetchAnalyticsData();
    } catch (err: any) {
      console.error("Error loading memories page data:", err);
      setError(err.message || "Failed to load memories and system configuration.");
    } finally {
      setLoading(false);
    }
  };

  const fetchMemories = async () => {
    try {
      const activeFilters: Record<string, any> = {
        status: "approved"
      };
      
      if (filters.searchQuery) activeFilters.searchQuery = filters.searchQuery;
      if (filters.type !== "all") activeFilters.type = filters.type;
      if (filters.importance !== "all") activeFilters.importance = filters.importance;
      if (filters.pinned !== "all") activeFilters.pinned = filters.pinned;
      if (filters.archived !== "all") activeFilters.archived = filters.archived;
      if (selectedTag) activeFilters.tag = selectedTag;

      activeFilters.sortBy = filters.sortBy;
      activeFilters.sortOrder = filters.sortOrder;

      const res = await api.getMemories(activeFilters);
      if (res && res.memories) {
        setMemories(res.memories);

        // Compute unique available tags across all returned items
        const tags = new Set<string>();
        res.memories.forEach((m) => {
          if (m.tags) m.tags.forEach((t) => tags.add(t));
        });
        setAvailableTags(Array.from(tags));
      }
    } catch (err: any) {
      console.error("Error fetching filtered memories:", err);
      throw err;
    }
  };

  const fetchPendingMemories = async () => {
    try {
      const res = await api.getMemories({ status: "pending" });
      if (res && res.memories) {
        setPendingMemories(res.memories);
      }
    } catch (err) {
      console.error("Error fetching pending memories:", err);
    }
  };

  const fetchAnalyticsData = async () => {
    try {
      const res = await api.getMemoryAnalytics();
      if (res && res.analytics) {
        setAnalytics(res.analytics);
        setAuditLogs(res.analytics.recentActivity || []);
      }
    } catch (err) {
      console.error("Error fetching memory analytics:", err);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Fetch memories again whenever filters or selected tag changes
  useEffect(() => {
    fetchMemories().catch((err) => {
      setError(err.message || "Failed to query memories.");
    });
  }, [filters, selectedTag]);

  // Flash success messages
  const triggerSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  // Handle Creating / Editing a Memory
  const handleSaveMemory = async (data: any) => {
    try {
      if (editingMemory) {
        // Edit Mode
        await api.updateMemory(editingMemory.id, data);
        triggerSuccess(`Memory "${data.title}" updated successfully.`);
      } else {
        // Create Mode
        await api.createMemory({ ...data, status: "approved" });
        triggerSuccess(`Memory "${data.title}" manually stored.`);
      }
      await fetchMemories();
      await fetchAnalyticsData();
    } catch (err: any) {
      console.error("Error storing memory item:", err);
      throw err;
    }
  };

  const handleDeleteMemory = async (id: string) => {
    try {
      await api.deleteMemory(id);
      setMemories(memories.filter((m) => m.id !== id));
      setPendingMemories(pendingMemories.filter((m) => m.id !== id));
      triggerSuccess("Memory permanently deleted.");
      await fetchAnalyticsData();
    } catch (err: any) {
      setError("Failed to delete memory: " + err.message);
    }
  };

  const handleTogglePin = async (id: string, current: boolean) => {
    try {
      await api.updateMemory(id, { pinned: !current });
      setMemories(
        memories.map((m) => (m.id === id ? { ...m, pinned: !current } : m))
      );
      triggerSuccess(!current ? "Memory pinned to context core." : "Memory unpinned.");
      await fetchAnalyticsData();
    } catch (err: any) {
      setError("Failed to update memory pinning: " + err.message);
    }
  };

  const handleToggleArchive = async (id: string, current: boolean) => {
    try {
      await api.updateMemory(id, { archived: !current });
      // If we are currently hiding archived items, filter it out immediately
      if (filters.archived === "false") {
        setMemories(memories.filter((m) => m.id !== id));
      } else {
        setMemories(
          memories.map((m) => (m.id === id ? { ...m, archived: !current } : m))
        );
      }
      triggerSuccess(!current ? "Memory archived." : "Memory unarchived.");
      await fetchAnalyticsData();
    } catch (err: any) {
      setError("Failed to update memory archive status: " + err.message);
    }
  };

  // Review Center Callbacks
  const handleApproveMemory = async (id: string) => {
    try {
      await api.updateMemory(id, { status: "approved" });
      setPendingMemories(pendingMemories.filter((m) => m.id !== id));
      triggerSuccess("Memory suggestion approved and activated.");
      await fetchMemories();
      await fetchAnalyticsData();
    } catch (err: any) {
      setError("Failed to approve memory: " + err.message);
    }
  };

  const handleRejectMemory = async (id: string) => {
    try {
      await api.updateMemory(id, { status: "rejected" });
      setPendingMemories(pendingMemories.filter((m) => m.id !== id));
      triggerSuccess("Memory suggestion rejected and dismissed.");
      await fetchAnalyticsData();
    } catch (err: any) {
      setError("Failed to reject memory: " + err.message);
    }
  };

  // Bulk Actions
  const handleSelectPending = (id: string) => {
    if (selectedPendingIds.includes(id)) {
      setSelectedPendingIds(selectedPendingIds.filter((x) => x !== id));
    } else {
      setSelectedPendingIds([...selectedPendingIds, id]);
    }
  };

  const handleSelectAllPending = () => {
    if (selectedPendingIds.length === pendingMemories.length) {
      setSelectedPendingIds([]);
    } else {
      setSelectedPendingIds(pendingMemories.map((m) => m.id));
    }
  };

  const handleBulkApprove = async () => {
    if (selectedPendingIds.length === 0) return;
    try {
      await api.bulkUpdateMemories(selectedPendingIds, { status: "approved" });
      triggerSuccess(`Successfully approved ${selectedPendingIds.length} memories.`);
      setSelectedPendingIds([]);
      await fetchPendingMemories();
      await fetchMemories();
      await fetchAnalyticsData();
    } catch (err: any) {
      setError("Bulk approve failed: " + err.message);
    }
  };

  const handleBulkReject = async () => {
    if (selectedPendingIds.length === 0) return;
    try {
      await api.bulkUpdateMemories(selectedPendingIds, { status: "rejected" });
      triggerSuccess(`Successfully rejected ${selectedPendingIds.length} memories.`);
      setSelectedPendingIds([]);
      await fetchPendingMemories();
      await fetchAnalyticsData();
    } catch (err: any) {
      setError("Bulk reject failed: " + err.message);
    }
  };

  // Manual Garbage Collection
  const handleRunGarbageCollection = async () => {
    setIsMaintenanceRunning(true);
    setError(null);
    try {
      const res = await api.runMemoryMaintenance();
      triggerSuccess(
        `Garbage Collection Completed! Pruned ${res.prunedCount} expired, dismissed ${res.clearedCount} rejected, and merged ${res.mergedCount} duplicate memories.`
      );
      await fetchAllData();
    } catch (err: any) {
      setError("Garbage collection failed: " + err.message);
    } finally {
      setIsMaintenanceRunning(false);
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch("/api/memory/export", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("astra_token")}`,
        },
      });
      if (!response.ok) throw new Error("Export request failed");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `astra-memories-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setError("Failed to export memories: " + err.message);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        const res = await api.importMemories(json);
        triggerSuccess(res.message);
        await fetchAllData();
      } catch (err: any) {
        setError("Import failed: " + (err.message || "Invalid JSON structure. Please upload a valid Astra backup file."));
      } finally {
        e.target.value = ""; // Reset input
      }
    };
    reader.readAsText(file);
  };

  const handleOpenCreate = () => {
    setEditingMemory(null);
    setIsEditorOpen(true);
  };

  const handleOpenEdit = (mem: MemoryItem) => {
    setEditingMemory(mem);
    setIsEditorOpen(true);
  };

  const handleClearFilters = () => {
    setFilters(initialFilters);
    setSelectedTag("");
  };

  return (
    <Layout>
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-8 space-y-6 animate-fade-in">
        {/* Header Title section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800/50 pb-5">
          <div>
            <h1 className="font-sans text-2xl font-extrabold tracking-tight md:text-3xl flex items-center gap-2.5 text-zinc-900 dark:text-zinc-100">
              <Brain className="h-7 w-7 text-cyan-400" />
              <span>Astra Memory Vault</span>
              <span className="text-xs font-bold uppercase px-2 py-0.5 rounded bg-cyan-950/40 border border-cyan-800/20 text-cyan-400">
                Enterprise v3.0
              </span>
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Configure, optimize, audit, and review your assistant's long-term memory.
            </p>
          </div>

          {/* Quick Action Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Export */}
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
              title="Download memories as JSON backup"
              aria-label="Export memories"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export</span>
            </button>

            {/* Import */}
            <label className="flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors cursor-pointer">
              <Upload className="h-3.5 w-3.5" />
              <span>Import</span>
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
                aria-label="Import memories JSON backup"
              />
            </label>

            {/* Run GC button */}
            <button
              onClick={handleRunGarbageCollection}
              disabled={isMaintenanceRunning}
              className="flex items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-950/10 text-amber-400 px-3 py-2 text-xs font-semibold hover:bg-amber-950/20 transition-all disabled:opacity-50"
              title="Run garbage collection & memory deduplication"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isMaintenanceRunning ? "animate-spin" : ""}`} />
              <span>Optimize Matrix</span>
            </button>

            {/* Create memory */}
            <button
              onClick={handleOpenCreate}
              className="flex items-center gap-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-cyan-950/20 transition-all active:scale-98"
              aria-label="Create memory"
            >
              <Plus className="h-4 w-4" />
              <span>Add Fact</span>
            </button>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex flex-wrap border-b border-zinc-200 dark:border-zinc-800/80 gap-1 sm:gap-2">
          <button
            onClick={() => setActiveTab("memories")}
            className={`px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === "memories"
                ? "border-cyan-500 text-cyan-400 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            <Database className="h-3.5 w-3.5" />
            <span>Memories Database ({memories.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("review")}
            className={`px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-1.5 relative ${
              activeTab === "review"
                ? "border-cyan-500 text-cyan-400 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Review Center</span>
            {pendingMemories.length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white ring-2 ring-slate-950 animate-pulse">
                {pendingMemories.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("analytics")}
            className={`px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === "analytics"
                ? "border-cyan-500 text-cyan-400 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            <span>Analytics & Logs</span>
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === "settings"
                ? "border-cyan-500 text-cyan-400 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            <Sliders className="h-3.5 w-3.5" />
            <span>Engine Config</span>
          </button>
        </div>

        {/* Success notification banner */}
        {successMessage && (
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 flex items-center gap-2.5 text-xs text-emerald-400 animate-fade-in">
            <CheckCircle className="h-4.5 w-4.5 shrink-0 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Error notification banner */}
        {error && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 flex items-center gap-2.5 text-xs text-red-500 animate-fade-in">
            <AlertCircle className="h-4.5 w-4.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Loading overlay spinner */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-500 mb-3" />
            <p className="text-sm font-medium">Synchronizing memory matrix...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* 1. MEMORIES TAB */}
            {activeTab === "memories" && (
              <>
                <MemoryFilters
                  filters={filters}
                  onChange={(updates) => setFilters({ ...filters, ...updates })}
                  onClear={handleClearFilters}
                  availableTags={availableTags}
                  selectedTag={selectedTag}
                  onSelectTag={setSelectedTag}
                />

                {memories.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/20 py-16 px-4 text-center">
                    <Database className="mx-auto h-12 w-12 text-slate-700 mb-4" />
                    <h3 className="text-md font-semibold text-slate-300">No stored memories found</h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
                      Try relaxing your filter parameters, searching with another query, or manually store a new preference or factual reference.
                    </p>
                    <button
                      onClick={handleOpenCreate}
                      className="mt-4 inline-flex items-center gap-1 rounded bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-800 transition-all"
                    >
                      <Plus className="h-3.5 w-3.5 text-cyan-400" />
                      Add first memory item
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {memories.map((mem) => (
                      <MemoryCard
                        key={mem.id}
                        memory={mem}
                        onEdit={handleOpenEdit}
                        onDelete={handleDeleteMemory}
                        onTogglePin={handleTogglePin}
                        onToggleArchive={handleToggleArchive}
                      />
                    ))}
                  </div>
                )}
              </>
            )}

            {/* 2. REVIEW CENTER TAB */}
            {activeTab === "review" && (
              <div className="space-y-6">
                <div className="rounded-xl border border-amber-500/20 bg-amber-950/5 p-5 text-sm">
                  <div className="flex gap-3">
                    <Sparkles className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-slate-200">Interactive Memory Review Center</h4>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        Astra's real-time conversation summarization engine automatically extracts prospective preferences, project constraints, and facts in the background. Here you can inspect, edit, approve, or reject these suggestions before they are committed to active context retrieval.
                      </p>
                    </div>
                  </div>
                </div>

                {pendingMemories.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/10 py-16 px-4 text-center">
                    <CheckCircle className="mx-auto h-12 w-12 text-emerald-500 mb-4" />
                    <h3 className="text-md font-semibold text-slate-300">Review matrix is empty</h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
                      All AI-suggested memories have been verified. Chat summaries and inline conversation extraction will automatically add new suggestions here as you converse with Astra.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Bulk controls bar */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-950/80 border border-slate-900 rounded-xl p-4">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedPendingIds.length === pendingMemories.length && pendingMemories.length > 0}
                          onChange={handleSelectAllPending}
                          className="h-4 w-4 rounded border-slate-800 bg-slate-950 text-cyan-500 focus:ring-cyan-500 accent-cyan-500 cursor-pointer"
                        />
                        <span className="text-xs font-semibold text-slate-300">
                          {selectedPendingIds.length} of {pendingMemories.length} suggestions selected
                        </span>
                      </div>

                      <div className="flex items-center gap-2 self-stretch sm:self-auto">
                        <button
                          onClick={handleBulkApprove}
                          disabled={selectedPendingIds.length === 0}
                          className="flex-1 sm:flex-none flex items-center justify-center gap-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 rounded px-3 py-1.5 text-xs font-bold text-white transition-colors"
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                          <span>Approve Selected</span>
                        </button>
                        <button
                          onClick={handleBulkReject}
                          disabled={selectedPendingIds.length === 0}
                          className="flex-1 sm:flex-none flex items-center justify-center gap-1 bg-rose-950/50 hover:bg-rose-900/30 disabled:opacity-40 border border-rose-500/20 rounded px-3 py-1.5 text-xs font-bold text-rose-300 transition-colors"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          <span>Reject Selected</span>
                        </button>
                      </div>
                    </div>

                    {/* Pending list */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {pendingMemories.map((mem) => (
                        <div key={mem.id} className="relative group">
                          {/* Selection Checkbox overlay */}
                          <div className="absolute top-4 left-4 z-10">
                            <input
                              type="checkbox"
                              checked={selectedPendingIds.includes(mem.id)}
                              onChange={() => handleSelectPending(mem.id)}
                              className="h-4.5 w-4.5 rounded-md border-slate-700 bg-slate-950 text-cyan-500 focus:ring-cyan-500 accent-cyan-500 cursor-pointer shadow-lg shadow-black/40 group-hover:border-cyan-500/50"
                            />
                          </div>

                          <div className="pl-6 h-full">
                            <MemoryCard
                              memory={mem}
                              onEdit={handleOpenEdit}
                              onDelete={handleDeleteMemory}
                              onTogglePin={handleTogglePin}
                              onToggleArchive={handleToggleArchive}
                              onApprove={handleApproveMemory}
                              onReject={handleRejectMemory}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 3. ANALYTICS & LOGS TAB */}
            {activeTab === "analytics" && (
              <div className="space-y-6">
                {/* Stats Summary Bento Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Total */}
                  <div className="rounded-2xl border border-slate-900 bg-slate-950/40 p-5 backdrop-blur-sm flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Database Size</span>
                      <h3 className="text-3xl font-extrabold text-slate-100 mt-1">{analytics?.totalCount || 0}</h3>
                    </div>
                    <span className="text-slate-500 text-[10px] mt-4 flex items-center gap-1">
                      <Database className="h-3 w-3 text-cyan-400" />
                      Active memory blocks
                    </span>
                  </div>

                  {/* Pinned */}
                  <div className="rounded-2xl border border-slate-900 bg-slate-950/40 p-5 backdrop-blur-sm flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Pinned Contexts</span>
                      <h3 className="text-3xl font-extrabold text-cyan-400 mt-1">{analytics?.pinnedCount || 0}</h3>
                    </div>
                    <span className="text-slate-500 text-[10px] mt-4 flex items-center gap-1">
                      <Pin className="h-3 w-3 text-cyan-400" fill="currentColor" />
                      Core priority overrides
                    </span>
                  </div>

                  {/* Pending Suggestions */}
                  <div className="rounded-2xl border border-slate-900 bg-slate-950/40 p-5 backdrop-blur-sm flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Review Backlog</span>
                      <h3 className="text-3xl font-extrabold text-amber-400 mt-1">{pendingMemories.length}</h3>
                    </div>
                    <span className="text-slate-500 text-[10px] mt-4 flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-amber-400" />
                      AI generated suggestions
                    </span>
                  </div>

                  {/* Expired count */}
                  <div className="rounded-2xl border border-slate-900 bg-slate-950/40 p-5 backdrop-blur-sm flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Expired Items</span>
                      <h3 className="text-3xl font-extrabold text-rose-400 mt-1">{analytics?.expiredCount || 0}</h3>
                    </div>
                    <span className="text-slate-500 text-[10px] mt-4 flex items-center gap-1">
                      <Clock className="h-3 w-3 text-rose-400" />
                      Awaiting GC sweep
                    </span>
                  </div>
                </div>

                {/* Categories & Recalls bento panel */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Category Ratio Chart (Tailwind customized progress bars) */}
                  <div className="rounded-2xl border border-slate-900 bg-slate-950/30 p-6 backdrop-blur-sm">
                    <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-5 flex items-center gap-2">
                      <BarChart3 className="h-4.5 w-4.5 text-cyan-400" />
                      Category Matrix Distribution
                    </h3>

                    <div className="space-y-4">
                      {analytics?.categoryCounts && Object.entries(analytics.categoryCounts).map(([type, count]: [string, any]) => {
                        const maxCount = Math.max(...Object.values(analytics.categoryCounts) as number[]) || 1;
                        const percentage = Math.round((count / (analytics.totalCount || 1)) * 100) || 0;
                        const widthPct = Math.round((count / maxCount) * 100);

                        const colorClasses: Record<string, string> = {
                          preference: "bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.4)]",
                          personal_fact: "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)]",
                          project: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]",
                          instruction: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]",
                          note: "bg-slate-400 shadow-[0_0_8px_rgba(148,163,184,0.4)]",
                          custom_command: "bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.4)]",
                          conversation_summary: "bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.4)]",
                        };

                        const nameLabels: Record<string, string> = {
                          preference: "User Preferences",
                          personal_fact: "Personal Facts",
                          project: "Project Specs & Stack",
                          instruction: "System Guidelines",
                          note: "Personal Notes",
                          custom_command: "Shortcuts / Commands",
                          conversation_summary: "Chat Summaries",
                        };

                        return (
                          <div key={type} className="space-y-1.5">
                            <div className="flex justify-between text-xs font-semibold">
                              <span className="text-slate-300">{nameLabels[type] || type}</span>
                              <span className="text-slate-500">
                                {count} {count === 1 ? "block" : "blocks"}{" "}
                                <span className="text-cyan-400 ml-1">({percentage}%)</span>
                              </span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-slate-900 overflow-hidden border border-slate-800/40">
                              <div
                                style={{ width: `${widthPct}%` }}
                                className={`h-full rounded-full transition-all duration-1000 ${colorClasses[type] || "bg-slate-500"}`}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Leaderboard: Recalled Items */}
                  <div className="rounded-2xl border border-slate-900 bg-slate-950/30 p-6 backdrop-blur-sm flex flex-col justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Zap className="h-4.5 w-4.5 text-cyan-400 animate-pulse" />
                        Recall Hot Matrix (Top Retrieved)
                      </h3>

                      {analytics?.mostRetrieved && analytics.mostRetrieved.length === 0 ? (
                        <p className="text-xs text-slate-500 text-center py-12">
                          No memory recalls have been recorded yet. Recall stats automatically accumulate when Astra retrieves relevant facts during chat completion loops.
                        </p>
                      ) : (
                        <div className="divide-y divide-slate-900/60">
                          {analytics?.mostRetrieved?.map((item: MemoryItem, index: number) => (
                            <div key={item.id} className="py-3 flex items-center justify-between">
                              <div className="flex items-center gap-3 min-w-0 pr-4">
                                <span className="font-mono text-xs font-bold text-slate-600 bg-slate-900/80 px-1.5 py-0.5 border border-slate-800/60 rounded">
                                  #{index + 1}
                                </span>
                                <div className="min-w-0">
                                  <h4 className="text-xs font-semibold text-slate-200 truncate">{item.title}</h4>
                                  <span className="text-[10px] text-slate-500 font-medium">Confidence: {item.confidence_score}%</span>
                                </div>
                              </div>
                              <span className="text-xs font-bold text-cyan-400 bg-cyan-950/30 border border-cyan-800/20 px-2.5 py-0.5 rounded-full whitespace-nowrap">
                                Recalled {item.times_recalled}x
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="border-t border-slate-900 pt-4 mt-4 flex justify-between items-center text-[11px] text-slate-500">
                      <span>Tracks AI interaction context queries</span>
                      <button
                        onClick={handleRunGarbageCollection}
                        className="text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 transition-all"
                      >
                        Optimize indexes <ChevronRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Activity log vertical timeline */}
                <div className="rounded-2xl border border-slate-900 bg-slate-950/30 p-6 backdrop-blur-sm">
                  <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-6 flex items-center gap-2">
                    <Clock className="h-4.5 w-4.5 text-cyan-400" />
                    Security & Memory Audit Trail
                  </h3>

                  {auditLogs.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-12">
                      No system memory audit records found.
                    </p>
                  ) : (
                    <div className="space-y-6 relative before:absolute before:inset-y-0 before:left-3.5 before:w-[1px] before:bg-slate-900">
                      {auditLogs.map((log) => {
                        const logDate = new Date(log.created_at).toLocaleTimeString(undefined, {
                          hour: "numeric",
                          minute: "2-digit",
                          second: "2-digit",
                        });
                        const logDay = new Date(log.created_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        });

                        return (
                          <div key={log.id} className="relative flex items-start gap-4 pl-1 animate-fade-in">
                            {/* Dot icon */}
                            <div className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-950 border border-slate-800 shadow-md">
                              <span className={`h-2.5 w-2.5 rounded-full ${
                                log.action === "Create" ? "bg-emerald-400 shadow-[0_0_6px_#34d399]" :
                                log.action === "Delete" ? "bg-rose-400 shadow-[0_0_6px_#f87171]" :
                                log.action === "Recall" ? "bg-cyan-400 shadow-[0_0_6px_#22d3ee]" : "bg-amber-400 shadow-[0_0_6px_#fbbf24]"
                              }`} />
                            </div>

                            {/* Content */}
                            <div className="flex-1 bg-slate-950/50 border border-slate-900/60 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-slate-200">Action: {log.action}</span>
                                  <span className="text-[10px] font-semibold text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded uppercase border border-slate-800/40">
                                    System
                                  </span>
                                </div>
                                <p className="text-xs text-slate-400 mt-1 font-mono break-all">{log.details}</p>
                              </div>

                              <span className="text-[10px] font-semibold text-slate-500 bg-slate-950 border border-slate-900 rounded px-2 py-1 flex items-center gap-1.5 self-start sm:self-auto whitespace-nowrap">
                                <Calendar className="h-3 w-3" />
                                {logDay} {logDate}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 4. SETTINGS TAB */}
            {activeTab === "settings" && (
              <div className="max-w-3xl">
                <MemorySettings
                  settings={settings}
                  onUpdate={(updatedSettings) => setSettings(updatedSettings)}
                />
              </div>
            )}
          </div>
        )}

        {/* Memory Editor overlay */}
        {isEditorOpen && (
          <MemoryEditor
            memory={editingMemory}
            onSave={handleSaveMemory}
            onClose={() => setIsEditorOpen(false)}
          />
        )}
      </div>
    </Layout>
  );
}
