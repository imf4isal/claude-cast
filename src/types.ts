// raw JSONL record as stored by Claude Code
export interface RawRecord {
  type: string;
  uuid: string;
  parentUuid: string | null;
  sessionId: string;
  requestId?: string;
  timestamp: string;
  slug?: string;
  cwd?: string;
  version?: string;
  gitBranch?: string;
  isSidechain?: boolean;
  userType?: string;
  permissionMode?: string;
  message?: RawMessage;
  data?: unknown;
  // file-history-snapshot fields
  snapshot?: unknown;
  isSnapshotUpdate?: boolean;
}

export interface RawMessage {
  role: "user" | "assistant";
  content: string | RawContentItem[];
  model?: string;
  id?: string;
  type?: string;
  stop_reason?: string | null;
  usage?: Record<string, unknown>;
}

export interface RawContentItem {
  type: string;
  text?: string;
  thinking?: string;
  signature?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string | RawToolResultContent[];
  is_error?: boolean;
}

export interface RawToolResultContent {
  type: string;
  text?: string;
}

// normalized content items
export type ContentItem =
  | { type: "text"; text: string }
  | { type: "thinking"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error: boolean };

export interface ConversationTurn {
  role: "user" | "assistant";
  uuid: string;
  timestamp: string;
  content: ContentItem[];
  model?: string;
}

export interface SessionMeta {
  sessionId: string;
  slug: string;
  cwd: string;
  startedAt: string;
  endedAt: string;
  model: string;
  version: string;
  turnCount: number;
  gitBranch?: string;
}

export interface ParsedSession {
  meta: SessionMeta;
  turns: ConversationTurn[];
}

export interface SessionListItem {
  sessionId: string;
  slug: string;
  cwd: string;
  filePath: string;
  mtime: Date;
  firstMessage: string;
}

export interface RenderOptions {
  includeThinking: boolean;
  includeToolResults: boolean;
  maxBytes: number;
}

export interface GistOptions {
  token?: string;
  isPublic: boolean;
  description?: string;
}

export interface GistResult {
  url: string;
  htmlUrl: string;
  id: string;
}
