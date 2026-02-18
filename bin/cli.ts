#!/usr/bin/env node

import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import { parseSession } from "../src/parser/index.js";
import {
  findSessionByUuid,
  findSessionBySlug,
  findLatestSession,
  listRecentSessions,
} from "../src/parser/locate.js";
import { renderMarkdown } from "../src/renderers/markdown.js";
import { renderHtml } from "../src/renderers/html.js";
import { uploadGist } from "../src/gist.js";
import { pickSession } from "../src/picker.js";
import { formatTimestamp, truncateText } from "../src/utils.js";
import type { RenderOptions } from "../src/types.js";

const program = new Command();

program
  .name("claude-cast")
  .description("Share Claude Code sessions via GitHub Gist")
  .version("0.1.0")
  .argument("[session]", "Session UUID, slug, or 'latest'")
  .option("-f, --format <format>", "Output format: html or md", "html")
  .option("-o, --output <path>", "Output file path (default: stdout)")
  .option("--gist", "Upload to GitHub Gist")
  .option("--gist-public", "Make the gist public (default: secret)")
  .option("--token <token>", "GitHub personal access token")
  .option("--include-thinking", "Include extended thinking blocks")
  .option("--no-tool-results", "Exclude tool call results")
  .option("--list", "List recent sessions")
  .option("--dry-run", "Print output to stdout instead of file")
  .action(async (session: string | undefined, opts: Record<string, unknown>) => {
    try {
      // --list mode
      if (opts.list) {
        const sessions = await listRecentSessions(20);
        if (sessions.length === 0) {
          console.log("No Claude Code sessions found.");
          return;
        }
        console.log("\nRecent Claude Code sessions:\n");
        for (const s of sessions) {
          const date = formatTimestamp(s.mtime.toISOString());
          const preview = truncateText(s.firstMessage || "(no message)", 60);
          console.log(`  ${s.slug}`);
          console.log(`    ${date}  |  ${s.cwd}`);
          console.log(`    ${preview}`);
          console.log();
        }
        return;
      }

      // Resolve session file path
      let filePath: string | null = null;

      if (!session) {
        // Interactive picker
        filePath = await pickSession();
      } else if (session === "latest") {
        filePath = findLatestSession();
        if (!filePath) {
          console.error("No sessions found.");
          process.exit(1);
        }
      } else {
        // Try UUID first
        filePath = findSessionByUuid(session);
        if (!filePath) {
          // Try slug
          filePath = await findSessionBySlug(session);
        }
        if (!filePath) {
          console.error(`Session not found: ${session}`);
          process.exit(1);
        }
      }

      // Parse session
      const parsed = await parseSession(filePath, {
        includeThinking: opts.includeThinking as boolean,
        includeToolResults: opts.toolResults as boolean,
      });

      const renderOptions: RenderOptions = {
        includeThinking: opts.includeThinking as boolean ?? false,
        includeToolResults: opts.toolResults as boolean ?? true,
        maxBytes: 900_000,
      };

      const format = (opts.format as string) ?? "html";

      // Render
      let output: string;
      let fileName: string;
      let gistFiles: Map<string, string>;

      if (format === "md" || format === "markdown") {
        const parts = renderMarkdown(parsed, renderOptions);
        output = parts[0];
        fileName = `${parsed.meta.slug || "session"}.md`;
        gistFiles = new Map();
        if (parts.length === 1) {
          gistFiles.set(fileName, parts[0]);
        } else {
          parts.forEach((part, i) => {
            gistFiles.set(`${parsed.meta.slug || "session"}-part${i + 1}.md`, part);
          });
        }
      } else {
        output = renderHtml(parsed, renderOptions);
        fileName = `${parsed.meta.slug || "session"}.html`;
        gistFiles = new Map([[fileName, output]]);
      }

      // Gist upload
      if (opts.gist) {
        const result = await uploadGist(gistFiles, {
          token: opts.token as string | undefined,
          isPublic: opts.gistPublic as boolean ?? false,
          description: `Claude Code session: ${parsed.meta.slug}`,
        });
        console.log(`\nGist created: ${result.htmlUrl}\n`);
        return;
      }

      // Output
      if (opts.dryRun || (!opts.output && !opts.gist)) {
        process.stdout.write(output);
      } else if (opts.output) {
        const outPath = path.resolve(opts.output as string);
        fs.writeFileSync(outPath, output);
        console.log(`Written to: ${outPath}`);
      }
    } catch (err) {
      if ((err as Error).name === "ExitPromptError") {
        // User cancelled interactive prompt
        process.exit(0);
      }
      console.error(`Error: ${(err as Error).message}`);
      process.exit(1);
    }
  });

program.parse();
