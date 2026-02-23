# Deep Research Prompt Engineering — Last 5 Days

> **Purpose:** Prompt to add more and find more details for reverse-engineering. Covers OpenClaw memories, all 6 workspaces, and Antigravity (last 5 days).
>
> **Use:** Copy the prompt below and run it in Cursor, OpenClaw, or Antigravity to fill gaps in `REVERSE_ENGINEERING_TIMELINE.md`.

---

## What Was Missed (Gap Analysis)

| Source | Missed | Path |
|--------|--------|------|
| **OpenClaw .aim/memory.jsonl** | Entity/observation knowledge graph | `~/.openclaw/workspace/.aim/memory.jsonl`, `~/.openclaw/workspace2/.aim/memory.jsonl` |
| **OpenClaw workspace-forge** | FORGE MEMORY.md, SOUL.md | `~/.openclaw/workspace-forge/` |
| **OpenClaw workspace-riki** | Riki MEMORY.md | `~/.openclaw/workspace-riki/` |
| **OpenClaw workspace-business** | Business MEMORY.md | `~/.openclaw/workspace-business/` |
| **OpenClaw workspace-marketing** | Marketing MEMORY.md | `~/.openclaw/workspace-marketing/` |
| **Antigravity brain/** | Each .pb conversation has a brain/UUID/ folder with task.md, implementation_plan.md, blueprints, audits | `~/.gemini/antigravity/brain/{uuid}/` |
| **Antigravity code_tracker** | Active tracked files (openclaw.json, SOUL.md, SKILLs) | `~/.gemini/antigravity/code_tracker/active/` |
| **Time window** | Last 5 days (Feb 17–22) — previous run used 2 days | — |

---

## Master Prompt (Copy & Run)

```
DEEP RESEARCH — Reverse Engineering Timeline (Last 5 Days)

Execute the following extraction and append findings to docs/REVERSE_ENGINEERING_TIMELINE.md or create docs/REVERSE_ENGINEERING_TIMELINE_APPENDIX.md.

SCOPE: Feb 17–22, 2026 (last 5 days)

---

PHASE 1: OpenClaw Memories

1. Read and extract:
   - ~/.openclaw/workspace/.aim/memory.jsonl — parse each JSON line, extract entity names + observations
   - ~/.openclaw/workspace2/.aim/memory.jsonl — same
   Output: Table of entities (edge-function, table, page, person, ai-agent) with key observations.

2. Read MEMORY.md from ALL 6 workspaces:
   - ~/.openclaw/workspace/MEMORY.md
   - ~/.openclaw/workspace2/MEMORY.md
   - ~/.openclaw/workspace-forge/MEMORY.md
   - ~/.openclaw/workspace-riki/MEMORY.md
   - ~/.openclaw/workspace-business/MEMORY.md
   - ~/.openclaw/workspace-marketing/MEMORY.md
   Output: Per-workspace summary (last updated, key facts, lessons).

---

PHASE 2: OpenClaw Sessions (Last 5 Days)

3. For each .jsonl in ~/.openclaw/agents/forge/sessions/ and ~/.openclaw/agents/main/sessions/:
   - Get file mtime; if >= 2026-02-17, include
   - Extract: session id, first timestamp, first user message (if type=message), cwd, any errorMessage
   Output: Chronological table with session_id, timestamp, first_user_msg_preview (80 chars), cwd, errors.

4. Check ~/.openclaw/agents/riki/sessions/, business/sessions/, marketing/sessions/ for same window.

---

PHASE 3: Antigravity (Last 5 Days)

5. List all .pb files in ~/.gemini/antigravity/conversations/ with mtime >= 2026-02-17.
   Output: ANT-XXX | filename | mtime | size_bytes

6. For EACH such .pb file, the UUID in the filename maps to brain/{uuid}/. Extract:
   - brain/{uuid}/task.md — task description
   - brain/{uuid}/*.md — list all .md files, read first 500 chars of each
   Output: Per-conversation table: uuid, mtime, task_summary, artifacts (list of .md files with 1-line summary).

7. Read ~/.gemini/antigravity/code_tracker/active/ — list files, mtimes, and 1-line description of each.

---

PHASE 4: Cross-Reference

8. Map Antigravity brain UUIDs to conversation .pb filenames. Ensure all 10 files from last 5 days have brain/ entries.

9. Identify: Which OpenClaw sessions overlap in time with Antigravity conversations? Which Cursor transcripts?

10. Extract any HEARTBEAT.md, BOOTSTRAP.md, EXECUTION-NOW.md from workspaces — add to timeline.

---

OUTPUT FORMAT

Append to REVERSE_ENGINEERING_TIMELINE.md or create REVERSE_ENGINEERING_TIMELINE_APPENDIX.md with:

## Appendix A: OpenClaw .aim Memory (Entities)
## Appendix B: OpenClaw Workspace MEMORY.md Summaries
## Appendix C: OpenClaw Sessions (Last 5 Days — Full)
## Appendix D: Antigravity Brain Artifacts (Last 5 Days)
## Appendix E: Antigravity code_tracker Active Files
## Appendix F: Cross-Reference Matrix (Time Overlap)

Do not skip any file. If a path does not exist, note "NOT FOUND" and continue.
```

---

## Antigravity Brain UUID Mapping (Last 5 Days)

| .pb file | brain/ folder | Key artifacts |
|----------|---------------|----------------|
| 2eb97580... | brain/2eb97580-b08f-4791-9820-f21e2bc0304a/ | task.md, codebase_audit_feb2026.md, architecture_deep_dive.md, implementation_plan.md, ... |
| 0c29ea41... | brain/0c29ea41-fbfe-41c2-8565-e3c0efc09983/ | task.md, soul_analysis.md, implementation_plan.md, walkthrough.md |
| 3724dabc... | brain/3724dabc.../ (empty) | No artifacts — folder exists but empty |
| ca63dcb1... | brain/ca63dcb1.../ (empty) | No artifacts — folder exists but empty |
| a349339c... | brain/a349339c-372c-44fb-aff7-4adc4beec62b/ | task.md, vertex_ai_ptd_guide.md, implementation_plan.md |
| 407b0f8b... | brain/407b0f8b-ce8c-4721-a349-7ee969044531/ | task.md, sse_migration_blueprint.md, ai_ui_audit_report.md, callgear_sse_sync_analysis.md, ... |
| b81101ed... | brain/b81101ed-9366-4ebc-9fce-7d10f129e6ec/ | task.md, hubspot_devtools_scrape.md, hubspot_skills_guide.md, hubspot_enhanced_prompt.md |
| a4d2752a... | brain/a4d2752a-9bfe-493d-b62c-041138e4d742/ | task.md, LISA_HISTORICAL_FAILURE_ANALYSIS.md, lisa_intelligence_evaluation.md, implementation_plan.md |
| b31c6454... | brain/b31c6454-bc14-4309-b6ba-c036799d3247/ | task.md, vertex_ai_capabilities.md, dead_code_audit.md, mobile_conversion_strategy.md, ... |
| 549b67fe... | brain/549b67fe-62f7-43ad-91f0-f874a31e933a/ | task.md, vertex_supabase_edge_research.md, agentic_ai_rag_blueprint.md, hubspot_dev_platform_report.md |

---

## Quick Commands for Manual Extraction

```bash
# OpenClaw .aim memory (first 20 entities)
head -30 ~/.openclaw/workspace/.aim/memory.jsonl | jq -r 'select(.type=="entity") | "\(.name) | \(.entityType) | \(.observations[0])"'

# Antigravity brain folders for last 5 days
for f in ~/.gemini/antigravity/conversations/*.pb; do
  mtime=$(stat -f "%Sm" -t "%Y-%m-%d" "$f")
  if [[ "$mtime" >= "2026-02-17" ]]; then
    uuid=$(basename "$f" .pb | cut -d'-' -f1)
    echo "=== $f ($mtime) ==="
    ls ~/.gemini/antigravity/brain/*${uuid}* 2>/dev/null || echo "no brain"
  fi
done

# OpenClaw workspace MEMORY.md last-updated
for w in workspace workspace2 workspace-forge workspace-riki workspace-business workspace-marketing; do
  f=~/.openclaw/$w/MEMORY.md
  [[ -f "$f" ]] && echo "$w: $(head -5 "$f" | grep -E "updated|Updated")"
done
```

---

## Verification Checklist

- [ ] All 6 OpenClaw workspaces MEMORY.md read
- [ ] workspace + workspace2 .aim/memory.jsonl parsed
- [ ] All FORGE + main sessions from Feb 17+ extracted
- [ ] riki, business, marketing sessions checked
- [ ] All 10 Antigravity .pb files (last 5 days) mapped to brain/
- [ ] Each brain/ folder: task.md + key artifacts summarized
- [ ] code_tracker/active/ listed
- [ ] Appendix added to timeline doc
