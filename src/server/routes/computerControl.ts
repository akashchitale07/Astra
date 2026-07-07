import { Router, Response } from "express";
import crypto from "crypto";
import { dbGet, dbRun, dbAll } from "../db.js";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth.js";
import { encryptApiKey, decryptApiKey } from "../utils/crypto.js";

const router = Router();

// Get Computer Control settings, allowlists, and pairings
router.get("/settings", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const now = new Date().toISOString();

    // 1. Get or create computer_control_settings
    let settings = await dbGet("SELECT * FROM computer_control_settings WHERE user_id = ?", [userId]);
    if (!settings) {
      await dbRun(
        `INSERT INTO computer_control_settings (user_id, control_enabled, dry_run_default, require_double_confirm_highrisk, created_at, updated_at)
         VALUES (?, 0, 1, 1, ?, ?)`,
        [userId, now, now]
      );
      settings = await dbGet("SELECT * FROM computer_control_settings WHERE user_id = ?", [userId]);
    }

    // 2. Get allowed directories
    const directories = await dbAll("SELECT path, created_at FROM allowed_directories WHERE user_id = ?", [userId]);

    // 3. Get allowed apps
    const apps = await dbAll("SELECT app_name, app_path, created_at FROM allowed_apps WHERE user_id = ?", [userId]);

    // 4. Get pairings
    const pairingsRaw = await dbAll("SELECT device_name, token, created_at, last_seen_at FROM agent_pairings WHERE user_id = ?", [userId]);
    const pairings = pairingsRaw.map((p) => {
      let decryptedToken = "";
      try {
        decryptedToken = decryptApiKey(p.token);
      } catch (err) {
        decryptedToken = "Error Decrypting";
      }
      return {
        device_name: p.device_name,
        created_at: p.created_at,
        last_seen_at: p.last_seen_at,
        token_masked: decryptedToken.length > 8 ? `${decryptedToken.slice(0, 6)}...${decryptedToken.slice(-4)}` : "********",
        token: decryptedToken // return decrypted so frontend can connect directly
      };
    });

    return res.json({
      settings: {
        control_enabled: !!settings.control_enabled,
        dry_run_default: !!settings.dry_run_default,
        require_double_confirm_highrisk: !!settings.require_double_confirm_highrisk,
        created_at: settings.created_at,
        updated_at: settings.updated_at
      },
      directories,
      apps,
      pairings
    });
  } catch (error: any) {
    console.error("Get computer control settings error:", error);
    return res.status(500).json({ error: error.message || "Failed to fetch computer control settings" });
  }
});

// Update Computer Control settings
router.put("/settings", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { control_enabled, dry_run_default, require_double_confirm_highrisk } = req.body;
    const now = new Date().toISOString();

    await dbRun(
      `UPDATE computer_control_settings 
       SET control_enabled = ?, dry_run_default = ?, require_double_confirm_highrisk = ?, updated_at = ?
       WHERE user_id = ?`,
      [
        control_enabled ? 1 : 0,
        dry_run_default ? 1 : 0,
        require_double_confirm_highrisk ? 1 : 0,
        now,
        userId
      ]
    );

    return res.json({ success: true, message: "Settings updated successfully." });
  } catch (error: any) {
    console.error("Update computer control settings error:", error);
    return res.status(500).json({ error: error.message || "Failed to update computer control settings" });
  }
});

// Create/Register a new agent pairing
router.post("/pair", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { token, device_name } = req.body;

    if (!token || !device_name) {
      return res.status(400).json({ error: "Missing token or device name" });
    }

    const encryptedToken = encryptApiKey(token.trim());
    const now = new Date().toISOString();

    // delete existing pairings first so there's only one active paired agent per user (optional or support multi)
    await dbRun("INSERT OR REPLACE INTO agent_pairings (user_id, token, device_name, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?)", [
      userId,
      encryptedToken,
      device_name.trim(),
      now,
      now
    ]);

    return res.json({ success: true, message: "Agent paired successfully!" });
  } catch (error: any) {
    console.error("Pairing error:", error);
    return res.status(500).json({ error: error.message || "Failed to pair agent" });
  }
});

// Delete/Unpair agent
router.delete("/pair", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: "Missing token for unpairing" });
    }

    // Since we store encrypted token, we should find the correct pairing
    const pairings = await dbAll("SELECT token FROM agent_pairings WHERE user_id = ?", [userId]);
    let targetEncryptedToken = "";
    for (const p of pairings) {
      try {
        const dec = decryptApiKey(p.token);
        if (dec === token.trim()) {
          targetEncryptedToken = p.token;
          break;
        }
      } catch (e) {
        // ignore decryption error
      }
    }

    if (targetEncryptedToken) {
      await dbRun("DELETE FROM agent_pairings WHERE user_id = ? AND token = ?", [userId, targetEncryptedToken]);
      return res.json({ success: true, message: "Agent unpaired successfully." });
    }

    return res.status(404).json({ error: "Pairing not found" });
  } catch (error: any) {
    console.error("Unpairing error:", error);
    return res.status(500).json({ error: error.message || "Failed to unpair agent" });
  }
});

// Add allowed directory
router.post("/allowlists/directory", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { path: dirPath } = req.body;

    if (!dirPath) {
      return res.status(400).json({ error: "Missing directory path" });
    }

    const now = new Date().toISOString();
    await dbRun("INSERT OR IGNORE INTO allowed_directories (user_id, path, created_at) VALUES (?, ?, ?)", [
      userId,
      dirPath.trim(),
      now
    ]);

    return res.json({ success: true, message: "Directory added to allowlist." });
  } catch (error: any) {
    console.error("Add directory error:", error);
    return res.status(500).json({ error: error.message || "Failed to add directory" });
  }
});

// Delete allowed directory
router.delete("/allowlists/directory", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { path: dirPath } = req.body;

    if (!dirPath) {
      return res.status(400).json({ error: "Missing directory path" });
    }

    await dbRun("DELETE FROM allowed_directories WHERE user_id = ? AND path = ?", [userId, dirPath.trim()]);
    return res.json({ success: true, message: "Directory removed from allowlist." });
  } catch (error: any) {
    console.error("Remove directory error:", error);
    return res.status(500).json({ error: error.message || "Failed to remove directory" });
  }
});

// Add allowed app
router.post("/allowlists/app", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { app_name, app_path } = req.body;

    if (!app_name || !app_path) {
      return res.status(400).json({ error: "Missing app name or path" });
    }

    const now = new Date().toISOString();
    await dbRun("INSERT OR IGNORE INTO allowed_apps (user_id, app_name, app_path, created_at) VALUES (?, ?, ?, ?)", [
      userId,
      app_name.trim(),
      app_path.trim(),
      now
    ]);

    return res.json({ success: true, message: "Application added to allowlist." });
  } catch (error: any) {
    console.error("Add app error:", error);
    return res.status(500).json({ error: error.message || "Failed to add application" });
  }
});

// Delete allowed app
router.delete("/allowlists/app", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { app_name, app_path } = req.body;

    if (!app_name || !app_path) {
      return res.status(400).json({ error: "Missing app name or path" });
    }

    await dbRun("DELETE FROM allowed_apps WHERE user_id = ? AND app_name = ? AND app_path = ?", [
      userId,
      app_name.trim(),
      app_path.trim()
    ]);
    return res.json({ success: true, message: "Application removed from allowlist." });
  } catch (error: any) {
    console.error("Remove app error:", error);
    return res.status(500).json({ error: error.message || "Failed to remove application" });
  }
});

// Get action audit log
router.get("/audit-log", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const logs = await dbAll(
      "SELECT * FROM action_audit_log WHERE user_id = ? ORDER BY created_at DESC LIMIT 100",
      [userId]
    );
    return res.json({ logs });
  } catch (error: any) {
    console.error("Get audit log error:", error);
    return res.status(500).json({ error: error.message || "Failed to fetch audit logs" });
  }
});

// Log executing action
router.post("/audit-log", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { action_type, target, args, status, dry_run } = req.body;

    if (!action_type || !target || !status) {
      return res.status(400).json({ error: "Missing audit log details" });
    }

    const logId = crypto.randomUUID();
    const now = new Date().toISOString();

    await dbRun(
      `INSERT INTO action_audit_log (id, user_id, action_type, target, args, status, dry_run, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        logId,
        userId,
        action_type,
        target,
        args ? JSON.stringify(args) : null,
        status,
        dry_run ? 1 : 0,
        now
      ]
    );

    return res.json({ success: true, logId });
  } catch (error: any) {
    console.error("Add audit log error:", error);
    return res.status(500).json({ error: error.message || "Failed to add audit log" });
  }
});

export default router;
