import { useState, useEffect, useCallback } from "react";
import { 
  ComputerControlSettings, 
  AllowedDirectory, 
  AllowedApp, 
  PairingInfo, 
  ActionAuditLog 
} from "../types";

export function useAstraAgent() {
  const [settings, setSettings] = useState<ComputerControlSettings | null>(null);
  const [directories, setDirectories] = useState<AllowedDirectory[]>([]);
  const [apps, setApps] = useState<AllowedApp[]>([]);
  const [pairings, setPairings] = useState<PairingInfo[]>([]);
  const [logs, setLogs] = useState<ActionAuditLog[]>([]);
  
  const [agentConnected, setAgentConnected] = useState<boolean>(false);
  const [agentStatus, setAgentStatus] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isKillSwitched, setIsKillSwitched] = useState<boolean>(false);

  const getAuthHeaders = () => {
    const token = localStorage.getItem("astra_token");
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  };

  // 1. Fetch system settings, pairings, and logs from our server
  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/computer-control/settings", {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch settings");
      const data = await res.json();
      setSettings(data.settings);
      setDirectories(data.directories || []);
      setApps(data.apps || []);
      setPairings(data.pairings || []);
    } catch (err) {
      console.error("Error fetching agent settings:", err);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch("/api/computer-control/audit-log", {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch audit log");
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (err) {
      console.error("Error fetching action logs:", err);
    }
  }, []);

  // 2. Poll/Check local companion agent status directly on localhost:4123
  const checkAgentConnection = useCallback(async () => {
    if (pairings.length === 0) {
      setAgentConnected(false);
      setAgentStatus(null);
      setIsKillSwitched(false);
      return;
    }

    const activeToken = pairings[0]?.token;
    if (!activeToken) {
      setAgentConnected(false);
      return;
    }

    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 1500); // short timeout

      const res = await fetch(`http://127.0.0.1:4123/status?token=${activeToken}`, {
        method: "GET",
        signal: controller.signal
      });
      clearTimeout(id);

      if (res.ok) {
        const status = await res.json();
        setAgentConnected(true);
        setAgentStatus(status);
        setIsKillSwitched(status.killSwitched || status.status === "stopped");
      } else {
        setAgentConnected(false);
        setAgentStatus(null);
      }
    } catch (err) {
      setAgentConnected(false);
      setAgentStatus(null);
    }
  }, [pairings]);

  // Load everything on mount & settings change
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchSettings();
      await fetchLogs();
      setLoading(false);
    };
    load();
  }, [fetchSettings, fetchLogs]);

  // Regularly check localhost connection
  useEffect(() => {
    checkAgentConnection();
    const interval = setInterval(checkAgentConnection, 5000);
    return () => clearInterval(interval);
  }, [checkAgentConnection]);

  // 3. Update server side control settings
  const updateSettings = async (updates: Partial<ComputerControlSettings>) => {
    try {
      const payload = { ...settings, ...updates };
      const res = await fetch("/api/computer-control/settings", {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to update settings");
      await fetchSettings();
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  // 4. Pair local agent
  const pairAgent = async (token: string, device_name: string) => {
    try {
      // Step 1: Register in database
      const dbRes = await fetch("/api/computer-control/pair", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ token, device_name }),
      });
      if (!dbRes.ok) {
        const errData = await dbRes.json();
        throw new Error(errData.error || "Failed to save pairing token in db");
      }

      // Step 2: Try pairing local agent on localhost directly to confirm
      const agentRes = await fetch("http://127.0.0.1:4123/pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      await fetchSettings();
      if (!agentRes.ok) {
        return { success: true, localWarning: "Saved token but could not contact local agent on http://127.0.0.1:4123. Make sure the agent is running." };
      }

      return { success: true };
    } catch (err: any) {
      console.error(err);
      return { success: false, error: err.message };
    }
  };

  // 5. Unpair agent
  const unpairAgent = async (token: string) => {
    try {
      const res = await fetch("/api/computer-control/pair", {
        method: "DELETE",
        headers: getAuthHeaders(),
        body: JSON.stringify({ token }),
      });
      if (!res.ok) throw new Error("Unpairing failed");
      await fetchSettings();
      setAgentConnected(false);
      setAgentStatus(null);
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  // Allowlist Managers
  const addDirectory = async (path: string) => {
    try {
      const res = await fetch("/api/computer-control/allowlists/directory", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ path }),
      });
      if (!res.ok) throw new Error("Failed to add directory");
      await fetchSettings();
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  const removeDirectory = async (path: string) => {
    try {
      const res = await fetch("/api/computer-control/allowlists/directory", {
        method: "DELETE",
        headers: getAuthHeaders(),
        body: JSON.stringify({ path }),
      });
      if (!res.ok) throw new Error("Failed to remove directory");
      await fetchSettings();
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  const addApp = async (app_name: string, app_path: string) => {
    try {
      const res = await fetch("/api/computer-control/allowlists/app", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ app_name, app_path }),
      });
      if (!res.ok) throw new Error("Failed to add app");
      await fetchSettings();
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  const removeApp = async (app_name: string, app_path: string) => {
    try {
      const res = await fetch("/api/computer-control/allowlists/app", {
        method: "DELETE",
        headers: getAuthHeaders(),
        body: JSON.stringify({ app_name, app_path }),
      });
      if (!res.ok) throw new Error("Failed to remove app");
      await fetchSettings();
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  // 6. Global Kill Switch Controllers
  const triggerKillSwitch = async () => {
    const activeToken = pairings[0]?.token;
    if (!activeToken) return false;
    try {
      const res = await fetch("http://127.0.0.1:4123/stop", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Astra-Token": activeToken,
        },
      });
      if (res.ok) {
        setIsKillSwitched(true);
        // Log to backend audit log
        await fetch("/api/computer-control/audit-log", {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            action_type: "KILL_SWITCH",
            target: "agent",
            status: "TRIGGERED",
            dry_run: false,
          }),
        });
        await fetchLogs();
        return true;
      }
      return false;
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  const resetKillSwitch = async () => {
    const activeToken = pairings[0]?.token;
    if (!activeToken) return false;
    try {
      const res = await fetch("http://127.0.0.1:4123/reset-killswitch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Astra-Token": activeToken,
        },
      });
      if (res.ok) {
        setIsKillSwitched(false);
        await fetch("/api/computer-control/audit-log", {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            action_type: "KILL_SWITCH_RESET",
            target: "agent",
            status: "RESET",
            dry_run: false,
          }),
        });
        await fetchLogs();
        return true;
      }
      return false;
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  // 7. Execute individual action
  const executeAction = async (action: string, args: Record<string, any>, dry_run: boolean = true) => {
    if (pairings.length === 0) {
      return { success: false, error: "Astra Agent not paired." };
    }
    const activeToken = pairings[0]?.token;
    if (!activeToken) {
      return { success: false, error: "Astra Agent pairing token is missing." };
    }

    try {
      // Check if global settings allow computer control
      if (settings && !settings.control_enabled) {
        return { success: false, error: "Computer Control is currently disabled in Settings. Enable it first." };
      }

      // Pre-validation directories and apps checks (done client side as well for smooth experience)
      const allowedDirPaths = directories.map(d => d.path);
      
      // Perform local agent request
      const res = await fetch("http://127.0.0.1:4123/action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Astra-Token": activeToken,
        },
        body: JSON.stringify({
          action,
          args,
          dry_run,
          allowed_directories: allowedDirPaths,
          allowed_apps: apps
        }),
      });

      const responseData = await res.json();

      // Log execution status to central audit logs on the server
      await fetch("/api/computer-control/audit-log", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          action_type: action,
          target: args.file_path || args.app_path || args.url || "system",
          args,
          status: res.ok ? (dry_run ? "DRY_RUN_APPROVED" : "EXECUTED") : "FAILED",
          dry_run
        }),
      });

      await fetchLogs();

      if (!res.ok) {
        return { success: false, error: responseData.error || "Execution failed." };
      }

      return { success: true, data: responseData };
    } catch (err: any) {
      console.error("Action execution error:", err);
      return { success: false, error: err.message || "Failed to reach local agent." };
    }
  };

  return {
    settings,
    directories,
    apps,
    pairings,
    logs,
    agentConnected,
    agentStatus,
    loading,
    isKillSwitched,
    fetchSettings,
    fetchLogs,
    updateSettings,
    pairAgent,
    unpairAgent,
    addDirectory,
    removeDirectory,
    addApp,
    removeApp,
    triggerKillSwitch,
    resetKillSwitch,
    executeAction,
  };
}
