import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Save, Plus, Tags, ShieldAlert, Sparkles, Database } from "lucide-react";
import { MemoryItem, MemoryType, MemoryImportance } from "../types/index.js";

interface MemoryEditorProps {
  memory?: MemoryItem | null; // If null, we are in CREATE mode
  onSave: (data: any) => Promise<void>;
  onClose: () => void;
}

const typeOptions: { value: MemoryType; label: string; desc: string }[] = [
  { value: "preference", label: "Preference", desc: "User response/style settings" },
  { value: "personal_fact", label: "Personal Fact", desc: "Core info about you" },
  { value: "project", label: "Project Details", desc: "Tech stacks, roadmaps, specs" },
  { value: "instruction", label: "System Instruction", desc: "Guiding rules & formatting preferences" },
  { value: "note", label: "Personal Note", desc: "General information or manual scratchpad" },
  { value: "custom_command", label: "Custom Command", desc: "Templates expanded in chat (e.g. /phaseprompt)" },
  { value: "conversation_summary", label: "Chat Summary", desc: "Summaries of past chats" },
];

export const MemoryEditor: React.FC<MemoryEditorProps> = ({
  memory,
  onSave,
  onClose,
}) => {
  const isEditMode = !!memory;

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState<MemoryType>("note");
  const [importance, setImportance] = useState<MemoryImportance>("medium");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [pinned, setPinned] = useState(false);
  const [archived, setArchived] = useState(false);
  
  // Enterprise Extensions
  const [confidenceScore, setConfidenceScore] = useState(100);
  const [expirationEnabled, setExpirationEnabled] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const [isEncrypted, setIsEncrypted] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Initialize form fields when editing an existing memory
  useEffect(() => {
    if (memory) {
      setTitle(memory.title);
      setContent(memory.content);
      setType(memory.type);
      setImportance(memory.importance);
      setTags(memory.tags || []);
      setTagInput("");
      setPinned(memory.pinned);
      setArchived(memory.archived);
      
      setConfidenceScore(memory.confidence_score !== undefined ? memory.confidence_score : 100);
      setExpirationEnabled(!!memory.expiration_enabled);
      setExpiresAt(memory.expires_at ? new Date(memory.expires_at).toISOString().split("T")[0] : "");
      setIsEncrypted(!!memory.is_encrypted);
    } else {
      // Reset to defaults
      setTitle("");
      setContent("");
      setType("note");
      setImportance("medium");
      setTags([]);
      setTagInput("");
      setPinned(false);
      setArchived(false);
      
      setConfidenceScore(100);
      setExpirationEnabled(false);
      setExpiresAt("");
      setIsEncrypted(false);
    }
    setErrorMessage("");
  }, [memory]);

  // Handle adding a tag from input
  const handleAddTag = () => {
    const formatted = tagInput.trim().toLowerCase().replace(/#/g, "");
    if (formatted && formatted.length <= 40 && !tags.includes(formatted)) {
      if (tags.length >= 20) {
        setErrorMessage("Maximum of 20 tags allowed.");
        return;
      }
      setTags([...tags, formatted]);
      setTagInput("");
      setErrorMessage("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleRemoveTag = (index: number) => {
    setTags(tags.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMessage("Title is required.");
      return;
    }
    if (title.length > 120) {
      setErrorMessage("Title cannot exceed 120 characters.");
      return;
    }
    if (!content.trim()) {
      setErrorMessage("Content is required.");
      return;
    }
    if (content.length > 5000) {
      setErrorMessage("Content cannot exceed 5000 characters.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      // Final merge of active tag input if any
      let finalTags = [...tags];
      const extraTag = tagInput.trim().toLowerCase().replace(/#/g, "");
      if (extraTag && extraTag.length <= 40 && !finalTags.includes(extraTag)) {
        finalTags.push(extraTag);
      }

      await onSave({
        type,
        title: title.trim(),
        content: content.trim(),
        importance,
        tags: finalTags,
        pinned,
        archived,
        confidence_score: confidenceScore,
        expiration_enabled: expirationEnabled,
        expires_at: expirationEnabled && expiresAt ? new Date(expiresAt).toISOString() : null,
        is_encrypted: isEncrypted,
      });
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to save memory.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="editor-title"
    >
      <motion.div
        initial={{ scale: 0.95, y: 15 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 15 }}
        className="w-full max-w-2xl my-8 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-900 pb-4">
          <h2 id="editor-title" className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            {isEditMode ? "Edit Long-Term Memory" : "Add New Memory Item"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-950 hover:text-slate-100 transition-colors"
            aria-label="Close editor"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error message */}
        <AnimatePresence>
          {errorMessage && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-4 overflow-hidden"
            >
              <div className="rounded-lg border border-rose-500/30 bg-rose-950/40 p-3 text-sm text-rose-300">
                {errorMessage}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Title field */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label htmlFor="mem-title" className="text-xs font-medium text-slate-400">
                Memory Title <span className="text-rose-500">*</span>
              </label>
              <span className={`text-[10px] ${title.length > 120 ? "text-rose-400" : "text-slate-500"}`}>
                {title.length}/120
              </span>
            </div>
            <input
              id="mem-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 120))}
              placeholder={type === "custom_command" ? "e.g., /bugfix" : "e.g., Preferred Stack"}
              className="w-full rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 transition-colors"
              aria-required="true"
            />
          </div>

          {/* Type and Importance Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Type */}
            <div>
              <label htmlFor="mem-type" className="block text-xs font-medium text-slate-400 mb-1.5">
                Category Type <span className="text-rose-500">*</span>
              </label>
              <select
                id="mem-type"
                value={type}
                onChange={(e) => setType(e.target.value as MemoryType)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 transition-colors"
              >
                {typeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[10px] text-slate-500">
                {typeOptions.find((opt) => opt.value === type)?.desc}
              </p>
            </div>

            {/* Importance */}
            <div>
              <label htmlFor="mem-importance" className="block text-xs font-medium text-slate-400 mb-1.5">
                Importance Context
              </label>
              <select
                id="mem-importance"
                value={importance}
                onChange={(e) => setImportance(e.target.value as MemoryImportance)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 transition-colors"
              >
                <option value="low">Low (Standard Context)</option>
                <option value="medium">Medium (Moderate Priority)</option>
                <option value="high">High (Maximum Context Retrieval Priority)</option>
              </select>
              <p className="mt-1 text-[10px] text-slate-500">
                High importance boosts retrieval relevance.
              </p>
            </div>
          </div>

          {/* Content field */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label htmlFor="mem-content" className="text-xs font-medium text-slate-400">
                Memory Content Details <span className="text-rose-500">*</span>
              </label>
              <span className={`text-[10px] ${content.length > 5000 ? "text-rose-400" : "text-slate-500"}`}>
                {content.length}/5000
              </span>
            </div>
            <textarea
              id="mem-content"
              required
              rows={5}
              value={content}
              onChange={(e) => setContent(e.target.value.slice(0, 5000))}
              placeholder={
                type === "custom_command"
                  ? "Describe what prompt/instructions this command expands to in chat context..."
                  : "Detail what Astra should remember about this preference, note, or project spec..."
              }
              className="w-full rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 transition-colors resize-y min-h-[100px]"
              aria-required="true"
            />
          </div>

          {/* Tags */}
          <div>
            <label htmlFor="mem-tag-input" className="block text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1">
              <Tags className="h-3.5 w-3.5 text-slate-500" />
              Tags (comma-separated or press enter)
            </label>
            <div className="flex items-center gap-2">
              <input
                id="mem-tag-input"
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. typescript, phase-3"
                className="flex-1 rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-1.5 text-sm text-slate-100 placeholder-slate-600 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 transition-colors"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="rounded-lg bg-slate-900 border border-slate-800 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {/* List of tags */}
            {tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {tags.map((tag, idx) => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 rounded bg-slate-900 px-2 py-0.5 text-xs text-cyan-300 border border-cyan-950/50"
                  >
                    #{tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(idx)}
                      className="text-slate-500 hover:text-rose-400 transition-colors ml-0.5"
                      aria-label={`Remove tag ${tag}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Enterprise Features: Confidence & Encryption */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-lg bg-slate-900/40 border border-slate-900/60 p-4">
            {/* Confidence Score Slider */}
            <div>
              <label htmlFor="mem-confidence" className="block text-xs font-medium text-slate-400 mb-1.5 flex justify-between">
                <span>Confidence Score</span>
                <span className="text-cyan-400 font-bold">{confidenceScore}%</span>
              </label>
              <input
                id="mem-confidence"
                type="range"
                min="0"
                max="100"
                value={confidenceScore}
                onChange={(e) => setConfidenceScore(parseInt(e.target.value, 10))}
                className="w-full accent-cyan-500 bg-slate-950 rounded-lg cursor-pointer h-2"
              />
              <p className="mt-1 text-[10px] text-slate-500">
                Determines injection reliability budget matching query.
              </p>
            </div>

            {/* Encryption toggle */}
            <div className="flex flex-col justify-center">
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isEncrypted}
                  onChange={(e) => setIsEncrypted(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-800 bg-slate-950 text-emerald-500 focus:ring-emerald-500/50 accent-emerald-500"
                />
                <div>
                  <span className="text-sm font-medium text-slate-200">AES-256 Encryption</span>
                  <p className="text-[10px] text-slate-500">
                    Encrypt memory contents securely at rest using military-grade protection.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Expiration Controls */}
          <div className="rounded-lg bg-slate-900/40 border border-slate-900/60 p-4 space-y-3">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={expirationEnabled}
                onChange={(e) => setExpirationEnabled(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-800 bg-slate-950 text-cyan-500 focus:ring-cyan-500/50 accent-cyan-500"
              />
              <div>
                <span className="text-sm font-medium text-slate-200">Enable Expiration Schedule</span>
                <p className="text-[10px] text-slate-500">
                  Automatically expunge and hide this memory after a designated date.
                </p>
              </div>
            </label>

            {expirationEnabled && (
              <div className="mt-3 animate-fade-in">
                <label htmlFor="mem-expiry-date" className="block text-xs font-medium text-slate-400 mb-1.5">
                  Expiration Date <span className="text-rose-500">*</span>
                </label>
                <input
                  id="mem-expiry-date"
                  type="date"
                  required={expirationEnabled}
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 transition-colors"
                />
              </div>
            )}
          </div>

          {/* Pinned and Archived Toggles */}
          <div className="flex flex-wrap gap-6 rounded-lg bg-slate-900/40 border border-slate-900/60 p-4">
            {/* Pinned Checkbox */}
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={pinned}
                onChange={(e) => setPinned(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-800 bg-slate-950 text-cyan-500 focus:ring-cyan-500/50 accent-cyan-500"
              />
              <div>
                <span className="text-sm font-medium text-slate-200">Pin Memory</span>
                <p className="text-[10px] text-slate-500">
                  Always priority-injects into chat regardless of strict search query match.
                </p>
              </div>
            </label>

            {/* Archived Checkbox */}
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={archived}
                onChange={(e) => setArchived(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-800 bg-slate-950 text-amber-500 focus:ring-amber-500/50 accent-amber-500"
              />
              <div>
                <span className="text-sm font-medium text-slate-200">Archive Memory</span>
                <p className="text-[10px] text-slate-500">
                  Excludes this memory item from being injected into your chat context.
                </p>
              </div>
            </label>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-900 pt-4 mt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg border border-slate-800 bg-transparent px-4 py-2 text-sm font-medium text-slate-400 hover:bg-slate-900 hover:text-slate-200 transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2 text-sm font-medium text-white shadow-lg hover:brightness-110 active:brightness-95 transition-all disabled:opacity-50 disabled:brightness-50"
            >
              <Save className="h-4 w-4" />
              {isSubmitting ? "Saving..." : isEditMode ? "Save Changes" : "Store Memory"}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};
