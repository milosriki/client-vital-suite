import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = process.cwd();
const FUNCTIONS_DIR = path.join(ROOT_DIR, "supabase/functions");

async function injectMiddleware() {
  if (!fs.existsSync(FUNCTIONS_DIR)) return;

  const entries = await fs.promises.readdir(FUNCTIONS_DIR, {
    withFileTypes: true,
  });

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith("_")) continue;

    const indexFile = path.join(FUNCTIONS_DIR, entry.name, "index.ts");
    if (!fs.existsSync(indexFile)) continue;

    let content = await fs.promises.readFile(indexFile, "utf8");

    // SKIP if already has verifyAuth
    if (
      content.includes("verifyAuth(req)") ||
      content.includes("verifyAuth") ||
      content.includes("auth-middleware")
    ) {
      console.log(`Select skipping ${entry.name} - already patched.`);
      continue;
    }

    // 1. Inject Import
    // We look for the last import statement to append ours
    const importRegex = /import .* from ".*";/g;
    const lastImport = [...content.matchAll(importRegex)].pop();

    if (!lastImport) {
      // If no imports, valid at top
      content =
        `import { verifyAuth } from "../_shared/auth-middleware.ts";\n` +
        content;
    } else {
      // Insert after last import
      const limit = lastImport.index + lastImport[0].length;
      content =
        content.slice(0, limit) +
        `\nimport { verifyAuth } from "../_shared/auth-middleware.ts";` +
        content.slice(limit);
    }

    // 2. Inject Function Call
    // Pattern: serve(async (req) => { ...
    // We want to insert `verifyAuth(req);` inside the function body, preferably inside the try block if it exists, or at the top.

    // Strategy: Look for `serve(async (req` and the opening `{`
    const serveRegex =
      /serve\s*\(\s*async\s*\(\s*(\w+)\s*(?::\s*Request)?\)\s*=>\s*\{/;
    const match = content.match(serveRegex);

    if (match) {
      const reqVarName = match[1]; // e.g. "req"
      const insertionPoint = match.index + match[0].length;

      // Check if there is an explicit "try {" closely following (within 200 chars)
      // If so, put it inside/before 'try'?
      // Putting it BEFORE 'try' risks crashing the process if verifyAuth throws?
      // Deno serve handles uncaught exceptions by returning 500 usually.
      // But let's look for "try {"

      const contentAfterServe = content.slice(insertionPoint);
      const tryMatch = contentAfterServe.match(/^\s*try\s*\{/);

      if (tryMatch) {
        // Inject INSIDE try block to leverage existing error handling
        const tryInsertIndex =
          insertionPoint + tryMatch.index + tryMatch[0].length;
        content =
          content.slice(0, tryInsertIndex) +
          `\n    verifyAuth(${reqVarName}); // Security Hardening` +
          content.slice(tryInsertIndex);
        console.log(`✅ Patched ${entry.name} (inside try block)`);
      } else {
        // Inject at top of serve
        content =
          content.slice(0, insertionPoint) +
          `\n    try { verifyAuth(${reqVarName}); } catch(e) { return new Response("Unauthorized", {status: 401}); } // Security Hardening` +
          content.slice(insertionPoint);
        console.log(`✅ Patched ${entry.name} (wrapped in new try/catch)`);
      }

      await fs.promises.writeFile(indexFile, content);
    } else {
      console.warn(`⚠️  Could not find 'serve' pattern in ${entry.name}`);
    }
  }
}

injectMiddleware().then(() => console.log("Done."));
