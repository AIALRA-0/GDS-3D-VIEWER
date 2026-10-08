# MCP Setup

## Recommended MCP Servers

### OpenAI Developer Docs

Use this when the team needs up-to-date product, model, or API documentation while iterating with Codex.

Official endpoint:

- `https://developers.openai.com/mcp`

### Playwright MCP

Use this as the browser self-feedback loop for UI validation, smoke testing, screenshots, and iterative debugging.

Recommended package:

- `npx @playwright/mcp@latest`

### Filesystem MCP

Use this to give agents scoped file access to the repository root instead of the entire machine.

Recommended package:

- `npx -y @modelcontextprotocol/server-filesystem /path/to/GDS-3D-VIEWER`

### GitHub MCP

Use this for repository browsing, pull requests, Actions inspection, and issue triage.

Recommended image:

- `ghcr.io/github/github-mcp-server`

## Suggested Setup Flow

1. Enable `openaiDeveloperDocs` for API lookup.
2. Enable `playwright` for browser feedback.
3. Enable `filesystem` scoped to this repository only.
4. Add GitHub MCP only when repository automation is needed.

## Repository Config Example

See [`configs/codex.mcp.config.toml.example`](../configs/codex.mcp.config.toml.example).
