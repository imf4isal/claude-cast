import type { RawRecord, ConversationTurn, ContentItem } from "../types.js";
import { deduplicateAssistants } from "./dedup.js";

/** Extract user content from a raw user record */
function extractUserContent(record: RawRecord, includeToolResults: boolean): ContentItem[] {
  const items: ContentItem[] = [];
  const content = record.message?.content;

  if (typeof content === "string") {
    const trimmed = content.trim();
    if (trimmed) {
      items.push({ type: "text", text: trimmed });
    }
    return items;
  }

  if (Array.isArray(content)) {
    for (const c of content) {
      if (c.type === "text" && c.text?.trim()) {
        items.push({ type: "text", text: c.text.trim() });
      } else if (c.type === "tool_result" && includeToolResults) {
        let resultText = "";
        if (typeof c.content === "string") {
          resultText = c.content;
        } else if (Array.isArray(c.content)) {
          resultText = c.content
            .map((rc) => rc.text ?? "")
            .filter(Boolean)
            .join("\n");
        }
        items.push({
          type: "tool_result",
          tool_use_id: c.tool_use_id ?? "",
          content: resultText,
          is_error: c.is_error ?? false,
        });
      }
    }
  }

  return items;
}

/**
 * Build a flat array of conversation turns from filtered records.
 * - Merges streaming assistant records via dedup
 * - Attaches tool_results to their parent assistant turn's tool_use
 * - Filters out user turns that are purely tool_results (no text)
 */
export function buildConversationTree(
  records: RawRecord[],
  includeThinking: boolean,
  includeToolResults: boolean
): ConversationTurn[] {
  const turns: ConversationTurn[] = [];

  // Build merged assistant turns
  const mergedAssistants = deduplicateAssistants(records, includeThinking);

  // Build a map from tool_use id → assistant turn index + content index (for attaching results)
  const toolUseMap = new Map<string, { turnIdx: number; contentIdx: number }>();

  // Process assistant turns first
  const assistantTurns: ConversationTurn[] = mergedAssistants.map((ma, turnIdx) => {
    const turn: ConversationTurn = {
      role: "assistant",
      uuid: ma.uuid,
      timestamp: ma.timestamp,
      content: ma.content,
      model: ma.model,
    };

    // Index tool_use items
    for (let i = 0; i < ma.content.length; i++) {
      const item = ma.content[i];
      if (item.type === "tool_use") {
        toolUseMap.set(item.id, { turnIdx, contentIdx: i });
      }
    }

    return turn;
  });

  // Process user records
  const userRecords = records.filter((r) => r.type === "user");
  const userTurns: ConversationTurn[] = [];

  for (const record of userRecords) {
    const content = extractUserContent(record, includeToolResults);

    // If it's all tool_results, attach them to parent assistant's tool_use
    const hasText = content.some((c) => c.type === "text");
    const toolResults = content.filter((c) => c.type === "tool_result");

    if (includeToolResults) {
      // Attach tool results inline after their corresponding tool_use in assistant turns
      for (const tr of toolResults) {
        if (tr.type !== "tool_result") continue;
        const ref = toolUseMap.get(tr.tool_use_id);
        if (ref) {
          const asTurn = assistantTurns[ref.turnIdx];
          // Insert tool_result right after the tool_use
          const insertIdx = ref.contentIdx + 1;
          asTurn.content.splice(insertIdx, 0, tr);
          // Update indices for subsequent tool_uses in this turn
          for (const [id, r] of toolUseMap) {
            if (r.turnIdx === ref.turnIdx && r.contentIdx >= insertIdx) {
              r.contentIdx++;
            }
          }
        }
      }
    }

    // Only create a user turn if there's actual text content
    if (hasText) {
      const textContent = content.filter((c) => c.type === "text");
      userTurns.push({
        role: "user",
        uuid: record.uuid,
        timestamp: record.timestamp,
        content: textContent,
      });
    }
  }

  // Merge all turns and sort by timestamp
  turns.push(...userTurns, ...assistantTurns);
  turns.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return turns;
}
