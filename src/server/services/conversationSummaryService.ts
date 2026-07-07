import crypto from "crypto";
import { dbGet, dbRun, dbAll } from "../db.js";
import { generateNonStreamingChatCompletion } from "./ai_service.js";
import { createMemory, getOrCreateMemorySettings } from "./memoryService.js";
import { ConversationSummary, MemoryItem, MemoryType, MemoryImportance } from "../../types/index.js";

interface ExtractionResult {
  summary: string;
  key_facts: string[];
  suggestions: Array<{
    type: MemoryType;
    title: string;
    content: string;
    importance: MemoryImportance;
    tags: string[];
  }>;
}

/**
 * Summarize conversation and extract key facts & memory suggestions.
 */
export async function summarizeAndExtractConversation(
  userId: string,
  conversationId: string,
  userApiKey?: string
): Promise<{
  summary: ConversationSummary;
  suggestions: Partial<MemoryItem>[];
}> {
  // 1. Fetch messages for the conversation
  const messages = await dbAll(
    "SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
    [conversationId]
  );

  if (messages.length < 2) {
    throw new Error("Conversation does not have enough messages (minimum 2) to summarize.");
  }

  // Format conversation history for prompt
  const formattedHistory = messages
    .map((m) => `${m.role === "user" ? "User" : "Astra"}: ${m.content}`)
    .join("\n\n");

  const prompt = `Analyze the following conversation history between the User and Astra (AI).
Tasks:
1. Provide a concise, professional summary capturing the main topics, decisions, user preferences revealed, and project details (max 4-5 sentences).
2. Extract a list of key bullet-point facts.
3. Identify any long-term memory-worthy statements (e.g., user preferences, personal facts, project specs, instructions, custom commands, or custom rules) that Astra should remember for future sessions.
   - Categorize each suggestion as one of: preference, personal_fact, project, instruction, note, custom_command.
   - Provide a short, human-readable title (max 120 chars) and a clear, specific content string (max 5000 chars) for each memory suggestion.
   - Assign an importance level: low, medium, or high.
   - Provide a short array of lowercase tags (max 5 tags per item, max 20 chars each tag).

CRITICAL: Do NOT suggest memories for passwords, API keys, tokens, session IDs, sensitive financial/payment info, legal/medical secrets, or raw file contents. Keep suggestions high quality and long-term relevant.

You MUST respond strictly with a JSON object of this exact schema:
{
  "summary": "Text summary of the conversation",
  "key_facts": ["Fact 1", "Fact 2"],
  "suggestions": [
    {
      "type": "preference",
      "title": "User UI Theme Preference",
      "content": "User prefers high-contrast dark futuristic user interfaces.",
      "importance": "medium",
      "tags": ["ui", "theme", "dark"]
    }
  ]
}

Only return raw JSON. Do not wrap in markdown blocks, do not include triple backticks or any explanations outside of the JSON.

Conversation History:
${formattedHistory}`;

  const responseText = await generateNonStreamingChatCompletion(
    [{ role: "user", content: prompt }],
    {
      userApiKey,
      systemInstruction: "You are a highly analytical memory-extraction engine that outputs strict JSON.",
    }
  );

  // Clean JSON response (remove markdown backticks if returned)
  let cleanJson = responseText.trim();
  if (cleanJson.startsWith("```")) {
    // If it's wrapped in ```json ... ``` or similar
    const lines = cleanJson.split("\n");
    if (lines[0].startsWith("```")) lines.shift();
    if (lines[lines.length - 1].startsWith("```")) lines.pop();
    cleanJson = lines.join("\n").trim();
  }

  let result: ExtractionResult;
  try {
    result = JSON.parse(cleanJson);
  } catch (err) {
    console.error("Failed to parse AI JSON for summary. Raw text:", responseText);
    throw new Error("AI returned a malformed response that could not be parsed as JSON.");
  }

  // Validate results and apply defaults
  const summaryText = result.summary || "No summary available.";
  const keyFacts = Array.isArray(result.key_facts) ? result.key_facts : [];
  const suggestions = Array.isArray(result.suggestions) ? result.suggestions : [];

  const now = new Date().toISOString();
  const summaryId = crypto.randomUUID();

  // 2. Check if a summary already exists for this conversation
  const existingSummary = await dbGet(
    "SELECT id FROM conversation_summaries WHERE conversation_id = ? AND user_id = ?",
    [conversationId, userId]
  );

  if (existingSummary) {
    // Update existing
    await dbRun(
      `UPDATE conversation_summaries 
       SET summary = ?, key_facts = ?, updated_at = ? 
       WHERE conversation_id = ? AND user_id = ?`,
      [summaryText, JSON.stringify(keyFacts), now, conversationId, userId]
    );
  } else {
    // Insert new
    await dbRun(
      `INSERT INTO conversation_summaries (id, user_id, conversation_id, summary, key_facts, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [summaryId, userId, conversationId, summaryText, JSON.stringify(keyFacts), now, now]
    );
  }

  const savedSummaryRow = await dbGet(
    "SELECT * FROM conversation_summaries WHERE conversation_id = ? AND user_id = ?",
    [conversationId, userId]
  );

  const formattedSummary: ConversationSummary = {
    id: savedSummaryRow.id,
    user_id: savedSummaryRow.user_id,
    conversation_id: savedSummaryRow.conversation_id,
    summary: savedSummaryRow.summary,
    key_facts: JSON.parse(savedSummaryRow.key_facts || "[]"),
    created_at: savedSummaryRow.created_at,
    updated_at: savedSummaryRow.updated_at,
  };

  // 3. Auto-save memories if auto-capture is enabled
  const settings = await getOrCreateMemorySettings(userId);
  const createdMemories: MemoryItem[] = [];

  if (settings.auto_capture_enabled && suggestions.length > 0) {
    for (const sug of suggestions) {
      try {
        const memory = await createMemory(userId, {
          type: sug.type,
          title: sug.title,
          content: sug.content,
          source: "summary",
          importance: sug.importance,
          tags: sug.tags,
          pinned: false,
          archived: false,
        });
        createdMemories.push(memory);
      } catch (e) {
        console.error("Failed to auto-save memory suggestion:", sug, e);
      }
    }
  }

  // Format return suggestions
  const returnedSuggestions = suggestions.map((sug, index) => {
    return {
      id: `suggested-${index}-${Date.now()}`,
      user_id: userId,
      type: sug.type,
      title: sug.title,
      content: sug.content,
      source: "summary" as const,
      importance: sug.importance,
      tags: sug.tags || [],
      pinned: false,
      archived: false,
    };
  });

  return {
    summary: formattedSummary,
    suggestions: returnedSuggestions,
  };
}

/**
 * Scan the latest exchange of a conversation to see if any immediate memory suggestions can be made.
 */
export async function scanForMemorySuggestions(
  userId: string,
  conversationId: string,
  userApiKey?: string
): Promise<Partial<MemoryItem>[]> {
  const messages = await dbAll(
    "SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 4",
    [conversationId]
  );

  if (messages.length < 2) return [];

  // Reverse to get chronological order
  messages.reverse();

  const formattedExchange = messages
    .map((m) => `${m.role === "user" ? "User" : "Astra"}: ${m.content}`)
    .join("\n\n");

  const prompt = `Review this recent chat exchange and determine if the user has shared any long-term useful facts, preferences, or goals that Astra should save to memory (e.g. "I prefer coding in TypeScript", "I'm building an AI app", "My database is SQLite").
  
Do NOT extract trivial details (like "I had a sandwich for lunch"), conversational fluff, passwords, keys, or temporary files.

If a highly useful fact or preference is found, output a JSON array containing up to 2 memory suggestions. If nothing long-term useful is found, output an empty JSON array: [].

You MUST respond strictly with a JSON array matching this exact schema:
[
  {
    "type": "preference | personal_fact | project | instruction | note",
    "title": "Short descriptive title",
    "content": "Specific memory details to save",
    "importance": "low | medium | high",
    "tags": ["tag1", "tag2"]
  }
]

Only return raw JSON. Do not wrap in markdown blocks or include explanations.

Chat exchange:
${formattedExchange}`;

  try {
    const responseText = await generateNonStreamingChatCompletion(
      [{ role: "user", content: prompt }],
      {
        userApiKey,
        systemInstruction: "You are a precise facts-extraction model that outputs strict JSON arrays.",
      }
    );

    let cleanJson = responseText.trim();
    if (cleanJson.startsWith("```")) {
      const lines = cleanJson.split("\n");
      if (lines[0].startsWith("```")) lines.shift();
      if (lines[lines.length - 1].startsWith("```")) lines.pop();
      cleanJson = lines.join("\n").trim();
    }

    const suggestions: any[] = JSON.parse(cleanJson);
    if (!Array.isArray(suggestions)) return [];

    return suggestions.map((sug, index) => ({
      id: `suggested-scan-${index}-${Date.now()}`,
      user_id: userId,
      type: sug.type || "personal_fact",
      title: sug.title || "User Info",
      content: sug.content || "",
      source: "chat" as const,
      importance: sug.importance || "medium",
      tags: sug.tags || [],
      pinned: false,
      archived: false,
    })).filter(s => s.content.trim().length > 0);

  } catch (err) {
    console.error("Error scanning for memory suggestions:", err);
    return [];
  }
}
