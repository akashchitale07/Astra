import React, { useState, useEffect } from "react";
import { api } from "../api/client.js";
import {
  Globe,
  Newspaper,
  Eye,
  EyeOff,
  Save,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  CloudSun,
  Tv,
  Plane,
  Trophy,
} from "lucide-react";

interface ProviderSetting {
  provider: string;
  enabled: boolean;
  apiKeyMasked: string;
  config: Record<string, any>;
}

export default function DataSourceSettings() {
  const [settings, setSettings] = useState<ProviderSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingKeys, setEditingKeys] = useState<Record<string, string>>({});
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  const [savingProviders, setSavingProviders] = useState<Record<string, boolean>>({});
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const fetchSettings = async () => {
    try {
      const data = await api.get("/internet/settings");
      if (data.success) {
        setSettings(data.settings);
        // Initialize editing state with masked keys
        const keys: Record<string, string> = {};
        data.settings.forEach((s: ProviderSetting) => {
          keys[s.provider] = s.apiKeyMasked || "";
        });
        setEditingKeys(keys);
      }
    } catch (err: any) {
      console.error("Failed to load internet settings:", err);
      setError("Failed to load data source configurations.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleToggle = async (provider: string, currentEnabled: boolean) => {
    try {
      const updatedEnabled = !currentEnabled;
      const response = await api.put("/internet/settings", {
        provider,
        enabled: updatedEnabled,
        api_key: editingKeys[provider] && !editingKeys[provider].includes("...") ? editingKeys[provider] : undefined,
      });

      if (response.success) {
        // Update local state
        setSettings((prev) =>
          prev.map((s) => (s.provider === provider ? { ...s, enabled: updatedEnabled } : s))
        );
        showSuccess(`Toggled ${provider} data source.`);
      }
    } catch (err: any) {
      setError(err.message || `Failed to toggle ${provider}`);
    }
  };

  const handleSaveKey = async (provider: string) => {
    setSavingProviders((prev) => ({ ...prev, [provider]: true }));
    setError(null);
    try {
      const keyVal = editingKeys[provider] || "";
      const isMaskedPlaceholder = keyVal.includes("...");

      const response = await api.put("/internet/settings", {
        provider,
        enabled: settings.find((s) => s.provider === provider)?.enabled ?? true,
        api_key: isMaskedPlaceholder ? undefined : keyVal,
      });

      if (response.success) {
        showSuccess(`Saved API Key for ${provider} successfully.`);
        await fetchSettings(); // refresh to get new masked keys
      }
    } catch (err: any) {
      setError(err.message || `Failed to save ${provider} key`);
    } finally {
      setSavingProviders((prev) => ({ ...prev, [provider]: false }));
    }
  };

  const handleClearKey = async (provider: string) => {
    if (!confirm(`Are you sure you want to clear the API Key for ${provider}?`)) return;
    try {
      const response = await api.put("/internet/settings", {
        provider,
        enabled: false,
        api_key: "",
      });

      if (response.success) {
        setEditingKeys((prev) => ({ ...prev, [provider]: "" }));
        showSuccess(`Cleared API Key for ${provider}.`);
        await fetchSettings();
      }
    } catch (err: any) {
      setError(err.message || `Failed to clear ${provider} key`);
    }
  };

  const showSuccess = (msg: string) => {
    setSaveSuccessMsg(msg);
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  const getProviderDetails = (provider: string) => {
    switch (provider) {
      case "brave":
        return {
          name: "Brave Search API",
          desc: "Uncensored global web search results directly indexed by Brave Search Engine.",
          icon: <Globe className="h-5 w-5 text-orange-500" />,
        };
      case "serpapi":
        return {
          name: "SerpAPI (Google Search)",
          desc: "High-accuracy live Google search results containing real organic ranking blocks.",
          icon: <Globe className="h-5 w-5 text-blue-500" />,
        };
      case "bing":
        return {
          name: "Microsoft Bing Search",
          desc: "Enterprise Bing Search API index containing vast international snippets and images.",
          icon: <Globe className="h-5 w-5 text-teal-500" />,
        };
      case "newsapi":
        return {
          name: "NewsAPI / GNews",
          desc: "Provides real-time breaking news feeds filtered by query terms.",
          icon: <Newspaper className="h-5 w-5 text-emerald-500" />,
        };
      default:
        return {
          name: provider.toUpperCase(),
          desc: "External real-time API integrations.",
          icon: <Globe className="h-5 w-5 text-zinc-400" />,
        };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Summary */}
      <div className="space-y-1.5 border-b border-zinc-100 pb-4 dark:border-zinc-900/50">
        <h2 className="text-sm font-bold tracking-wider text-zinc-400 uppercase flex items-center space-x-2">
          <Globe className="h-4 w-4" />
          <span>Internet Intelligence Data Sources</span>
        </h2>
        <p className="text-xs text-zinc-500">
          Configure real-time scraping and intelligence providers. Integrations marked "Fallback Active" run on high-quality, keyless alternative adapters automatically when custom credentials are blank.
        </p>
      </div>

      {/* Success / Error Banners */}
      {saveSuccessMsg && (
        <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-3 flex items-center space-x-2 text-xs text-green-500">
          <CheckCircle className="h-4.5 w-4.5" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 flex items-center space-x-2 text-xs text-red-500">
          <AlertCircle className="h-4.5 w-4.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 2x2 Bento list of providers */}
      <div className="grid gap-4 sm:grid-cols-2">
        {["brave", "serpapi", "bing", "newsapi"].map((provider) => {
          const detail = getProviderDetails(provider);
          const currentConfig = settings.find((s) => s.provider === provider);
          const isEnabled = currentConfig?.enabled || false;
          const keyVal = editingKeys[provider] || "";
          const isConfigured = !!currentConfig?.apiKeyMasked;
          const isSaving = savingProviders[provider] || false;

          return (
            <div
              key={provider}
              className={`rounded-xl border p-4.5 flex flex-col justify-between space-y-4 transition-all ${
                isEnabled
                  ? "border-blue-500/30 bg-blue-500/[0.01] dark:border-blue-500/20"
                  : "border-zinc-200 bg-white dark:border-zinc-800/80 dark:bg-zinc-950/40"
              }`}
            >
              {/* Card top details */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    {detail.icon}
                    <span className="text-xs font-bold text-zinc-800 dark:text-zinc-100">
                      {detail.name}
                    </span>
                  </div>

                  {/* Toggle Slider */}
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={() => handleToggle(provider, isEnabled)}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4 bg-zinc-200 peer-focus:outline-none dark:bg-zinc-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all dark:border-zinc-600 peer-checked:bg-blue-500"></div>
                  </label>
                </div>

                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  {detail.desc}
                </p>
              </div>

              {/* Status and API Key Field */}
              <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-900/50">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">
                    Connection
                  </span>
                  {isConfigured ? (
                    <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[9px] font-extrabold text-green-500 uppercase">
                      Ready
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-extrabold text-amber-500 uppercase">
                      Fallback Active
                    </span>
                  )}
                </div>

                {/* API Key Input Row */}
                <div className="relative flex items-center">
                  <input
                    type={visibleKeys[provider] ? "text" : "password"}
                    value={keyVal}
                    onChange={(e) =>
                      setEditingKeys((prev) => ({ ...prev, [provider]: e.target.value }))
                    }
                    placeholder="Enter API Key"
                    className="w-full rounded-md border border-zinc-200 bg-transparent py-1.5 pl-3 pr-14 text-xs text-zinc-800 focus:border-blue-500 focus:outline-none dark:border-zinc-800 dark:text-zinc-200"
                  />
                  <div className="absolute right-1 top-1 flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={() =>
                        setVisibleKeys((prev) => ({ ...prev, [provider]: !prev[provider] }))
                      }
                      className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                    >
                      {visibleKeys[provider] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                    {keyVal && (
                      <button
                        type="button"
                        onClick={() => handleSaveKey(provider)}
                        disabled={isSaving}
                        className="p-1 text-blue-500 hover:text-blue-600 disabled:opacity-50"
                        title="Save Key"
                      >
                        {isSaving ? (
                          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                        ) : (
                          <Save className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {isConfigured && (
                  <button
                    type="button"
                    onClick={() => handleClearKey(provider)}
                    className="text-[10px] text-red-500 hover:underline pt-0.5 block"
                  >
                    Clear Credentials
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Built-in fallback widgets summary */}
      <div className="rounded-xl border border-dashed border-zinc-200 p-4 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/20 space-y-3">
        <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
          Out-of-the-Box Zero-Key Integrations
        </span>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
          <div className="flex items-center space-x-2 text-[10px] font-semibold text-zinc-500">
            <CloudSun className="h-4 w-4 text-sky-400" />
            <span>wttr Weather</span>
          </div>
          <div className="flex items-center space-x-2 text-[10px] font-semibold text-zinc-500">
            <TrendingUp className="h-4 w-4 text-emerald-400" />
            <span>Yahoo Stocks</span>
          </div>
          <div className="flex items-center space-x-2 text-[10px] font-semibold text-zinc-500">
            <TrendingUp className="h-4 w-4 text-indigo-400" />
            <span>CoinGecko Crypt</span>
          </div>
          <div className="flex items-center space-x-2 text-[10px] font-semibold text-zinc-500">
            <Tv className="h-4 w-4 text-red-400" />
            <span>YouTube Search</span>
          </div>
          <div className="flex items-center space-x-2 text-[10px] font-semibold text-zinc-500">
            <Plane className="h-4 w-4 text-purple-400" />
            <span>Flight Status</span>
          </div>
          <div className="flex items-center space-x-2 text-[10px] font-semibold text-zinc-500">
            <Trophy className="h-4 w-4 text-amber-400" />
            <span>Sports Scores</span>
          </div>
        </div>
      </div>
    </div>
  );
}
