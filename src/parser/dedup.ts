import type { RawRecord, ContentItem } from "../types.js";

interface MergedAssistant {
  uuid: string;
  parentUuid: string | null;
  requestId: string;
  timestamp: string;
  model?: string;
  content: ContentItem[];
}

function extractContent(record: RawRecord, includeThinking: boolean): ContentItem[] {
  const items: ContentItem[] = [];
  const content = record.message?.content;
  if (!Array.isArray(content)) return items;

  for (const c of content) {
    switch (c.type) {
      case "text":
        if (c.text?.trim()) {
          items.push({ type: "text", text: c.text });
        }
        break;
      case "thinking":
        if (includeThinking && c.thinking?.trim()) {
          items.push({ type: "thinking", text: c.thinking });
        }
        break;
      case "tool_use":
        if (c.id && c.name) {
          items.push({
            type: "tool_use",
            id: c.id,
            name: c.name,
            input: c.input ?? {},
          });
        }
        break;
    }
  }
  return items;
}

function coalesceText(items: ContentItem[]): ContentItem[] {
  const result: ContentItem[] = [];
  for (const item of items) {
    if (
      item.type === "text" &&
      result.length > 0 &&
      result[result.length - 1].type === "text"
    ) {
      // merge with previous text block
      const prev = result[result.length - 1] as { type: "text"; text: string };
      prev.text += item.text;
    } else {
      result.push({ ...item });
    }
  }
  return result;
}

/**
 * Deduplicate streaming assistant records.
 * Multiple records share the same requestId — merge them by collecting
 * all content items in timestamp order, then coalescing adjacent text.
 */
export function deduplicateAssistants(
  records: RawRecord[],
  includeThinking: boolean
): MergedAssistant[] {
  const assistantRecords = records.filter((r) => r.type === "assistant");

  // group by requestId
  const groups = new Map<string, RawRecord[]>();
  for (const r of assistantRecords) {
    const key = r.requestId ?? r.uuid;
    const group = groups.get(key) ?? [];
    group.push(r);
    groups.set(key, group);
  }

  const merged: MergedAssistant[] = [];
  for (const [requestId, group] of groups) {

    group.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const allContent: ContentItem[] = [];
    for (const r of group) {
      allContent.push(...extractContent(r, includeThinking));
    }

    // deduplicate tool_use by id (streaming can repeat them)
    const seenToolIds = new Set<string>();
    const dedupedContent: ContentItem[] = [];
    for (const item of allContent) {
      if (item.type === "tool_use") {
        if (seenToolIds.has(item.id)) continue;
        seenToolIds.add(item.id);
      }
      dedupedContent.push(item);
    }

    const first = group[0];
    const last = group[group.length - 1];

    merged.push({
      uuid: first.uuid,
      parentUuid: first.parentUuid,
      requestId,
      timestamp: first.timestamp,
      model: first.message?.model ?? last.message?.model,
      content: coalesceText(dedupedContent),
    });
  }

  return merged;
}
