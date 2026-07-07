import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext.js";
import { api } from "../api/client.js";
import { Conversation, Message } from "../types/index.js";
import Layout from "../components/Layout.js";
import MessageBubble from "../components/MessageBubble.js";
import { MemorySuggestion } from "../components/MemorySuggestion.js";
import {
  Send,
  Paperclip,
  FileText,
  AlertCircle,
  Plus,
  Trash2,
  Sparkles,
  HelpCircle,
} from "lucide-react";

export default function Chat() {
  const { token } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentId, setCurrentId] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<Message | null>(null);
  const [activeSuggestions, setActiveSuggestions] = useState<any[]>([]);

  // File Upload State
  const [attachedFile, setAttachedFile] = useState<{
    id: string;
    filename: string;
    extractionStatus: "success" | "failed" | "pending";
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto scroll to bottom when message arrives
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage]);

  // Load conversations and optionally select active conversation
  const loadConversations = async (selectId?: string) => {
    try {
      const data = await api.get("/chat/conversations");
      setConversations(data.conversations || []);
      
      // Extract optional active ID from URL query
      const params = new URLSearchParams(window.location.search);
      const urlId = params.get("id");

      let activeId = selectId || urlId;

      if (!activeId && data.conversations?.length > 0) {
        activeId = data.conversations[0].id;
      }

      if (activeId) {
        setCurrentId(activeId);
        loadMessages(activeId);
        // Sync URL query without reloading the page
        const newUrl = `${window.location.pathname}?id=${activeId}`;
        window.history.replaceState({ path: newUrl }, "", newUrl);
      } else {
        // No chats exist at all, auto create one
        handleCreateNewChat();
      }
    } catch (err) {
      console.error("Error loading conversations:", err);
    }
  };

  useEffect(() => {
    loadConversations();
  }, []);

  const fetchSuggestions = async (convId: string) => {
    try {
      const data = await api.getConversationSuggestions(convId);
      if (data && data.suggestions) {
        setActiveSuggestions(data.suggestions);
      } else {
        setActiveSuggestions([]);
      }
    } catch (err) {
      console.error("Error loading memory suggestions:", err);
      setActiveSuggestions([]);
    }
  };

  const loadMessages = async (id: string) => {
    try {
      const data = await api.get(`/chat/conversations/${id}/messages`);
      setMessages(data.messages || []);
      setStreamingMessage(null);
      fetchSuggestions(id);
    } catch (err) {
      console.error("Error fetching messages:", err);
    }
  };

  const handleCreateNewChat = async () => {
    try {
      const data = await api.post("/chat/conversations", { title: "New Chat" });
      setConversations((prev) => [data.conversation, ...prev]);
      setCurrentId(data.conversation.id);
      setMessages([]);
      setStreamingMessage(null);
      setAttachedFile(null);
      
      const newUrl = `${window.location.pathname}?id=${data.conversation.id}`;
      window.history.pushState({ path: newUrl }, "", newUrl);
    } catch (err) {
      console.error("Error creating chat:", err);
    }
  };

  const handleSelectConversation = (id: string) => {
    setCurrentId(id);
    loadMessages(id);
    setAttachedFile(null);
    setFileError(null);
    
    const newUrl = `${window.location.pathname}?id=${id}`;
    window.history.pushState({ path: newUrl }, "", newUrl);
  };

  // 1. Send Message & Stream Response
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() && !attachedFile) return;
    if (!currentId) return;

    const messageText = inputText.trim();
    setInputText("");
    setLoading(true);
    setFileError(null);

    // Save user's local message inside array for responsive render
    const localUserMsg: Message = {
      id: Math.random().toString(),
      conversation_id: currentId,
      role: "user",
      content: messageText,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, localUserMsg]);

    // Setup local streaming assistant message
    const localAssistantMsg: Message = {
      id: "streaming-response",
      conversation_id: currentId,
      role: "assistant",
      content: "",
      created_at: new Date().toISOString(),
    };
    setStreamingMessage(localAssistantMsg);

    try {
      // Initiate HTTP request for SSE Stream
      const response = await fetch(`/api/chat/conversations/${currentId}/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: messageText,
          fileId: attachedFile?.id,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to initiate response generation");
      }

      if (!response.body) {
        throw new Error("No response body received for streaming");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let accumulatedText = "";

      // Read chunk-by-chunk from Express stream
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const cleanLine = line.trim();
          if (!cleanLine) continue;

          if (cleanLine.startsWith("data: ")) {
            const dataStr = cleanLine.slice(6);
            if (dataStr === "[DONE]") {
              // Generation completed successfully! Refetch full message log to synchronize IDs
              await loadMessages(currentId);
              setStreamingMessage(null);
              setAttachedFile(null); // Clear attached file once sent
              break;
            }

            try {
              const data = JSON.parse(dataStr);
              if (data.chunk) {
                accumulatedText += data.chunk;
                setStreamingMessage((prev) => {
                  if (!prev) return null;
                  return { ...prev, content: accumulatedText };
                });
              } else if (data.error) {
                setFileError(data.error);
                setStreamingMessage(null);
              }
            } catch (err) {
              // Ignore partial JSON lines
            }
          }
        }
      }
    } catch (err: any) {
      console.error("Streaming chat error:", err);
      setFileError(err.message || "Failed to communicate with AI Model");
      setStreamingMessage(null);
    } finally {
      setLoading(false);
    }
  };

  // 2. Edit Message Handler
  const handleEditMessage = async (messageId: string, newContent: string) => {
    // Note: For Phase 1, we can simply show updated content on UI or prompt rewrite.
    // Let's implement full UX!
    setMessages((prev) =>
      prev.map((msg) => (msg.id === messageId ? { ...msg, content: newContent } : msg))
    );
  };

  // 3. Delete Message Handler
  const handleDeleteMessage = async (messageId: string) => {
    // For Phase 1 we can remove it from UI array immediately
    setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
  };

  // 4. Regenerate Message Handler
  const handleRegenerateMessage = async (messageId: string) => {
    // Find the last user message preceding this assistant response and re-send it!
    const msgIndex = messages.findIndex((m) => m.id === messageId);
    if (msgIndex === -1) return;

    // Search backwards for the last "user" message
    let userMsg: Message | null = null;
    for (let i = msgIndex - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        userMsg = messages[i];
        break;
      }
    }

    if (userMsg) {
      setInputText(userMsg.content);
      // Remove all messages following that user message to keep thread linear
      const truncatedHistory = messages.slice(0, messages.indexOf(userMsg));
      setMessages(truncatedHistory);
      // Re-trigger send
      setTimeout(() => handleSendMessage(), 100);
    }
  };

  // 5. File Upload Handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentId) return;

    setUploading(true);
    setFileError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("conversationId", currentId);

    try {
      const data = await api.post("/chat/upload", formData);

      if (data.extractionStatus === "failed") {
        // PDF/DOCX Parsing failed, but we still allow attaching
        setAttachedFile({
          id: data.fileId,
          filename: data.filename,
          extractionStatus: "failed",
        });
        setFileError(
          "Astra was unable to extract text from this document. You can still send it, but AI content context may be limited."
        );
      } else {
        setAttachedFile({
          id: data.fileId,
          filename: data.filename,
          extractionStatus: "success",
        });
      }
    } catch (err: any) {
      console.error("File upload failed:", err);
      setFileError(err.message || "Failed to upload file");
    } finally {
      setUploading(false);
      // Reset input value so same file can be uploaded again
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const activeConversation = conversations.find((c) => c.id === currentId);

  // Suggestions for empty chat
  const chatStarterPrompts = [
    { title: "Write a complete script", prompt: "Write a clean Node.js script using express to fetch weather statistics." },
    { title: "Explain a complex concept", prompt: "Explain how Server-Sent Events (SSE) differ from WebSockets in simple, clear terms." },
    { title: "Perform deep proofreading", prompt: "Proofread and polish this email: 'hey team wanted to follow up on the launch date is it still on for monday?'" },
  ];

  return (
    <Layout
      currentConversationId={currentId}
      onSelectConversation={handleSelectConversation}
      onNewConversationCreated={handleCreateNewChat}
    >
      <div className="flex h-full flex-col bg-white dark:bg-zinc-950 font-sans relative">
        {/* Chat Title bar */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-200/60 bg-white/70 px-6 backdrop-blur-md dark:border-zinc-900/50 dark:bg-zinc-950/70 z-10">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">Active Session</span>
            <span className="text-xs text-zinc-300 dark:text-zinc-700">|</span>
            <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate max-w-[200px]">
              {activeConversation?.title || "New Conversation"}
            </span>
          </div>

          <button
            onClick={handleCreateNewChat}
            className="flex items-center space-x-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold shadow-xs hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">New Chat</span>
          </button>
        </div>

        {/* Message Thread Scrollport */}
        <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-900/30">
          {messages.length === 0 && !streamingMessage ? (
            // Zero State Suggestions
            <div className="mx-auto max-w-2xl px-4 py-16 space-y-8">
              <div className="text-center space-y-3">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600/10 text-blue-500 shadow-xs">
                  <Sparkles className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-bold tracking-tight">I am Astra, your Smart Assistant</h2>
                <p className="text-xs text-zinc-400">Select a prompt below or type your instruction to begin our session.</p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {chatStarterPrompts.map((starter) => (
                  <button
                    key={starter.title}
                    onClick={() => setInputText(starter.prompt)}
                    className="flex flex-col items-start justify-between rounded-xl border border-zinc-100 bg-white p-4.5 text-left shadow-xs transition-all hover:bg-zinc-50 dark:border-zinc-800/80 dark:bg-zinc-950 dark:hover:bg-zinc-900"
                  >
                    <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                      {starter.title}
                    </span>
                    <span className="mt-2 text-[10px] text-zinc-400 leading-normal line-clamp-2">
                      "{starter.prompt}"
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            // Active messages log
            <div className="flex flex-col">
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  onDelete={handleDeleteMessage}
                  onEdit={handleEditMessage}
                  onRegenerate={handleRegenerateMessage}
                />
              ))}

              {/* Streaming AI content */}
              {streamingMessage && <MessageBubble message={streamingMessage} isStreaming={true} />}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Floating Chat Input Panel */}
        <div className="border-t border-zinc-200/50 bg-white/80 p-4 backdrop-blur-md dark:border-zinc-900/50 dark:bg-zinc-950/80">
          <div className="mx-auto max-w-3xl space-y-3">
            {/* Active Memory Suggestions */}
            {activeSuggestions.length > 0 && (
              <div className="space-y-2">
                {activeSuggestions.map((sug, idx) => (
                  <MemorySuggestion
                    key={`suggestion-${idx}-${sug.title}`}
                    suggestion={sug}
                    onDismiss={() => {
                      setActiveSuggestions((prev) => prev.filter((_, sIdx) => sIdx !== idx));
                    }}
                  />
                ))}
              </div>
            )}

            {/* Error alerts */}
            {fileError && (
              <div className="flex items-center space-x-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-500">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{fileError}</span>
              </div>
            )}

            {/* Attached file banner */}
            {attachedFile && (
              <div className="flex items-center justify-between rounded-lg bg-zinc-50 p-2 border border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800/80">
                <div className="flex items-center space-x-2">
                  <FileText className={`h-4 w-4 ${attachedFile.extractionStatus === "failed" ? "text-amber-500" : "text-blue-500"}`} />
                  <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 truncate max-w-[200px]">
                    {attachedFile.filename}
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                    {attachedFile.extractionStatus === "success" ? "Extracted" : "Attach Only"}
                  </span>
                </div>
                <button
                  onClick={() => setAttachedFile(null)}
                  className="rounded-full p-1 hover:bg-zinc-200 text-zinc-400 hover:text-zinc-600 dark:hover:bg-zinc-800"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Textarea Input Card */}
            <form onSubmit={handleSendMessage} className="relative rounded-xl border border-zinc-200 bg-white shadow-xs focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 dark:border-zinc-800 dark:bg-zinc-950">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Ask Astra anything... (press Enter to send)"
                className="w-full resize-none bg-transparent py-3.5 pl-4 pr-16 text-sm placeholder-zinc-400 focus:outline-none dark:text-zinc-100 min-h-[44px] max-h-[160px]"
                rows={1}
              />

              <div className="absolute right-3.5 bottom-2.5 flex items-center space-x-2.5">
                {/* File Attachment paperclip */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".txt,.pdf,.docx"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || loading}
                  className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-50 dark:hover:bg-zinc-900"
                  title="Attach file (PDF, DOCX, TXT)"
                >
                  <Paperclip className={`h-4.5 w-4.5 ${uploading ? "animate-pulse text-blue-500" : ""}`} />
                </button>

                {/* Send Button */}
                <button
                  type="submit"
                  disabled={loading || uploading || (!inputText.trim() && !attachedFile)}
                  className="rounded-lg bg-blue-600 p-1.5 text-white shadow-xs hover:bg-blue-700 disabled:opacity-30 disabled:hover:bg-blue-600"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </form>

            <p className="text-[10px] text-center text-zinc-400 font-mono tracking-wide">
              ASTRA CORE ENGINE SECURED • SESSION CONTEXT REMEMBERED
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}

// Simple absolute close SVG just in case we need it
function X(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  );
}
