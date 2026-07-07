import { useState, useEffect } from "react";
import { User, Cpu, Copy, Check, Trash, Edit3, Save, X, RotateCcw, AlertCircle } from "lucide-react";
import Markdown from "react-markdown";
import { Message } from "../types/index.js";
import { ActionPlan, PlanStep } from "./ActionPlan.js";
import { useAstraAgent } from "../hooks/useAstraAgent.js";

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
  onDelete?: (id: string) => void;
  onEdit?: (id: string, newContent: string) => void;
  onRegenerate?: (id: string) => void;
}

export default function MessageBubble({
  message,
  isStreaming = false,
  onDelete,
  onEdit,
  onRegenerate,
}: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);

  const isUser = message.role === "user";

  // Action Plan parsing and execution logic
  const [steps, setSteps] = useState<PlanStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isAutomating, setIsAutomating] = useState(false);
  const { executeAction, agentConnected, isKillSwitched, settings } = useAstraAgent();

  const startTag = "[ACTION_PLAN]";
  const endTag = "[/ACTION_PLAN]";
  const startIndex = message.content.indexOf(startTag);
  const endIndex = message.content.indexOf(endTag);

  let cleanContent = message.content;
  let parsedSteps: any[] | null = null;

  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    const jsonStr = message.content.slice(startIndex + startTag.length, endIndex).trim();
    cleanContent = (message.content.slice(0, startIndex) + message.content.slice(endIndex + endTag.length)).trim();
    try {
      parsedSteps = JSON.parse(jsonStr);
    } catch (e) {
      console.error("Failed to parse Action Plan JSON:", e);
    }
  }

  // Sync steps state
  useEffect(() => {
    if (parsedSteps) {
      const initialSteps = parsedSteps.map((step: any, idx: number) => ({
        id: step.id || `step-${idx}-${Date.now()}`,
        title: step.title || `Action Step ${idx + 1}`,
        action: step.action,
        args: step.args || {},
        estimatedTime: step.estimatedTime || "1s",
        isHighRisk: !!step.isHighRisk,
        status: "pending" as const,
      }));
      setSteps(initialSteps);
      setCurrentStepIndex(0);
      setIsAutomating(false);
    } else {
      setSteps([]);
    }
  }, [message.content]);

  const handleExecuteNext = async () => {
    if (currentStepIndex >= steps.length) return;
    const step = steps[currentStepIndex];
    
    setSteps(prev => prev.map((s, idx) => idx === currentStepIndex ? { ...s, status: "running" } : s));
    
    const isDryRun = settings?.dry_run_default ?? true;
    const res = await executeAction(step.action, step.args, isDryRun);
    
    if (res.success) {
      const outputText = res.data?.stdout || res.data?.result || res.data?.preview || "Command completed successfully.";
      setSteps(prev => prev.map((s, idx) => idx === currentStepIndex ? { ...s, status: "completed", output: outputText } : s));
      setCurrentStepIndex(prev => prev + 1);
    } else {
      setSteps(prev => prev.map((s, idx) => idx === currentStepIndex ? { ...s, status: "failed", output: res.error } : s));
    }
  };

  const handleExecuteAll = async () => {
    setIsAutomating(true);
    let tempIndex = currentStepIndex;
    
    while (tempIndex < steps.length) {
      const step = steps[tempIndex];
      
      setSteps(prev => prev.map((s, idx) => idx === tempIndex ? { ...s, status: "running" } : s));
      
      const isDryRun = settings?.dry_run_default ?? true;
      const res = await executeAction(step.action, step.args, isDryRun);
      
      if (res.success) {
        const outputText = res.data?.stdout || res.data?.result || res.data?.preview || "Command completed successfully.";
        setSteps(prev => prev.map((s, idx) => idx === tempIndex ? { ...s, status: "completed", output: outputText } : s));
        tempIndex++;
        setCurrentStepIndex(tempIndex);
      } else {
        setSteps(prev => prev.map((s, idx) => idx === tempIndex ? { ...s, status: "failed", output: res.error } : s));
        break;
      }
      
      await new Promise(r => setTimeout(r, 800));
    }
    
    setIsAutomating(false);
  };

  const handleReset = () => {
    setSteps(prev => prev.map(s => ({ ...s, status: "pending", output: undefined })));
    setCurrentStepIndex(0);
    setIsAutomating(false);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text:", err);
    }
  };

  const handleSaveEdit = () => {
    if (onEdit && editContent.trim() !== "" && editContent !== message.content) {
      onEdit(message.id, editContent);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditContent(message.content);
    setIsEditing(false);
  };

  return (
    <div
      id={`message-${message.id}`}
      className={`group flex w-full gap-4 py-6 px-4 md:px-6 transition-colors ${
        isUser
          ? "bg-transparent"
          : "bg-zinc-50/50 dark:bg-zinc-900/30 border-y border-zinc-100 dark:border-zinc-900/50"
      }`}
    >
      {/* Icon/Avatar Container */}
      <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-lg border text-sm font-semibold shadow-sm">
        {isUser ? (
          <div className="flex h-full w-full items-center justify-center bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
            <User className="h-4 w-4" />
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-blue-500 text-white dark:bg-blue-600">
            <Cpu className="h-4 w-4" />
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 space-y-2 overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="font-sans text-xs font-semibold tracking-wider text-zinc-500 dark:text-zinc-400 uppercase">
            {isUser ? "You" : "Astra"}
          </span>
          
          {/* Action Row */}
          {!isEditing && (
            <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={handleCopy}
                className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                title="Copy response"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
              </button>

              {isUser && onEdit && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                  title="Edit message"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </button>
              )}

              {!isUser && onRegenerate && !isStreaming && (
                <button
                  onClick={() => onRegenerate(message.id)}
                  className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                  title="Regenerate"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              )}

              {onDelete && (
                <button
                  onClick={() => onDelete(message.id)}
                  className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-800 dark:hover:text-red-400"
                  title="Delete message"
                >
                  <Trash className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Message body / Markdown */}
        <div className="prose prose-zinc dark:prose-invert max-w-none text-sm leading-7 text-zinc-800 dark:text-zinc-100">
          {isEditing ? (
            <div className="mt-2 space-y-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 p-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                rows={3}
              />
              <div className="flex justify-end space-x-2">
                <button
                  onClick={handleCancelEdit}
                  className="flex items-center space-x-1 rounded-md border border-zinc-200 px-2.5 py-1.5 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>Cancel</span>
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="flex items-center space-x-1 rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>Save</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="markdown-body">
              <Markdown
                components={{
                  code({ node, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || "");
                    const isInline = !match;
                    return isInline ? (
                      <code
                        className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                        {...props}
                      >
                        {children}
                      </code>
                    ) : (
                      <div className="my-4 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
                        <div className="flex items-center justify-between bg-zinc-100 px-4 py-1.5 font-mono text-xs text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                          <span>{match[1]}</span>
                          <button
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(String(children).replace(/\n$/, ""));
                              } catch (e) {
                                console.error(e);
                              }
                            }}
                            className="hover:text-zinc-800 dark:hover:text-zinc-100"
                          >
                            Copy code
                          </button>
                        </div>
                        <pre className="overflow-x-auto bg-zinc-50 p-4 font-mono text-xs text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
                          <code className={className} {...props}>
                            {children}
                          </code>
                        </pre>
                      </div>
                    );
                  },
                }}
              >
                {cleanContent}
              </Markdown>
            </div>
          )}
        </div>

        {/* Action Plan Orchestration Panel */}
        {!isEditing && !isUser && steps.length > 0 && (
          <div className="mt-4 max-w-2xl space-y-3">
            {!agentConnected && (
              <div className="flex items-center gap-2 px-3 py-2 text-xs bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>
                  Local agent companion is disconnected. Please launch it locally and go to{" "}
                  <a href="/computer-control" className="underline font-semibold hover:text-amber-400">
                    Computer Control
                  </a>{" "}
                  to pair.
                </span>
              </div>
            )}
            {isKillSwitched && (
              <div className="flex items-center gap-2 px-3 py-2 text-xs bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>
                  Safety Lock (Kill Switch) is ACTIVE. Paused all actions. Deactivate it from{" "}
                  <a href="/computer-control" className="underline font-semibold hover:text-red-300">
                    Control Center
                  </a>{" "}
                  first.
                </span>
              </div>
            )}
            <ActionPlan
              steps={steps}
              currentStepIndex={currentStepIndex}
              onExecuteNext={handleExecuteNext}
              onExecuteAll={handleExecuteAll}
              onReset={handleReset}
              isAutomating={isAutomating}
            />
          </div>
        )}

        {/* Streaming / Typing indicator */}
        {isStreaming && message.content === "" && (
          <div className="flex items-center space-x-1 py-2">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 dark:bg-zinc-500 [animation-delay:-0.3s]"></span>
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 dark:bg-zinc-500 [animation-delay:-0.15s]"></span>
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 dark:bg-zinc-500"></span>
          </div>
        )}
      </div>
    </div>
  );
}
