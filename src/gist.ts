import { execSync } from "node:child_process";
import type { GistOptions, GistResult } from "./types.js";

/** Try to get a GitHub token from various sources */
async function resolveToken(explicitToken?: string): Promise<string | null> {
  // 1. Explicit token
  if (explicitToken) return explicitToken;

  // 2. Environment variables
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN;

  // 3. gh CLI auth token
  try {
    const token = execSync("gh auth token", { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
    if (token) return token;
  } catch {
    // gh not installed or not authenticated
  }

  return null;
}

/** Check if gh CLI is available and authenticated */
function isGhAvailable(): boolean {
  try {
    execSync("gh auth status", { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
    return true;
  } catch {
    return false;
  }
}

/** Upload via gh CLI */
function uploadViaGh(
  files: Map<string, string>,
  options: GistOptions
): GistResult {
  const tmpDir = execSync("mktemp -d", { encoding: "utf-8" }).trim();

  try {
    // Write files to temp dir
    const filePaths: string[] = [];
    for (const [name, content] of files) {
      const filePath = `${tmpDir}/${name}`;
      const fs = require("node:fs") as typeof import("node:fs");
      fs.writeFileSync(filePath, content);
      filePaths.push(filePath);
    }

    const args = ["gh", "gist", "create"];
    if (options.description) args.push("--desc", options.description);
    if (options.isPublic) args.push("--public");
    args.push(...filePaths);

    const output = execSync(args.join(" "), {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    // gh outputs the gist URL
    const url = output.split("\n").pop()?.trim() ?? "";
    const id = url.split("/").pop() ?? "";

    return { url, htmlUrl: url, id };
  } finally {
    execSync(`rm -rf ${tmpDir}`, { stdio: "pipe" });
  }
}

/** Upload via GitHub REST API */
async function uploadViaApi(
  files: Map<string, string>,
  token: string,
  options: GistOptions
): Promise<GistResult> {
  const gistFiles: Record<string, { content: string }> = {};
  for (const [name, content] of files) {
    gistFiles[name] = { content };
  }

  const response = await fetch("https://api.github.com/gists", {
    method: "POST",
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      description: options.description ?? "Claude Code session shared via claude-cast",
      public: options.isPublic,
      files: gistFiles,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    if (response.status === 401) {
      throw new Error("GitHub authentication failed. Check your token.");
    }
    if (response.status === 422) {
      throw new Error(`GitHub rejected the gist: ${body}`);
    }
    throw new Error(`GitHub API error (${response.status}): ${body}`);
  }

  const data = (await response.json()) as { html_url: string; url: string; id: string };
  return {
    url: data.url,
    htmlUrl: data.html_url,
    id: data.id,
  };
}

/** Upload content to GitHub Gist */
export async function uploadGist(
  files: Map<string, string>,
  options: GistOptions
): Promise<GistResult> {
  // Try gh CLI first
  if (isGhAvailable() && !options.token) {
    try {
      return uploadViaGh(files, options);
    } catch {
      // Fall through to REST API
    }
  }

  // REST API path
  const token = await resolveToken(options.token);
  if (!token) {
    throw new Error(
      "No GitHub token found. Provide one via --token, GITHUB_TOKEN env, or run `gh auth login`."
    );
  }

  return uploadViaApi(files, token, options);
}
