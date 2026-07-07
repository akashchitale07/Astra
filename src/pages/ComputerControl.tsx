import React, { useState } from "react";
import Layout from "../components/Layout";
import { AgentStatus } from "../components/AgentStatus";
import { KillSwitch } from "../components/KillSwitch";
import { AllowlistManager } from "../components/AllowlistManager";
import { AuditLog } from "../components/AuditLog";
import { ActionConfirmDialog } from "../components/ActionConfirmDialog";
import { useAstraAgent } from "../hooks/useAstraAgent";
import { 
  Terminal, 
  ShieldCheck, 
  Settings, 
  ToggleLeft, 
  Play, 
  Eye, 
  Lock, 
  Globe, 
  Code,
  FolderPlus,
  Compass,
  Zap,
  HelpCircle
} from "lucide-react";

export default function ComputerControl() {
  const { 
    settings, 
    updateSettings, 
    agentConnected, 
    executeAction,
    isKillSwitched
  } = useAstraAgent();

  // Dialog State
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<string>("");
  const [pendingTarget, setPendingTarget] = useState<string>("");
  const [pendingArgs, setPendingArgs] = useState<Record<string, any>>({});
  const [pendingHighRisk, setPendingHighRisk] = useState<boolean>(false);

  // Playground/Manual execution form states
  const [playAction, setPlayAction] = useState("open_url");
  const [playUrl, setPlayUrl] = useState("https://google.com");
  const [playAppPath, setPlayAppPath] = useState("");
  const [playAppName, setPlayAppName] = useState("");
  const [playFolderPath, setPlayFolderPath] = useState("");
  const [playCmd, setPlayCmd] = useState("");
  const [playTextToType, setPlayTextToType] = useState("");
  const [playCoords, setPlayCoords] = useState({ x: "", y: "" });

  const [execResult, setExecResult] = useState<any>(null);
  const [execError, setExecError] = useState<string>("");
  const [executing, setExecuting] = useState(false);

  // Trigger manual sandbox playground action
  const handlePlaygroundSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setExecError("");
    setExecResult(null);

    let target = "system";
    let args: Record<string, any> = {};
    let highRisk = false;

    if (playAction === "open_url") {
      if (!playUrl.startsWith("http")) {
        setExecError("URL must start with http:// or https://");
        return;
      }
      target = playUrl;
      args = { url: playUrl };
    } else if (playAction === "open_app") {
      if (!playAppPath) {
        setExecError("Please enter application path.");
        return;
      }
      target = playAppPath;
      args = { app_path: playAppPath };
    } else if (playAction === "close_app") {
      if (!playAppName) {
        setExecError("Please enter process name.");
        return;
      }
      target = playAppName;
      args = { app_name: playAppName };
    } else if (playAction === "create_folder") {
      if (!playFolderPath) {
        setExecError("Please enter folder path.");
        return;
      }
      target = playFolderPath;
      args = { folder_path: playFolderPath };
    } else if (playAction === "execute_command") {
      if (!playCmd) {
        setExecError("Please enter terminal command.");
        return;
      }
      target = playCmd;
      args = { command: playCmd };
      highRisk = true; // live shell command is high risk!
    } else if (playAction === "keyboard_type") {
      if (!playTextToType) {
        setExecError("Please enter text to type.");
        return;
      }
      target = "keyboard simulation";
      args = { text: playTextToType };
    } else if (playAction === "mouse_click") {
      target = "mouse simulation";
      const x = playCoords.x ? parseInt(playCoords.x, 10) : undefined;
      const y = playCoords.y ? parseInt(playCoords.y, 10) : undefined;
      args = { x, y };
    } else if (playAction === "take_screenshot") {
      target = "screen capture";
      args = {};
    }

    // Set up confirmation dialog parameters
    setPendingAction(playAction);
    setPendingTarget(target);
    setPendingArgs(args);
    setPendingHighRisk(highRisk);
    setConfirmOpen(true);
  };

  // Confirm gate callback
  const handleActionConfirm = async (dryRun: boolean) => {
    setConfirmOpen(false);
    setExecuting(true);
    setExecError("");
    setExecResult(null);

    const result = await executeAction(pendingAction, pendingArgs, dryRun);
    setExecuting(false);

    if (result.success) {
      setExecResult(result.data);
    } else {
      setExecError(result.error || "Failed to execute action.");
    }
  };

  const handleActionCancel = () => {
    setConfirmOpen(false);
    setExecError("Action execution aborted by user safety filter.");
  };

  return (
    <Layout>
      <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto pb-24">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <Terminal className="h-6 w-6 text-indigo-400" />
              Computer Control Center
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              Configure pairing credentials, manage directories & apps allowlists, and inspect local execution safety logs.
            </p>
          </div>
        </div>

        {/* 1. Safety Lock & Emergency Banners */}
        <KillSwitch />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Column 1 & 2: Main Controls & Allowlist */}
          <div className="lg:col-span-2 space-y-8">
            {/* Pairing Portal */}
            <AgentStatus />

            {/* Allowlists Crud */}
            <AllowlistManager />
          </div>

          {/* Column 3: Control Settings & Interactive Sandbox */}
          <div className="space-y-8">
            {/* Server-Side Core Settings */}
            <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-6 backdrop-blur-xl shadow-xl space-y-5">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2 border-b border-zinc-800/80 pb-3">
                <Settings className="h-4 w-4 text-indigo-400" />
                Control Gateways
              </h3>

              <div className="space-y-4">
                {/* 1. Control Enabled */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-white block">Enable Computer Control</span>
                    <span className="text-[10px] text-zinc-500 block leading-relaxed">
                      Allow Astra to connect and orchestrate actions on your local computer agent.
                    </span>
                  </div>
                  <button
                    onClick={() => updateSettings({ control_enabled: !settings?.control_enabled })}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition duration-250 shrink-0 ${
                      settings?.control_enabled ? "bg-indigo-600" : "bg-zinc-800"
                    }`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition duration-250 ${
                      settings?.control_enabled ? "translate-x-4.5" : "translate-x-1"
                    }`} />
                  </button>
                </div>

                {/* 2. Dry-Run default */}
                <div className="flex items-start justify-between gap-3 pt-3 border-t border-zinc-850">
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-white block">Dry-Run Mode (Safe Trial)</span>
                    <span className="text-[10px] text-zinc-500 block leading-relaxed">
                      All new computer control plans run in preview-only mode by default without executing live commands.
                    </span>
                  </div>
                  <button
                    onClick={() => updateSettings({ dry_run_default: !settings?.dry_run_default })}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition duration-250 shrink-0 ${
                      settings?.dry_run_default ? "bg-indigo-600" : "bg-zinc-800"
                    }`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition duration-250 ${
                      settings?.dry_run_default ? "translate-x-4.5" : "translate-x-1"
                    }`} />
                  </button>
                </div>

                {/* 3. Double Confirm High-Risk */}
                <div className="flex items-start justify-between gap-3 pt-3 border-t border-zinc-850">
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-white block">Enforce High-Risk Gates</span>
                    <span className="text-[10px] text-zinc-500 block leading-relaxed">
                      Requires check-box re-authorization and double confirm actions before running terminal scripts or deletions.
                    </span>
                  </div>
                  <button
                    onClick={() => updateSettings({ require_double_confirm_highrisk: !settings?.require_double_confirm_highrisk })}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition duration-250 shrink-0 ${
                      settings?.require_double_confirm_highrisk ? "bg-indigo-600" : "bg-zinc-800"
                    }`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition duration-250 ${
                      settings?.require_double_confirm_highrisk ? "translate-x-4.5" : "translate-x-1"
                    }`} />
                  </button>
                </div>
              </div>
            </div>

            {/* Sandbox Playground */}
            <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-6 backdrop-blur-xl shadow-xl flex flex-col">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2 border-b border-zinc-800/80 pb-3 mb-4">
                <Compass className="h-4 w-4 text-indigo-400" />
                Manual Sandbox Console
              </h3>

              {!agentConnected ? (
                <div className="text-center py-8 px-4 border border-zinc-800 rounded-xl bg-zinc-950/20 text-zinc-500 text-xs">
                  Connect your local companion agent to open the sandbox interactive tester console.
                </div>
              ) : isKillSwitched ? (
                <div className="text-center py-8 px-4 border border-red-500/20 rounded-xl bg-red-950/10 text-red-400 text-xs flex items-center gap-2 justify-center">
                  <Lock className="h-4 w-4 shrink-0" />
                  Reset Safety Lockout first to test sandbox commands.
                </div>
              ) : (
                <form onSubmit={handlePlaygroundSubmit} className="space-y-4">
                  <div>
                    <label className="block text-[10px] uppercase font-mono text-zinc-500 mb-1">Select API Capability</label>
                    <select
                      value={playAction}
                      onChange={(e) => setPlayAction(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
                    >
                      <option value="open_url">🌐 Open Website URL</option>
                      <option value="open_app">🚀 Open Launcher Application</option>
                      <option value="close_app">🛑 Terminate App/Process</option>
                      <option value="create_folder">📁 Create Directory Folder</option>
                      <option value="take_screenshot">📸 Capture Screen Snapshot</option>
                      <option value="keyboard_type">⌨️ Keyboard Key Simulation</option>
                      <option value="mouse_click">🖱️ Simulate Mouse Cursor Click</option>
                      <option value="execute_command">⚡ Run Terminal Script Command</option>
                    </select>
                  </div>

                  {/* Dynamic Fields */}
                  {playAction === "open_url" && (
                    <div>
                      <label className="block text-[10px] uppercase font-mono text-zinc-500 mb-1">Target URL</label>
                      <input
                        type="url"
                        value={playUrl}
                        onChange={(e) => setPlayUrl(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-white"
                        placeholder="https://google.com"
                        required
                      />
                    </div>
                  )}

                  {playAction === "open_app" && (
                    <div>
                      <label className="block text-[10px] uppercase font-mono text-zinc-500 mb-1">Application Launcher Path</label>
                      <input
                        type="text"
                        value={playAppPath}
                        onChange={(e) => setPlayAppPath(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-white"
                        placeholder="e.g. C:\Windows\notepad.exe or /Applications/Safari.app"
                        required
                      />
                    </div>
                  )}

                  {playAction === "close_app" && (
                    <div>
                      <label className="block text-[10px] uppercase font-mono text-zinc-500 mb-1">App Process Name</label>
                      <input
                        type="text"
                        value={playAppName}
                        onChange={(e) => setPlayAppName(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-white"
                        placeholder="e.g. Chrome or Terminal"
                        required
                      />
                    </div>
                  )}

                  {playAction === "create_folder" && (
                    <div>
                      <label className="block text-[10px] uppercase font-mono text-zinc-500 mb-1">New Folder Path (Absolute)</label>
                      <input
                        type="text"
                        value={playFolderPath}
                        onChange={(e) => setPlayFolderPath(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-white"
                        placeholder="/Users/username/Projects/new-dir"
                        required
                      />
                    </div>
                  )}

                  {playAction === "execute_command" && (
                    <div>
                      <label className="block text-[10px] uppercase font-mono text-zinc-500 mb-1">Command String</label>
                      <input
                        type="text"
                        value={playCmd}
                        onChange={(e) => setPlayCmd(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-white font-mono"
                        placeholder="echo 'Astra Control!'"
                        required
                      />
                    </div>
                  )}

                  {playAction === "keyboard_type" && (
                    <div>
                      <label className="block text-[10px] uppercase font-mono text-zinc-500 mb-1">Characters to Type</label>
                      <input
                        type="text"
                        value={playTextToType}
                        onChange={(e) => setPlayTextToType(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-white"
                        placeholder="e.g. Hello, World!"
                        required
                      />
                    </div>
                  )}

                  {playAction === "mouse_click" && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] uppercase font-mono text-zinc-500 mb-1">Coordinate X (Optional)</label>
                        <input
                          type="number"
                          value={playCoords.x}
                          onChange={(e) => setPlayCoords({ ...playCoords, x: e.target.value })}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-white"
                          placeholder="e.g. 500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-mono text-zinc-500 mb-1">Coordinate Y (Optional)</label>
                        <input
                          type="number"
                          value={playCoords.y}
                          onChange={(e) => setPlayCoords({ ...playCoords, y: e.target.value })}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-white"
                          placeholder="e.g. 350"
                        />
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={executing}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs rounded-xl transition duration-150 shadow-md flex items-center justify-center gap-1.5"
                  >
                    <Play className="h-3.5 w-3.5" />
                    {executing ? "Deploying Action..." : "Test Local Capability"}
                  </button>

                  {/* Execution Feedback Area */}
                  {execError && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono rounded-lg mt-2 overflow-x-auto">
                      <strong>ERROR:</strong> {execError}
                    </div>
                  )}

                  {execResult && (
                    <div className="p-3 bg-zinc-950 border border-zinc-850 rounded-lg mt-2 max-h-48 overflow-y-auto font-mono text-[10px] text-zinc-300">
                      <span className="text-emerald-400 block font-bold mb-1 border-b border-zinc-850 pb-1">✓ Sandbox Response</span>
                      {execResult.screenshot ? (
                        <div className="space-y-2">
                          <span className="text-zinc-500 block">Snapshot captured successfully:</span>
                          <img 
                            src={execResult.screenshot} 
                            alt="Local screen capture sandbox preview" 
                            className="rounded border border-zinc-800 max-w-full h-auto shadow"
                          />
                        </div>
                      ) : (
                        <pre>{JSON.stringify(execResult, null, 2)}</pre>
                      )}
                    </div>
                  )}
                </form>
              )}
            </div>
          </div>
        </div>

        {/* 3. Detailed Audit Logs Table */}
        <AuditLog />
      </div>

      {/* Confirmation Dialog Gate */}
      <ActionConfirmDialog
        isOpen={confirmOpen}
        actionType={pendingAction}
        target={pendingTarget}
        args={pendingArgs}
        isHighRisk={pendingHighRisk}
        onConfirm={handleActionConfirm}
        onCancel={handleActionCancel}
      />
    </Layout>
  );
}
