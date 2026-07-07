import { Router, Response } from "express";
import crypto from "crypto";
import { dbGet, dbRun } from "../db.js";
import { hashPassword, verifyPassword, createAccessToken } from "../auth/security.js";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth.js";

const router = Router();

// 1. Signup Route
router.post("/signup", async (req, res) => {
  try {
    const { email, password, display_name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long" });
    }

    // Check if user already exists
    const existingUser = await dbGet("SELECT id FROM users WHERE email = ?", [email.toLowerCase()]);
    if (existingUser) {
      return res.status(400).json({ error: "A user with this email already exists" });
    }

    const userId = crypto.randomUUID();
    const hashedPassword = hashPassword(password);
    const now = new Date().toISOString();
    const name = display_name || email.split("@")[0];

    // Create User record
    await dbRun(
      "INSERT INTO users (id, email, hashed_password, display_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      [userId, email.toLowerCase(), hashedPassword, name, now, now]
    );

    // Create UserSettings record
    const settingsId = crypto.randomUUID();
    await dbRun(
      "INSERT INTO user_settings (id, user_id, encrypted_api_key, api_key_masked, theme, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [settingsId, userId, null, null, "dark", now, now]
    );

    const token = createAccessToken(userId, email.toLowerCase());

    return res.status(201).json({
      token,
      user: {
        id: userId,
        email: email.toLowerCase(),
        display_name: name,
      },
    });
  } catch (error) {
    console.error("Signup error:", error);
    return res.status(500).json({ error: "Internal server error during registration" });
  }
});

// 2. Login Route
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await dbGet("SELECT * FROM users WHERE email = ?", [email.toLowerCase()]);
    if (!user) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    const isValidPassword = verifyPassword(password, user.hashed_password);
    if (!isValidPassword) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    const token = createAccessToken(user.id, user.email);

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Internal server error during login" });
  }
});

// 3. Get Profile Route
router.get("/profile", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await dbGet("SELECT id, email, display_name, created_at FROM users WHERE id = ?", [
      req.user?.id,
    ]);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    return res.json({ user });
  } catch (error) {
    console.error("Get profile error:", error);
    return res.status(500).json({ error: "Internal server error fetching profile" });
  }
});

// 4. Update Profile Route
router.put("/profile", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { display_name, email } = req.body;
    const userId = req.user?.id;

    if (!display_name && !email) {
      return res.status(400).json({ error: "Display name or email is required to update" });
    }

    const now = new Date().toISOString();

    if (email && email.toLowerCase() !== req.user?.email) {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: "Invalid email format" });
      }

      // Check email uniqueness
      const existingUser = await dbGet("SELECT id FROM users WHERE email = ? AND id != ?", [
        email.toLowerCase(),
        userId,
      ]);
      if (existingUser) {
        return res.status(400).json({ error: "This email is already taken" });
      }

      await dbRun(
        "UPDATE users SET display_name = COALESCE(?, display_name), email = ?, updated_at = ? WHERE id = ?",
        [display_name, email.toLowerCase(), now, userId]
      );
    } else {
      await dbRun("UPDATE users SET display_name = COALESCE(?, display_name), updated_at = ? WHERE id = ?", [
        display_name,
        now,
        userId,
      ]);
    }

    const updatedUser = await dbGet("SELECT id, email, display_name FROM users WHERE id = ?", [userId]);

    return res.json({
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Update profile error:", error);
    return res.status(500).json({ error: "Internal server error updating profile" });
  }
});

export default router;
