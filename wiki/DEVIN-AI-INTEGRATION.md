# Devin AI Wiki Integration

**Date:** 2025-12-21
**Status:** 🟡 Ready for Setup

---

## Overview

Devin AI is an autonomous AI software engineer that can be integrated into the project via MCP (Model Context Protocol) and API.

---

## Integration Options

### Option 1: Devin MCP Server (Recommended)

- **URL:** `https://mcp.devin.ai/sse`
- **Transport:** SSE (Server-Sent Events)
- **Auth:** Bearer token (from Devin dashboard)
- **For:** Private repositories, full access

### Option 2: DeepWiki MCP Server (Free)

- **URL:** `https://mcp.deepwiki.com/sse`
- **Transport:** SSE
- **Auth:** None required
- **For:** Public repositories only

---

## Setup Requirements

1. **Devin API Key** from https://app.devin.ai → Settings → Devin's API
2. **Cursor IDE** or compatible MCP client
3. **Repository indexed** at DeepWiki.com (optional for DeepWiki tools)

---

## MCP Configuration

Add to your `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "devin": {
      "url": "https://mcp.devin.ai/sse",
      "transport": "sse",
      "headers": {
        "Authorization": "Bearer YOUR_DEVIN_API_KEY"
      }
    }
  }
}
```

---

## Available Tools

| Tool                  | Description                                |
| --------------------- | ------------------------------------------ |
| `read_wiki_structure` | Get documentation topics for a GitHub repo |
| `read_wiki_contents`  | View comprehensive documentation           |
| `ask_question`        | AI-powered Q&A about the codebase          |

---

## Use Cases

1. **Code Review:** "Review the latest changes and identify potential issues"
2. **Documentation:** "Generate wiki documentation for all Edge Functions"
3. **Bug Fixing:** "Find and fix the HubSpot infinite loop issue"
4. **Feature Development:** "Add pagination to the clients table"

---

## Related Files

- `/DEVIN_SETUP_GUIDE.md` - Detailed setup instructions
- `/.vscode/mcp-config-example.json` - Example MCP config

---

**Next Step:** Get your Devin API key and add it to your MCP configuration.
