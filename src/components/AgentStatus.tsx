import React, { useState } from "react";
import { useAstraAgent } from "../hooks/useAstraAgent";
import { Terminal, Shield, RefreshCw, Key, LogOut } from "lucide-react";

export function AgentStatus() {
  const { 
    agentConnected, 
    agentStatus, 
    pairings, 
    pairAgent, 
    unpairAgent, 
    loading, 
    isKillSwitched,
    resetKillSwitch 
  } = useAstraAgent();

  const [deviceName, setDeviceName] = useState("Local Machine");
  const [token, setToken] = useState("");
  const [pairingError, setPairingError] = useState("");
  const [pairingSuccess, setPairingSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handlePair = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) {
      setPairingError("Please enter a pairing token.");
      return;
    }

    setSubmitting(true);
    setPairingError("");
    setPairingSuccess("");

    const res = await pairAgent(token, deviceName);
    setSubmitting(false);

    if (res.success) {
      setPairingSuccess(res.localWarning || "Astra Agent paired successfully!");
      setToken("");
    } else {
      setPairingError(res.error || "Failed to pair agent.");
    }
  };

  const handleUnpair = async () => {
    if (pairings.length > 0) {
      const confirmed = window.confirm("Are you sure you want to unpair this agent? This will revoke localhost control access.");
      if (confirmed) {
        await unpairAgent(pairings[0].token);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 bg-zinc-900/40 border border-zinc-800 rounded-2xl backdrop-blur-xl">
        <RefreshCw className="h-5 w-5 animate-spin text-indigo-400 mr-2" />
        <span className="text-zinc-400">Loading computer control status...</span>
      </div>
    );
  }

  const isPaired = pairings.length > 0;

  return (
    <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-6 backdrop-blur-xl shadow-2xl relative overflow-hidden">
      {/* Glow highlight */}
      <div className={`absolute top-0 right-0 w-32 h-32 blur-3xl rounded-full opacity-10 transition-colors duration-500 ${
        isKillSwitched ? "bg-red-500" : agentConnected ? "bg-emerald-500" : "bg-zinc-500"
      }`} />

      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-lg font-medium text-white flex items-center gap-2">
            <Terminal className="h-5 w-5 text-indigo-400" />
            Local Companion Agent
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Required to securely bridge the browser sandbox to perform local machine actions.
          </p>
        </div>

        {/* Live Status Badge */}
        <div className="flex items-center gap-2">
          {isKillSwitched ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/30">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
              Kill Switch Active
            </span>
          ) : agentConnected ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Connected
            </span>
          ) : isPaired ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
              Agent Offline
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700">
              <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
              Unpaired
            </span>
          )}
        </div>
      </div>

      {isPaired ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-zinc-950/40 p-4 border border-zinc-800/60 rounded-xl">
            <div>
              <span className="block text-[10px] uppercase font-mono text-zinc-500 tracking-wider">Device</span>
              <span className="text-sm font-medium text-white">{pairings[0].device_name}</span>
            </div>
            <div>
              <span className="block text-[10px] uppercase font-mono text-zinc-500 tracking-wider">OS Platform</span>
              <span className="text-sm font-mono text-indigo-300 capitalize">
                {agentConnected ? agentStatus?.os || "Loading..." : "Unknown"}
              </span>
            </div>
            <div>
              <span className="block text-[10px] uppercase font-mono text-zinc-500 tracking-wider">Local Host</span>
              <span className="text-sm font-mono text-zinc-300">127.0.0.1:4123</span>
            </div>
            <div>
              <span className="block text-[10px] uppercase font-mono text-zinc-500 tracking-wider">Token Masked</span>
              <span className="text-sm font-mono text-zinc-400 select-all">{pairings[0].token_masked}</span>
            </div>
          </div>

          {!agentConnected && (
            <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs">
              <p className="font-semibold mb-1">Astra Agent not detected on localhost</p>
              <p className="leading-relaxed opacity-90">
                Please make sure the local agent is running inside your computer by opening your terminal, navigating to <code className="bg-amber-500/20 px-1 py-0.5 rounded font-mono text-[11px]">/agent</code>, and running <code className="bg-amber-500/20 px-1 py-0.5 rounded font-mono text-[11px]">npm run dev</code> or <code className="bg-amber-500/20 px-1 py-0.5 rounded font-mono text-[11px]">node dist/index.js</code>.
              </p>
            </div>
          )}

          {isKillSwitched && (
            <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-xs flex justify-between items-center">
              <div>
                <p className="font-semibold mb-1">Safety Lockout Active</p>
                <p className="leading-relaxed opacity-90">
                  The agent has been locked down. No computer control commands will be executed until reset.
                </p>
              </div>
              <button 
                onClick={resetKillSwitch}
                className="ml-4 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg text-xs transition duration-150 shadow"
              >
                Reset Lockout
              </button>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              onClick={handleUnpair}
              className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 px-3 py-2 rounded-lg border border-red-500/20 transition duration-150"
            >
              <LogOut className="h-3.5 w-3.5" />
              Revoke Agent Pairing
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handlePair} className="space-y-4">
          <div className="p-4 bg-zinc-950/40 border border-zinc-800/80 rounded-xl space-y-3">
            <p className="text-xs text-zinc-300 leading-relaxed">
              To activate Computer Control, run the companion agent from your local terminal. Copy the printed <strong className="text-indigo-400">Pairing Token</strong> from the terminal output and paste it here:
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase font-mono text-zinc-500 mb-1">Device Name</label>
                <input
                  type="text"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/30"
                  placeholder="e.g. My Mac Studio"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono text-zinc-500 mb-1">Pairing Token</label>
                <div className="relative">
                  <Key className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                  <input
                    type="password"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/30"
                    placeholder="Paste your astra_ token"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {pairingError && (
            <p className="text-xs text-red-400 font-medium px-1">{pairingError}</p>
          )}
          {pairingSuccess && (
            <p className="text-xs text-emerald-400 font-medium px-1">{pairingSuccess}</p>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-sm font-medium rounded-xl transition duration-150 shadow-lg shadow-indigo-500/10"
            >
              {submitting ? "Establishing Pairing..." : "Establish Secure Pairing"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
