import { Router, Response } from "express";
import crypto from "crypto";
import { dbGet, dbRun } from "../db.js";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth.js";
import { encryptApiKey, maskApiKey } from "../utils/crypto.js";

const router = Router();

// 1. Get User Settings
router.get("/", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    let settings = await dbGet("SELECT * FROM user_settings WHERE user_id = ?", [userId]);

    // If settings don't exist for some reason, create them
    if (!settings) {
      const now = new Date().toISOString();
      const settingsId = crypto.randomUUID();
      await dbRun(
        "INSERT INTO user_settings (id, user_id, encrypted_api_key, api_key_masked, theme, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [settingsId, userId, null, null, "dark", now, now]
      );
      settings = await dbGet("SELECT * FROM user_settings WHERE user_id = ?", [userId]);
    }

    return res.json({
      settings: {
        theme: settings.theme,
        api_key_masked: settings.api_key_masked || "",
      },
    });
  } catch (error) {
    console.error("Get settings error:", error);
    return res.status(500).json({ error: "Internal server error fetching settings" });
  }
});

// 2. Update User Settings
router.put("/", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { theme, api_key } = req.body;

    const now = new Date().toISOString();
    let settings = await dbGet("SELECT * FROM user_settings WHERE user_id = ?", [userId]);

    if (!settings) {
      const settingsId = crypto.randomUUID();
      await dbRun(
        "INSERT INTO user_settings (id, user_id, encrypted_api_key, api_key_masked, theme, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [settingsId, userId, null, null, "dark", now, now]
      );
      settings = await dbGet("SELECT * FROM user_settings WHERE user_id = ?", [userId]);
    }

    let encryptedKey = settings.encrypted_api_key;
    let maskedKey = settings.api_key_masked;

    // If an API key was provided, encrypt it and store it
    if (api_key !== undefined) {
      if (api_key === "") {
        encryptedKey = null;
        maskedKey = null;
      } else if (api_key.includes("...")) {
        // Do not re-encrypt if they sent the masked key back
        // Just keep the current keys
      } else {
        encryptedKey = encryptApiKey(api_key);
        maskedKey = maskApiKey(api_key);
      }
    }

    const nextTheme = theme || settings.theme || "dark";

    await dbRun(
      "UPDATE user_settings SET theme = ?, encrypted_api_key = ?, api_key_masked = ?, updated_at = ? WHERE user_id = ?",
      [nextTheme, encryptedKey, maskedKey, now, userId]
    );

    return res.json({
      message: "Settings updated successfully",
      settings: {
        theme: nextTheme,
        api_key_masked: maskedKey || "",
      },
    });
  } catch (error) {
    console.error("Update settings error:", error);
    return res.status(500).json({ error: "Internal server error updating settings" });
  }
});

export default router;
