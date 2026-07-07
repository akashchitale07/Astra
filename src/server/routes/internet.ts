import { Router, Response } from "express";
import crypto from "crypto";
import { dbGet, dbAll, dbRun } from "../db.js";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth.js";
import { encryptApiKey, decryptApiKey, maskApiKey } from "../utils/crypto.js";
import { SearchService } from "../services/searchService.js";
import { WebFetchService } from "../services/webFetchService.js";
import { ResearchService } from "../services/researchService.js";
import { DataProviderService } from "../services/dataProviderService.js";
import { WebCacheService } from "../services/webCacheService.js";

const router = Router();

// 1. Get Data Source Settings
router.get("/settings", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const rows = await dbAll(
      "SELECT provider, enabled, encrypted_api_key, config FROM data_source_settings WHERE user_id = ?",
      [userId]
    );

    // Map rows and mask the encrypted keys
    const settings = rows.map((row) => {
      let maskedKey = "";
      if (row.encrypted_api_key) {
        try {
          const decrypted = decryptApiKey(row.encrypted_api_key);
          maskedKey = maskApiKey(decrypted);
        } catch {
          maskedKey = "********";
        }
      }
      return {
        provider: row.provider,
        enabled: !!row.enabled,
        apiKeyMasked: maskedKey,
        config: row.config ? JSON.parse(row.config) : {},
      };
    });

    return res.json({ success: true, settings });
  } catch (error) {
    console.error("Get data source settings error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch settings" });
  }
});

// 2. Update Data Source Setting (Create or Update)
router.put("/settings", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { provider, enabled, api_key, config } = req.body;

    if (!provider) {
      return res.status(400).json({ success: false, error: "Provider is required" });
    }

    const now = new Date().toISOString();
    const existing = await dbGet(
      "SELECT encrypted_api_key FROM data_source_settings WHERE user_id = ? AND provider = ?",
      [userId, provider]
    );

    let encryptedKey = existing?.encrypted_api_key || null;

    if (api_key !== undefined) {
      if (api_key === "") {
        encryptedKey = null;
      } else if (api_key.includes("...")) {
        // Do not re-encrypt masked placeholder
      } else {
        encryptedKey = encryptApiKey(api_key);
      }
    }

    const isEnabled = enabled ? 1 : 0;
    const configStr = config ? JSON.stringify(config) : "{}";

    if (existing) {
      await dbRun(
        `UPDATE data_source_settings 
         SET enabled = ?, encrypted_api_key = ?, config = ?, updated_at = ? 
         WHERE user_id = ? AND provider = ?`,
        [isEnabled, encryptedKey, configStr, now, userId, provider]
      );
    } else {
      await dbRun(
        `INSERT INTO data_source_settings (user_id, provider, enabled, encrypted_api_key, config, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, provider, isEnabled, encryptedKey, configStr, now, now]
      );
    }

    return res.json({ success: true, message: `Updated ${provider} settings successfully` });
  } catch (error) {
    console.error("Update data source settings error:", error);
    return res.status(500).json({ success: false, error: "Failed to update settings" });
  }
});

// 3. Web Search Endpoint
router.post("/search", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id || "anonymous";
    const { query, provider } = req.body;

    if (!query) {
      return res.status(400).json({ success: false, error: "Query parameter is required" });
    }

    const isAllowed = await WebCacheService.checkRateLimit(userId, "search", 60);
    if (!isAllowed) {
      return res.status(429).json({ success: false, error: "Rate limit exceeded (60 requests per hour)" });
    }

    const result = await SearchService.search(query, userId, provider);
    return res.json({ success: true, ...result });
  } catch (error: any) {
    console.error("Route search error:", error);
    return res.status(500).json({ success: false, error: error.message || "Search failed" });
  }
});

// 4. Fetch/Scrape Website or PDF Endpoint
router.post("/fetch", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id || "anonymous";
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ success: false, error: "URL is required" });
    }

    const isAllowed = await WebCacheService.checkRateLimit(userId, "webFetch", 60);
    if (!isAllowed) {
      return res.status(429).json({ success: false, error: "Rate limit exceeded (60 fetches per hour)" });
    }

    const result = await WebFetchService.fetchUrl(url, userId);
    return res.json({ success: true, ...result });
  } catch (error: any) {
    console.error("Route fetch error:", error);
    return res.status(500).json({ success: false, error: error.message || "Fetch failed" });
  }
});

// 5. Research Mode Endpoint
router.post("/research", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id || "anonymous";
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ success: false, error: "Query is required" });
    }

    const isAllowed = await WebCacheService.checkRateLimit(userId, "research", 30);
    if (!isAllowed) {
      return res.status(429).json({ success: false, error: "Rate limit exceeded (30 research sessions per hour)" });
    }

    const result = await ResearchService.conductResearch(query, userId);

    // Save session to SQLite
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await dbRun(
      "INSERT INTO research_sessions (id, user_id, query, sources, summary, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      [id, userId, query, JSON.stringify(result.sources), result.summary, now]
    );

    return res.json({ success: true, id, ...result });
  } catch (error: any) {
    console.error("Route research error:", error);
    return res.status(500).json({ success: false, error: error.message || "Research synthesis failed" });
  }
});

// Get Research History
router.get("/research/history", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const rows = await dbAll(
      "SELECT id, query, sources, summary, created_at FROM research_sessions WHERE user_id = ? ORDER BY created_at DESC",
      [userId]
    );

    const history = rows.map((row) => ({
      id: row.id,
      query: row.query,
      sources: row.sources ? JSON.parse(row.sources) : [],
      summary: row.summary,
      createdAt: row.created_at,
    }));

    return res.json({ success: true, history });
  } catch (error) {
    console.error("Get research history error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch research history" });
  }
});

// 6. Live Weather Endpoint
router.post("/weather", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id || "anonymous";
    const { location } = req.body;

    if (!location) {
      return res.status(400).json({ success: false, error: "Location is required" });
    }

    const data = await DataProviderService.getWeather(location, userId);
    return res.json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || "Failed to fetch weather" });
  }
});

// 7. Live Stock Endpoint
router.post("/stock", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id || "anonymous";
    const { symbol } = req.body;

    if (!symbol) {
      return res.status(400).json({ success: false, error: "Stock symbol is required" });
    }

    const data = await DataProviderService.getStock(symbol, userId);
    return res.json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || "Failed to fetch stock" });
  }
});

// 8. Live Crypto Endpoint
router.post("/crypto", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id || "anonymous";
    const { coinId } = req.body;

    if (!coinId) {
      return res.status(400).json({ success: false, error: "Coin ID (e.g. bitcoin) is required" });
    }

    const data = await DataProviderService.getCrypto(coinId, userId);
    return res.json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || "Failed to fetch crypto price" });
  }
});

// 9. Live News Endpoint
router.post("/news", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id || "anonymous";
    const { topic } = req.body;

    const data = await DataProviderService.getNews(topic || "world", userId);
    return res.json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || "Failed to fetch news headlines" });
  }
});

// 10. YouTube Search Endpoint
router.post("/youtube", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id || "anonymous";
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ success: false, error: "Search query is required" });
    }

    const data = await DataProviderService.searchYouTube(query, userId);
    return res.json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || "Failed to search YouTube videos" });
  }
});

// 11. Flight Endpoint
router.post("/flight", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id || "anonymous";
    const { flightNumber } = req.body;

    if (!flightNumber) {
      return res.status(400).json({ success: false, error: "Flight number is required" });
    }

    const data = await DataProviderService.getFlight(flightNumber, userId);
    return res.json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || "Failed to fetch flight status" });
  }
});

// 12. Sports Endpoint
router.post("/sports", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id || "anonymous";
    const { league } = req.body;

    if (!league) {
      return res.status(400).json({ success: false, error: "League is required (e.g. NBA, NFL)" });
    }

    const data = await DataProviderService.getSports(league, userId);
    return res.json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || "Failed to fetch sports updates" });
  }
});

export default router;
