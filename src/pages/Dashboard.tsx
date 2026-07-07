import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext.js";
import { api } from "../api/client.js";
import { Conversation } from "../types/index.js";
import Layout from "../components/Layout.js";
import {
  MessageSquare,
  Sparkles,
  Cpu,
  Settings,
  ShieldCheck,
  Calendar,
  ChevronRight,
  TrendingUp,
} from "lucide-react";

export default function Dashboard() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [stats, setStats] = useState({
    chatCount: 0,
    apiStatus: "Checking...",
    lastActive: "Today",
  });

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const data = await api.get("/chat/conversations");
        setConversations(data.conversations || []);
        
        // Calculate dynamic stats
        const count = data.conversations?.length || 0;
        
        // Check API health status
        let apiHealth = "ONLINE";
        try {
          const health = await api.get("/health");
          if (health.status !== "healthy") apiHealth = "DEGRADED";
        } catch (e) {
          apiHealth = "OFFLINE";
        }

        setStats({
          chatCount: count,
          apiStatus: apiHealth,
          lastActive: count > 0 ? "Today" : "Never",
        });
      } catch (err) {
        console.error("Error loading dashboard data:", err);
      }
    };

    fetchDashboardData();
  }, []);

  const handleStartChat = () => {
    window.location.href = "/chat";
  };

  const handleNewConversation = async () => {
    try {
      const data = await api.post("/chat/conversations", { title: "New Conversation" });
      window.location.href = `/chat?id=${data.conversation.id}`;
    } catch (err) {
      console.error("Error creating new chat:", err);
    }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-5xl px-4 py-8 md:px-8 space-y-8 animate-fade-in">
        {/* Welcome Banner */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-100 pb-6 dark:border-zinc-800/50">
          <div>
            <h1 className="font-sans text-2xl font-extrabold tracking-tight md:text-3xl">
              Hello, {user?.display_name}!
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Welcome to Astra v1.0. Your AI assistant cockpit is fully prepared.
            </p>
          </div>
          <button
            onClick={handleNewConversation}
            className="flex items-center justify-center space-x-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-blue-700 transition-colors shrink-0"
          >
            <Sparkles className="h-4 w-4" />
            <span>Launch New Agent</span>
          </button>
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Stat 1 */}
          <div className="rounded-xl border border-zinc-100 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wider text-zinc-400 uppercase">Conversations</span>
              <div className="rounded-lg bg-blue-500/10 p-2 text-blue-500">
                <MessageSquare className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline space-x-2">
              <span className="text-2xl font-bold tracking-tight">{stats.chatCount}</span>
              <span className="text-xs font-mono text-zinc-500">active</span>
            </div>
          </div>

          {/* Stat 2 */}
          <div className="rounded-xl border border-zinc-100 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wider text-zinc-400 uppercase">System Status</span>
              <div className={`rounded-lg p-2 ${stats.apiStatus === "ONLINE" ? "bg-green-500/10 text-green-500" : "bg-amber-500/10 text-amber-500"}`}>
                <ShieldCheck className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline space-x-2">
              <span className={`text-xl font-bold tracking-tight ${stats.apiStatus === "ONLINE" ? "text-green-500" : "text-amber-500"}`}>
                {stats.apiStatus}
              </span>
            </div>
          </div>

          {/* Stat 3 */}
          <div className="rounded-xl border border-zinc-100 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wider text-zinc-400 uppercase">AI Model</span>
              <div className="rounded-lg bg-purple-500/10 p-2 text-purple-500">
                <Cpu className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline space-x-2">
              <span className="text-sm font-bold tracking-tight truncate">GPT-4o / Gemini 3.5</span>
            </div>
          </div>

          {/* Stat 4 */}
          <div className="rounded-xl border border-zinc-100 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wider text-zinc-400 uppercase">Last Session</span>
              <div className="rounded-lg bg-amber-500/10 p-2 text-amber-500">
                <Calendar className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline space-x-2">
              <span className="text-2xl font-bold tracking-tight">{stats.lastActive}</span>
            </div>
          </div>
        </div>

        {/* Bento Grid Features / Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Quick Actions Card */}
          <div className="rounded-xl border border-zinc-100 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950 md:col-span-1 space-y-4">
            <h3 className="font-sans text-sm font-bold tracking-wider text-zinc-400 uppercase">
              Quick Shortcuts
            </h3>
            <div className="space-y-2">
              <button
                onClick={handleStartChat}
                className="flex w-full items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50/50 p-3 text-left text-xs font-medium hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/30 dark:hover:bg-zinc-900/60"
              >
                <div className="flex items-center space-x-2.5">
                  <MessageSquare className="h-4 w-4 text-blue-500" />
                  <span>Launch Chat Terminal</span>
                </div>
                <ChevronRight className="h-4 w-4 text-zinc-400" />
              </button>

              <button
                onClick={() => (window.location.href = "/settings")}
                className="flex w-full items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50/50 p-3 text-left text-xs font-medium hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/30 dark:hover:bg-zinc-900/60"
              >
                <div className="flex items-center space-x-2.5">
                  <Settings className="h-4 w-4 text-amber-500" />
                  <span>Configure API Keys</span>
                </div>
                <ChevronRight className="h-4 w-4 text-zinc-400" />
              </button>

              <button
                onClick={() => (window.location.href = "/profile")}
                className="flex w-full items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50/50 p-3 text-left text-xs font-medium hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/30 dark:hover:bg-zinc-900/60"
              >
                <div className="flex items-center space-x-2.5">
                  <Cpu className="h-4 w-4 text-purple-500" />
                  <span>Customize Profile</span>
                </div>
                <ChevronRight className="h-4 w-4 text-zinc-400" />
              </button>
            </div>
          </div>

          {/* Recent Conversations Card */}
          <div className="rounded-xl border border-zinc-100 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950 md:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-sans text-sm font-bold tracking-wider text-zinc-400 uppercase">
                Recent Conversations
              </h3>
              {conversations.length > 3 && (
                <button
                  onClick={handleStartChat}
                  className="flex items-center text-xs font-bold text-blue-500 hover:underline"
                >
                  <span>View All</span>
                  <ChevronRight className="h-3 w-3" />
                </button>
              )}
            </div>

            <div className="space-y-2">
              {conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-zinc-400 dark:text-zinc-500">
                  <MessageSquare className="h-8 w-8 opacity-35 mb-2.5 animate-bounce" />
                  <p className="text-xs font-medium">No previous conversations found</p>
                  <button
                    onClick={handleNewConversation}
                    className="mt-3 text-xs font-bold text-blue-500 hover:underline"
                  >
                    Create one now
                  </button>
                </div>
              ) : (
                conversations.slice(0, 3).map((conv) => (
                  <div
                    key={conv.id}
                    onClick={() => (window.location.href = `/chat?id=${conv.id}`)}
                    className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50/20 p-3.5 hover:bg-zinc-50 dark:border-zinc-900 dark:bg-zinc-900/10 dark:hover:bg-zinc-900/30 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center space-x-3 overflow-hidden pr-4">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
                        <MessageSquare className="h-4 w-4" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="truncate text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                          {conv.title}
                        </span>
                        <span className="text-[10px] text-zinc-400 font-mono">
                          Updated {new Date(conv.updated_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-zinc-400 shrink-0" />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* MVP Notice */}
        <div className="rounded-xl border border-blue-500/10 bg-blue-500/5 p-4 flex items-start space-x-3">
          <TrendingUp className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-blue-500 uppercase tracking-wider">Astra System Roadmap</h4>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              You are running **Astra Phase 1 Master MVP**. Voice assistant, local vector databases, multi-agent pipelines, and computer control interfaces are reserved for future phases. All current configurations are locally persisted securely.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
