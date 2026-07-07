import { dbGet } from "../db.js";
import { decryptApiKey } from "../utils/crypto.js";
import { WebCacheService } from "./webCacheService.js";

export interface SearchResult {
  title: string;
  snippet: string;
  url: string;
}

export const SearchService = {
  /**
   * Main search method that routes to the configured provider
   */
  async search(
    query: string,
    userId: string,
    providerOverride?: string
  ): Promise<{ results: SearchResult[]; provider: string }> {
    try {
      // 1. Get user configuration
      const settings = await dbGet<{
        provider: string;
        enabled: number;
        encrypted_api_key: string | null;
        config: string | null;
      }>(
        "SELECT provider, enabled, encrypted_api_key, config FROM data_source_settings WHERE user_id = ? AND enabled = 1",
        [userId]
      );

      // Determine active provider
      let provider = providerOverride || settings?.provider || "duckduckgo";
      let apiKey = "";

      if (settings && settings.enabled && !providerOverride) {
        provider = settings.provider;
        if (settings.encrypted_api_key) {
          try {
            apiKey = decryptApiKey(settings.encrypted_api_key);
          } catch (err) {
            console.error("Failed to decrypt search API key:", err);
          }
        }
      }

      // Check cache first
      const cacheKey = WebCacheService.generateKey("search", `${provider}:${query}`);
      const cached = await WebCacheService.get(cacheKey);
      if (cached) {
        try {
          return { results: JSON.parse(cached), provider };
        } catch {
          // Ignore parse errors
        }
      }

      let results: SearchResult[] = [];

      if (provider === "brave") {
        results = await this.searchBrave(query, apiKey);
      } else if (provider === "serpapi") {
        results = await this.searchSerpApi(query, apiKey);
      } else if (provider === "bing") {
        results = await this.searchBing(query, apiKey);
      } else {
        // Fallback or explicit DuckDuckGo
        results = await this.searchDuckDuckGo(query);
        provider = "duckduckgo";
      }

      // Save to cache (cache for 4 hours to keep updates relatively live)
      if (results.length > 0) {
        await WebCacheService.set(cacheKey, "search", JSON.stringify(results), 4 * 3600);
      }

      // Log request
      await WebCacheService.logRequest(userId, `search:${provider}`, "web", "200");

      return { results, provider };
    } catch (error) {
      console.error(`Search failed with provider:`, error);
      // Fallback to DuckDuckGo if preferred fails so we never crash the chat!
      try {
        const results = await this.searchDuckDuckGo(query);
        return { results, provider: "duckduckgo (fallback)" };
      } catch {
        return { results: [], provider: "failed" };
      }
    }
  },

  /**
   * Brave Search API
   */
  async searchBrave(query: string, apiKey: string): Promise<SearchResult[]> {
    if (!apiKey) throw new Error("Brave Search key is missing");

    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": apiKey,
      },
    });

    if (!res.ok) {
      throw new Error(`Brave Search failed: ${res.statusText}`);
    }

    const data = await res.json();
    const webResults = data.web?.results || [];

    return webResults.map((item: any) => ({
      title: item.title || "",
      snippet: item.description || "",
      url: item.url || "",
    }));
  },

  /**
   * SerpAPI (Google Search)
   */
  async searchSerpApi(query: string, apiKey: string): Promise<SearchResult[]> {
    if (!apiKey) throw new Error("SerpAPI key is missing");

    const url = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${apiKey}`;
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`SerpAPI search failed: ${res.statusText}`);
    }

    const data = await res.json();
    const organic = data.organic_results || [];

    return organic.map((item: any) => ({
      title: item.title || "",
      snippet: item.snippet || "",
      url: item.link || "",
    }));
  },

  /**
   * Bing Search API
   */
  async searchBing(query: string, apiKey: string): Promise<SearchResult[]> {
    if (!apiKey) throw new Error("Bing Search key is missing");

    const url = `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: {
        "Ocp-Apim-Subscription-Key": apiKey,
      },
    });

    if (!res.ok) {
      throw new Error(`Bing Search failed: ${res.statusText}`);
    }

    const data = await res.json();
    const values = data.webPages?.value || [];

    return values.map((item: any) => ({
      title: item.name || "",
      snippet: item.snippet || "",
      url: item.url || "",
    }));
  },

  /**
   * Scraping DuckDuckGo HTML (Keyless backup)
   */
  async searchDuckDuckGo(query: string): Promise<SearchResult[]> {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!res.ok) {
      throw new Error("DuckDuckGo scraping failed");
    }

    const html = await res.text();
    const results: SearchResult[] = [];

    // Simple robust HTML parsing for DuckDuckGo HTML structure
    // We want to find result blocks
    const resultsBlockRegex = /<div class="result results_links results_links_deep[^"]*">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g;
    let match;
    let count = 0;

    while ((match = resultsBlockRegex.exec(html)) !== null && count < 8) {
      const block = match[1];

      // Extract URL & Title
      const linkMatch = block.match(/<a class="result__url" href="([^"]+)"/);
      const titleMatch = block.match(/<a class="result__a"[^>]*>([\s\S]*?)<\/a>/);
      const snippetMatch = block.match(/<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);

      if (linkMatch && titleMatch) {
        // Clean URL (DuckDuckGo custom redirect link sometimes, strip uddg parameter)
        let rawUrl = linkMatch[1];
        if (rawUrl.includes("uddg=")) {
          try {
            const parsedUrl = new URL(`https://ddg.gg${rawUrl}`);
            const realUrl = parsedUrl.searchParams.get("uddg");
            if (realUrl) rawUrl = realUrl;
          } catch {
            // Keep original
          }
        }

        const title = titleMatch[1].replace(/<[^>]*>/g, "").trim();
        const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]*>/g, "").trim() : "";

        if (title && rawUrl) {
          results.push({
            title,
            snippet,
            url: rawUrl,
          });
          count++;
        }
      }
    }

    return results;
  },
};
