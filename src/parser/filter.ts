import type { RawRecord } from "../types.js";

const NOISE_TYPES = new Set([
  "progress",
  "agent_progress",
  "bash_progress",
  "hook_progress",
  "file-history-snapshot",
  "system",
  "queue-operation",
  "update",
  "create",
]);

const SYSTEM_PREFIXES = [
  "<local-command-caveat>",
  "<command-name>",
  "<system-reminder>",
  "<local-command-stdout>",
  "<local-command-stderr>",
];

function isSystemUserMessage(record: RawRecord): boolean {
  if (record.type !== "user") return false;
  const content = record.message?.content;
  if (typeof content === "string") {
    const trimmed = content.trim();
    return SYSTEM_PREFIXES.some((p) => trimmed.startsWith(p));
  }
  return false;
}

export function filterRecords(records: RawRecord[]): RawRecord[] {
  return records.filter((r) => {
    if (NOISE_TYPES.has(r.type)) return false;
    if (r.isSidechain) return false;
    if (isSystemUserMessage(r)) return false;

    return true;
  });
}
