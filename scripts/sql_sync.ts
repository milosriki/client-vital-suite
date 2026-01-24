import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import matter from "gray-matter";

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

const s = createClient(url, key);
const skillsDir = path.resolve(process.cwd(), ".agent/skills");

async function runSync() {
  console.log("🚀 SQL-BASED PRODUCTION SYNC...");
  const folders = fs.readdirSync(skillsDir);
  let count = 0;

  for (const f of folders) {
    const p = path.join(skillsDir, f, "SKILL.md");
    if (!fs.existsSync(p)) continue;

    const { data, content } = matter(fs.readFileSync(p, "utf8"));
    const skillName = data.name || f;
    const skillDesc = data.description || "";
    // Escaping single quotes for SQL
    const safeContent = content.replace(/'/g, "''");
    const safeName = skillName.replace(/'/g, "''");
    const safeDesc = skillDesc.replace(/'/g, "''");
    const safeCaps = JSON.stringify(data.capabilities || []).replace(
      /'/g,
      "''",
    );

    const sql = `
      INSERT INTO public.agent_skills (id, name, description, content, capabilities)
      VALUES ('${f}', '${safeName}', '${safeDesc}', '${safeContent}', '${safeCaps}'::jsonb)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        content = EXCLUDED.content,
        capabilities = EXCLUDED.capabilities,
        updated_at = now();
    `;

    const { error } = await s.rpc("execute_sql_query", { sql_query: sql });

    if (error) {
      console.error(`  ❌ Failed ${f}:`, error);
    } else {
      console.log(`  ✅ Synced ${f}`);
      count++;
    }
  }
  console.log(`\n🎉 SUCCESS: ${count} skills synced to production.`);
}

runSync();
