import { useState, useEffect } from "react";
import {
  MessageSquare,
  Settings,
  User,
  LogOut,
  LayoutDashboard,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Search,
  Pin,
  Archive,
  Brain,
  Terminal,
  BookOpen,
  GitBranch,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.js";
import { Conversation } from "../types/index.js";
import { api } from "../api/client.js";

interface SidebarProps {
  currentConversationId?: string;
  onSelectConversation: (id: string) => void;
  onNewConversationCreated?: (conv: Conversation) => void;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({
  currentConversationId,
  onSelectConversation,
  onNewConversationCreated,
  isMobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const { user, logout } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => {
    const saved = localStorage.getItem("astra_pinned_chats");
    return saved ? JSON.parse(saved) : [];
  });
  const [archivedIds, setArchivedIds] = useState<string[]>(() => {
    const saved = localStorage.getItem("astra_archived_chats");
    return saved ? JSON.parse(saved) : [];
  });
  const [showArchived, setShowArchived] = useState(false);

  // Sync pinned and archived IDs with localstorage
  useEffect(() => {
    localStorage.setItem("astra_pinned_chats", JSON.stringify(pinnedIds));
  }, [pinnedIds]);

  useEffect(() => {
    localStorage.setItem("astra_archived_chats", JSON.stringify(archivedIds));
  }, [archivedIds]);

  // Fetch conversations from API
  const fetchConversations = async () => {
    try {
      const data = await api.get("/chat/conversations");
      setConversations(data.conversations);
    } catch (err) {
      console.error("Error fetching conversations:", err);
    }
  };

  useEffect(() => {
    fetchConversations();
    // Poll every 10 seconds for sidebar updates
    const interval = setInterval(fetchConversations, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleCreateChat = async () => {
    try {
      const data = await api.post("/chat/conversations", { title: "New Conversation" });
      setConversations((prev) => [data.conversation, ...prev]);
      onSelectConversation(data.conversation.id);
      if (onNewConversationCreated) {
        onNewConversationCreated(data.conversation);
      }
      if (onMobileClose) onMobileClose();
    } catch (err) {
      console.error("Error creating chat:", err);
    }
  };

  const handleDeleteChat = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this chat conversation?")) return;
    try {
      await api.delete(`/chat/conversations/${id}`);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      setPinnedIds((prev) => prev.filter((pId) => pId !== id));
      setArchivedIds((prev) => prev.filter((aId) => aId !== id));
      if (currentConversationId === id) {
        // If the current active chat was deleted, clear active select
        const remaining = conversations.filter((c) => c.id !== id);
        if (remaining.length > 0) {
          onSelectConversation(remaining[0].id);
        } else {
          // Trigger reload or parent update
          window.location.href = "/chat";
        }
      }
    } catch (err) {
      console.error("Error deleting chat:", err);
    }
  };

  const handleStartRename = (id: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(id);
    setEditTitle(title);
  };

  const handleSaveRename = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editTitle.trim()) return;
    try {
      const data = await api.put(`/chat/conversations/${id}`, { title: editTitle });
      setConversations((prev) => prev.map((c) => (c.id === id ? data.conversation : c)));
      setEditingId(null);
    } catch (err) {
      console.error("Error renaming chat:", err);
    }
  };

  const handleCancelRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const togglePinChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPinnedIds((prev) => (prev.includes(id) ? prev.filter((pId) => pId !== id) : [...prev, id]));
  };

  const toggleArchiveChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setArchivedIds((prev) => (prev.includes(id) ? prev.filter((aId) => aId !== id) : [...prev, id]));
  };

  // Filter conversations
  const filteredConversations = conversations.filter((c) => {
    const matchesSearch = c.title.toLowerCase().includes(searchQuery.toLowerCase());
    const isArchived = archivedIds.includes(c.id);
    
    if (showArchived) {
      return matchesSearch && isArchived;
    } else {
      return matchesSearch && !isArchived;
    }
  });

  // Sort: Pinned chats on top, then sorted by updated_at DESC
  const sortedConversations = [...filteredConversations].sort((a, b) => {
    const aPinned = pinnedIds.includes(a.id);
    const bPinned = pinnedIds.includes(b.id);

    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;

    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  const sidebarLinks = [
    { name: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
    { name: "Chat", icon: MessageSquare, href: "/chat" },
    { name: "Deep Research", icon: BookOpen, href: "/research" },
    { name: "Memory Vault", icon: Brain, href: "/memory" },
    { name: "Computer Control", icon: Terminal, href: "/computer-control" },
    { name: "Workflows", icon: GitBranch, href: "/workflows" },
    { name: "Profile", icon: User, href: "/profile" },
    { name: "Settings", icon: Settings, href: "/settings" },
  ];

  const handleNavigate = (href: string) => {
    window.location.href = href;
  };

  return (
    <div
      className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 transition-transform lg:static lg:translate-x-0 ${
        isMobileOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      {/* Brand Header */}
      <div className="flex h-16 items-center justify-between border-b border-zinc-200 px-6 dark:border-zinc-800">
        <div className="flex items-center space-x-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white font-bold tracking-wider shadow-md">
            A
          </div>
          <div className="flex flex-col">
            <span className="font-sans text-sm font-bold tracking-wider text-zinc-950 dark:text-zinc-50 uppercase">
              ASTRA
            </span>
            <span className="text-[10px] tracking-widest text-zinc-400 font-mono uppercase">
              Think. Listen. Execute.
            </span>
          </div>
        </div>
        {isMobileOpen && onMobileClose && (
          <button onClick={onMobileClose} className="rounded-lg p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-900 lg:hidden">
            <X className="h-5 w-5 text-zinc-500" />
          </button>
        )}
      </div>

      {/* Primary Actions */}
      <div className="p-4 space-y-3">
        <button
          onClick={handleCreateChat}
          className="flex w-full items-center justify-center space-x-2 rounded-lg bg-blue-600 py-2.5 px-4 text-sm font-semibold text-white shadow-md hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>New Chat</span>
        </button>

        {/* Navigation Section */}
        <div className="space-y-1">
          {sidebarLinks.map((link) => {
            const isActive = window.location.pathname === link.href;
            return (
              <button
                key={link.name}
                onClick={() => handleNavigate(link.href)}
                className={`flex w-full items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-50"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900/50 dark:hover:text-zinc-50"
                }`}
              >
                <link.icon className="h-4 w-4" />
                <span>{link.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Conversations List Container */}
      <div className="flex-1 flex flex-col min-h-0 border-t border-zinc-200 dark:border-zinc-800">
        {/* Chats Header & Search */}
        <div className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wider text-zinc-400 dark:text-zinc-500 uppercase">
              {showArchived ? "Archived Chats" : "Previous Chats"}
            </span>
            <button
              onClick={() => setShowArchived((prev) => !prev)}
              className="text-[10px] font-mono tracking-wider hover:underline text-blue-500"
            >
              {showArchived ? "Show Active" : "Show Archived"}
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-white py-1.5 pl-9 pr-3 text-xs focus:border-blue-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
            />
          </div>
        </div>

        {/* Scrollable chat items */}
        <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-1">
          {sortedConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-zinc-400 dark:text-zinc-500">
              <MessageSquare className="h-6 w-6 opacity-30 mb-2" />
              <p className="text-xs">No conversations found</p>
            </div>
          ) : (
            sortedConversations.map((conv) => {
              const isSelected = currentConversationId === conv.id;
              const isPinned = pinnedIds.includes(conv.id);
              const isArchived = archivedIds.includes(conv.id);

              return (
                <div
                  key={conv.id}
                  onClick={() => {
                    onSelectConversation(conv.id);
                    if (onMobileClose) onMobileClose();
                  }}
                  className={`group relative flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-zinc-200/80 text-zinc-950 dark:bg-zinc-900 dark:text-zinc-50"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900/30 dark:hover:text-zinc-200"
                  }`}
                >
                  <div className="flex flex-1 items-center space-x-2.5 min-w-0 pr-6">
                    {isPinned ? (
                      <Pin className="h-3.5 w-3.5 shrink-0 text-blue-500 rotate-45" />
                    ) : (
                      <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-60" />
                    )}

                    {editingId === conv.id ? (
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full rounded border border-zinc-300 bg-white px-1.5 py-0.5 text-xs text-zinc-950 focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                        autoFocus
                      />
                    ) : (
                      <span className="truncate text-xs">{conv.title}</span>
                    )}
                  </div>

                  {/* Context menu triggers (hover action row) */}
                  <div className="absolute right-2 top-2 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {editingId === conv.id ? (
                      <>
                        <button
                          onClick={(e) => handleSaveRename(conv.id, e)}
                          className="rounded-md p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-green-500"
                        >
                          <Check className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => handleCancelRename(e)}
                          className="rounded-md p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-red-500"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={(e) => togglePinChat(conv.id, e)}
                          className={`rounded p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 ${
                            isPinned ? "text-blue-500" : "text-zinc-400"
                          }`}
                          title={isPinned ? "Unpin chat" : "Pin chat"}
                        >
                          <Pin className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => toggleArchiveChat(conv.id, e)}
                          className={`rounded p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 ${
                            isArchived ? "text-indigo-500" : "text-zinc-400"
                          }`}
                          title={isArchived ? "Activate chat" : "Archive chat"}
                        >
                          <Archive className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => handleStartRename(conv.id, conv.title, e)}
                          className="rounded p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-400"
                          title="Rename"
                        >
                          <Edit2 className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteChat(conv.id, e)}
                          className="rounded p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-400 hover:text-red-500"
                          title="Delete"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* User Footer Profile */}
      {user && (
        <div className="flex h-16 items-center justify-between border-t border-zinc-200 bg-zinc-100/50 px-6 dark:border-zinc-800 dark:bg-zinc-900/30">
          <div className="flex items-center space-x-3 overflow-hidden">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-300 text-xs font-semibold text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
              {user.display_name.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="truncate text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                {user.display_name}
              </span>
              <span className="truncate text-[10px] text-zinc-500 dark:text-zinc-400">
                {user.email}
              </span>
            </div>
          </div>
          <button
            onClick={logout}
            className="rounded-lg p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 hover:text-red-600 dark:hover:text-red-400"
            title="Log Out"
          >
            <LogOut className="h-4.5 w-4.5" />
          </button>
        </div>
      )}
    </div>
  );
}
