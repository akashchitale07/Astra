import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import os from "os";
import { exec, execSync } from "child_process";

const app = express();
const PORT = 4123;
const CONFIG_FILE = path.resolve(process.cwd(), "config.json");

// Local state
let pairingToken = "";
let isKillSwitched = false;
const localLogs: any[] = [];

// Redact sensitive keys from log arguments
function redactArgs(args: any): any {
  if (!args) return args;
  const copy = JSON.parse(JSON.stringify(args));
  const sensitiveKeys = ["token", "apiKey", "password", "secret", "pairingToken"];
  for (const key of Object.keys(copy)) {
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
      copy[key] = "[REDACTED]";
    } else if (typeof copy[key] === "object") {
      copy[key] = redactArgs(copy[key]);
    }
  }
  return copy;
}

// Log action locally
function logLocal(actionType: string, target: string, args: any, status: string, dryRun: boolean) {
  const logEntry = {
    id: crypto.randomUUID(),
    actionType,
    target,
    args: redactArgs(args),
    status,
    dryRun,
    timestamp: new Date().toISOString()
  };
  localLogs.unshift(logEntry);
  if (localLogs.length > 500) {
    localLogs.pop();
  }
  // Also write to console
  console.log(`[LOG] ${logEntry.timestamp} | Action: ${actionType} | Target: ${target} | Status: ${status} | DryRun: ${dryRun}`);
}

// Initialize pairing token
function initConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, "utf8");
      const config = JSON.parse(raw);
      if (config.token) {
        pairingToken = config.token;
        console.log("-----------------------------------------");
        console.log(`🔑 Stored pairing token loaded: ${pairingToken}`);
        console.log("-----------------------------------------");
        return;
      }
    }
  } catch (err) {
    console.error("Failed to read agent config.json:", err);
  }

  // Generate a random pairing token if none exists
  pairingToken = "astra_" + crypto.randomBytes(6).toString("hex");
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify({ token: pairingToken }, null, 2), "utf8");
    console.log("-----------------------------------------");
    console.log("🆕 New pairing token generated for Astra!");
    console.log(`🔑 PAIRING TOKEN: ${pairingToken}`);
    console.log("⚠️ Copy this code and enter it in the Astra Web application.");
    console.log("-----------------------------------------");
  } catch (err) {
    console.error("Failed to save generated token to config.json:", err);
  }
}

initConfig();

// CORS config
app.use(cors({
  origin: (origin, callback) => {
    // Rejects non-localhost origins to protect the agent from external sites
    if (!origin) {
      callback(null, true);
      return;
    }
    const isLocalhost = origin.startsWith("http://localhost:") || 
                        origin.startsWith("http://127.0.0.1:") || 
                        origin.includes("ais-dev-") || 
                        origin.includes("ais-pre-") ||
                        origin.includes("ai.studio"); // Allow Google AI studio previews
    
    if (isLocalhost) {
      callback(null, true);
    } else {
      console.warn(`🚨 Blocked request from non-authorized origin: ${origin}`);
      callback(new Error("Not allowed by CORS: Non-localhost origins blocked."));
    }
  },
  credentials: true
}));

app.use(express.json({ limit: "50mb" }));

// Log middleware
app.use((req, res, next) => {
  console.log(`[Agent API] ${req.method} ${req.url}`);
  next();
});

// Authentication middleware for agent actions
const authenticateAgent = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const requestToken = req.headers["x-astra-token"] || req.query.token;
  if (!requestToken || requestToken !== pairingToken) {
    console.warn("🚨 Unauthorized attempt to access Agent API!");
    return res.status(401).json({ error: "Unauthorized: Invalid or missing pairing token." });
  }
  next();
};

// Endpoints
app.get("/status", (req, res) => {
  // Safe to hit without auth, but tells if paired or not masked
  const requestToken = req.headers["x-astra-token"] || req.query.token;
  res.json({
    status: isKillSwitched ? "stopped" : "running",
    paired: requestToken === pairingToken,
    os: process.platform,
    hostname: os.hostname(),
    arch: process.arch,
    killSwitched: isKillSwitched
  });
});

app.post("/pair", (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ error: "Missing token" });
  }
  if (token === pairingToken) {
    return res.json({ success: true, message: "Device paired successfully." });
  } else {
    return res.status(401).json({ error: "Invalid pairing token." });
  }
});

// Kill Switch
app.post("/stop", authenticateAgent, (req, res) => {
  isKillSwitched = true;
  logLocal("KILL_SWITCH", "agent", null, "TRIGGERED", false);
  res.json({ success: true, message: "EMERGENCY STOP ENFORCED. All computer actions paused." });
});

// Reset Kill Switch
app.post("/reset-killswitch", authenticateAgent, (req, res) => {
  isKillSwitched = false;
  logLocal("KILL_SWITCH_RESET", "agent", null, "RESET", false);
  res.json({ success: true, message: "Kill switch deactivated. Operations resumed." });
});

// Get local logs
app.get("/audit", authenticateAgent, (req, res) => {
  res.json({ logs: localLogs });
});

// Path validation helper (to protect from escaping approved paths)
function isPathAllowed(targetPath: string, allowedDirs: string[]): boolean {
  if (!allowedDirs || allowedDirs.length === 0) return false;
  const resolvedTarget = path.resolve(targetPath);
  return allowedDirs.some(dir => {
    const resolvedDir = path.resolve(dir);
    return resolvedTarget === resolvedDir || resolvedTarget.startsWith(resolvedDir + path.sep);
  });
}

// App allowlist helper
function isAppAllowed(appPath: string, allowedApps: any[]): boolean {
  if (!allowedApps || allowedApps.length === 0) return false;
  const resolvedAppPath = path.resolve(appPath).toLowerCase();
  return allowedApps.some(app => {
    const p1 = path.resolve(app.app_path).toLowerCase();
    const p2 = app.app_name.toLowerCase();
    return resolvedAppPath === p1 || resolvedAppPath.includes(p2);
  });
}

// Destructive blocklist check
const blocklistCommands = [
  "rm -rf", "format", "mkfs", "dd", "shutdown", "reboot", "del /f", "del /s", "rd /s",
  "registry", "reg delete", "net user", "chmod -r 777", "chown", "fork bomb"
];

function isCommandSafe(cmd: string): boolean {
  const cleanCmd = cmd.toLowerCase();
  return !blocklistCommands.some(block => cleanCmd.includes(block));
}

// Main ACTION endpoint
app.post("/action", authenticateAgent, async (req, res) => {
  if (isKillSwitched) {
    return res.status(403).json({ error: "Agent is currently in STOP mode. Deactivate kill switch first." });
  }

  const { action, args, dry_run = true, allowed_directories = [], allowed_apps = [] } = req.body;

  if (!action) {
    return res.status(400).json({ error: "No action specified." });
  }

  console.log(`[Action Dispatch] Received: ${action} | Dry Run: ${dry_run}`);

  try {
    // ------------------------------------------------------------------
    // APPLICATION CONTROL
    // ------------------------------------------------------------------
    if (action === "open_app") {
      const { app_path } = args;
      if (!app_path) throw new Error("Missing 'app_path' argument");

      // App Allowlist check
      if (!isAppAllowed(app_path, allowed_apps)) {
        throw new Error(`Access Denied: Application "${app_path}" is not in the allowlist.`);
      }

      if (dry_run) {
        logLocal("open_app", app_path, args, "DRY_RUN_APPROVED", true);
        return res.json({ success: true, dry_run: true, preview: `Would launch application at: "${app_path}"` });
      }

      // Live Execution
      const osPlatform = process.platform;
      let cmd = "";
      if (osPlatform === "win32") {
        cmd = `start "" "${app_path}"`;
      } else if (osPlatform === "darwin") {
        cmd = `open "${app_path}"`;
      } else {
        cmd = `"${app_path}" &`;
      }

      exec(cmd, (err) => {
        if (err) console.error("Launch app error:", err);
      });

      logLocal("open_app", app_path, args, "EXECUTED", false);
      return res.json({ success: true, result: `Launched application "${app_path}"` });
    }

    if (action === "close_app") {
      const { app_name } = args;
      if (!app_name) throw new Error("Missing 'app_name' argument");

      if (dry_run) {
        logLocal("close_app", app_name, args, "DRY_RUN_APPROVED", true);
        return res.json({ success: true, dry_run: true, preview: `Would force-close application process matching: "${app_name}"` });
      }

      const osPlatform = process.platform;
      const cmd = osPlatform === "win32" ? `taskkill /IM "${app_name}*" /F` : `pkill -f "${app_name}"`;

      try {
        execSync(cmd);
        logLocal("close_app", app_name, args, "EXECUTED", false);
        return res.json({ success: true, result: `Closed application processes matching "${app_name}"` });
      } catch (err: any) {
        throw new Error(`Failed to close app: ${err.message}`);
      }
    }

    if (action === "list_apps") {
      if (dry_run) {
        logLocal("list_apps", "system", args, "DRY_RUN_APPROVED", true);
        return res.json({ success: true, dry_run: true, preview: `Would fetch list of active background/foreground application processes` });
      }

      const osPlatform = process.platform;
      const cmd = osPlatform === "win32" ? "tasklist" : "ps -e -o comm=";
      const output = execSync(cmd).toString();
      const processes = Array.from(new Set(output.split("\n").map(p => p.trim()).filter(Boolean)));

      logLocal("list_apps", "system", args, "EXECUTED", false);
      return res.json({ success: true, processes: processes.slice(0, 100) });
    }

    // ------------------------------------------------------------------
    // BROWSER CONTROL
    // ------------------------------------------------------------------
    if (action === "open_url") {
      const { url } = args;
      if (!url) throw new Error("Missing 'url' argument");
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        throw new Error("Invalid URL. Must begin with http:// or https://");
      }

      if (dry_run) {
        logLocal("open_url", url, args, "DRY_RUN_APPROVED", true);
        return res.json({ success: true, dry_run: true, preview: `Would open default browser to URL: "${url}"` });
      }

      const osPlatform = process.platform;
      const cmd = osPlatform === "win32" ? `start "" "${url}"` : osPlatform === "darwin" ? `open "${url}"` : `xdg-open "${url}"`;

      execSync(cmd);
      logLocal("open_url", url, args, "EXECUTED", false);
      return res.json({ success: true, result: `Opened default browser to "${url}"` });
    }

    // ------------------------------------------------------------------
    // DEVELOPER TOOLS
    // ------------------------------------------------------------------
    if (action === "open_vscode") {
      const { target_path } = args;
      if (!target_path) throw new Error("Missing 'target_path' argument");

      if (!isPathAllowed(target_path, allowed_directories)) {
        throw new Error(`Access Denied: Path "${target_path}" is not inside allowed directories.`);
      }

      if (dry_run) {
        logLocal("open_vscode", target_path, args, "DRY_RUN_APPROVED", true);
        return res.json({ success: true, dry_run: true, preview: `Would launch VS Code inside directory: "${target_path}"` });
      }

      exec(`code "${target_path}"`, (err) => {
        if (err) console.error("Launch VS Code failed:", err);
      });

      logLocal("open_vscode", target_path, args, "EXECUTED", false);
      return res.json({ success: true, result: `VS Code opened on workspace: "${target_path}"` });
    }

    if (action === "open_terminal") {
      const { target_path } = args;
      const workDir = target_path || process.cwd();

      if (target_path && !isPathAllowed(target_path, allowed_directories)) {
        throw new Error(`Access Denied: Path "${target_path}" is not inside allowed directories.`);
      }

      if (dry_run) {
        logLocal("open_terminal", workDir, args, "DRY_RUN_APPROVED", true);
        return res.json({ success: true, dry_run: true, preview: `Would spawn a native terminal shell rooted in: "${workDir}"` });
      }

      const osPlatform = process.platform;
      let cmd = "";
      if (osPlatform === "win32") {
        cmd = `start cmd.exe /K "cd /d ${workDir}"`;
      } else if (osPlatform === "darwin") {
        cmd = `osascript -e 'tell app "Terminal" to do script "cd ${workDir}"'`;
      } else {
        cmd = `x-terminal-emulator --working-directory="${workDir}" &`;
      }

      exec(cmd);
      logLocal("open_terminal", workDir, args, "EXECUTED", false);
      return res.json({ success: true, result: `Spawned system terminal rooted in "${workDir}"` });
    }

    // ------------------------------------------------------------------
    // FILE OPERATIONS (Path-restricted)
    // ------------------------------------------------------------------
    if ([
      "create_folder", "rename_file", "copy_file", "move_file", 
      "search_files", "delete_file"
    ].includes(action)) {
      
      // Enforce directories allowlist
      const checkPath = (p: string) => {
        if (!p) return;
        if (!isPathAllowed(p, allowed_directories)) {
          throw new Error(`Access Denied: Path "${p}" is outside the user's approved folders.`);
        }
      };

      if (action === "create_folder") {
        const { folder_path } = args;
        if (!folder_path) throw new Error("Missing 'folder_path'");
        checkPath(folder_path);

        if (dry_run) {
          logLocal("create_folder", folder_path, args, "DRY_RUN_APPROVED", true);
          return res.json({ success: true, dry_run: true, preview: `Would create directory: "${folder_path}"` });
        }

        fs.mkdirSync(path.resolve(folder_path), { recursive: true });
        logLocal("create_folder", folder_path, args, "EXECUTED", false);
        return res.json({ success: true, result: `Created directory at "${folder_path}"` });
      }

      if (action === "rename_file") {
        const { old_path, new_path } = args;
        if (!old_path || !new_path) throw new Error("Missing 'old_path' or 'new_path'");
        checkPath(old_path);
        checkPath(new_path);

        if (dry_run) {
          logLocal("rename_file", old_path, args, "DRY_RUN_APPROVED", true);
          return res.json({ success: true, dry_run: true, preview: `Would rename "${old_path}" to "${new_path}"` });
        }

        fs.renameSync(path.resolve(old_path), path.resolve(new_path));
        logLocal("rename_file", old_path, args, "EXECUTED", false);
        return res.json({ success: true, result: `Renamed item from "${old_path}" to "${new_path}"` });
      }

      if (action === "copy_file") {
        const { src_path, dest_path } = args;
        if (!src_path || !dest_path) throw new Error("Missing 'src_path' or 'dest_path'");
        checkPath(src_path);
        checkPath(dest_path);

        if (dry_run) {
          logLocal("copy_file", src_path, args, "DRY_RUN_APPROVED", true);
          return res.json({ success: true, dry_run: true, preview: `Would copy file from "${src_path}" to "${dest_path}"` });
        }

        fs.copyFileSync(path.resolve(src_path), path.resolve(dest_path));
        logLocal("copy_file", src_path, args, "EXECUTED", false);
        return res.json({ success: true, result: `Copied file from "${src_path}" to "${dest_path}"` });
      }

      if (action === "move_file") {
        const { src_path, dest_path } = args;
        if (!src_path || !dest_path) throw new Error("Missing 'src_path' or 'dest_path'");
        checkPath(src_path);
        checkPath(dest_path);

        if (dry_run) {
          logLocal("move_file", src_path, args, "DRY_RUN_APPROVED", true);
          return res.json({ success: true, dry_run: true, preview: `Would move file from "${src_path}" to "${dest_path}"` });
        }

        fs.renameSync(path.resolve(src_path), path.resolve(dest_path));
        logLocal("move_file", src_path, args, "EXECUTED", false);
        return res.json({ success: true, result: `Moved file from "${src_path}" to "${dest_path}"` });
      }

      if (action === "search_files") {
        const { root_path, query } = args;
        if (!root_path || !query) throw new Error("Missing 'root_path' or 'query'");
        checkPath(root_path);

        if (dry_run) {
          logLocal("search_files", root_path, args, "DRY_RUN_APPROVED", true);
          return res.json({ success: true, dry_run: true, preview: `Would recursively search for files named "*${query}*" in directory: "${root_path}"` });
        }

        const matches: string[] = [];
        const searchDir = (dir: string) => {
          const items = fs.readdirSync(dir);
          for (const item of items) {
            const fullPath = path.join(dir, item);
            try {
              const stat = fs.statSync(fullPath);
              if (item.toLowerCase().includes(query.toLowerCase())) {
                matches.push(fullPath);
              }
              if (stat.isDirectory() && !item.startsWith(".")) {
                searchDir(fullPath);
              }
            } catch (err) {
              // ignore unreadable stats
            }
          }
        };

        searchDir(path.resolve(root_path));
        logLocal("search_files", root_path, args, "EXECUTED", false);
        return res.json({ success: true, matches: matches.slice(0, 50) });
      }

      if (action === "delete_file") {
        const { file_path, recursive = false } = args;
        if (!file_path) throw new Error("Missing 'file_path'");
        checkPath(file_path);

        if (dry_run) {
          logLocal("delete_file", file_path, args, "DRY_RUN_APPROVED", true);
          return res.json({ success: true, dry_run: true, preview: `Would delete file/folder at: "${file_path}" (Recursive: ${recursive})` });
        }

        const resolved = path.resolve(file_path);
        const stat = fs.statSync(resolved);
        if (stat.isDirectory()) {
          if (!recursive) {
            throw new Error("Cannot delete a directory without specifying 'recursive' opt-in.");
          }
          fs.rmSync(resolved, { recursive: true, force: true });
        } else {
          fs.unlinkSync(resolved);
        }

        logLocal("delete_file", file_path, args, "EXECUTED", false);
        return res.json({ success: true, result: `Permanently deleted file/folder at "${file_path}"` });
      }
    }

    // ------------------------------------------------------------------
    // HIGH-RISK COMMAND EXECUTION
    // ------------------------------------------------------------------
    if (action === "execute_command") {
      const { command, cwd } = args;
      if (!command) throw new Error("Missing 'command' argument");

      if (cwd && !isPathAllowed(cwd, allowed_directories)) {
        throw new Error(`Access Denied: Working directory "${cwd}" is not in approved folders.`);
      }

      if (!isCommandSafe(command)) {
        throw new Error("Action Aborted: Command matches safety blocklist of destructive actions!");
      }

      if (dry_run) {
        logLocal("execute_command", command, args, "DRY_RUN_APPROVED", true);
        return res.json({ success: true, dry_run: true, preview: `Would run shell command: "${command}" in folder: "${cwd || "default agent root"}"` });
      }

      try {
        const options = cwd ? { cwd: path.resolve(cwd) } : {};
        const output = execSync(command, { ...options, timeout: 15000 }).toString();

        logLocal("execute_command", command, args, "EXECUTED", false);
        return res.json({ success: true, stdout: output });
      } catch (err: any) {
        throw new Error(`Shell execution failed: ${err.stderr?.toString() || err.message}`);
      }
    }

    // ------------------------------------------------------------------
    // SCREEN & INPUT AUTOMATION
    // ------------------------------------------------------------------
    if (action === "take_screenshot") {
      if (dry_run) {
        logLocal("take_screenshot", "screen", args, "DRY_RUN_APPROVED", true);
        return res.json({ success: true, dry_run: true, preview: "Would capture screen display output" });
      }

      const osPlatform = process.platform;
      const tmpPath = path.join(os.tmpdir(), `astra_snap_${Date.now()}.png`);

      try {
        if (osPlatform === "darwin") {
          execSync(`screencapture -t png -x "${tmpPath}"`);
        } else if (osPlatform === "win32") {
          // PowerShell Native .NET assembly capture
          const psScript = `
            Add-Type -AssemblyName System.Windows.Forms
            Add-Type -AssemblyName System.Drawing
            $screen = [System.Windows.Forms.Screen]::PrimaryScreen
            $bounds = $screen.Bounds
            $bmp = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
            $graphics = [System.Drawing.Graphics]::FromImage($bmp)
            $graphics.CopyFromScreen($bounds.Location.X, $bounds.Location.Y, 0, 0, $bounds.Size)
            $bmp.Save("${tmpPath}")
            $graphics.Dispose()
            $bmp.Dispose()
          `;
          execSync(`powershell -Command "${psScript.replace(/\n/g, ' ')}"`);
        } else {
          // Linux
          execSync(`gnome-screenshot -f "${tmpPath}" || scrot "${tmpPath}" || import -window root "${tmpPath}"`);
        }

        if (!fs.existsSync(tmpPath)) {
          throw new Error("Screenshot utility was unable to produce a file.");
        }

        const data64 = fs.readFileSync(tmpPath, { encoding: "base64" });
        fs.unlinkSync(tmpPath); // clean up

        logLocal("take_screenshot", "screen", args, "EXECUTED", false);
        return res.json({ success: true, screenshot: `data:image/png;base64,${data64}` });
      } catch (err: any) {
        throw new Error(`Failed to take screenshot: ${err.message}`);
      }
    }

    if (action === "clipboard_read") {
      if (dry_run) {
        logLocal("clipboard_read", "clipboard", args, "DRY_RUN_APPROVED", true);
        return res.json({ success: true, dry_run: true, preview: "Would read current system clipboard contents" });
      }

      const osPlatform = process.platform;
      let text = "";
      try {
        if (osPlatform === "win32") {
          text = execSync("powershell -Command Get-Clipboard").toString().trim();
        } else if (osPlatform === "darwin") {
          text = execSync("pbpaste").toString().trim();
        } else {
          text = execSync("xclip -selection clipboard -o || xsel --clipboard --output").toString().trim();
        }
      } catch (e) {
        text = ""; // Empty or failed
      }

      logLocal("clipboard_read", "clipboard", args, "EXECUTED", false);
      return res.json({ success: true, text });
    }

    if (action === "clipboard_write") {
      const { text } = args;
      if (text === undefined) throw new Error("Missing 'text' argument");

      if (dry_run) {
        logLocal("clipboard_write", "clipboard", args, "DRY_RUN_APPROVED", true);
        return res.json({ success: true, dry_run: true, preview: `Would write the following string to clipboard: "${text.slice(0, 100)}${text.length > 100 ? "..." : ""}"` });
      }

      const osPlatform = process.platform;
      try {
        if (osPlatform === "win32") {
          execSync(`powershell -Command "Set-Clipboard -Value '${text.replace(/'/g, "''")}'"`);
        } else if (osPlatform === "darwin") {
          const proc = exec("pbcopy");
          proc.stdin?.write(text);
          proc.stdin?.end();
        } else {
          const proc = exec("xclip -selection clipboard");
          proc.stdin?.write(text);
          proc.stdin?.end();
        }
      } catch (err: any) {
        throw new Error(`Clipboard write failed: ${err.message}`);
      }

      logLocal("clipboard_write", "clipboard", args, "EXECUTED", false);
      return res.json({ success: true, result: "Copied text to clipboard." });
    }

    // Interactive controls window management & keyboard/mouse simulators (High-Risk)
    if (action === "window_manage") {
      const { window_action, app_name } = args; // minimize, maximize, focus
      if (!window_action || !app_name) throw new Error("Missing window_action or app_name");

      if (dry_run) {
        logLocal("window_manage", app_name, args, "DRY_RUN_APPROVED", true);
        return res.json({ success: true, dry_run: true, preview: `Would trigger window action: "${window_action}" on app matching: "${app_name}"` });
      }

      const osPlatform = process.platform;
      if (osPlatform === "darwin") {
        const applescript = `
          tell application "System Events"
            tell application process "${app_name}"
              set frontmost to true
              if "${window_action}" is "minimize" then
                set value of attribute "AXMiniaturized" of every window to true
              end if
            end tell
          end tell
        `;
        exec(`osascript -e '${applescript}'`);
      } else if (osPlatform === "win32") {
        // Simple PowerShell automation
        const ps = `
          $wshell = New-Object -ComObject Wscript.Shell;
          $wshell.AppActivate("${app_name}")
        `;
        exec(`powershell -Command "${ps.replace(/\n/g, ' ')}"`);
      }

      logLocal("window_manage", app_name, args, "EXECUTED", false);
      return res.json({ success: true, result: `Performed window state change "${window_action}" on "${app_name}"` });
    }

    if (action === "keyboard_type") {
      const { text } = args;
      if (!text) throw new Error("Missing 'text' to type");

      if (dry_run) {
        logLocal("keyboard_type", "keyboard", args, "DRY_RUN_APPROVED", true);
        return res.json({ success: true, dry_run: true, preview: `Would simulate keyboard keystrokes typing: "${text}"` });
      }

      const osPlatform = process.platform;
      if (osPlatform === "win32") {
        const ps = `
          Add-Type -AssemblyName System.Windows.Forms
          [System.Windows.Forms.SendKeys]::SendWait("${text.replace(/["'%&]/g, '')}")
        `;
        execSync(`powershell -Command "${ps.replace(/\n/g, ' ')}"`);
      } else if (osPlatform === "darwin") {
        execSync(`osascript -e 'tell application "System Events" to keystroke "${text.replace(/"/g, '\\"')}"'`);
      } else {
        execSync(`xdotool type "${text}"`);
      }

      logLocal("keyboard_type", "keyboard", args, "EXECUTED", false);
      return res.json({ success: true, result: `Typed text: "${text}"` });
    }

    if (action === "mouse_click") {
      const { x, y } = args; // optional coordinates
      const targetDesc = x !== undefined && y !== undefined ? `at coordinates (${x}, ${y})` : "at current cursor position";

      if (dry_run) {
        logLocal("mouse_click", "mouse", args, "DRY_RUN_APPROVED", true);
        return res.json({ success: true, dry_run: true, preview: `Would simulate system mouse left-click ${targetDesc}` });
      }

      const osPlatform = process.platform;
      if (osPlatform === "win32") {
        let ps = "";
        if (x !== undefined && y !== undefined) {
          ps = `
            [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x}, ${y})
          `;
        }
        // simulate click
        ps += `
          $signature = '[DllImport("user32.dll")] public static extern void mouse_event(int dwFlags, int dx, int dy, int cButtons, int dwExtraInfo);'
          $type = Add-Type -MemberDefinition $signature -Name "Win32Mouse" -Namespace "Win32" -PassThru
          $type::mouse_event(0x0002, 0, 0, 0, 0) # left down
          $type::mouse_event(0x0004, 0, 0, 0, 0) # left up
        `;
        execSync(`powershell -Command "${ps.replace(/\n/g, ' ')}"`);
      } else if (osPlatform === "darwin") {
        let osascript = "";
        if (x !== undefined && y !== undefined) {
          // requires click tools or fallback to python
          osascript = `
            tell application "System Events"
              click at {${x}, ${y}}
            end tell
          `;
        } else {
          osascript = `
            tell application "System Events"
              click
            end tell
          `;
        }
        exec(`osascript -e '${osascript}'`);
      } else {
        if (x !== undefined && y !== undefined) {
          execSync(`xdotool mousemove ${x} ${y} click 1`);
        } else {
          execSync("xdotool click 1");
        }
      }

      logLocal("mouse_click", "mouse", args, "EXECUTED", false);
      return res.json({ success: true, result: `Simulated mouse click ${targetDesc}` });
    }

    throw new Error(`Unsupported action/capability type: "${action}"`);

  } catch (error: any) {
    console.error(`Action error [${action}]:`, error);
    logLocal(action, args?.file_path || args?.app_path || args?.url || "error", args, "FAILED: " + error.message, false);
    return res.status(500).json({ error: error.message || "Failed to execute computer action." });
  }
});

// Start listening
app.listen(PORT, "127.0.0.1", () => {
  console.log(`🚀 Astra Agent local server listening on http://127.0.0.1:${PORT}`);
  console.log("🔒 Access strictly restricted to localhost requests.");
});
