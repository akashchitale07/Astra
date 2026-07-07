import { useState } from "react";
import { Menu, ChevronRight } from "lucide-react";
import Sidebar from "./Sidebar.js";
import ThemeToggle from "./ThemeToggle.js";
import { useAuth } from "../context/AuthContext.js";
import { Conversation } from "../types/index.js";

interface LayoutProps {
  children: React.ReactNode;
  currentConversationId?: string;
  onSelectConversation?: (id: string) => void;
  onNewConversationCreated?: (conv: Conversation) => void;
}

export default function Layout({
  children,
  currentConversationId,
  onSelectConversation,
  onNewConversationCreated,
}: LayoutProps) {
  const { user } = useAuth();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50 font-sans">
      {/* Sidebar Component */}
      <Sidebar
        currentConversationId={currentConversationId}
        onSelectConversation={onSelectConversation || (() => {})}
        onNewConversationCreated={onNewConversationCreated}
        isMobileOpen={isMobileOpen}
        onMobileClose={() => setIsMobileOpen(false)}
      />

      {/* Main Container */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden relative">
        {/* Sticky Header */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-zinc-200 bg-white/80 px-4 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/80 z-20">
          <div className="flex items-center space-x-3">
            {/* Mobile Sidebar Trigger */}
            <button
              onClick={() => setIsMobileOpen(true)}
              className="rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 lg:hidden"
              aria-label="Open sidebar"
            >
              <Menu className="h-5 w-5 text-zinc-500" />
            </button>
            <div className="hidden lg:flex items-center text-xs text-zinc-400 font-mono tracking-wider uppercase">
              <span>ASTRA SYSTEM</span>
              <ChevronRight className="h-3 w-3 mx-1" />
              <span className="text-blue-500 font-semibold">ONLINE</span>
            </div>
          </div>

          {/* Quick Actions Row */}
          <div className="flex items-center space-x-3">
            <ThemeToggle />
            {user && (
              <div
                onClick={() => (window.location.href = "/profile")}
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg bg-zinc-100 border border-zinc-200 text-xs font-bold text-zinc-700 shadow-sm transition-all hover:bg-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                {user.display_name.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
        </header>

        {/* Dynamic Content Viewport */}
        <main className="flex-1 overflow-y-auto relative bg-zinc-50/30 dark:bg-zinc-950/20">
          {children}
        </main>
      </div>

      {/* Backdrop for mobile drawer */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-xs lg:hidden"
        />
      )}
    </div>
  );
}
