#!/usr/bin/env node
/**
 * Build Reverse Engineering Timeline — aggregates metadata from Cursor, OpenClaw, Antigravity.
 * Run: node scripts/build-timeline.mjs
 * Output: Summary to stdout; use to update docs/REVERSE_ENGINEERING_TIMELINE.md
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const CURSOR_TRANSCRIPTS =
  process.env.CURSOR_TRANSCRIPTS ||
  path.join(
    process.env.HOME || process.env.USERPROFILE,
    ".cursor/projects/Users-milosvukovic-client-vital-suite/agent-transcripts"
  );
const OPENCLAW_AGENTS =
  process.env.OPENCLAW_AGENTS ||
  path.join(process.env.HOME || process.env.USERPROFILE, ".openclaw/agents");
const ANTIGRAVITY_CONV =
  process.env.ANTIGRAVITY_CONV ||
  path.join(process.env.HOME || process.env.USERPROFILE, ".gemini/antigravity/conversations");

function statSafe(p) {
  try {
    return fs.statSync(p);
  } catch {
    return null;
  }
}

function listDirSafe(dir) {
  try {
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}

function extractFirstUserMsg(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split("\n").filter(Boolean);
    for (const line of lines) {
      const m = line.match(/"text":"([^"]{1,80})/);
      if (m) return m[1].replace(/\\n/g, " ").trim();
    }
  } catch {}
  return null;
}

function collectCursor() {
  const events = [];
  const dirs = listDirSafe(CURSOR_TRANSCRIPTS) || [];
  for (const d of dirs) {
    const jsonl = path.join(CURSOR_TRANSCRIPTS, d, `${d}.jsonl`);
    const stat = statSafe(jsonl);
    if (!stat) continue;
    const id = d.split("-")[0];
    const first = extractFirstUserMsg(jsonl);
    events.push({
      ts: stat.mtime.toISOString().slice(0, 16).replace("T", " "),
      source: "Cursor",
      id,
      summary: first || "agent transcript",
    });
  }
  return events;
}

function collectOpenClaw(agentId) {
  const events = [];
  const sessionsDir = path.join(OPENCLAW_AGENTS, agentId, "sessions");
  const files = listDirSafe(sessionsDir) || [];
  for (const f of files) {
    if (!f.endsWith(".jsonl")) continue;
    const fp = path.join(sessionsDir, f);
    const stat = statSafe(fp);
    if (!stat) continue;
    const sid = f.replace(".jsonl", "").split("-")[0];
    let summary = "session";
    try {
      const raw = fs.readFileSync(fp, "utf8");
      const firstLine = raw.split("\n")[0];
      const session = JSON.parse(firstLine);
      if (session.type === "session" && session.timestamp) {
        summary = `session start ${session.timestamp.slice(0, 10)}`;
      }
      const msgMatch = raw.match(/"text":"\[([^\]]+)\]\s*([^"]{1,60})/);
      if (msgMatch) summary = msgMatch[2].trim() || summary;
      else {
        const cronMatch = raw.match(/\[cron:[^\]]+\s+([^\]]+)/);
        if (cronMatch) summary = `Cron: ${cronMatch[1].slice(0, 40)}`;
      }
    } catch {}
    events.push({
      ts: stat.mtime.toISOString().slice(0, 16).replace("T", " "),
      source: `OpenClaw-${agentId}`,
      id: sid,
      summary,
    });
  }
  return events;
}

function collectAntigravity() {
  const events = [];
  const files = listDirSafe(ANTIGRAVITY_CONV) || [];
  for (const f of files) {
    if (!f.endsWith(".pb")) continue;
    const fp = path.join(ANTIGRAVITY_CONV, f);
    const stat = statSafe(fp);
    if (!stat) continue;
    const id = f.replace(".pb", "").split("-")[0];
    events.push({
      ts: stat.mtime.toISOString().slice(0, 16).replace("T", " "),
      source: "Antigravity",
      id,
      summary: ".pb (protobuf binary)",
    });
  }
  return events;
}

function main() {
  const all = [
    ...collectCursor(),
    ...collectOpenClaw("forge"),
    ...collectOpenClaw("main"),
    ...collectAntigravity(),
  ];

  all.sort((a, b) => a.ts.localeCompare(b.ts));

  console.log("# Reverse Engineering Timeline — Aggregated\n");
  console.log("| Timestamp | Source | ID | Summary |");
  console.log("|-----------|--------|-----|---------|");
  for (const e of all) {
    const summary = (e.summary || "").slice(0, 60).replace(/\|/g, " ");
    console.log(`| ${e.ts} | ${e.source} | ${e.id} | ${summary} |`);
  }
  console.log(`\nTotal: ${all.length} events`);
}

main();
