import crypto from "crypto";
import { dbGet, dbRun } from "../db.js";

export interface WebCacheItem {
  id: string;
  cache_key: string;
  source: string;
  content: string;
  fetched_at: string;
  expires_at: string;
}

export const WebCacheService = {
  /**
   * Generates a deterministic cache key from URL/query params
   */
  generateKey(source: string, identifier: string): string {
    return crypto
      .createHash("sha256")
      .update(`${source}:${identifier}`)
      .digest("hex");
  },

  /**
   * Retrieves a cached item if it exists and has not expired
   */
  async get(cacheKey: string): Promise<string | null> {
    try {
      const row = await dbGet<WebCacheItem>(
        "SELECT content, expires_at FROM web_cache WHERE cache_key = ?",
        [cacheKey]
      );

      if (!row) return null;

      const now = new Date();
      const expiresAt = new Date(row.expires_at);

      if (now > expiresAt) {
        // Cache expired, delete it asynchronously
        dbRun("DELETE FROM web_cache WHERE cache_key = ?", [cacheKey]).catch(
          (err) => console.error("Failed to delete expired cache:", err)
        );
        return null;
      }

      return row.content;
    } catch (err) {
      console.error("Cache get error:", err);
      return null;
    }
  },

  /**
   * Saves content to cache with a TTL (Time To Live)
   */
  async set(
    cacheKey: string,
    source: string,
    content: string,
    ttlSeconds: number = 3600
  ): Promise<void> {
    try {
      const id = crypto.randomUUID();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

      // Upsert into SQLite
      await dbRun(
        `INSERT INTO web_cache (id, cache_key, source, content, fetched_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(cache_key) DO UPDATE SET
           content = excluded.content,
           fetched_at = excluded.fetched_at,
           expires_at = excluded.expires_at`,
        [
          id,
          cacheKey,
          source,
          content,
          now.toISOString(),
          expiresAt.toISOString(),
        ]
      );
    } catch (err) {
      console.error("Cache set error:", err);
    }
  },

  /**
   * Logs an external API request
   */
  async logRequest(
    userId: string,
    provider: string,
    endpoint: string,
    status: string
  ): Promise<void> {
    try {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      await dbRun(
        "INSERT INTO external_request_log (id, user_id, provider, endpoint, status, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        [id, userId, provider, endpoint, status, now]
      );
    } catch (err) {
      console.error("Request log error:", err);
    }
  },

  /**
   * Enforces rate limits server-side per user/provider
   */
  async checkRateLimit(
    userId: string,
    provider: string,
    limitPerHour: number = 60
  ): Promise<boolean> {
    try {
      const oneHourAgo = new Date(Date.now() - 3600 * 1000).toISOString();
      const result = await dbGet<{ count: number }>(
        `SELECT COUNT(*) as count FROM external_request_log 
         WHERE user_id = ? AND provider = ? AND created_at > ?`,
        [userId, provider, oneHourAgo]
      );

      const count = result?.count || 0;
      return count < limitPerHour;
    } catch (err) {
      console.error("Rate limit check error:", err);
      return true; // Allow on DB failure to avoid blocking user
    }
  },
};
