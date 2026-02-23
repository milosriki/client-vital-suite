#!/usr/bin/env node
/**
 * Generate KNOWLEDGE.md — one local file with findings + plans + key decisions.
 * Any AI reads this first. Run: node scripts/generate-knowledge.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function readIfExists(p) {
  const full = path.join(ROOT, p);
  return fs.existsSync(full) ? fs.readFileSync(full, "utf-8") : "";
}

function main() {
  const findings = readIfExists("findings.md");
  const plansDir = path.join(ROOT, "docs", "plans");
  const planFiles = fs.existsSync(plansDir)
    ? fs.readdirSync(plansDir).filter((f) => f.endsWith(".md")).slice(0, 25)
    : [];

  let plans = "";
  for (const f of planFiles) {
    const content = fs.readFileSync(path.join(plansDir, f), "utf-8");
    plans += `\n## Plan: ${f.replace(".md", "")}\n${content.slice(0, 4000)}\n`;
  }

  const wiring = readIfExists("WIRING_ANALYSIS.md").slice(0, 3000) || "";
  const cursorrules = readIfExists(".cursorrules");

  const out = `# KNOWLEDGE — Read This Before Coding

> **Updated:** ${new Date().toISOString().slice(0, 10)}  
> **Purpose:** One file for any AI. Findings, plans, decisions. Local. Fast.

---

## Key Rules (from .cursorrules)

${cursorrules || "- Check WIRING_ANALYSIS.md before new code.\n- Use Tailwind + Shadcn.\n- Never hardcode client data."}

---

## Findings (What's Broken)

${findings ? findings.slice(0, 12000) : "No findings.md found."}

---

## Plans & Ideas

${plans || "No docs/plans found."}

---

## Wiring (if available)

${wiring || "No WIRING_ANALYSIS.md."}

---

## Stack

- **Frontend:** React 19, Vite, Tailwind, shadcn
- **Backend:** Supabase (Postgres, Edge Functions)
- **AI:** Gemini (unified-ai-client.ts)
- **Deploy:** Vercel (frontend), Supabase (functions + DB)
`;

  fs.writeFileSync(path.join(ROOT, "KNOWLEDGE.md"), out);
  console.log("KNOWLEDGE.md generated.");
}

main();
