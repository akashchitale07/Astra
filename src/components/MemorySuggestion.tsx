import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Check, X, Edit2, Database, AlertCircle } from "lucide-react";
import { MemoryItem, MemoryType } from "../types/index.js";
import { api } from "../api/client.js";

interface MemorySuggestionProps {
  suggestion: Partial<MemoryItem>;
  onDismiss: () => void;
  onSuccessfullySaved?: (memory: MemoryItem) => void;
}

export const MemorySuggestion: React.FC<MemorySuggestionProps> = ({
  suggestion,
  onDismiss,
  onSuccessfullySaved,
}) => {
  const [isSaved, setIsSaved] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  // Edit fields
  const [title, setTitle] = useState(suggestion.title || "");
  const [content, setContent] = useState(suggestion.content || "");
  const [type, setType] = useState<MemoryType>(suggestion.type || "personal_fact");

  const handleSave = async () => {
    setIsSaving(true);
    setError("");

    try {
      const payload = {
        title: title.trim(),
        content: content.trim(),
        type,
        source: suggestion.source || "chat",
        importance: suggestion.importance || "medium",
        tags: suggestion.tags || [],
        pinned: false,
        archived: false,
      };

      const res = await api.createMemory(payload);
      if (res && res.memory) {
        setIsSaved(true);
        if (onSuccessfullySaved) {
          onSuccessfullySaved(res.memory);
        }
        setTimeout(() => {
          onDismiss();
        }, 1500);
      }
    } catch (err: any) {
      setError(err.message || "Failed to store memory.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="my-3 rounded-xl border border-cyan-500/30 bg-slate-950/90 p-4 shadow-[0_0_15px_rgba(6,182,212,0.1)] backdrop-blur-md"
    >
      <AnimatePresence mode="wait">
        {isSaved ? (
          <motion.div
            key="saved"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-4 text-center text-cyan-400"
          >
            <div className="rounded-full bg-cyan-950/40 p-2 border border-cyan-500/20 mb-2">
              <Check className="h-6 w-6 animate-bounce" />
            </div>
            <p className="text-sm font-semibold tracking-wide">Saved to Long-Term Memory!</p>
            <p className="text-xs text-slate-500 mt-1">Astra will remember this for future chats.</p>
          </motion.div>
        ) : (
          <motion.div key="form" className="space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-400">
                <Sparkles className="h-4 w-4 text-cyan-400 animate-pulse" />
                <span>Memory Suggestion Detected</span>
              </div>
              <button
                onClick={onDismiss}
                className="text-slate-500 hover:text-slate-300 rounded-full p-0.5 transition-colors"
                title="Dismiss suggestion"
                aria-label="Dismiss memory suggestion"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Error alerts */}
            {error && (
              <div className="rounded border border-rose-500/30 bg-rose-950/20 p-2 text-xs text-rose-300 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" />
                {error}
              </div>
            )}

            {/* Editing / Reading Mode */}
            {isEditing ? (
              <div className="space-y-2 text-xs">
                <div>
                  <label className="text-[10px] font-medium text-slate-500 uppercase">Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-slate-100 focus:border-cyan-500/50 focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-medium text-slate-500 uppercase">Category</label>
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value as MemoryType)}
                      className="w-full rounded border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-slate-100 focus:border-cyan-500/50 focus:outline-none"
                    >
                      <option value="preference">Preference</option>
                      <option value="personal_fact">Personal Fact</option>
                      <option value="project">Project Detail</option>
                      <option value="instruction">Instruction</option>
                      <option value="note">Note</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-medium text-slate-500 uppercase">Details</label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={3}
                    className="w-full rounded border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-slate-100 focus:border-cyan-500/50 focus:outline-none resize-y"
                  />
                </div>
              </div>
            ) : (
              <div className="bg-slate-900/40 rounded-lg p-3 border border-slate-900/60 text-xs space-y-1.5">
                <h4 className="font-semibold text-slate-200 flex items-center gap-1">
                  <Database className="h-3.5 w-3.5 text-slate-500" />
                  {title}
                </h4>
                <p className="text-slate-400 leading-relaxed italic">{content}</p>
                {suggestion.tags && suggestion.tags.length > 0 && (
                  <div className="flex gap-1 pt-1">
                    {suggestion.tags.map((t) => (
                      <span key={t} className="text-[10px] text-cyan-400 bg-cyan-950/20 px-1.5 py-0.2 rounded">
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 text-xs">
              {isEditing ? (
                <>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-2.5 py-1 text-slate-400 hover:text-slate-200"
                    disabled={isSaving}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="rounded bg-cyan-500 px-3 py-1 text-white font-medium hover:bg-cyan-600 transition-colors flex items-center gap-1"
                  >
                    {isSaving ? "Saving..." : "Save Memory"}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-1 rounded bg-slate-900 border border-slate-800 px-2.5 py-1 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                  >
                    <Edit2 className="h-3 w-3" />
                    Edit
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-1 rounded bg-cyan-500/20 border border-cyan-500/30 px-3 py-1 text-cyan-300 font-semibold hover:bg-cyan-500/30 hover:border-cyan-500/50 hover:text-white transition-all shadow-[0_0_8px_rgba(6,182,212,0.1)]"
                  >
                    Save to Astra
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
