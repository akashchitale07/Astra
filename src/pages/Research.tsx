import React, { useState, useEffect } from "react";
import Layout from "../components/Layout.js";
import { api } from "../api/client.js";
import {
  BookOpen,
  Search,
  Globe,
  Loader,
  ArrowRight,
  History,
  ExternalLink,
  ChevronRight,
  Clock,
  Sparkles,
  Info,
  ChevronDown,
} from "lucide-react";

interface ResearchSource {
  title: string;
  url: string;
  snippet: string;
  fetchedStatus: string;
}

interface HistoricSession {
  id: string;
  query: string;
  sources: ResearchSource[];
  summary: string;
  createdAt: string;
}

export default function Research() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"idle" | "searching" | "fetching" | "synthesizing">("idle");
  const [history, setHistory] = useState<HistoricSession[]>([]);
  const [activeSession, setActiveSession] = useState<HistoricSession | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [highlightedSource, setHighlightedSource] = useState<number | null>(null);

  const fetchHistory = async () => {
    try {
      const data = await api.get("/internet/research/history");
      if (data.success) {
        setHistory(data.history);
        if (data.history.length > 0 && !activeSession) {
          setActiveSession(data.history[0]);
        }
      }
    } catch (err) {
      console.error("Failed to load research history:", err);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleStartResearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setErrorMessage(null);
    setStep("searching");

    try {
      // Simulate visual step progress so user sees exact active session pipeline
      setTimeout(() => setStep("fetching"), 1500);
      setTimeout(() => setStep("synthesizing"), 3500);

      const data = await api.post("/internet/research", { query });

      if (data.success) {
        const newSession: HistoricSession = {
          id: data.id,
          query: data.query,
          sources: data.sources,
          summary: data.summary,
          createdAt: new Date().toISOString(),
        };

        setActiveSession(newSession);
        setHistory((prev) => [newSession, ...prev]);
        setQuery("");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to complete research synthesis.");
    } finally {
      setLoading(false);
      setStep("idle");
    }
  };

  // Highlights the cited source when a user clicks e.g., [1]
  const renderSummaryWithCitations = (summary: string) => {
    // Matches citation brackets like [1] or [2]
    const parts = summary.split(/(\[\d+\])/g);

    return parts.map((part, index) => {
      const match = part.match(/^\[(\d+)\]$/);
      if (match) {
        const sourceIndex = parseInt(match[1], 10) - 1;
        const isHighlighted = highlightedSource === sourceIndex;

        return (
          <button
            key={index}
            onClick={() => {
              setHighlightedSource(sourceIndex);
              // Auto-scroll to referenced source card
              const element = document.getElementById(`source-card-${sourceIndex}`);
              if (element) {
                element.scrollIntoView({ behavior: "smooth", block: "center" });
              }
            }}
            className={`mx-0.5 inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-md text-[10px] font-bold transition-all ${
              isHighlighted
                ? "bg-blue-600 text-white ring-2 ring-blue-400"
                : "bg-zinc-150 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 hover:bg-blue-500 hover:text-white"
            }`}
            title={`Source reference: ${activeSession?.sources[sourceIndex]?.title || "Link"}`}
          >
            {match[1]}
          </button>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <Layout>
      <div className="grid h-[calc(100vh-4rem)] grid-cols-1 lg:grid-cols-12 overflow-hidden animate-fade-in">
        {/* Left Side: Historical Index Browser */}
        <div className="lg:col-span-3 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/20 flex flex-col min-h-0">
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center space-x-2 shrink-0">
            <History className="h-4 w-4 text-zinc-400" />
            <span className="text-xs font-bold tracking-wider uppercase text-zinc-400">
              Research Dossiers
            </span>
          </div>

          {/* Dossiers list */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {history.length === 0 ? (
              <div className="text-center py-12 text-zinc-400 text-xs">
                No past dossiers found. Start your first research mission.
              </div>
            ) : (
              history.map((session) => {
                const isActive = activeSession?.id === session.id;
                return (
                  <button
                    key={session.id}
                    onClick={() => {
                      setActiveSession(session);
                      setHighlightedSource(null);
                    }}
                    className={`w-full text-left rounded-lg p-3 flex flex-col space-y-1 transition-all ${
                      isActive
                        ? "bg-white border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900 shadow-sm"
                        : "hover:bg-zinc-100/50 dark:hover:bg-zinc-900/20"
                    }`}
                  >
                    <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate w-full">
                      {session.query}
                    </span>
                    <div className="flex items-center space-x-2 text-[10px] text-zinc-400">
                      <Clock className="h-3 w-3 shrink-0" />
                      <span>
                        {new Date(session.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      <span>•</span>
                      <span>{session.sources?.length || 0} Sources</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Main Active Session Stage */}
        <div className="lg:col-span-9 flex flex-col min-h-0 bg-white dark:bg-zinc-950">
          {/* Top Stage Header bar */}
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shrink-0">
            <div className="flex items-center space-x-3">
              <BookOpen className="h-5 w-5 text-blue-500" />
              <div>
                <h1 className="text-sm font-extrabold text-zinc-950 dark:text-zinc-50 uppercase tracking-tight">
                  Deep Research Intelligence
                </h1>
                <p className="text-[10px] text-zinc-400">
                  Astra v5.0 Multi-source factual crawler and citation indexer
                </p>
              </div>
            </div>

            {/* Header search bar */}
            <form onSubmit={handleStartResearch} className="relative flex-1 sm:max-w-md">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ex. quantum computing progress 2026..."
                className="w-full rounded-md border border-zinc-200 bg-transparent py-2 pl-9 pr-10 text-xs text-zinc-800 focus:border-blue-500 focus:outline-none dark:border-zinc-800 dark:text-zinc-200"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="absolute right-1 top-1.5 rounded-md p-1 bg-blue-600 text-white disabled:opacity-40"
              >
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>

          {/* Main Dossier Presentation stage */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Loading Pipeline State */}
            {loading && (
              <div className="rounded-2xl border border-blue-500/10 bg-blue-500/[0.02] p-8 flex flex-col items-center justify-center text-center space-y-4">
                <div className="relative">
                  <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500/20 border-t-blue-500" />
                  <Globe className="h-5 w-5 text-blue-500 absolute top-2.5 left-2.5 animate-pulse" />
                </div>

                <div className="space-y-1">
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-widest">
                    Pipeline Active
                  </span>
                  <div className="flex items-center space-x-3 text-[11px] text-zinc-500 dark:text-zinc-400 justify-center font-mono">
                    <span className={step === "searching" ? "text-blue-500 font-bold" : "opacity-40"}>
                      1. Web Index Search
                    </span>
                    <span>→</span>
                    <span className={step === "fetching" ? "text-blue-500 font-bold" : "opacity-40"}>
                      2. Scrape & Clean Pages
                    </span>
                    <span>→</span>
                    <span className={step === "synthesizing" ? "text-blue-500 font-bold" : "opacity-40"}>
                      3. Cite & Summarize
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {errorMessage && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-xs text-red-500 flex items-center space-x-2">
                <Info className="h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Presentation of active dossier */}
            {!loading && activeSession && (
              <div className="space-y-8 max-w-4xl">
                {/* Dossier Heading */}
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-500 uppercase font-mono">
                      Active Dossier
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      Completed: {new Date(activeSession.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-50">
                    {activeSession.query}
                  </h2>
                </div>

                {/* AI Synthesis Card */}
                <div className="rounded-2xl border border-zinc-150 bg-white p-6 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-950 space-y-4">
                  <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-900/50">
                    <div className="flex items-center space-x-2">
                      <Sparkles className="h-4.5 w-4.5 text-blue-500 animate-pulse" />
                      <span className="text-xs font-bold tracking-wider uppercase text-zinc-500">
                        Synthesized Synthesis Report
                      </span>
                    </div>
                  </div>

                  {/* Summary Text (Supporting clicks on inline citation buttons) */}
                  <div className="text-zinc-800 dark:text-zinc-300 text-xs md:text-sm leading-relaxed whitespace-pre-wrap font-sans space-y-4">
                    {renderSummaryWithCitations(activeSession.summary)}
                  </div>
                </div>

                {/* Sources Card Grid */}
                <div className="space-y-3">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-zinc-400">
                    Reference Citation Index ({activeSession.sources?.length || 0})
                  </h3>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {activeSession.sources?.map((source, idx) => {
                      const isHighlighted = highlightedSource === idx;
                      return (
                        <div
                          key={idx}
                          id={`source-card-${idx}`}
                          className={`rounded-xl border p-4 flex flex-col justify-between space-y-3 transition-all ${
                            isHighlighted
                              ? "border-blue-500 ring-2 ring-blue-500/20 bg-blue-500/[0.01]"
                              : "border-zinc-200 bg-white dark:border-zinc-800/80 dark:bg-zinc-950/40"
                          }`}
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center space-x-2">
                              <span className="flex h-5 w-5 items-center justify-center rounded bg-zinc-100 text-[10px] font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                                {idx + 1}
                              </span>
                              <span className="rounded-full bg-zinc-100 dark:bg-zinc-900 px-2 py-0.5 text-[8px] font-extrabold text-zinc-500 uppercase font-mono">
                                {source.fetchedStatus || "Loaded"}
                              </span>
                            </div>

                            <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-200 line-clamp-2 leading-snug">
                              {source.title}
                            </h4>
                            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 line-clamp-3 leading-relaxed">
                              {source.snippet}
                            </p>
                          </div>

                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer referrerPolicy=no-referrer"
                            className="inline-flex items-center space-x-1 text-[10px] font-semibold text-blue-500 hover:underline pt-1.5 border-t border-zinc-100 dark:border-zinc-900/50"
                          >
                            <span>Visit source domain</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Zero State empty */}
            {!loading && !activeSession && (
              <div className="h-[50vh] flex flex-col items-center justify-center text-center space-y-4 max-w-md mx-auto">
                <BookOpen className="h-10 w-10 text-zinc-300" />
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 uppercase">
                    Initialize Dossier Synthesis
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Astra Research Mode automatically scrapes relevant website directories and creates inline-cited reports. Run a query above to start.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
