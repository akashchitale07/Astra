import React, { useState } from "react";
import { motion } from "motion/react";
import { Pin, Archive, Trash2, Edit2, Calendar, Database, ShieldAlert, Sparkles, MessageSquare } from "lucide-react";
import { MemoryItem, MemoryType, MemoryImportance } from "../types/index.js";

interface MemoryCardProps {
  memory: MemoryItem;
  onEdit: (memory: MemoryItem) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string, current: boolean) => void;
  onToggleArchive: (id: string, current: boolean) => void;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}

const typeConfig: Record<MemoryType, { label: string; bg: string; text: string }> = {
  preference: { label: "Preference", bg: "bg-purple-950/40 border-purple-500/30", text: "text-purple-300" },
  personal_fact: { label: "Personal Fact", bg: "bg-blue-950/40 border-blue-500/30", text: "text-blue-300" },
  project: { label: "Project", bg: "bg-emerald-950/40 border-emerald-500/30", text: "text-emerald-300" },
  instruction: { label: "Instruction", bg: "bg-amber-950/40 border-amber-500/30", text: "text-amber-300" },
  note: { label: "Personal Note", bg: "bg-slate-950/40 border-slate-500/30", text: "text-slate-300" },
  custom_command: { label: "Command", bg: "bg-cyan-950/40 border-cyan-500/30", text: "text-cyan-300" },
  conversation_summary: { label: "Summary", bg: "bg-pink-950/40 border-pink-500/30", text: "text-pink-300" },
};

const importanceConfig: Record<MemoryImportance, { label: string; text: string; dot: string }> = {
  high: { label: "High", text: "text-rose-400", dot: "bg-rose-500 shadow-[0_0_8px_#f43f5e]" },
  medium: { label: "Medium", text: "text-amber-400", dot: "bg-amber-500 shadow-[0_0_8px_#f59e0b]" },
  low: { label: "Low", text: "text-slate-400", dot: "bg-slate-500" },
};

export const MemoryCard: React.FC<MemoryCardProps> = ({
  memory,
  onEdit,
  onDelete,
  onTogglePin,
  onToggleArchive,
  onApprove,
  onReject,
}) => {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const typeStyle = typeConfig[memory.type] || typeConfig.note;
  const impStyle = importanceConfig[memory.importance] || importanceConfig.medium;

  const formattedDate = new Date(memory.updated_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const formattedExpiry = memory.expires_at && memory.expiration_enabled
    ? new Date(memory.expires_at).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <motion.div
      id={`memory-card-${memory.id}`}
      layout
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -2 }}
      className={`relative flex flex-col justify-between overflow-hidden rounded-xl border p-5 backdrop-blur-md transition-all duration-300 ${
        memory.pinned
          ? "border-cyan-500/40 bg-slate-900/65 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
          : memory.status === "pending"
          ? "border-amber-500/30 bg-amber-950/10 shadow-[0_0_15px_rgba(245,158,11,0.05)]"
          : "border-slate-800 bg-slate-950/60 hover:border-slate-700 hover:shadow-[0_0_15px_rgba(0,0,0,0.3)]"
      }`}
    >
      {/* Top Banner Accent */}
      {memory.pinned && (
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500" />
      )}
      {memory.status === "pending" && !memory.pinned && (
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-amber-500/40" />
      )}

      <div>
        {/* Card Header Info */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {/* Type Badge */}
            <span
              className={`rounded-md border px-2 py-0.5 text-xs font-medium tracking-wide uppercase ${typeStyle.bg} ${typeStyle.text}`}
            >
              {typeStyle.label}
            </span>

            {/* Importance Dot */}
            <span className="flex items-center gap-1.5 rounded-full bg-slate-900/50 px-2 py-0.5 text-[10px] font-medium text-slate-400 border border-slate-800/50">
              <span className={`h-1.5 w-1.5 rounded-full ${impStyle.dot}`} />
              {impStyle.label}
            </span>

            {/* Pending Status Badge */}
            {memory.status === "pending" && (
              <span className="rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-400 animate-pulse">
                Pending Approval
              </span>
            )}
          </div>

          {/* Quick Status / Actions */}
          <div className="flex items-center gap-1">
            {memory.status !== "pending" && (
              <>
                <button
                  onClick={() => onTogglePin(memory.id, memory.pinned)}
                  className={`p-1.5 rounded-lg transition-colors duration-150 ${
                    memory.pinned
                      ? "text-cyan-400 hover:bg-cyan-950/30"
                      : "text-slate-500 hover:bg-slate-800/50 hover:text-slate-300"
                  }`}
                  title={memory.pinned ? "Unpin memory" : "Pin memory to prioritize in context"}
                  aria-label={memory.pinned ? "Unpin memory" : "Pin memory"}
                >
                  <Pin className="h-4 w-4" fill={memory.pinned ? "currentColor" : "none"} />
                </button>
                <button
                  onClick={() => onToggleArchive(memory.id, memory.archived)}
                  className={`p-1.5 rounded-lg transition-colors duration-150 ${
                    memory.archived
                      ? "text-amber-400 hover:bg-amber-950/30"
                      : "text-slate-500 hover:bg-slate-800/50 hover:text-slate-300"
                  }`}
                  title={memory.archived ? "Unarchive memory" : "Archive memory (exclude from AI context)"}
                  aria-label={memory.archived ? "Unarchive memory" : "Archive memory"}
                >
                  <Archive className="h-4 w-4" fill={memory.archived ? "currentColor" : "none"} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Memory Title */}
        <h3 className="mb-2 text-md font-medium text-slate-100 tracking-tight leading-snug">
          {memory.title}
        </h3>

        {/* Memory Content */}
        <p className="mb-4 text-sm text-slate-400 whitespace-pre-wrap break-words leading-relaxed">
          {memory.content}
        </p>

        {/* Confidence & Expiration Metrics */}
        <div className="mb-4 flex flex-wrap gap-2 text-[11px] text-slate-500 border-t border-slate-900/40 pt-3">
          {memory.confidence_score !== undefined && (
            <div className="flex items-center gap-1.5 bg-slate-900/30 border border-slate-800/30 rounded px-2 py-0.5">
              <span className="text-slate-400 font-medium">Confidence:</span>
              <span className={`font-bold ${
                memory.confidence_score >= 80 ? "text-emerald-400" : memory.confidence_score >= 50 ? "text-amber-400" : "text-rose-400"
              }`}>{memory.confidence_score}%</span>
            </div>
          )}

          {memory.times_recalled !== undefined && memory.times_recalled > 0 && (
            <div className="flex items-center gap-1 bg-slate-900/30 border border-slate-800/30 rounded px-2 py-0.5" title={`Times this memory was retrieved: ${memory.times_recalled}`}>
              <span className="text-slate-400 font-medium">Recalled:</span>
              <span className="text-cyan-400 font-bold">{memory.times_recalled}x</span>
            </div>
          )}

          {formattedExpiry && (
            <div className="flex items-center gap-1 bg-slate-900/30 border border-slate-800/30 rounded px-2 py-0.5">
              <span className="text-slate-400 font-medium">Expires:</span>
              <span className="text-amber-400 font-semibold">{formattedExpiry}</span>
            </div>
          )}
        </div>

        {/* Tag Badges */}
        {memory.tags && memory.tags.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {memory.tags.map((tag) => (
              <span
                key={tag}
                className="rounded bg-slate-900/80 px-2 py-0.5 text-xs text-cyan-300 border border-cyan-950/50 hover:border-cyan-800/40 transition-colors"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Review Center Approve/Reject Buttons */}
      {memory.status === "pending" && (onApprove || onReject) && (
        <div className="mb-4 flex items-center gap-2 border-t border-slate-900/60 pt-4">
          {onApprove && (
            <button
              onClick={() => onApprove(memory.id)}
              className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 py-1.5 text-xs font-bold text-white transition-colors active:scale-98"
              aria-label="Approve memory"
            >
              Approve
            </button>
          )}
          {onReject && (
            <button
              onClick={() => onReject(memory.id)}
              className="flex-1 rounded-lg bg-rose-950/40 border border-rose-500/20 hover:bg-rose-900/30 py-1.5 text-xs font-bold text-rose-300 transition-colors active:scale-98"
              aria-label="Reject memory"
            >
              Reject
            </button>
          )}
        </div>
      )}

      {/* Card Footer: Metadata and Action Buttons */}
      <div className="mt-auto pt-4 border-t border-slate-900 flex items-center justify-between text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" />
          {formattedDate}
        </span>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          {isConfirmingDelete ? (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-rose-400 mr-1 animate-pulse">Delete?</span>
              <button
                onClick={() => {
                  onDelete(memory.id);
                  setIsConfirmingDelete(false);
                }}
                className="rounded bg-rose-950/60 border border-rose-500/40 px-2 py-1 text-rose-300 hover:bg-rose-900 transition-colors"
                aria-label="Confirm delete memory"
              >
                Yes
              </button>
              <button
                onClick={() => setIsConfirmingDelete(false)}
                className="rounded bg-slate-900 border border-slate-800 px-2 py-1 text-slate-400 hover:bg-slate-800 transition-colors"
                aria-label="Cancel delete"
              >
                No
              </button>
            </div>
          ) : (
            <>
              {/* Source Badge indicator */}
              <span
                className="mr-2 flex items-center gap-1 text-[10px] text-slate-600 font-medium"
                title={`Source: ${memory.source}`}
              >
                {memory.source === "manual" && <Database className="h-3 w-3" />}
                {memory.source === "chat" && <MessageSquare className="h-3 w-3" />}
                {memory.source === "summary" && <Sparkles className="h-3 w-3" />}
                {memory.source === "system" && <ShieldAlert className="h-3 w-3" />}
                {memory.source}
              </span>

              <button
                onClick={() => onEdit(memory)}
                className="p-1 rounded text-slate-400 hover:bg-slate-900 hover:text-slate-200 transition-colors"
                title="Edit memory"
                aria-label="Edit memory"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setIsConfirmingDelete(true)}
                className="p-1 rounded text-slate-500 hover:bg-rose-950/40 hover:text-rose-400 transition-colors"
                title="Delete memory"
                aria-label="Delete memory"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
};
