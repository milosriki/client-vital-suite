import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import matter from "gray-matter";

const cleanValue = (val?: string) => {
  if (!val) return "";
  return val
    .trim()
    .replace(/^["']|["']$/g, "") // Remove surrounding quotes
    .replace(/\\n/g, "") // Remove literal \n
    .trim();
};

const SUPABASE_URL = cleanValue(
  process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL,
);
const SUPABASE_SERVICE_KEY = cleanValue(
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY,
);

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  console.log("Current Keys:", {
    URL: !!SUPABASE_URL,
    KEY: !!SUPABASE_SERVICE_KEY,
  });
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const SKILLS_DIR = path.resolve(process.cwd(), ".agent/skills");

async function syncSkills() {
  console.log("🚀 STARTING SKILL SYNC (Target: agent_skills)...\n");

  if (!fs.existsSync(SKILLS_DIR)) {
    console.error(`❌ Skills directory not found: ${SKILLS_DIR}`);
    process.exit(1);
  }

  const skillFolders = fs.readdirSync(SKILLS_DIR);
  let synced = 0;
  let errors = 0;

  for (const folder of skillFolders) {
    const skillPath = path.join(SKILLS_DIR, folder, "SKILL.md");
    if (!fs.existsSync(skillPath)) continue;

    try {
      const fileContent = fs.readFileSync(skillPath, "utf8");
      const { data, content } = matter(fileContent);

      const skillId = folder;
      const skillName = data.name || folder;
      const skillDesc = data.description || "";

      console.log(`Syncing [${skillId}]...`);

      // 1. Delete old version
      await supabase.from("agent_skills").delete().eq("id", skillId);

      // 2. Insert new version
      const { error } = await supabase.from("agent_skills").insert({
        id: skillId,
        name: skillName,
        description: skillDesc,
        content: content,
        capabilities: data.capabilities || [],
      });

      if (error) {
        console.error(`❌ Failed to sync ${skillId}:`, {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        errors++;
      } else {
        synced++;
      }
    } catch (e: any) {
      console.error(`❌ Error processing ${folder}:`, e.message || e);
      errors++;
    }
  }

  console.log(`\n📊 SYNC COMPLETE: ${synced} Skills Uploaded to Brain.`);
}

syncSkills();
