import React, { useState } from "react";
import { useAstraAgent } from "../hooks/useAstraAgent";
import { ShieldAlert, ShieldCheck, Power, RefreshCw } from "lucide-react";

export function KillSwitch() {
  const { isKillSwitched, triggerKillSwitch, resetKillSwitch, agentConnected } = useAstraAgent();
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    setLoading(true);
    if (isKillSwitched) {
      await resetKillSwitch();
    } else {
      const confirmKill = window.confirm("🚨 EMERGENCY STOP: Are you sure you want to trigger a full system lockout? This will halt any running actions on your local machine instantly.");
      if (confirmKill) {
        await triggerKillSwitch();
      }
    }
    setLoading(false);
  };

  if (!agentConnected) return null; // Only show if agent is connected and has potential of running tasks

  return (
    <div className={`border rounded-2xl p-5 backdrop-blur-xl transition-all duration-300 relative overflow-hidden ${
      isKillSwitched 
        ? "bg-red-500/10 border-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.15)] animate-pulse" 
        : "bg-zinc-900/40 border-zinc-800"
    }`}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-xl ${isKillSwitched ? "bg-red-500/20 text-red-400" : "bg-indigo-500/10 text-indigo-400"}`}>
            {isKillSwitched ? <ShieldAlert className="h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">
              {isKillSwitched ? "Astra Safety Lockout Enforced" : "Local Security Guard Active"}
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
              {isKillSwitched 
                ? "The local companion agent has blocked all OS, keyboard, mouse, and terminal actions." 
                : "A global emergency stop can be triggered at any time to instantly lock Astra out of your system."}
            </p>
          </div>
        </div>

        <button
          onClick={handleToggle}
          disabled={loading}
          className={`w-full sm:w-auto px-5 py-2.5 rounded-xl font-medium text-xs flex items-center justify-center gap-2 transition duration-150 shadow-md ${
            isKillSwitched
              ? "bg-emerald-600 hover:bg-emerald-500 text-white"
              : "bg-red-600 hover:bg-red-500 text-white shadow-red-500/10"
          }`}
        >
          {loading ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Power className="h-4 w-4" />
          )}
          {isKillSwitched ? "Deactivate Safety Lockout" : "EMERGENCY STOP (HALT ALL)"}
        </button>
      </div>
    </div>
  );
}
