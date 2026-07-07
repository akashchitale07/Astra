import React, { useState } from "react";
import { useAstraAgent } from "../hooks/useAstraAgent";
import { Folder, Play, Plus, Trash2, ShieldCheck, ShieldAlert, Laptop } from "lucide-react";

export function AllowlistManager() {
  const { 
    directories, 
    apps, 
    addDirectory, 
    removeDirectory, 
    addApp, 
    removeApp,
    loading 
  } = useAstraAgent();

  // State for adding folder
  const [newDir, setNewDir] = useState("");
  const [dirError, setDirError] = useState("");

  // State for adding app
  const [appName, setAppName] = useState("");
  const [appPath, setAppPath] = useState("");
  const [appError, setAppError] = useState("");

  const handleAddDir = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDir.trim()) return;
    
    setDirError("");
    const success = await addDirectory(newDir.trim());
    if (success) {
      setNewDir("");
    } else {
      setDirError("Failed to add directory path.");
    }
  };

  const handleAddApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appName.trim() || !appPath.trim()) return;

    setAppError("");
    const success = await addApp(appName.trim(), appPath.trim());
    if (success) {
      setAppName("");
      setAppPath("");
    } else {
      setAppError("Failed to add application to allowlist.");
    }
  };

  if (loading) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* 1. Folders Allowlist */}
      <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-6 backdrop-blur-xl shadow-xl flex flex-col h-full">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-2">
          <Folder className="h-4 w-4 text-indigo-400" />
          Approved Workspace Directories
        </h3>
        <p className="text-xs text-zinc-400 mb-6">
          File operations, VS Code workspaces, and command execution directories are restricted to the absolute paths listed below.
        </p>

        {/* List of Directories */}
        <div className="flex-1 space-y-2 mb-6 overflow-y-auto max-h-[220px] pr-1">
          {directories.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-zinc-800 rounded-xl text-zinc-500 text-xs">
              No directories in allowlist yet. System files are currently restricted.
            </div>
          ) : (
            directories.map((dir) => (
              <div 
                key={dir.path} 
                className="flex items-center justify-between p-3 bg-zinc-950/40 border border-zinc-800/60 rounded-xl hover:border-zinc-700/60 transition duration-150"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Folder className="h-4 w-4 text-zinc-500 shrink-0" />
                  <span className="text-xs font-mono text-zinc-300 truncate select-all">{dir.path}</span>
                </div>
                <button
                  onClick={() => removeDirectory(dir.path)}
                  className="p-1.5 hover:bg-red-500/10 text-zinc-500 hover:text-red-400 rounded-lg transition duration-150"
                  title="Remove from allowlist"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Add Directory Form */}
        <form onSubmit={handleAddDir} className="space-y-3 mt-auto border-t border-zinc-800/80 pt-4">
          <label className="block text-[10px] uppercase font-mono text-zinc-500">Add Folder Path (Absolute)</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newDir}
              onChange={(e) => setNewDir(e.target.value)}
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500/80"
              placeholder="e.g. /Users/username/Projects or C:\Projects"
              required
            />
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-500 text-white p-2 rounded-lg transition duration-150 flex items-center justify-center shrink-0"
              title="Add Path"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          {dirError && <p className="text-[10px] text-red-400 mt-1">{dirError}</p>}
        </form>
      </div>

      {/* 2. Applications Allowlist */}
      <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-6 backdrop-blur-xl shadow-xl flex flex-col h-full">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-2">
          <Laptop className="h-4 w-4 text-indigo-400" />
          Approved Applications Allowlist
        </h3>
        <p className="text-xs text-zinc-400 mb-6">
          Astra is permitted to open, close, and list processes only for the verified applications declared in this allowlist.
        </p>

        {/* List of Apps */}
        <div className="flex-1 space-y-2 mb-6 overflow-y-auto max-h-[220px] pr-1">
          {apps.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-zinc-800 rounded-xl text-zinc-500 text-xs">
              No apps registered in allowlist yet. Application control is disabled.
            </div>
          ) : (
            apps.map((app) => (
              <div 
                key={`${app.app_name}-${app.app_path}`} 
                className="flex items-center justify-between p-3 bg-zinc-950/40 border border-zinc-800/60 rounded-xl hover:border-zinc-700/60 transition duration-150"
              >
                <div className="min-w-0 pr-2">
                  <span className="text-xs font-semibold text-white block truncate">{app.app_name}</span>
                  <span className="text-[10px] font-mono text-zinc-500 block truncate select-all">{app.app_path}</span>
                </div>
                <button
                  onClick={() => removeApp(app.app_name, app.app_path)}
                  className="p-1.5 hover:bg-red-500/10 text-zinc-500 hover:text-red-400 rounded-lg transition duration-150"
                  title="Remove App"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Add App Form */}
        <form onSubmit={handleAddApp} className="space-y-3 mt-auto border-t border-zinc-800/80 pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase font-mono text-zinc-500 mb-1">App Name</label>
              <input
                type="text"
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500/80"
                placeholder="e.g. VS Code"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-mono text-zinc-500 mb-1">Launcher/Binary Path</label>
              <input
                type="text"
                value={appPath}
                onChange={(e) => setAppPath(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500/80"
                placeholder="/usr/bin/code or C:\...\code.exe"
                required
              />
            </div>
          </div>
          <div className="flex justify-end pt-1">
            <button
              type="submit"
              className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition duration-150 shadow"
            >
              <Plus className="h-3.5 w-3.5" />
              Add App
            </button>
          </div>
          {appError && <p className="text-[10px] text-red-400 mt-1">{appError}</p>}
        </form>
      </div>
    </div>
  );
}
