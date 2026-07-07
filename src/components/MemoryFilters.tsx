import React from "react";
import { Search, RotateCcw, Pin, Archive, HelpCircle, ArrowUpDown, Brain } from "lucide-react";
import { MemoryType, MemoryImportance } from "../types/index.js";

interface FilterState {
  searchQuery: string;
  type: string;
  importance: string;
  pinned: string; // "all", "true", "false"
  archived: string; // "all", "true", "false"
  sortBy: string; // "updated_at", "created_at", "last_used_at", "importance"
  sortOrder: "ASC" | "DESC";
}

interface MemoryFiltersProps {
  filters: FilterState;
  onChange: (updates: Partial<FilterState>) => void;
  onClear: () => void;
  availableTags: string[];
  selectedTag: string;
  onSelectTag: (tag: string) => void;
}

const categories: { value: string; label: string }[] = [
  { value: "all", label: "All Categories" },
  { value: "preference", label: "Preferences" },
  { value: "personal_fact", label: "Facts" },
  { value: "project", label: "Projects" },
  { value: "instruction", label: "Rules & Instructions" },
  { value: "note", label: "Notes" },
  { value: "custom_command", label: "Commands" },
  { value: "conversation_summary", label: "Summaries" },
];

export const MemoryFilters: React.FC<MemoryFiltersProps> = ({
  filters,
  onChange,
  onClear,
  availableTags,
  selectedTag,
  onSelectTag,
}) => {
  return (
    <div className="space-y-4 rounded-xl border border-slate-900 bg-slate-950/40 p-4 backdrop-blur-md">
      {/* Row 1: Search and Sort */}
      <div className="flex flex-col md:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="text"
            value={filters.searchQuery}
            onChange={(e) => onChange({ searchQuery: e.target.value })}
            placeholder="Search within stored memories (titles, details, tags)..."
            className="w-full rounded-lg border border-slate-800 bg-slate-950/80 py-2 pl-9 pr-4 text-sm text-slate-100 placeholder-slate-600 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 transition-colors"
            aria-label="Search memories"
          />
        </div>

        {/* Sort controls */}
        <div className="flex items-center gap-2">
          <label htmlFor="sort-by" className="text-xs text-slate-500 whitespace-nowrap">
            Sort by:
          </label>
          <select
            id="sort-by"
            value={filters.sortBy}
            onChange={(e) => onChange({ sortBy: e.target.value })}
            className="rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-300 focus:border-cyan-500/50 focus:outline-none transition-colors"
          >
            <option value="updated_at">Recently Modified</option>
            <option value="created_at">Date Created</option>
            <option value="last_used_at">Last Recalled / Active</option>
            <option value="importance">Importance Level</option>
          </select>

          <button
            onClick={() => onChange({ sortOrder: filters.sortOrder === "ASC" ? "DESC" : "ASC" })}
            className="rounded-lg border border-slate-800 bg-slate-950 p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-900 transition-colors"
            title={`Sort order: ${filters.sortOrder}`}
            aria-label={`Toggle sort order to ${filters.sortOrder === "ASC" ? "descending" : "ascending"}`}
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
          </button>

          <button
            onClick={onClear}
            className="rounded-lg border border-slate-800 bg-slate-950 p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-900 transition-colors flex items-center gap-1.5 text-xs font-medium"
            title="Reset filters"
            aria-label="Reset all filters"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </div>

      {/* Row 2: Category Filters */}
      <div className="border-t border-slate-900/60 pt-3">
        <label className="block text-xs font-medium text-slate-500 mb-2">Filter by Category</label>
        <div className="flex flex-wrap gap-1.5">
          {categories.map((cat) => (
            <button
              key={cat.value}
              onClick={() => onChange({ type: cat.value })}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-all ${
                filters.type === cat.value
                  ? "border-cyan-500/50 bg-cyan-950/20 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.1)]"
                  : "border-slate-900 bg-slate-950/60 text-slate-400 hover:border-slate-800 hover:text-slate-300"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Row 3: Advanced Toggles & Quick states */}
      <div className="flex flex-wrap items-center gap-4 border-t border-slate-900/60 pt-3 text-xs">
        {/* Importance */}
        <div className="flex items-center gap-2">
          <span className="text-slate-500 font-medium">Importance:</span>
          <div className="flex bg-slate-950 rounded-lg p-0.5 border border-slate-900">
            {["all", "high", "medium", "low"].map((imp) => (
              <button
                key={imp}
                onClick={() => onChange({ importance: imp })}
                className={`rounded px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide transition-all ${
                  filters.importance === imp
                    ? "bg-slate-800 text-slate-100"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {imp}
              </button>
            ))}
          </div>
        </div>

        {/* Pinned Pill Filter */}
        <div className="flex items-center gap-2">
          <span className="text-slate-500 font-medium">Status:</span>
          <div className="flex items-center gap-1.5">
            {/* Pinned pill */}
            <button
              onClick={() =>
                onChange({
                  pinned: filters.pinned === "true" ? "all" : "true",
                })
              }
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 border text-[10px] font-semibold transition-all ${
                filters.pinned === "true"
                  ? "border-cyan-500/40 bg-cyan-950/10 text-cyan-400 shadow-[0_0_6px_rgba(6,182,212,0.1)]"
                  : "border-slate-900 bg-slate-950/40 text-slate-500 hover:border-slate-800 hover:text-slate-400"
              }`}
            >
              <Pin className="h-3 w-3" fill={filters.pinned === "true" ? "currentColor" : "none"} />
              Pinned Only
            </button>

            {/* Archive Filter */}
            <button
              onClick={() =>
                onChange({
                  archived: filters.archived === "all" ? "false" : filters.archived === "false" ? "true" : "all",
                })
              }
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 border text-[10px] font-semibold transition-all ${
                filters.archived === "false"
                  ? "border-slate-800 bg-slate-900/40 text-slate-400" // Normal: show active only
                  : filters.archived === "true"
                  ? "border-amber-500/40 bg-amber-950/10 text-amber-400" // Show archived only
                  : "border-slate-900 bg-slate-950/40 text-slate-500" // Show all
              }`}
            >
              <Archive className="h-3 w-3" fill={filters.archived === "true" ? "currentColor" : "none"} />
              {filters.archived === "false"
                ? "Active Memories"
                : filters.archived === "true"
                ? "Archived Only"
                : "Active & Archived"}
            </button>
          </div>
        </div>
      </div>

      {/* Row 4: Tag Filter List */}
      {availableTags.length > 0 && (
        <div className="border-t border-slate-900/60 pt-3">
          <label className="block text-xs font-medium text-slate-500 mb-2">Filter by Tag</label>
          <div className="flex flex-wrap gap-1.5 max-h-[72px] overflow-y-auto pr-2 custom-scrollbar">
            <button
              onClick={() => onSelectTag("")}
              className={`rounded px-2 py-0.5 text-xs transition-colors ${
                selectedTag === ""
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                  : "bg-slate-950 text-slate-500 hover:text-slate-300 border border-transparent"
              }`}
            >
              #all-tags
            </button>
            {availableTags.map((tag) => (
              <button
                key={tag}
                onClick={() => onSelectTag(tag)}
                className={`rounded px-2 py-0.5 text-xs transition-colors ${
                  selectedTag === tag
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                    : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
