import React, { useState } from "react";
import { useAstraAgent } from "../hooks/useAstraAgent";
import { History, Search, Terminal, Eye, AlertCircle, ShieldAlert } from "lucide-react";

export function AuditLog() {
  const { logs, loading } = useAstraAgent();
  const [searchTerm, setSearchTerm] = useState("");

  if (loading) return null;

  const filteredLogs = logs.filter(log => {
    const searchLower = searchTerm.toLowerCase();
    return (
      log.action_type.toLowerCase().includes(searchLower) ||
      log.target.toLowerCase().includes(searchLower) ||
      (log.status && log.status.toLowerCase().includes(searchLower))
    );
  });

  return (
    <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-6 backdrop-blur-xl shadow-xl flex flex-col h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <History className="h-4 w-4 text-indigo-400" />
            Computer Action Audit Trail
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            Complete history of local execution attempts, dry-runs, safety decisions, and authorization gates.
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-60 bg-zinc-950/40 border border-zinc-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500/80"
            placeholder="Filter logs by action or target..."
          />
        </div>
      </div>

      <div className="flex-1 overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-zinc-800 text-[10px] uppercase font-mono text-zinc-500 tracking-wider">
              <th className="pb-3 pl-2">Timestamp</th>
              <th className="pb-3">Action Type</th>
              <th className="pb-3">Target / Scope</th>
              <th className="pb-3">Status</th>
              <th className="pb-3 pr-2 text-right">Execution Mode</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-850">
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-10 text-center text-zinc-500 text-xs">
                  No audit logs found. Perform some local actions or check the agent connection.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => {
                let statusColor = "text-zinc-400 bg-zinc-800/40 border-zinc-700/50";
                if (log.status === "EXECUTED") {
                  statusColor = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
                } else if (log.status.startsWith("FAILED") || log.status === "REJECTED") {
                  statusColor = "text-red-400 bg-red-500/10 border-red-500/20";
                } else if (log.status === "DRY_RUN_APPROVED") {
                  statusColor = "text-amber-400 bg-amber-500/10 border-amber-500/20";
                }

                const displayDate = new Date(log.created_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                });

                return (
                  <tr key={log.id} className="hover:bg-zinc-950/20 transition duration-100 group">
                    <td className="py-3 pl-2 text-xs font-mono text-zinc-500">{displayDate}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <Terminal className="h-3 w-3 text-indigo-400 shrink-0" />
                        <span className="text-xs font-mono font-semibold text-zinc-200">{log.action_type}</span>
                      </div>
                    </td>
                    <td className="py-3 max-w-[240px] truncate">
                      <span className="text-xs font-mono text-zinc-400 select-all" title={log.target}>
                        {log.target}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${statusColor}`}>
                        {log.status === "DRY_RUN_APPROVED" ? "Dry Run Passed" : log.status}
                      </span>
                    </td>
                    <td className="py-3 pr-2 text-right text-xs font-mono">
                      {log.dry_run ? (
                        <span className="text-amber-500 flex items-center justify-end gap-1 text-[10px]">
                          <Eye className="h-3 w-3" />
                          Dry Run Mode
                        </span>
                      ) : (
                        <span className="text-zinc-500 flex items-center justify-end gap-1 text-[10px]">
                          <ShieldAlert className="h-3 w-3 text-red-500/70" />
                          Live Mode
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
