import { homedir } from "node:os";
import path from "node:path";


export function decodeProjectPath(dirName: string): string {
  return dirName.replace(/-/g, "/");
}

export function encodeProjectPath(cwd: string): string {
  return cwd.replace(/\//g, "-");
}

export function getClaudeProjectsDir(): string {
  return path.join(homedir(), ".claude", "projects");
}

export function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + "\u2026";
}

export function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function byteLength(str: string): number {
  return Buffer.byteLength(str, "utf-8");
}

export function truncateLines(text: string, maxLines: number): string {
  const lines = text.split("\n");
  if (lines.length <= maxLines) return text;
  return lines.slice(0, maxLines).join("\n") + `\n... (${lines.length - maxLines} more lines)`;
}
