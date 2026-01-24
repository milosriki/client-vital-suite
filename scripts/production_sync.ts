import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import matter from "gray-matter";

// Robust cleaner for env vars with literal \n and quotes
const clean = (v?: string) =>
  v
    ?.trim()
    .replace(/["'\\]/g, "")
    .replace(/n$/g, "")
    .trim() || "";

const url = clean(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
const key = clean(
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY,
);

if (!url || !key) {
  console.error("❌ Authentication keys missing.");
  process.exit(1);
}

const supabase = createClient(url, key);
const skillsDir = path.resolve(process.cwd(), ".agent/skills");

async function runSync() {
  console.log("🚀 FINAL PRODUCTION SYNC...");
  const folders = fs.readdirSync(skillsDir);
  let count = 0;

  for (const f of folders) {
    const p = path.join(skillsDir, f, "SKILL.md");
    if (!fs.existsSync(p)) continue;

    console.log(`- Uploading ${f}...`);
    const { data, content } = matter(fs.readFileSync(p, "utf8"));

    // UPSERT directly
    const { error } = await supabase.from("agent_skills").upsert({
      id: f,
      name: data.name || f,
      description: data.description || "",
      content: content,
      capabilities: data.capabilities || [],
    });

    if (error) console.error(`  ❌ Failed ${f}:`, error.message);
    else count++;
  }
  console.log(`✅ SYNC COMPLETE: ${count} skills in production.`);
}

runSync();
