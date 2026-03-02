# Plan: MiniMax + Context7 + OpenClaw

Install MiniMax across Cursor, Claude, and OpenClaw; use Context7 MCP for prompt improvement; replace OpenAI with MiniMax in OpenClaw.

## Approach

Use MiniMax-M2.5 as the primary coding/reasoning model in Cursor and OpenClaw, and as an optional backend for Claude. Wire Context7 MCP into prompt workflows so agents fetch current docs before non-trivial edits. Vital Suite backend stays on Gemini (per AGENTS.md); OpenAI remains only for embeddings.

## Scope

- **In:** Cursor model override, Claude config, OpenClaw provider swap, Context7 prompt gates, key hygiene (sk-cp vs sk-api)
- **Out:** Changing Vital Suite Supabase AI (Gemini), openai-embeddings, webhooks, or any production backend

## Action Items

- [ ] **Fix MCP key** — Use `sk-api-*` for minimax-mcp in `~/.cursor/mcp.json`; reserve `sk-cp-*` for Cursor model override only
- [ ] **Complete Cursor setup** — Follow `docs/MINIMAX-M2.5-CURSOR-SETUP.md`: Base URL `https://api.minimax.io/v1`, add custom model `MiniMax-M2.5`, enable it in chat
- [ ] **Configure Claude for MiniMax** — If using Claude Desktop: set Anthropic-compatible base URL and API key (MiniMax supports this); document in `docs/MINIMAX-CLAUDE-SETUP.md`
- [ ] **Replace OpenAI in OpenClaw** — Inspect `~/.openclaw/openclaw.json` and env; swap OpenAI provider/config for MiniMax (Anthropic-compatible endpoint + key)
- [ ] **Add Context7 prompt gate** — In `docs/PTD-ASTAR-PROMPT-v6.md` and similar prompts: require 1–2 Context7 `query-docs` calls before non-trivial edits (per existing "context7 gate" section)
- [ ] **Document key usage** — Add `docs/MINIMAX-KEY-USAGE.md`: sk-cp = Cursor model; sk-api = MCP, Claude, OpenClaw
- [ ] **Verify** — Run `npm run build`, `npx tsc --noEmit`; test Cursor chat with MiniMax-M2.5; test OpenClaw with MiniMax backend

## Open Questions

- Does Claude Desktop support base_url override for Anthropic SDK? (If not, skip Claude step or use a different integration.)
- Exact OpenClaw config path and schema — confirm `~/.openclaw/openclaw.json` and any `.env` before editing.
