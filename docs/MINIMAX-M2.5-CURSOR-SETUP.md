# MiniMax-M2.5 in Cursor — Setup Guide

> Use MiniMax-M2.5 as your coding model in Cursor.  
> Source: [platform.minimax.io/docs/coding-plan/cursor](https://platform.minimax.io/docs/coding-plan/cursor)

---

## Prerequisites

1. **Clear OpenAI env vars** (if set):
   - `OPENAI_API_KEY`
   - `OPENAI_BASE_URL`

2. **Get your API key** from [MiniMax Developer Platform](https://platform.minimax.io/user-center/basic-information/interface-key)  
   - China: [platform.minimaxi.com](https://platform.minimaxi.com/user-center/basic-information/interface-key)  
   - Use your **Coding Plan Key** (`sk-cp-...`)

---

## Step-by-Step

### 1. Open Cursor Settings

- Click **Settings** (top-right) → **Models**

### 2. Configure API Keys

- Expand **API Keys**
- Enable **Override OpenAI Base URL**
- **Base URL:**
  - International: `https://api.minimax.io/v1`
  - China: `https://api.minimaxi.com/v1`
- Paste your MiniMax API key into the **OpenAI API Key** field
- Click **Enable OpenAI API Key** and verify

### 3. Add Custom Model

- In **Models**, click **View All Models**
- Click **Add Custom Model**
- Model name: **`MiniMax-M2.5`**
- Click **Add**

### 4. Use It

- Enable the new **MiniMax-M2.5** model
- In the chat panel, select **MiniMax-M2.5** as the model
- Start coding with MiniMax-M2.5

---

## Region Reference

| Region   | Base URL                    | API Key Source |
|----------|-----------------------------|----------------|
| Global   | `https://api.minimax.io/v1` | platform.minimax.io |
| China    | `https://api.minimaxi.com/v1` | platform.minimaxi.com |

---

## MCP vs Model

| Component | Purpose |
|-----------|---------|
| **MiniMax MCP** (`minimax-mcp`) | Tools: text-to-image, generate-video, text-to-audio, etc. |
| **MiniMax-M2.5 model** | The LLM that powers chat/composer (replaces Claude) |

You can use both: MiniMax-M2.5 for reasoning + MCP tools for images/video/audio.
