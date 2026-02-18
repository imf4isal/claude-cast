import fs from "node:fs";
import readline from "node:readline";
import type { RawRecord, ParsedSession, SessionMeta } from "../types.js";
import { filterRecords } from "./filter.js";
import { buildConversationTree } from "./tree.js";


async function readRecords(filePath: string): Promise<RawRecord[]> {
  const records: RawRecord[] = [];
  const stream = fs.createReadStream(filePath, { encoding: "utf-8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      records.push(JSON.parse(trimmed) as RawRecord);
    } catch {
      // skip malformed lines
    }
  }

  return records;
}


function extractMeta(records: RawRecord[], turnCount: number): SessionMeta {

  const firstUser = records.find((r) => r.type === "user" && r.message?.role === "user");
  const firstAssistant = records.find((r) => r.type === "assistant");
  const lastRecord = records[records.length - 1];

  return {
    sessionId: firstUser?.sessionId ?? "",
    slug: firstUser?.slug ?? "",
    cwd: firstUser?.cwd ?? "",
    startedAt: firstUser?.timestamp ?? "",
    endedAt: lastRecord?.timestamp ?? "",
    model: firstAssistant?.message?.model ?? "unknown",
    version: firstUser?.version ?? "",
    turnCount,
    gitBranch: firstUser?.gitBranch,
  };
}

export async function parseSession(
  filePath: string,
  options: { includeThinking?: boolean; includeToolResults?: boolean } = {}
): Promise<ParsedSession> {
  const { includeThinking = false, includeToolResults = true } = options;

  const rawRecords = await readRecords(filePath);
  const filtered = filterRecords(rawRecords);
  const turns = buildConversationTree(filtered, includeThinking, includeToolResults);
  const meta = extractMeta(rawRecords, turns.length);

  return { meta, turns };
}
