import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { getClaudeProjectsDir, decodeProjectPath, truncateText } from "../utils.js";
import type { RawRecord, SessionListItem } from "../types.js";


async function readFirstRecord(filePath: string): Promise<RawRecord | null> {
  try {
    const stream = fs.createReadStream(filePath, { encoding: "utf-8" });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const record = JSON.parse(trimmed) as RawRecord;
        rl.close();
        stream.destroy();
        return record;
      } catch {
        continue;
      }
    }
    return null;
  } catch {
    return null;
  }
}

// user-type record to get session metadata
async function readFirstUserRecord(filePath: string): Promise<RawRecord | null> {
  try {
    const stream = fs.createReadStream(filePath, { encoding: "utf-8" });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const record = JSON.parse(trimmed) as RawRecord;
        if (record.type === "user" && record.message?.role === "user") {
          rl.close();
          stream.destroy();
          return record;
        }
      } catch {
        continue;
      }
    }
    return null;
  } catch {
    return null;
  }
}

//  .jsonl files across all project dirs - same parent
function getAllSessionFiles(): { filePath: string; projectDir: string }[] {
  const projectsDir = getClaudeProjectsDir();
  if (!fs.existsSync(projectsDir)) return [];

  const results: { filePath: string; projectDir: string }[] = [];
  const dirs = fs.readdirSync(projectsDir, { withFileTypes: true });

  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;
    const dirPath = path.join(projectsDir, dir.name);
    try {
      const files = fs.readdirSync(dirPath);
      for (const file of files) {
        if (file.endsWith(".jsonl")) {
          results.push({ filePath: path.join(dirPath, file), projectDir: dir.name });
        }
      }
    } catch {
      // skip unreadable dirs
    }
  }
  return results;
}

export function findSessionByUuid(uuid: string): string | null {
  const files = getAllSessionFiles();
  for (const { filePath } of files) {
    const basename = path.basename(filePath, ".jsonl");
    if (basename === uuid) return filePath;
  }
  return null;
}

export async function findSessionBySlug(slug: string): Promise<string | null> {
  const files = getAllSessionFiles();
  for (const { filePath } of files) {
    const record = await readFirstUserRecord(filePath);
    if (record?.slug === slug) return filePath;
  }
  return null;
}


export function findLatestSession(): string | null {
  const files = getAllSessionFiles();
  let latest: { filePath: string; mtime: number } | null = null;

  for (const { filePath } of files) {
    try {
      const stat = fs.statSync(filePath);
      if (!latest || stat.mtimeMs > latest.mtime) {
        latest = { filePath, mtime: stat.mtimeMs };
      }
    } catch {}
  }
  return latest?.filePath ?? null;
}

// user text message
function extractFirstMessage(record: RawRecord): string {
  const content = record.message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    for (const item of content) {
      if (item.type === "text" && item.text) return item.text.trim();
    }
  }
  return "";
}

/** List recent sessions sorted by mtime desc */
export async function listRecentSessions(limit: number = 20): Promise<SessionListItem[]> {
  const files = getAllSessionFiles();

  const items: { filePath: string; projectDir: string; mtime: Date }[] = [];
  for (const { filePath, projectDir } of files) {
    try {
      const stat = fs.statSync(filePath);
      items.push({ filePath, projectDir, mtime: stat.mtime });
    } catch {
      // skip
    }
  }

  items.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
  const top = items.slice(0, limit);

  const results: SessionListItem[] = [];
  for (const item of top) {
    const record = await readFirstUserRecord(item.filePath);
    if (!record) continue;

    const firstMsg = extractFirstMessage(record);
    // skip system/command messages
    if (firstMsg.startsWith("<")) continue;

    results.push({
      sessionId: record.sessionId,
      slug: record.slug ?? path.basename(item.filePath, ".jsonl"),
      cwd: decodeProjectPath(item.projectDir),
      filePath: item.filePath,
      mtime: item.mtime,
      firstMessage: truncateText(firstMsg, 80),
    });
  }

  return results;
}
