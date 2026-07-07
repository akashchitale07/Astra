import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext.js";
import { useTheme } from "../context/ThemeContext.js";
import { api } from "../api/client.js";
import Layout from "../components/Layout.js";
import DataSourceSettings from "../components/DataSourceSettings.js";
import {
  Settings as SettingsIcon,
  Key,
  Eye,
  EyeOff,
  Sparkles,
  CheckCircle,
  Monitor,
  Moon,
  Sun,
  ShieldAlert,
} from "lucide-react";

export default function Settings() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();

  // Settings state
  const [apiKey, setApiKey] = useState("");
  const [maskedKey, setMaskedKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch settings from server
  const fetchSettings = async () => {
    try {
      const data = await api.get("/settings");
      setMaskedKey(data.settings.api_key_masked || "");
      setApiKey(data.settings.api_key_masked || "");
    } catch (err) {
      console.error("Error loading settings:", err);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const data = await api.put("/settings", {
        theme: theme,
        api_key: apiKey === maskedKey ? undefined : apiKey, // only update if they changed it from masked key representation
      });

      setMaskedKey(data.settings.api_key_masked || "");
      setApiKey(data.settings.api_key_masked || "");
      setSaveSuccess(true);
      
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to update settings");
    } finally {
      setLoading(false);
    }
  };

  const handleClearApiKey = async () => {
    if (!confirm("Are you sure you want to remove your configured API key? Astra will revert to the default system model.")) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.put("/settings", {
        theme,
        api_key: "", // sending empty string clears it
      });
      setMaskedKey("");
      setApiKey("");
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to clear key");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-3xl px-4 py-8 md:px-8 space-y-8 animate-fade-in">
        {/* Page Header */}
        <div className="border-b border-zinc-100 pb-5 dark:border-zinc-800/50">
          <h1 className="font-sans text-2xl font-extrabold tracking-tight md:text-3xl flex items-center space-x-2.5">
            <SettingsIcon className="h-6 w-6 text-zinc-400" />
            <span>Settings</span>
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Configure your AI assistant options and engine settings.
          </p>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSaveSettings} className="space-y-6">
          {/* Action result banner */}
          {saveSuccess && (
            <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-4 flex items-center space-x-2.5 text-xs text-green-500">
              <CheckCircle className="h-4.5 w-4.5" />
              <span>Settings updated successfully!</span>
            </div>
          )}

          {error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 flex items-center space-x-2.5 text-xs text-red-500">
              <ShieldAlert className="h-4.5 w-4.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Card 1: AI Model Engine Credentials */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800/80 dark:bg-zinc-950 space-y-6">
            <div className="space-y-1.5 border-b border-zinc-100 pb-4 dark:border-zinc-900/50">
              <h2 className="text-sm font-bold tracking-wider text-zinc-400 uppercase flex items-center space-x-2">
                <Key className="h-4 w-4" />
                <span>AI Engine Keys</span>
              </h2>
              <p className="text-xs text-zinc-500">
                Configure your own API keys. Keys are encrypted at rest with AES-256 and never returned raw to the client.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  OpenAI-Compatible API Key
                </label>
                <div className="relative">
                  <input
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={maskedKey ? "••••••••••••••••" : "sk-..."}
                    className="w-full rounded-lg border border-zinc-200 bg-transparent py-2.5 pl-4 pr-24 text-sm text-zinc-800 focus:border-blue-500 focus:outline-none dark:border-zinc-800 dark:text-zinc-100"
                  />
                  <div className="absolute right-2 top-1.5 flex items-center space-x-1.5">
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
                    >
                      {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                    {maskedKey && (
                      <button
                        type="button"
                        onClick={handleClearApiKey}
                        className="rounded-md p-1.5 text-xs font-semibold text-red-500 hover:bg-red-500/10"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-[10px] text-zinc-400 font-mono leading-normal">
                  If empty, Astra utilizes the system's **Gemini 3.5 Flash** fallback engine seamlessly. Adding a key grants access to advanced OpenAI GPT-4o completions.
                </p>
              </div>
            </div>
          </div>

          {/* Card: Internet Intelligence Data Sources */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800/80 dark:bg-zinc-950">
            <DataSourceSettings />
          </div>

          {/* Card 2: Appearance */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800/80 dark:bg-zinc-950 space-y-6">
            <div className="space-y-1.5 border-b border-zinc-100 pb-4 dark:border-zinc-900/50">
              <h2 className="text-sm font-bold tracking-wider text-zinc-400 uppercase flex items-center space-x-2">
                <Monitor className="h-4 w-4" />
                <span>Appearance</span>
              </h2>
              <p className="text-xs text-zinc-500">
                Choose your default UI style preference.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Dark Theme Button */}
              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={`flex items-center justify-center space-x-3 rounded-xl border p-4 text-sm font-semibold transition-all ${
                  theme === "dark"
                    ? "border-blue-500 bg-blue-500/5 text-blue-500"
                    : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900"
                }`}
              >
                <Moon className="h-5 w-5" />
                <span>Futuristic Dark</span>
              </button>

              {/* Light Theme Button */}
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={`flex items-center justify-center space-x-3 rounded-xl border p-4 text-sm font-semibold transition-all ${
                  theme === "light"
                    ? "border-blue-500 bg-blue-500/5 text-blue-500"
                    : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900"
                }`}
              >
                <Sun className="h-5 w-5" />
                <span>Classic Light</span>
              </button>
            </div>
          </div>

          {/* Card 3: Astra Long-Term Memory Vault */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800/80 dark:bg-zinc-950 space-y-6">
            <div className="space-y-1.5 border-b border-zinc-100 pb-4 dark:border-zinc-900/50">
              <h2 className="text-sm font-bold tracking-wider text-zinc-400 uppercase flex items-center space-x-2">
                <Sparkles className="h-4 w-4" />
                <span>Long-Term Memory & Commands</span>
              </h2>
              <p className="text-xs text-zinc-500">
                Astra's Memory Vault lets the AI adapt to your style, store preferences, remember critical project context, and run expanded template commands.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-slate-950/5 border border-slate-900/10 dark:bg-slate-950/40 dark:border-slate-900/60">
              <div className="text-left space-y-1">
                <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  Manage Memories & Settings
                </span>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Add manual preferences, create custom templates, audit chat summaries, adjust retrieval sliders, or backup/restore memories.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  window.location.href = "/memory";
                }}
                className="w-full sm:w-auto rounded-lg bg-cyan-500 hover:bg-cyan-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-cyan-950/20 whitespace-nowrap transition-all"
              >
                Open Memory Vault
              </button>
            </div>
          </div>

          {/* Submission and Save button */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center space-x-2 rounded-lg bg-blue-600 py-2.5 px-6 font-semibold text-white shadow-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Save All Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
