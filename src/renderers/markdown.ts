import type { ParsedSession, ContentItem, RenderOptions } from "../types.js";
import { formatTimestamp, truncateLines, byteLength } from "../utils.js";

const MAX_TOOL_OUTPUT_LINES = 50;
const GIST_MAX_BYTES = 900_000;

function renderContentItem(item: ContentItem): string {
  switch (item.type) {
    case "text":
      return item.text + "\n";

    case "thinking":
      return `<details>\n<summary>Extended Thinking</summary>\n\n${item.text}\n\n</details>\n\n`;

    case "tool_use": {
      const inputStr = JSON.stringify(item.input, null, 2);
      return (
        `<details>\n<summary>Tool: ${item.name}</summary>\n\n` +
        "```json\n" +
        truncateLines(inputStr, MAX_TOOL_OUTPUT_LINES) +
        "\n```\n\n</details>\n\n"
      );
    }

    case "tool_result": {
      const label = item.is_error ? "Tool Error" : "Tool Result";
      return (
        `<details>\n<summary>${label}</summary>\n\n` +
        "```\n" +
        truncateLines(item.content, MAX_TOOL_OUTPUT_LINES) +
        "\n```\n\n</details>\n\n"
      );
    }
  }
}

function renderHeader(session: ParsedSession): string {
  const { meta } = session;
  const lines = [
    `# ${meta.slug || "Claude Code Session"}`,
    "",
    `| | |`,
    `|---|---|`,
    `| **Date** | ${formatTimestamp(meta.startedAt)} |`,
    `| **Model** | ${meta.model} |`,
    `| **Project** | \`${meta.cwd}\` |`,
    `| **Turns** | ${meta.turnCount} |`,
  ];
  if (meta.version) lines.push(`| **Version** | ${meta.version} |`);
  if (meta.gitBranch && meta.gitBranch !== "HEAD") {
    lines.push(`| **Branch** | ${meta.gitBranch} |`);
  }
  lines.push("", "---", "");
  return lines.join("\n");
}


export function renderMarkdown(
  session: ParsedSession,
  options: RenderOptions
): string[] {
  const header = renderHeader(session);
  let current = header;
  const files: string[] = [];
  const maxBytes = options.maxBytes || GIST_MAX_BYTES;

  for (const turn of session.turns) {
    const roleLabel = turn.role === "user" ? "You" : "Claude";
    const timestamp = formatTimestamp(turn.timestamp);
    let turnBlock = `### ${roleLabel}\n*${timestamp}*\n\n`;

    for (const item of turn.content) {
      if (item.type === "thinking" && !options.includeThinking) continue;
      if (item.type === "tool_result" && !options.includeToolResults) continue;
      turnBlock += renderContentItem(item);
    }

    turnBlock += "\n---\n\n";


    if (byteLength(current + turnBlock) > maxBytes && current !== header) {
      files.push(current);
      current = `# ${session.meta.slug} (continued)\n\n---\n\n`;
    }

    current += turnBlock;
  }

  if (current.trim()) {
    files.push(current);
  }

  return files.length > 0 ? files : [header + "\n*Empty session*\n"];
}
