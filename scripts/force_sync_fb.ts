import { readFile } from "fs/promises";
import { exec } from "child_process";
import { promisify } from "util";
import { join } from "path";
import { config } from "dotenv";

const execAsync = promisify(exec);

async function forceSync() {
  console.log("🔄 Reading .env.local to find FB_ACCESS_TOKEN...");

  // Manually parse to be 100% sure of what we get
  const envPath = join(process.cwd(), ".env.local");
  const content = await readFile(envPath, "utf-8");

  const match = content.match(/FB_ACCESS_TOKEN="([^"]+)"/);
  if (!match) {
    console.error("❌ Could not find FB_ACCESS_TOKEN in .env.local");
    return;
  }

  let token = match[1];
  // Aggressive cleaning
  token = token.replace(/\\n/g, "").replace(/\n/g, "").trim();

  console.log(`🔑 Found Token (ends with): ...${token.slice(-10)}`);
  console.log("mw Pushing to Supabase...");

  try {
    // Escape the token for the shell command just in case
    const safeToken = token.replace(/"/g, '\\"');
    await execAsync(
      `supabase secrets set FB_ACCESS_TOKEN="${safeToken}" --project-ref ztjndilxurtsfqdsvfds`,
    );
    console.log("✅ FB_ACCESS_TOKEN successfully updated in Supabase Secrets!");
  } catch (e: any) {
    console.error("❌ Failed to set secret:", e.message);
  }
}

forceSync();
