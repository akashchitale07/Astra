import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Brain, ToggleLeft, ToggleRight, Sparkles, Check, RefreshCw, Sliders, Shield } from "lucide-react";
import { MemorySettings as IMemorySettings } from "../types/index.js";
import { api } from "../api/client.js";

interface MemorySettingsProps {
  settings: IMemorySettings | null;
  onUpdate: (updatedSettings: IMemorySettings) => void;
}

export const MemorySettings: React.FC<MemorySettingsProps> = ({
  settings,
  onUpdate,
}) => {
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [autoCaptureEnabled, setAutoCaptureEnabled] = useState(false);
  const [memoryInjectionEnabled, setMemoryInjectionEnabled] = useState(true);
  const [summarizeConversationsEnabled, setSummarizeConversationsEnabled] = useState(true);
  const [maxMemories, setMaxMemories] = useState(8);

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (settings) {
      setMemoryEnabled(settings.memory_enabled);
      setAutoCaptureEnabled(settings.auto_capture_enabled);
      setMemoryInjectionEnabled(settings.memory_injection_enabled);
      setSummarizeConversationsEnabled(settings.summarize_conversations_enabled);
      setMaxMemories(settings.max_memories_in_context);
    }
  }, [settings]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    setErrorMessage("");

    try {
      const res = await api.updateMemorySettings({
        memory_enabled: memoryEnabled,
        auto_capture_enabled: autoCaptureEnabled,
        memory_injection_enabled: memoryInjectionEnabled,
        summarize_conversations_enabled: summarizeConversationsEnabled,
        max_memories_in_context: maxMemories,
      });

      if (res && res.settings) {
        onUpdate(res.settings);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to update memory settings.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!settings) {
    return (
      <div className="flex items-center justify-center p-8 text-slate-500">
        <RefreshCw className="h-5 w-5 animate-spin mr-2" />
        Loading memory engine settings...
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-900 bg-slate-950/40 p-6 backdrop-blur-md space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-900 pb-4">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-cyan-950/30 p-2 text-cyan-400">
            <Brain className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Memory Engine Configuration</h3>
            <p className="text-xs text-slate-500">Customize how Astra remembers and recalls helpful context</p>
          </div>
        </div>
      </div>

      {/* Save Alerts */}
      <AnimatePresence>
        {saveSuccess && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-lg bg-emerald-950/30 border border-emerald-500/20 p-3 text-xs text-emerald-400 flex items-center gap-1.5"
          >
            <Check className="h-4 w-4" />
            Memory settings saved and synchronized successfully.
          </motion.div>
        )}
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-lg bg-rose-950/30 border border-rose-500/20 p-3 text-xs text-rose-400"
          >
            {errorMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Grid */}
      <div className="space-y-4">
        {/* Toggle: Enable Memory */}
        <div className="flex items-start justify-between gap-4 p-3 rounded-lg bg-slate-950/50 hover:bg-slate-950/80 transition-colors">
          <div>
            <label className="text-sm font-medium text-slate-200 cursor-pointer block" onClick={() => setMemoryEnabled(!memoryEnabled)}>
              Enable Astra Long-Term Memory
            </label>
            <span className="text-xs text-slate-500">
              When disabled, Astra stores no new information and does not use saved memories.
            </span>
          </div>
          <button
            onClick={() => setMemoryEnabled(!memoryEnabled)}
            className="text-slate-400 hover:text-white transition-colors"
            aria-label="Toggle memory enabled"
          >
            {memoryEnabled ? (
              <ToggleRight className="h-7 w-7 text-cyan-400" />
            ) : (
              <ToggleLeft className="h-7 w-7 text-slate-600" />
            )}
          </button>
        </div>

        {/* Toggle: Memory Injection */}
        <div
          className={`flex items-start justify-between gap-4 p-3 rounded-lg transition-all ${
            memoryEnabled ? "bg-slate-950/50 hover:bg-slate-950/80" : "bg-slate-950/10 opacity-40 pointer-events-none"
          }`}
        >
          <div>
            <label className="text-sm font-medium text-slate-200 cursor-pointer block" onClick={() => setMemoryInjectionEnabled(!memoryInjectionEnabled)}>
              Inject Memories into Chat Context
            </label>
            <span className="text-xs text-slate-500">
              Inject relevant memories as reference facts during active conversation turns.
            </span>
          </div>
          <button
            onClick={() => setMemoryInjectionEnabled(!memoryInjectionEnabled)}
            className="text-slate-400 hover:text-white transition-colors"
            aria-label="Toggle memory injection"
            disabled={!memoryEnabled}
          >
            {memoryInjectionEnabled ? (
              <ToggleRight className="h-7 w-7 text-cyan-400" />
            ) : (
              <ToggleLeft className="h-7 w-7 text-slate-600" />
            )}
          </button>
        </div>

        {/* Toggle: Conversation Summarization */}
        <div
          className={`flex items-start justify-between gap-4 p-3 rounded-lg transition-all ${
            memoryEnabled ? "bg-slate-950/50 hover:bg-slate-950/80" : "bg-slate-950/10 opacity-40 pointer-events-none"
          }`}
        >
          <div>
            <label className="text-sm font-medium text-slate-200 cursor-pointer block" onClick={() => setSummarizeConversationsEnabled(!summarizeConversationsEnabled)}>
              Enable Conversation Summaries
            </label>
            <span className="text-xs text-slate-500">
              Allow Astra to compile short summaries and key takeaways of completed conversations.
            </span>
          </div>
          <button
            onClick={() => setSummarizeConversationsEnabled(!summarizeConversationsEnabled)}
            className="text-slate-400 hover:text-white transition-colors"
            aria-label="Toggle conversation summaries"
            disabled={!memoryEnabled}
          >
            {summarizeConversationsEnabled ? (
              <ToggleRight className="h-7 w-7 text-cyan-400" />
            ) : (
              <ToggleLeft className="h-7 w-7 text-slate-600" />
            )}
          </button>
        </div>

        {/* Toggle: Auto-Capture */}
        <div
          className={`flex items-start justify-between gap-4 p-3 rounded-lg transition-all ${
            memoryEnabled ? "bg-slate-950/50 hover:bg-slate-950/80" : "bg-slate-950/10 opacity-40 pointer-events-none"
          }`}
        >
          <div>
            <div className="flex items-center gap-1.5">
              <label className="text-sm font-medium text-slate-200 cursor-pointer" onClick={() => setAutoCaptureEnabled(!autoCaptureEnabled)}>
                Auto-Capture Memory Suggestions
              </label>
              <span className="rounded bg-rose-950/50 text-rose-400 text-[10px] font-semibold px-1.5 py-0.5 border border-rose-900/40">
                OFF BY DEFAULT
              </span>
            </div>
            <span className="text-xs text-slate-500 block mt-0.5">
              Automatically save extracted facts to memory. When off, Astra only prompts suggestions.
            </span>
          </div>
          <button
            onClick={() => setAutoCaptureEnabled(!autoCaptureEnabled)}
            className="text-slate-400 hover:text-white transition-colors"
            aria-label="Toggle auto capture memory"
            disabled={!memoryEnabled}
          >
            {autoCaptureEnabled ? (
              <ToggleRight className="h-7 w-7 text-rose-500" />
            ) : (
              <ToggleLeft className="h-7 w-7 text-slate-600" />
            )}
          </button>
        </div>

        {/* Slider: Max Context Memories */}
        <div
          className={`p-4 rounded-lg bg-slate-900/30 border border-slate-900/60 space-y-3 transition-all ${
            memoryEnabled && memoryInjectionEnabled ? "" : "opacity-40 pointer-events-none"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <Sliders className="h-3.5 w-3.5 text-slate-500" />
              Max Memories Retrieved in Chat Context
            </span>
            <span className="text-sm font-semibold text-cyan-400">{maxMemories} items</span>
          </div>
          <input
            type="range"
            min={1}
            max={20}
            value={maxMemories}
            onChange={(e) => setMaxMemories(parseInt(e.target.value, 10))}
            className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            disabled={!memoryEnabled || !memoryInjectionEnabled}
          />
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>1 memory</span>
            <span>Recommended (8)</span>
            <span>20 memories</span>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-2">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 px-5 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-850 active:scale-98 transition-all disabled:opacity-50"
        >
          <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
          {isSaving ? "Saving Settings..." : "Apply & Save Settings"}
        </button>
      </div>

      {/* Safety Notice */}
      <div className="flex gap-2 text-[10px] text-slate-600 border-t border-slate-900 pt-4">
        <Shield className="h-3.5 w-3.5 shrink-0 text-slate-700" />
        <p>
          <strong>Privacy Protocol:</strong> Astra's memory module never stores API credentials, private tokens, passwords, or raw private files. Stored context is encrypted and accessible only by you.
        </p>
      </div>
    </div>
  );
};
