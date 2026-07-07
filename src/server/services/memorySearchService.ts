import { MemoryItem } from "../../types/index.js";
import { queryMemories, updateMemory } from "./memoryService.js";

/**
 * Calculates if a memory item has expired.
 */
export function isExpired(item: MemoryItem): boolean {
  if (!item.expiration_enabled || !item.expires_at) return false;
  try {
    return new Date(item.expires_at).getTime() < Date.now();
  } catch (e) {
    return false;
  }
}

/**
 * Calculates an enterprise-grade search score for a memory item based on a search query.
 */
export function scoreMemory(item: MemoryItem, query: string): number {
  if (!query) return 0;

  // Phase 1: Exclude expired memories
  if (isExpired(item)) return 0;

  // We should also only rank approved memories for injection/search
  if (item.status === "rejected") return 0;

  const normalizedQuery = query.toLowerCase().trim();
  const normalizedTitle = item.title.toLowerCase();
  const normalizedContent = item.content.toLowerCase();
  
  let score = 0;

  // Phase 2: Exact Phrase Matches & Pinned Boost (Highest Precedence)
  if (normalizedTitle === normalizedQuery) {
    score += 100; // Exact title match
  } else if (normalizedTitle.includes(normalizedQuery)) {
    score += 40; // Substring title match
  }

  if (normalizedContent.includes(normalizedQuery)) {
    score += 20; // Substring content match
  }

  if (item.pinned) {
    score += 50; // Pin status boost
  }

  // Phase 3: Importance Level Score Boost
  if (item.importance === "high") {
    score += 30;
  } else if (item.importance === "medium") {
    score += 15;
  } else {
    score += 5;
  }

  // Phase 4: Token Overlap & Tag Match
  const tokens = normalizedQuery.split(/\s+/).filter(t => t.length > 1);
  let overlaps = 0;
  for (const token of tokens) {
    let matched = false;
    if (item.tags.map(t => t.toLowerCase()).includes(token)) {
      score += 25;
      matched = true;
    } else if (item.tags.some(t => t.toLowerCase().includes(token))) {
      score += 12;
      matched = true;
    }

    if (normalizedTitle.includes(token)) {
      score += 10;
      matched = true;
    }

    if (normalizedContent.includes(token)) {
      score += 5;
      matched = true;
    }

    if (matched) overlaps++;
  }

  // Phase 5: Recency (Decay multiplier over time)
  let recencyBoost = 0;
  try {
    const lastUpdate = new Date(item.updated_at).getTime();
    const now = Date.now();
    const diffHours = (now - lastUpdate) / (1000 * 60 * 60);

    if (diffHours <= 1) {
      recencyBoost = 20; // Modified within 1 hour
    } else if (diffHours <= 24) {
      recencyBoost = 15; // Modified within 1 day
    } else if (diffHours <= 168) {
      recencyBoost = 10; // Modified within 1 week
    } else if (diffHours <= 720) {
      recencyBoost = 5;  // Modified within 1 month
    } else {
      recencyBoost = 1;  // Older
    }
  } catch (err) {
    recencyBoost = 0;
  }
  score += recencyBoost;

  // Phase 6: Frequency Boost (high times_recalled)
  const timesRecalled = item.times_recalled || 0;
  score += Math.min(25, timesRecalled * 2); // Cap frequency boost at 25 points

  // Phase 7: Project Relevance Boost
  if (item.type === "project") {
    score += 10;
    const projectKeywords = ["project", "build", "stack", "app", "code", "architecture", "database", "dev", "git"];
    if (projectKeywords.some(kw => normalizedQuery.includes(kw))) {
      score += 20;
    }
  }

  // Category Domain Context Relevance Boost
  const categoryKeywords: Record<string, string[]> = {
    preference: ["prefer", "like", "love", "favorite", "ui", "theme", "settings"],
    instruction: ["rule", "instruction", "must", "always", "never", "should", "guideline"],
    note: ["note", "memo", "remember", "remind", "details"],
    custom_command: ["command", "execute", "run", "shortcut", "trigger"],
    conversation_summary: ["summary", "summarize", "recap", "previous", "history"]
  };
  const matchedKeywords = categoryKeywords[item.type];
  if (matchedKeywords && matchedKeywords.some(kw => normalizedQuery.includes(kw))) {
    score += 15;
  }

  // Confidence Score Multiplier: Scale the final score slightly based on the confidence score
  const confidence = item.confidence_score !== undefined ? item.confidence_score : 100;
  const confidenceWeight = confidence / 100;
  score = score * (0.5 + 0.5 * confidenceWeight); // scale by 50% - 100%

  return score;
}

/**
 * Searches and retrieves the most relevant memories for a user, sorted by enterprise scoring engine.
 * Filters out archived & expired memories by default unless explicitly requested.
 */
export async function searchMemories(
  userId: string,
  query: string,
  limit: number = 8,
  includePending: boolean = false
): Promise<MemoryItem[]> {
  // Fetch active memories (unarchived, approved by default)
  const statusFilter = includePending ? "all" : "approved";
  const memories = await queryMemories(userId, { archived: false, status: statusFilter as any });

  // Filter out expired items
  const activeMemories = memories.filter(item => !isExpired(item));

  if (!query || query.trim().length === 0) {
    // No query, sort by pinned first, then updated_at
    const results = activeMemories
      .sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      })
      .slice(0, limit);

    return results;
  }

  // Score each memory
  const scored = activeMemories.map((item) => {
    return {
      item,
      score: scoreMemory(item, query),
    };
  });

  // Filter out those with 0 score (no relevance found at all)
  const sortedMemories = scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.item)
    .slice(0, limit);

  // Update retrieval analytics for returned memories in background
  const nowStr = new Date().toISOString();
  sortedMemories.forEach((item, idx) => {
    const oldTimes = item.times_recalled || 0;
    const newTimes = oldTimes + 1;
    const currentRank = idx + 1;
    const oldAvgRank = item.average_retrieval_rank || 0.0;
    const newAvgRank = oldTimes === 0 
      ? currentRank 
      : ((oldAvgRank * oldTimes) + currentRank) / newTimes;

    updateMemory(userId, item.id, {
      times_recalled: newTimes,
      last_recalled: nowStr,
      last_retrieved_at: nowStr,
      last_injected_at: nowStr,
      average_retrieval_rank: parseFloat(newAvgRank.toFixed(2)),
      retrieval_success: 1
    }).catch((err) => {
      // Slently ignore background update errors
    });
  });

  return sortedMemories;
}
