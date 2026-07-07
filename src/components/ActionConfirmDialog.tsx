import React, { useState, useEffect } from "react";
import { AlertTriangle, Clock, Play, ShieldAlert, X } from "lucide-react";

interface ActionConfirmDialogProps {
  isOpen: boolean;
  actionType: string;
  target: string;
  args: Record<string, any>;
  isHighRisk: boolean;
  onConfirm: (dryRun: boolean) => void;
  onCancel: () => void;
  autoCancelSeconds?: number;
}

export function ActionConfirmDialog({
  isOpen,
  actionType,
  target,
  args,
  isHighRisk,
  onConfirm,
  onCancel,
  autoCancelSeconds = 30
}: ActionConfirmDialogProps) {
  const [dryRun, setDryRun] = useState(true);
  const [doubleConfirmed, setDoubleConfirmed] = useState(false);
  const [timeLeft, setTimeLeft] = useState(autoCancelSeconds);

  // Handle countdown timer
  useEffect(() => {
    if (!isOpen) return;
    
    setTimeLeft(autoCancelSeconds);
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onCancel(); // auto cancel when timer hits zero
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, onCancel, autoCancelSeconds]);

  // Reset dryRun and doubleConfirmed states when dialog opens
  useEffect(() => {
    if (isOpen) {
      setDryRun(true);
      setDoubleConfirmed(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const requiresDoubleConfirm = isHighRisk && !dryRun;

  const handleConfirmSubmit = () => {
    if (requiresDoubleConfirm && !doubleConfirmed) {
      return;
    }
    onConfirm(dryRun);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl relative">
        
        {/* Banner */}
        <div className={`p-5 flex items-center gap-3 ${
          isHighRisk && !dryRun 
            ? "bg-gradient-to-r from-red-600 to-red-800 text-white" 
            : isHighRisk 
              ? "bg-gradient-to-r from-amber-600 to-amber-800 text-white"
              : "bg-gradient-to-r from-indigo-600 to-purple-600 text-white"
        }`}>
          <ShieldAlert className="h-6 w-6 animate-pulse shrink-0" />
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-semibold tracking-wide uppercase font-mono">
              {isHighRisk && !dryRun ? "CRITICAL SYSTEM AUTHORIZATION REQUIRED" : "Action Confirmation Required"}
            </h4>
            <p className="text-[11px] opacity-90 truncate">
              {actionType} on target: {target}
            </p>
          </div>
          <button 
            onClick={onCancel}
            className="p-1.5 hover:bg-white/10 rounded-full transition duration-150"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Action Details */}
          <div className="space-y-3">
            <div className="bg-zinc-950 p-4 border border-zinc-800/60 rounded-xl space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-mono text-zinc-500">Action:</span>
                <span className="font-mono font-bold text-white bg-zinc-800 px-2 py-0.5 rounded">{actionType}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="font-mono text-zinc-500">Target/Path:</span>
                <span className="font-mono text-zinc-300 truncate max-w-[280px]">{target}</span>
              </div>
              {Object.keys(args).length > 0 && (
                <div className="border-t border-zinc-850 pt-2 mt-2">
                  <span className="block text-[10px] font-mono text-zinc-500 mb-1">Arguments:</span>
                  <pre className="text-[10px] font-mono bg-zinc-900 p-2 rounded text-indigo-300 overflow-x-auto max-h-24">
                    {JSON.stringify(args, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>

          {/* Dry Run / Live Toggle */}
          <div className="p-4 bg-zinc-950/60 border border-zinc-800 rounded-xl flex items-start gap-3">
            <input
              id="dry-run-checkbox"
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              className="mt-1 h-4 w-4 text-red-600 border-zinc-800 rounded focus:ring-red-500 focus:ring-offset-zinc-900 bg-zinc-900"
            />
            <div className="flex-1">
              <label htmlFor="dry-run-checkbox" className="text-xs font-bold text-amber-400 cursor-pointer flex items-center gap-1.5">
                Execute in Safe DRY-RUN Mode (Highly Recommended)
              </label>
              <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">
                When checked, Astra logs, parses, and evaluates the command sequence but does NOT make any modifications to your machine. Uncheck to run LIVE.
              </p>
            </div>
          </div>

          {/* High-Risk Double Confirmation Block */}
          {requiresDoubleConfirm && (
            <div className="p-4 bg-red-950/20 border border-red-500/30 rounded-xl space-y-3 animate-slide-up">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <h5 className="text-xs font-bold text-red-400">High-Risk Operation</h5>
                  <p className="text-[11px] text-red-300/80 leading-relaxed mt-0.5">
                    This action will execute a live command or delete files. To prevent accidental system alterations, please check the box below to authorize.
                  </p>
                </div>
              </div>
              
              <label className="flex items-center gap-2 text-xs text-red-300 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={doubleConfirmed}
                  onChange={(e) => setDoubleConfirmed(e.target.checked)}
                  className="h-4 w-4 text-red-600 border-zinc-800 rounded focus:ring-red-500 bg-zinc-900"
                />
                I understand this is a live machine modification.
              </label>
            </div>
          )}

          {/* Countdown timer & action buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-zinc-800 pt-5">
            <span className="text-xs text-zinc-500 flex items-center gap-1.5 font-mono">
              <Clock className="h-3.5 w-3.5 text-zinc-400 animate-spin" />
              Auto-cancel in <span className="text-white font-bold">{timeLeft}s</span>
            </span>

            <div className="flex gap-3 w-full sm:w-auto justify-end">
              <button
                onClick={onCancel}
                className="w-full sm:w-auto px-4 py-2 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl text-xs font-semibold transition duration-150"
              >
                Cancel Action
              </button>
              
              <button
                onClick={handleConfirmSubmit}
                disabled={requiresDoubleConfirm && !doubleConfirmed}
                className={`w-full sm:w-auto px-5 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition duration-150 shadow ${
                  requiresDoubleConfirm
                    ? doubleConfirmed
                      ? "bg-red-600 hover:bg-red-500 text-white"
                      : "bg-red-950 text-red-600 border border-red-900/40 cursor-not-allowed"
                    : dryRun
                      ? "bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold"
                      : "bg-indigo-600 hover:bg-indigo-500 text-white"
                }`}
              >
                <Play className="h-3.5 w-3.5 shrink-0" />
                {dryRun ? "Review Safely" : requiresDoubleConfirm ? "Execute High-Risk Live" : "Execute Live Action"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
