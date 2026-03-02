#!/usr/bin/env node
/**
 * Ingest findings.md and docs/plans/*.md into agent_knowledge (unified memory).
 * Run: node scripts/ingest-unified-knowledge.mjs [--source findings|plans|all]
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env
 * Deploy edge function first: supabase functions deploy ingest-unified-knowledge
 *
 * Chunks by ## headers. Sends to ingest-unified-knowledge edge function.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://ztjndilxurtsfqdsvfds.supabase.co";
const KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!KEY) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY in .env");
  process.exit(1);
}

const source = process.argv.includes("--source")
  ? process.argv[process.argv.indexOf("--source") + 1]
  : "all";

/** Chunk markdown by ## headers. Returns { title, content }[] */
function chunkByHeaders(content, maxChunkChars = 6000) {
  const sections = [];
  const lines = content.split("\n");
  let current = { title: "Overview", content: [] };

  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (current.content.length > 0) {
        const text = current.content.join("\n").trim();
        if (text.length > 100) {
          sections.push({
            title: current.title,
            content: text.slice(0, maxChunkChars),
          });
        }
      }
      current = { title: line.replace(/^##\s+/, "").trim(), content: [] };
    } else {
      current.content.push(line);
    }
  }
  if (current.content.length > 0) {
    const text = current.content.join("\n").trim();
    if (text.length > 100) {
      sections.push({ title: current.title, content: text.slice(0, maxChunkChars) });
    }
  }
  return sections;
}

/** Collect chunks from findings and/or plans */
function collectChunks() {
  const chunks = [];

  if (source === "findings" || source === "all") {
    const p = path.join(ROOT, "findings.md");
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, "utf-8");
      const sections = chunkByHeaders(content);
      for (const s of sections) {
        chunks.push({
          category: "findings",
          title: s.title,
          content: s.content,
          source: "findings.md",
        });
      }
      console.log(`  findings.md: ${sections.length} chunks`);
    } else {
      console.warn("  findings.md not found");
    }
  }

  if (source === "findings" || source === "all") {
    const crawPath = path.join(ROOT, "CRAW-FINDINGS-2026-02-26.md");
    if (fs.existsSync(crawPath)) {
      const content = fs.readFileSync(crawPath, "utf-8");
      const sections = chunkByHeaders(content);
      for (const s of sections) {
        chunks.push({
          category: "findings",
          title: `CRAW-Feb26: ${s.title}`,
          content: s.content,
          source: "CRAW-FINDINGS-2026-02-26.md",
        });
      }
      console.log(`  CRAW-FINDINGS: ${sections.length} chunks`);
    }
  }

  if (source === "plans" || source === "all") {
    const plansDir = path.join(ROOT, "docs", "plans");
    if (fs.existsSync(plansDir)) {
      const files = fs.readdirSync(plansDir).filter((f) => f.endsWith(".md"));
      for (const f of files) {
        const content = fs.readFileSync(path.join(plansDir, f), "utf-8");
        const sections = chunkByHeaders(content);
        for (const s of sections) {
          chunks.push({
            category: "plans",
            title: `${path.basename(f, ".md")}: ${s.title}`,
            content: s.content,
            source: `docs/plans/${f}`,
          });
        }
      }
      console.log(`  docs/plans: ${files.length} files`);
    }
  }

  return chunks;
}

async function ingestViaEdgeFunction(chunks) {
  const url = `${SUPABASE_URL}/functions/v1/ingest-unified-knowledge`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ chunks }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Edge function failed (${res.status}): ${text}`);
  }
  return res.json();
}

async function main() {
  console.log(`Ingesting unified knowledge (source=${source})...`);
  const chunks = collectChunks();
  console.log(`Total chunks: ${chunks.length}`);

  if (chunks.length === 0) {
    console.log("Nothing to ingest.");
    return;
  }

  const result = await ingestViaEdgeFunction(chunks);
  console.log("Done.", result);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
