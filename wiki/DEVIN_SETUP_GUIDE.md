# Devin AI Integration Guide

## 🤖 What is Devin?

Devin is an AI software engineer that can autonomously complete development tasks. It integrates via MCP (Model Context Protocol) and API.

---

## 🚀 Quick Install: VS Code Extension

### Option 1: From VS Code Marketplace

1. Open VS Code/Cursor
2. Press `Cmd+Shift+X` (Extensions)
3. Search for "Devin"
4. Install **Devin** by Cognition AI

### Option 2: From Devin MCP Marketplace

1. Go to: https://app.devin.ai → Settings → MCP marketplace
2. Find and install the Devin MCP server

### Option 3: Manual VS Code Extension

If available as VSIX:

```bash
code --install-extension /path/to/devin.vsix
```

---

## ⌨️ VS Code Commands (After Install)

Once installed, you can use these commands (`Cmd+Shift+P`):

| Command                 | Description              |
| ----------------------- | ------------------------ |
| `Devin: Open Sessions`  | View your Devin sessions |
| `Devin: Set API Key`    | Configure your API key   |
| `Devin: Set User Email` | Set your account email   |

---

## 🔑 Step 1: Get Your Devin API Key

From your screenshot, you're already on the right page:

1. Go to: https://app.devin.ai → Settings → Devin's API
2. Click "View key" to see your **Personal API Key**
3. Copy the key

---

## 🔧 Step 2: Add Devin to Your MCP Configuration

### For Cursor IDE

Create or edit `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "devin": {
      "url": "https://mcp.devin.ai/sse",
      "transport": "sse",
      "headers": {
        "Authorization": "Bearer YOUR_DEVIN_API_KEY"
      }
    },
    "deepwiki": {
      "url": "https://mcp.deepwiki.com/sse",
      "transport": "sse"
    }
  }
}
```

Replace `YOUR_DEVIN_API_KEY` with your actual key from Step 1.

---

## 🌐 Step 3: Index Your Repository in DeepWiki

For Devin to understand your codebase:

1. Go to: https://deepwiki.com
2. Enter your repository: `milosriki/client-vital-suite`
3. Let it index your repository
4. Now Devin can ask questions about your code!

---

## 📡 Step 4: Using Devin API Directly

### Create a Session (from your screenshot):

```bash
curl -X POST "https://api.devin.ai/v1/sessions" \
  -H "Authorization: Bearer $DEVIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Review all wiki files in the client-vital-suite repo and create a summary"
  }'
```

---

## 🛠️ Step 5: Add Devin to Supabase Secrets (Optional)

If you want Edge Functions to call Devin:

```bash
supabase secrets set DEVIN_API_KEY=your_key_here --project-ref ztjndilxurtsfqdsvfds
```

---

## 📝 MCP Tools Available

Once connected, you get these tools:

| Tool                  | Description                            |
| --------------------- | -------------------------------------- |
| `read_wiki_structure` | Get documentation structure for a repo |
| `read_wiki_contents`  | Get comprehensive docs about a repo    |
| `ask_question`        | Ask AI-powered questions about a repo  |

---

## 🎯 Example: Ask About Your Wiki

After setup, you can ask Devin:

> "Using DeepWiki, read the wiki structure for milosriki/client-vital-suite and summarize all documented errors"

---

## ⚙️ Full MCP Config Example

For your `.cursor/mcp.json` or Cursor settings:

```json
{
  "mcpServers": {
    "devin": {
      "url": "https://mcp.devin.ai/sse",
      "transport": "sse",
      "headers": {
        "Authorization": "Bearer devin_xxxxxxxxxxxxxxxxxxxx"
      }
    },
    "deepwiki": {
      "url": "https://mcp.deepwiki.com/sse",
      "transport": "sse"
    },
    "hubspot-advanced": {
      "command": "node",
      "args": [
        "/Users/milosvukovic/Documents/hubspot-mcp-server/dist/server.js"
      ],
      "env": {
        "HUBSPOT_ACCESS_TOKEN": "your_hubspot_key"
      }
    },
    "supabase": {
      "command": "npx",
      "args": ["-y", "@supabase/mcp-server-supabase@latest"],
      "env": {
        "SUPABASE_URL": "https://ztjndilxurtsfqdsvfds.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "your_service_role_key"
      }
    }
  }
}
```

---

## ✅ Verification

After setup, test by asking in Cursor:

> "Use the Devin MCP to read the wiki structure for milosriki/client-vital-suite"

You should see Devin respond with the repository documentation structure.

---

**Status:** Ready to Configure
**API Key Location:** https://app.devin.ai → Settings → Devin's API
