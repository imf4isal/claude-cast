export function htmlShell(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<style>
  :root {
    color-scheme: light dark;
  }

  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.6;
    max-width: 900px;
    margin: 0 auto;
    padding: 20px;
    background: light-dark(#f8f9fa, #1a1a2e);
    color: light-dark(#1a1a2e, #e0e0e0);
  }

  .session-header {
    margin-bottom: 32px;
    padding: 24px;
    border-radius: 12px;
    background: light-dark(#fff, #16213e);
    border: 1px solid light-dark(#e0e0e0, #333);
  }

  .session-header h1 {
    font-size: 1.5rem;
    margin-bottom: 12px;
    color: light-dark(#1a1a2e, #e0e0e0);
  }

  .meta-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .pill {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 16px;
    font-size: 0.8rem;
    background: light-dark(#e8eaf6, #1a1a4e);
    color: light-dark(#3949ab, #7986cb);
  }

  .turn {
    margin-bottom: 24px;
    padding: 16px 20px;
    border-radius: 10px;
    background: light-dark(#fff, #16213e);
    border: 1px solid light-dark(#e0e0e0, #333);
    position: relative;
  }

  .turn.user {
    border-left: 4px solid #2196f3;
  }

  .turn.assistant {
    border-left: 4px solid #4caf50;
  }

  .turn-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
  }

  .avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.9rem;
    font-weight: 600;
    flex-shrink: 0;
  }

  .avatar.user {
    background: light-dark(#bbdefb, #1565c0);
    color: light-dark(#1565c0, #bbdefb);
  }

  .avatar.assistant {
    background: light-dark(#c8e6c9, #2e7d32);
    color: light-dark(#2e7d32, #c8e6c9);
  }

  .turn-role {
    font-weight: 600;
    font-size: 0.95rem;
  }

  .turn-time {
    font-size: 0.75rem;
    color: light-dark(#888, #777);
    margin-left: auto;
  }

  .turn-content {
    font-size: 0.92rem;
    line-height: 1.7;
  }

  .turn-content p {
    margin-bottom: 10px;
  }

  .turn-content p:last-child {
    margin-bottom: 0;
  }

  .turn-content ul, .turn-content ol {
    margin: 8px 0;
    padding-left: 24px;
  }

  .turn-content li {
    margin-bottom: 4px;
  }

  .turn-content strong {
    font-weight: 600;
  }

  .turn-content h1, .turn-content h2, .turn-content h3,
  .turn-content h4, .turn-content h5, .turn-content h6 {
    margin-top: 16px;
    margin-bottom: 8px;
  }

  .turn-content code {
    font-family: "SF Mono", "Fira Code", "Fira Mono", Menlo, Monaco, Consolas, monospace;
    font-size: 0.85em;
    padding: 2px 6px;
    border-radius: 4px;
    background: light-dark(#f0f0f0, #2a2a4a);
  }

  .turn-content pre {
    margin: 12px 0;
    padding: 14px;
    border-radius: 8px;
    background: light-dark(#f5f5f5, #0d1117);
    overflow-x: auto;
    border: 1px solid light-dark(#e0e0e0, #333);
  }

  .turn-content pre code {
    padding: 0;
    background: none;
    font-size: 0.83em;
    line-height: 1.5;
  }

  details.tool-call {
    margin: 10px 0;
    border: 1px solid light-dark(#e0d4f5, #2d1b4e);
    border-left: 3px solid #9c27b0;
    border-radius: 6px;
    overflow: hidden;
  }

  details.tool-call summary {
    padding: 8px 14px;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 500;
    background: light-dark(#f3e5f5, #1a0a2e);
    color: light-dark(#6a1b9a, #ce93d8);
  }

  details.tool-call .tool-body {
    padding: 10px 14px;
    font-size: 0.83rem;
  }

  details.thinking {
    margin: 10px 0;
    border: 1px solid light-dark(#ffe0b2, #4e3a1b);
    border-left: 3px solid #ff9800;
    border-radius: 6px;
    overflow: hidden;
  }

  details.thinking summary {
    padding: 8px 14px;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 500;
    background: light-dark(#fff3e0, #2e1a00);
    color: light-dark(#e65100, #ffb74d);
  }

  details.thinking .thinking-body {
    padding: 10px 14px;
    font-size: 0.83rem;
    white-space: pre-wrap;
    color: light-dark(#555, #aaa);
  }

  details.tool-result {
    margin: 4px 0 10px;
    border: 1px solid light-dark(#e0e0e0, #333);
    border-radius: 6px;
    overflow: hidden;
  }

  details.tool-result summary {
    padding: 6px 14px;
    cursor: pointer;
    font-size: 0.8rem;
    background: light-dark(#fafafa, #111);
    color: light-dark(#666, #999);
  }

  details.tool-result .result-body {
    padding: 10px 14px;
    font-size: 0.8rem;
  }

  details.tool-result .result-body pre {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-all;
  }

  .footer {
    margin-top: 40px;
    padding-top: 20px;
    border-top: 1px solid light-dark(#e0e0e0, #333);
    text-align: center;
    font-size: 0.75rem;
    color: light-dark(#888, #666);
  }

  @media (max-width: 640px) {
    body { padding: 12px; }
    .turn { padding: 12px 14px; }
    .session-header { padding: 16px; }
  }
</style>
</head>
<body>
${body}
<div class="footer">
  Generated by claude-cast
</div>
</body>
</html>`;
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
