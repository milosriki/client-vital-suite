import { walk } from "https://deno.land/std@0.168.0/fs/walk.ts";
import { join } from "https://deno.land/std@0.168.0/path/mod.ts";

const TARGET_DIR = "./supabase/functions";
const SHARED_DIR = "_shared";
const SKIP_DIRS = ["_shared", "_archive", "node_modules"];

async function main() {
  console.log("🔒 Starting Security Hardening of Edge Functions...");

  for await (const entry of Deno.readDir(TARGET_DIR)) {
    if (!entry.isDirectory || SKIP_DIRS.includes(entry.name)) continue;

    const indexPath = join(TARGET_DIR, entry.name, "index.ts");

    try {
      const content = await Deno.readTextFile(indexPath);

      if (
        content.includes("verifyAuth(req)") ||
        content.includes("verifyAuth(request)")
      ) {
        console.log(`✅ [SKIPPING] ${entry.name} (Already secured)`);
        continue;
      }

      console.log(`🛠️ [SECURING] ${entry.name}...`);

      let newContent = content;
      let importAdded = false;

      // 1. Add Import
      const importStatement = `import { verifyAuth } from "../_shared/auth-middleware.ts";\n`;
      if (!newContent.includes("auth-middleware.ts")) {
        // Insert after other imports
        const lastImportIdx = newContent.lastIndexOf("import ");
        if (lastImportIdx !== -1) {
          const endOfImportLine = newContent.indexOf("\n", lastImportIdx);
          newContent =
            newContent.slice(0, endOfImportLine + 1) +
            importStatement +
            newContent.slice(endOfImportLine + 1);
          importAdded = true;
        } else {
          newContent = importStatement + newContent;
          importAdded = true;
        }
      }

      // 2. Add verifyAuth call
      // Look for serve(async (req) ... or Deno.serve(async (req) ...
      // Regex to capture the function body start
      const serveRegex = /(serve\s*\(\s*async\s*\(\s*(\w+)\s*.*?\)\s*=>\s*\{)/;
      const match = newContent.match(serveRegex);

      if (match) {
        const fullMatch = match[1];
        const reqVarName = match[2]; // e.g., 'req' or 'request'

        // Check if there is an OPTIONS check immediately after
        const optionsRegex =
          /if\s*\(\s*\w+\.method\s*===\s*["']OPTIONS["']\s*\)\s*return\s*.*?;/;
        const optionsMatch = newContent
          .slice(match.index! + fullMatch.length)
          .match(optionsRegex);

        let insertPos = match.index! + fullMatch.length;
        if (optionsMatch && optionsMatch.index === 0) {
          // Should check for whitespace
          // If OPTIONS check is practically first, insert AFTER it
          const nextLineIdx = newContent.indexOf(
            "\n",
            insertPos + optionsMatch[0].length,
          );
          insertPos = nextLineIdx + 1;
        } else {
          // Just after {
          insertPos = match.index! + fullMatch.length;
        }

        // Insert verifyAuth(req);
        const injection = `\n  verifyAuth(${reqVarName});\n`;
        newContent =
          newContent.slice(0, insertPos) +
          injection +
          newContent.slice(insertPos);

        await Deno.writeTextFile(indexPath, newContent);
        console.log(`✅ [SECURED] ${entry.name}`);
      } else {
        console.warn(
          `⚠️ [MANUAL CHECK REQUIRED] ${entry.name} (Could not find 'serve' pattern)`,
        );
      }
    } catch (err) {
      if (err instanceof Deno.errors.NotFound) {
        // console.log(`ℹ️ [INFO] ${entry.name} has no index.ts`);
      } else {
        console.error(`❌ [ERROR] ${entry.name}: ${err.message}`);
      }
    }
  }
  console.log("🎉 Security Hardening Complete.");
}

main();
