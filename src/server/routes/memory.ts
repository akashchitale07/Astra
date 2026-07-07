import { Router, Response } from "express";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth.js";
import { dbGet, dbAll, dbRun } from "../db.js";
import { decryptApiKey } from "../utils/crypto.js";
import {
  createMemory,
  deleteMemory,
  getMemory,
  getOrCreateMemorySettings,
  queryMemories,
  updateMemory,
  updateMemorySettings,
  dbRowToMemoryItem,
  writeAuditLog,
} from "../services/memoryService.js";
import { searchMemories } from "../services/memorySearchService.js";
import {
  scanForMemorySuggestions,
  summarizeAndExtractConversation,
} from "../services/conversationSummaryService.js";
import { MemoryType, MemoryImportance } from "../../types/index.js";

const router = Router();

// 1. Get Memory Analytics (Dashboard statistics)
router.get("/analytics", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id as string;
    const now = new Date().toISOString();

    // Total Count
    const totalRow = await dbGet("SELECT COUNT(*) as count FROM memory_items WHERE user_id = ?", [userId]);
    const totalCount = totalRow?.count || 0;

    // Pinned Count
    const pinnedRow = await dbGet("SELECT COUNT(*) as count FROM memory_items WHERE user_id = ? AND pinned = 1", [userId]);
    const pinnedCount = pinnedRow?.count || 0;

    // Archived Count
    const archivedRow = await dbGet("SELECT COUNT(*) as count FROM memory_items WHERE user_id = ? AND archived = 1", [userId]);
    const archivedCount = archivedRow?.count || 0;

    // Expired Count
    const expiredRow = await dbGet(
      "SELECT COUNT(*) as count FROM memory_items WHERE user_id = ? AND expiration_enabled = 1 AND expires_at < ?",
      [userId, now]
    );
    const expiredCount = expiredRow?.count || 0;

    // Category Counts
    const categoryRows = await dbAll(
      "SELECT type, COUNT(*) as count FROM memory_items WHERE user_id = ? GROUP BY type",
      [userId]
    );
    const categoryCounts: Record<string, number> = {
      preference: 0,
      personal_fact: 0,
      project: 0,
      instruction: 0,
      note: 0,
      custom_command: 0,
      conversation_summary: 0
    };
    categoryRows.forEach(row => {
      categoryCounts[row.type] = row.count;
    });

    // Most and Least Retrieved
    const mostRows = await dbAll(
      "SELECT * FROM memory_items WHERE user_id = ? AND times_recalled > 0 ORDER BY times_recalled DESC LIMIT 5",
      [userId]
    );
    const mostRetrieved = mostRows.map(dbRowToMemoryItem);

    const leastRows = await dbAll(
      "SELECT * FROM memory_items WHERE user_id = ? ORDER BY times_recalled ASC LIMIT 5",
      [userId]
    );
    const leastRetrieved = leastRows.map(dbRowToMemoryItem);

    // Growth Data (by date)
    const growthRows = await dbAll(
      `SELECT SUBSTR(created_at, 1, 10) as date, COUNT(*) as count 
       FROM memory_items 
       WHERE user_id = ? 
       GROUP BY date 
       ORDER BY date ASC 
       LIMIT 30`,
      [userId]
    );
    const growthData = growthRows.map(row => ({
      date: row.date,
      count: row.count
    }));

    // Recent Audit Logs
    const auditRows = await dbAll(
      "SELECT * FROM audit_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 15",
      [userId]
    );
    const recentActivity = auditRows.map(row => ({
      id: row.id,
      user_id: row.user_id,
      action: row.action,
      memory_id: row.memory_id,
      details: row.details,
      created_at: row.created_at
    }));

    return res.json({
      analytics: {
        totalCount,
        pinnedCount,
        archivedCount,
        expiredCount,
        categoryCounts,
        mostRetrieved,
        leastRetrieved,
        growthData,
        recentActivity
      }
    });
  } catch (error: any) {
    console.error("Get memory analytics error:", error);
    return res.status(500).json({ error: error.message || "Failed to fetch memory analytics" });
  }
});

// 2. Get Audit Logs
router.get("/audit-logs", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id as string;
    const logs = await dbAll("SELECT * FROM audit_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 100", [userId]);
    return res.json({ logs });
  } catch (error: any) {
    console.error("Get audit logs error:", error);
    return res.status(500).json({ error: error.message || "Failed to fetch audit logs" });
  }
});

// 3. Memory Garbage Collection / Maintenance
router.post("/maintenance", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id as string;
    const now = new Date().toISOString();

    // Prune expired memories
    const expiredCountRow = await dbGet(
      "SELECT COUNT(*) as count FROM memory_items WHERE user_id = ? AND expiration_enabled = 1 AND expires_at < ?",
      [userId, now]
    );
    const expiredCount = expiredCountRow?.count || 0;
    if (expiredCount > 0) {
      await dbRun(
        "DELETE FROM memory_items WHERE user_id = ? AND expiration_enabled = 1 AND expires_at < ?",
        [userId, now]
      );
    }

    // Clear rejected suggestions
    const rejectedCountRow = await dbGet(
      "SELECT COUNT(*) as count FROM memory_items WHERE user_id = ? AND status = 'rejected'",
      [userId]
    );
    const rejectedCount = rejectedCountRow?.count || 0;
    if (rejectedCount > 0) {
      await dbRun("DELETE FROM memory_items WHERE user_id = ? AND status = 'rejected'", [userId]);
    }

    // Deduplication (Find and merge memories with identical or highly similar titles)
    const memories = await queryMemories(userId, { status: "all" });
    const titleGroups: Record<string, typeof memories> = {};
    memories.forEach(mem => {
      const normTitle = mem.title.trim().toLowerCase();
      if (!titleGroups[normTitle]) {
        titleGroups[normTitle] = [];
      }
      titleGroups[normTitle].push(mem);
    });

    let mergedCount = 0;
    for (const title in titleGroups) {
      const duplicates = titleGroups[title];
      if (duplicates.length > 1) {
        // Sort: Pinned first, then oldest
        duplicates.sort((a, b) => {
          if (a.pinned && !b.pinned) return -1;
          if (!a.pinned && b.pinned) return 1;
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });

        const primary = duplicates[0];
        const secondaryItems = duplicates.slice(1);

        // Merge tags
        const allTagsSet = new Set([...primary.tags, ...secondaryItems.flatMap(d => d.tags)]);
        const mergedTags = Array.from(allTagsSet);

        // Merge content (if they are different, concatenate them)
        let mergedContent = primary.content;
        secondaryItems.forEach(sec => {
          if (!primary.content.includes(sec.content) && !sec.content.includes(primary.content)) {
            mergedContent += `\n\n[Merged Content]: ${sec.content}`;
          }
        });

        // Importance (highest level)
        const weight = { high: 3, medium: 2, low: 1 };
        let highestImportance = primary.importance;
        secondaryItems.forEach(sec => {
          if (weight[sec.importance] > weight[highestImportance]) {
            highestImportance = sec.importance;
          }
        });

        // Update primary memory
        await updateMemory(userId, primary.id, {
          content: mergedContent,
          tags: mergedTags,
          importance: highestImportance,
          confidence_score: Math.min(100, primary.confidence_score + 10) // boost confidence
        });

        // Delete duplicate items
        for (const sec of secondaryItems) {
          await dbRun("DELETE FROM memory_items WHERE id = ? AND user_id = ?", [sec.id, userId]);
        }

        mergedCount += secondaryItems.length;
      }
    }

    // Optimize SQLite storage
    try {
      await dbRun("VACUUM");
    } catch (vacuumErr) {
      // safe to ignore
    }

    // Write audit log
    await writeAuditLog(
      userId,
      "Maintenance",
      undefined,
      `Memory garbage collection run. Pruned ${expiredCount} expired items. Cleared ${rejectedCount} rejected items. Merged ${mergedCount} duplicates.`
    );

    return res.json({
      message: "Garbage collection completed successfully.",
      prunedCount: expiredCount,
      clearedCount: rejectedCount,
      mergedCount
    });
  } catch (error: any) {
    console.error("Garbage collection error:", error);
    return res.status(500).json({ error: error.message || "Failed to run memory maintenance" });
  }
});

// 4. Bulk Update Memories
router.post("/bulk", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id as string;
    const { ids, updates } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "Invalid bulk operation: 'ids' must be a non-empty array." });
    }

    let updatedCount = 0;
    for (const id of ids) {
      try {
        await updateMemory(userId, id, updates);
        updatedCount++;
      } catch (err: any) {
        console.error(`Bulk update failed for id ${id}:`, err.message);
      }
    }

    return res.json({
      message: `Successfully bulk updated ${updatedCount} memories.`,
      updatedCount
    });
  } catch (error: any) {
    console.error("Bulk update error:", error);
    return res.status(500).json({ error: error.message || "Failed to perform bulk update" });
  }
});

// 5. Get All Memories (filtered)
router.get("/", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id as string;
    const { type, tag, pinned, archived, importance, searchQuery, sortBy, sortOrder, limit, offset, status } = req.query;

    const filters: any = {};
    if (type && type !== "all") filters.type = type as MemoryType;
    if (tag) filters.tag = tag as string;
    if (pinned !== undefined && pinned !== "all") filters.pinned = pinned === "true";
    if (archived !== undefined && archived !== "all") filters.archived = archived === "true";
    if (importance && importance !== "all") filters.importance = importance as MemoryImportance;
    if (searchQuery) filters.searchQuery = searchQuery as string;
    if (status) filters.status = status as any;

    const options: any = {};
    if (sortBy) options.sortBy = sortBy as any;
    if (sortOrder) options.sortOrder = sortOrder as any;
    if (limit) options.limit = parseInt(limit as string, 10);
    if (offset) options.offset = parseInt(offset as string, 10);

    const memories = await queryMemories(userId, filters, options);
    return res.json({ memories });
  } catch (error: any) {
    console.error("Get memories error:", error);
    return res.status(500).json({ error: error.message || "Failed to fetch memories" });
  }
});

// 6. Get Memory Settings
router.get("/settings", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id as string;
    const settings = await getOrCreateMemorySettings(userId);
    return res.json({ settings });
  } catch (error: any) {
    console.error("Get memory settings error:", error);
    return res.status(500).json({ error: error.message || "Failed to fetch memory settings" });
  }
});

// 7. Update Memory Settings
router.patch("/settings", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id as string;
    const updates = req.body;
    const settings = await updateMemorySettings(userId, updates);
    return res.json({ settings, message: "Memory settings updated successfully" });
  } catch (error: any) {
    console.error("Update memory settings error:", error);
    return res.status(400).json({ error: error.message || "Failed to update memory settings" });
  }
});

// 8. Export Memories
router.get("/export", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id as string;
    // Export all memories with status=all and archived=all
    const memories = await queryMemories(userId, { status: "all", archived: undefined });
    
    // Clear out user_id for generic portable import
    const exportedMemories = memories.map(({ user_id, ...rest }) => rest);

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename=astra-memory-export-${Date.now()}.json`);
    return res.send(JSON.stringify(exportedMemories, null, 2));
  } catch (error: any) {
    console.error("Export memories error:", error);
    return res.status(500).json({ error: error.message || "Failed to export memories" });
  }
});

// 9. Import Memories
router.post("/import", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id as string;
    const { memories } = req.body;

    if (!Array.isArray(memories)) {
      return res.status(400).json({ error: "Invalid import format. Expected an array of memory objects." });
    }

    if (memories.length > 500) {
      return res.status(400).json({ error: "Import limit exceeded. Maximum 500 memories can be imported at once." });
    }

    // Get current memories to prevent duplicates
    const currentMemories = await queryMemories(userId, { status: "all", archived: undefined });
    const currentTitlesAndContents = new Set(
      currentMemories.map((m) => `${m.title.toLowerCase().trim()}|${m.content.toLowerCase().trim()}`)
    );

    let importedCount = 0;
    const errors: string[] = [];

    for (const item of memories) {
      try {
        if (!item.title || !item.content || !item.type) {
          errors.push(`Skipped memory: Missing required fields (title, content, type).`);
          continue;
        }

        const compositeKey = `${item.title.toLowerCase().trim()}|${item.content.toLowerCase().trim()}`;
        if (currentTitlesAndContents.has(compositeKey)) {
          // Skip duplicates
          continue;
        }

        await createMemory(userId, {
          type: item.type,
          title: item.title,
          content: item.content,
          source: item.source || "manual",
          importance: item.importance || "medium",
          tags: Array.isArray(item.tags) ? item.tags : [],
          pinned: !!item.pinned,
          archived: !!item.archived,
          confidence_score: item.confidence_score !== undefined ? item.confidence_score : 90, // default imported to 90
          expires_at: item.expires_at,
          expiration_enabled: !!item.expiration_enabled,
          parent_id: item.parent_id,
          status: item.status || "approved",
          is_encrypted: !!item.is_encrypted,
        });

        importedCount++;
      } catch (err: any) {
        errors.push(`Error importing "${item.title || "Untitled"}": ${err.message}`);
      }
    }

    return res.json({
      message: `Successfully imported ${importedCount} memories.`,
      importedCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error("Import memories error:", error);
    return res.status(500).json({ error: error.message || "Failed to import memories" });
  }
});

// 10. Search Memories (Scoring Engine)
router.post("/search", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id as string;
    const { query, limit, includePending } = req.body;

    if (query === undefined) {
      return res.status(400).json({ error: "Search query string is required" });
    }

    const searchLimit = limit ? Math.min(50, Math.max(1, parseInt(limit, 10))) : 8;
    const memories = await searchMemories(userId, query, searchLimit, !!includePending);

    return res.json({ memories });
  } catch (error: any) {
    console.error("Search memories error:", error);
    return res.status(500).json({ error: error.message || "Failed to search memories" });
  }
});

// 11. Get Single Memory
router.get("/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id as string;
    const { id } = req.params;
    const memory = await getMemory(userId, id);
    return res.json({ memory });
  } catch (error: any) {
    console.error("Get memory error:", error);
    return res.status(404).json({ error: error.message || "Memory not found" });
  }
});

// 12. Create Memory Item
router.post("/", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id as string;
    const {
      type,
      title,
      content,
      source,
      importance,
      tags,
      pinned,
      archived,
      confidence_score,
      expires_at,
      expiration_enabled,
      parent_id,
      status,
      is_encrypted,
    } = req.body;

    const memory = await createMemory(userId, {
      type,
      title,
      content,
      source: source || "manual",
      importance,
      tags,
      pinned,
      archived,
      confidence_score,
      expires_at,
      expiration_enabled,
      parent_id,
      status,
      is_encrypted,
    });

    return res.status(201).json({ memory });
  } catch (error: any) {
    console.error("Create memory error:", error);
    return res.status(400).json({ error: error.message || "Failed to create memory" });
  }
});

// 13. Update Memory Item
router.patch("/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id as string;
    const { id } = req.params;
    const updates = req.body;

    const memory = await updateMemory(userId, id, updates);
    return res.json({ memory, message: "Memory updated successfully" });
  } catch (error: any) {
    console.error("Update memory error:", error);
    return res.status(400).json({ error: error.message || "Failed to update memory" });
  }
});

// 14. Delete Memory Item
router.delete("/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id as string;
    const { id } = req.params;

    await deleteMemory(userId, id);
    return res.json({ message: "Memory deleted successfully" });
  } catch (error: any) {
    console.error("Delete memory error:", error);
    return res.status(400).json({ error: error.message || "Failed to delete memory" });
  }
});

// 15. Summarize Conversation
router.post("/conversations/:id/summarize", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id as string;
    const { id: conversationId } = req.params;

    // Retrieve and decrypt user API key if available
    const settings = await dbGet("SELECT encrypted_api_key FROM user_settings WHERE user_id = ?", [userId]);
    let decryptedKey: string | undefined;
    if (settings && settings.encrypted_api_key) {
      decryptedKey = decryptApiKey(settings.encrypted_api_key);
    }

    const result = await summarizeAndExtractConversation(userId, conversationId, decryptedKey);
    return res.json(result);
  } catch (error: any) {
    console.error("Conversation summarization route error:", error);
    return res.status(500).json({ error: error.message || "Failed to summarize conversation" });
  }
});

// 16. Scan conversation for real-time memory suggestions
router.get("/conversations/:id/suggestions", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id as string;
    const { id: conversationId } = req.params;

    // Retrieve and decrypt user API key if available
    const settings = await dbGet("SELECT encrypted_api_key FROM user_settings WHERE user_id = ?", [userId]);
    let decryptedKey: string | undefined;
    if (settings && settings.encrypted_api_key) {
      decryptedKey = decryptApiKey(settings.encrypted_api_key);
    }

    const suggestions = await scanForMemorySuggestions(userId, conversationId, decryptedKey);
    return res.json({ suggestions });
  } catch (error: any) {
    console.error("Get conversation suggestions route error:", error);
    return res.status(500).json({ error: error.message || "Failed to retrieve memory suggestions" });
  }
});

export default router;
