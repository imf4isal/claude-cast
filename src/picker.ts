import { select } from "@inquirer/prompts";
import { listRecentSessions } from "./parser/locate.js";
import { formatTimestamp, truncateText } from "./utils.js";

/** Interactive session picker using inquirer */
export async function pickSession(): Promise<string> {
  const sessions = await listRecentSessions(20);

  if (sessions.length === 0) {
    throw new Error("No Claude Code sessions found in ~/.claude/projects/");
  }

  // Group by cwd for separators
  const grouped = new Map<string, typeof sessions>();
  for (const s of sessions) {
    const group = grouped.get(s.cwd) ?? [];
    group.push(s);
    grouped.set(s.cwd, group);
  }

  type Choice = {
    name: string;
    value: string;
    description: string;
  };

  const choices: (Choice | { type: "separator"; separator: string })[] = [];

  for (const [cwd, items] of grouped) {
    choices.push({ type: "separator" as const, separator: `\u2500\u2500 ${cwd} \u2500\u2500` });
    for (const item of items) {
      const date = formatTimestamp(item.mtime.toISOString());
      const preview = truncateText(item.firstMessage || "(no message)", 50);
      choices.push({
        name: `${item.slug}  ${date}`,
        value: item.filePath,
        description: preview,
      });
    }
  }

  const filePath = await select<string>({
    message: "Select a Claude Code session:",
    choices: choices as Array<{ name: string; value: string; description: string }>,
  });

  return filePath;
}
