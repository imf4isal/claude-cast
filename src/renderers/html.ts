import { marked } from "marked";
import type { ParsedSession, ContentItem, RenderOptions } from "../types.js";
import { formatTimestamp, truncateLines } from "../utils.js";
import { htmlShell, escapeHtml } from "./html-template.js";

const MAX_TOOL_OUTPUT_LINES = 50;

function renderContentItemHtml(item: ContentItem): string {
  switch (item.type) {
    case "text":
      return `<div class="turn-content">${marked.parse(item.text)}</div>`;

    case "thinking":
      return (
        `<details class="thinking">` +
        `<summary>Extended Thinking</summary>` +
        `<div class="thinking-body">${escapeHtml(item.text)}</div>` +
        `</details>`
      );

    case "tool_use": {
      const inputStr = truncateLines(JSON.stringify(item.input, null, 2), MAX_TOOL_OUTPUT_LINES);
      return (
        `<details class="tool-call">` +
        `<summary>Tool: ${escapeHtml(item.name)}</summary>` +
        `<div class="tool-body"><pre><code>${escapeHtml(inputStr)}</code></pre></div>` +
        `</details>`
      );
    }

    case "tool_result": {
      const label = item.is_error ? "Tool Error" : "Tool Result";
      const truncated = truncateLines(item.content, MAX_TOOL_OUTPUT_LINES);
      return (
        `<details class="tool-result">` +
        `<summary>${escapeHtml(label)}</summary>` +
        `<div class="result-body"><pre><code>${escapeHtml(truncated)}</code></pre></div>` +
        `</details>`
      );
    }
  }
}

function renderMetaHeader(session: ParsedSession): string {
  const { meta } = session;
  let pills = `<span class="pill">${escapeHtml(formatTimestamp(meta.startedAt))}</span>`;
  pills += `<span class="pill">${escapeHtml(meta.model)}</span>`;
  pills += `<span class="pill">${meta.turnCount} turns</span>`;
  if (meta.cwd) pills += `<span class="pill">${escapeHtml(meta.cwd)}</span>`;
  if (meta.version) pills += `<span class="pill">v${escapeHtml(meta.version)}</span>`;
  if (meta.gitBranch && meta.gitBranch !== "HEAD") {
    pills += `<span class="pill">${escapeHtml(meta.gitBranch)}</span>`;
  }

  return (
    `<div class="session-header">` +
    `<h1>${escapeHtml(meta.slug || "Claude Code Session")}</h1>` +
    `<div class="meta-pills">${pills}</div>` +
    `</div>`
  );
}

function renderTurn(turn: import("../types.js").ConversationTurn, options: RenderOptions): string {
  const roleClass = turn.role;
  const roleLabel = turn.role === "user" ? "You" : "Claude";
  const avatarLabel = turn.role === "user" ? "U" : "C";
  const timestamp = formatTimestamp(turn.timestamp);

  let contentHtml = "";
  for (const item of turn.content) {
    if (item.type === "thinking" && !options.includeThinking) continue;
    if (item.type === "tool_result" && !options.includeToolResults) continue;
    contentHtml += renderContentItemHtml(item);
  }

  if (!contentHtml.trim()) return "";

  return (
    `<div class="turn ${roleClass}">` +
    `<div class="turn-header">` +
    `<div class="avatar ${roleClass}">${avatarLabel}</div>` +
    `<span class="turn-role">${roleLabel}</span>` +
    `<span class="turn-time">${escapeHtml(timestamp)}</span>` +
    `</div>` +
    contentHtml +
    `</div>`
  );
}

export function renderHtml(session: ParsedSession, options: RenderOptions): string {
  const title = session.meta.slug || "Claude Code Session";
  let body = renderMetaHeader(session);

  for (const turn of session.turns) {
    const turnHtml = renderTurn(turn, options);
    if (turnHtml) body += turnHtml;
  }

  return htmlShell(title, body);
}
