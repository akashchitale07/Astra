import { createRequire } from "module";
import { URL } from "url";
import { WebCacheService } from "./webCacheService.js";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

export interface FetchResult {
  text: string;
  status: "success" | "blocked_by_robots" | "oversized" | "timeout" | "failed";
  contentType?: string;
  url: string;
  title?: string;
}

const USER_AGENT = "AstraBot/1.0 (+https://ai.studio/build; myturnnn3@gmail.com)";
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB limit
const FETCH_TIMEOUT_MS = 15000; // 15 seconds timeout

export const WebFetchService = {
  /**
   * Parse robots.txt rules for user-agent * or AstraBot
   */
  isAllowedByRobots(robotsTxt: string, path: string): boolean {
    try {
      const lines = robotsTxt.split(/\r?\n/);
      let isTargetAgent = false;
      const disallows: string[] = [];

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;

        const separatorIdx = trimmed.indexOf(":");
        if (separatorIdx === -1) continue;

        const key = trimmed.slice(0, separatorIdx).trim().toLowerCase();
        const val = trimmed.slice(separatorIdx + 1).trim();

        if (key === "user-agent") {
          const agent = val.toLowerCase();
          isTargetAgent = agent === "*" || agent === "astrabot";
        } else if (isTargetAgent) {
          if (key === "disallow") {
            if (val) disallows.push(val);
          } else if (key === "allow") {
            // Simple allow rules could override disallows, but for safe Phase 5,
            // we prioritize conservative disallows.
          }
        }
      }

      // Check if the current path matches any disallow rules
      for (const rule of disallows) {
        // Simple prefix match. Standard robots.txt rules can be complex (wildcards),
        // but prefix match covers 95% of common cases safely.
        const ruleRegex = rule
          .replace(/[.+^${}()|[\]\\]/g, "\\$&")
          .replace(/\*/g, ".*");
        const regex = new RegExp(`^${ruleRegex}`);
        if (regex.test(path)) {
          return false;
        }
      }

      return true;
    } catch (err) {
      console.error("Error parsing robots.txt, defaulting to allowed:", err);
      return true;
    }
  },

  /**
   * Fetches robots.txt and verifies permission
   */
  async checkRobotsPermission(targetUrl: string): Promise<boolean> {
    try {
      const parsedUrl = new URL(targetUrl);
      const robotsUrl = `${parsedUrl.protocol}//${parsedUrl.host}/robots.txt`;

      // Cache robots.txt for 1 hour to prevent constant refetching
      const cacheKey = WebCacheService.generateKey("robots", robotsUrl);
      let robotsTxt = await WebCacheService.get(cacheKey);

      if (!robotsTxt) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        try {
          const res = await fetch(robotsUrl, {
            headers: { "User-Agent": USER_AGENT },
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (res.ok) {
            robotsTxt = await res.text();
            await WebCacheService.set(cacheKey, "robots", robotsTxt, 3600);
          } else {
            robotsTxt = ""; // If robots.txt not found (404), allow everything
          }
        } catch {
          clearTimeout(timeoutId);
          robotsTxt = ""; // Timeout or failure, assume allowed
        }
      }

      if (!robotsTxt) return true;
      return this.isAllowedByRobots(robotsTxt, parsedUrl.pathname);
    } catch (err) {
      console.error("Robots permission check failed, allowing:", err);
      return true;
    }
  },

  /**
   * Extracts clean readable text from HTML string
   */
  cleanHtml(html: string): { text: string; title: string } {
    let text = html;

    // Extract title
    let title = "";
    const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      title = titleMatch[1].trim();
    }

    // Strip header, footer, nav, script, style, iframe, noscript, head
    text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
    text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");
    text = text.replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, "");
    text = text.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "");
    text = text.replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, "");
    text = text.replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, "");
    text = text.replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, "");
    text = text.replace(/<head\b[^<]*(?:(?!<\/head>)<[^<]*)*<\/head>/gi, "");

    // Replace line-break tags with newlines
    text = text.replace(/<\/p>/gi, "\n\n");
    text = text.replace(/<\/div>/gi, "\n");
    text = text.replace(/<br\s*\/?>/gi, "\n");
    text = text.replace(/<\/li>/gi, "\n");
    text = text.replace(/<\/tr>/gi, "\n");
    text = text.replace(/<\/h[1-6]>/gi, "\n\n");

    // Strip remaining tags
    text = text.replace(/<[^>]*>/g, " ");

    // Decode HTML entities
    text = text
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&nbsp;/gi, " ");

    // Normalize white space
    text = text.replace(/[ \t]+/g, " ");
    text = text.replace(/\n\s*\n+/g, "\n\n");

    return {
      text: text.trim(),
      title: title || "Webpage content",
    };
  },

  /**
   * Main fetch method to retrieve and scrape website content or PDF
   */
  async fetchUrl(targetUrl: string, userId: string): Promise<FetchResult> {
    try {
      // Validate robots.txt
      const allowed = await this.checkRobotsPermission(targetUrl);
      if (!allowed) {
        return { text: "", status: "blocked_by_robots", url: targetUrl };
      }

      // Check cache
      const cacheKey = WebCacheService.generateKey("fetch", targetUrl);
      const cachedContent = await WebCacheService.get(cacheKey);
      if (cachedContent) {
        try {
          const parsed = JSON.parse(cachedContent);
          return {
            text: parsed.text,
            title: parsed.title,
            status: "success",
            contentType: parsed.contentType,
            url: targetUrl,
          };
        } catch {
          // Fall back to refetching if cache format invalid
        }
      }

      // Execute request with AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      let res: Response;
      try {
        res = await fetch(targetUrl, {
          headers: { "User-Agent": USER_AGENT },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (err.name === "AbortError") {
          return { text: "", status: "timeout", url: targetUrl };
        }
        throw err;
      }

      if (!res.ok) {
        return { text: "", status: "failed", url: targetUrl };
      }

      const contentType = res.headers.get("content-type") || "";
      const contentLengthHeader = res.headers.get("content-length");
      if (contentLengthHeader) {
        const size = parseInt(contentLengthHeader, 10);
        if (size > MAX_SIZE_BYTES) {
          return { text: "", status: "oversized", url: targetUrl };
        }
      }

      // Fetch the buffer and verify size limit
      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (buffer.length > MAX_SIZE_BYTES) {
        return { text: "", status: "oversized", url: targetUrl };
      }

      let extractedText = "";
      let pageTitle = "";

      if (contentType.includes("application/pdf") || targetUrl.endsWith(".pdf")) {
        // Parse PDF
        try {
          const pdfData = await pdfParse(buffer);
          extractedText = pdfData.text || "";
          pageTitle = `PDF document from ${new URL(targetUrl).hostname}`;
        } catch (err) {
          console.error("PDF parsing failed:", err);
          return { text: "", status: "failed", url: targetUrl };
        }
      } else {
        // Parse HTML
        const html = buffer.toString("utf8");
        const clean = this.cleanHtml(html);
        extractedText = clean.text;
        pageTitle = clean.title;
      }

      const truncatedText = extractedText.slice(0, 100000); // hard limit to keep safe token size

      const result: FetchResult = {
        text: truncatedText,
        title: pageTitle,
        status: "success",
        contentType,
        url: targetUrl,
      };

      // Save to cache (cache for 12 hours)
      await WebCacheService.set(
        cacheKey,
        "fetch",
        JSON.stringify({
          text: truncatedText,
          title: pageTitle,
          contentType,
        }),
        12 * 3600
      );

      // Log external request
      await WebCacheService.logRequest(
        userId,
        "webFetch",
        new URL(targetUrl).host,
        "200"
      );

      return result;
    } catch (error) {
      console.error(`Scraping failed for ${targetUrl}:`, error);
      return { text: "", status: "failed", url: targetUrl };
    }
  },
};
