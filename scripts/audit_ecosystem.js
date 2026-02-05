import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = process.cwd();
const FUNCTIONS_DIR = path.join(ROOT_DIR, "supabase/functions");
const WEB_APP_DIR = path.join(ROOT_DIR, "src");

const audit = {
  functions: { total: 0, issues: [] },
  web: { issues: [] },
};

// === HELPER: Walk Directory ===
async function* walk(dir) {
  const files = await fs.promises.readdir(dir, { withFileTypes: true });
  for (const dirent of files) {
    const res = path.resolve(dir, dirent.name);
    if (dirent.isDirectory()) {
      yield* walk(res);
    } else {
      yield res;
    }
  }
}

// === FUNCTION AUDIT ===
async function auditFunctions() {
  if (!fs.existsSync(FUNCTIONS_DIR)) return;

  const entries = await fs.promises.readdir(FUNCTIONS_DIR, {
    withFileTypes: true,
  });
  for (const entry of entries) {
    if (entry.isDirectory() && !entry.name.startsWith("_")) {
      audit.functions.total++;
      const indexFile = path.join(FUNCTIONS_DIR, entry.name, "index.ts");

      if (fs.existsSync(indexFile)) {
        const content = await fs.promises.readFile(indexFile, "utf8");

        // 1. JWT / Auth
        // Heuristic: Check for secure auth patterns
        if (
          !content.includes("verify_jwt") &&
          !content.includes("verifyJwt") &&
          !content.includes("verifyJWT") &&
          !content.includes("verifyAuth")
        ) {
          if (
            !content.includes("Authorization") &&
            !content.includes("x-auth-token") &&
            !content.includes("auth-header")
          ) {
            audit.functions.issues.push({
              functionName: entry.name,
              rule: "Missing Auth Check",
              severity: "HIGH",
              details:
                "No 'verify_jwt', 'Authorization', or 'x-auth-token' check found.",
            });
          }
        }

        // 2. Secret exposure
        // Check if specific env vars are hardcoded (simplified heuristic)
        if (content.includes("sk_live_") || content.includes("sk_test_")) {
          audit.functions.issues.push({
            functionName: entry.name,
            rule: "Potential Hardcoded Secret",
            severity: "CRITICAL",
            details: "Found pattern matching potential Stripe API key.",
          });
        }

        // 3. Try/Catch
        if (!content.includes("try ") && !content.includes("catch")) {
          audit.functions.issues.push({
            functionName: entry.name,
            rule: "Missing Try/Catch",
            severity: "MEDIUM",
            details: "No try/catch block found in main handler.",
          });
        }
      }
    }
  }
}

// === WEB APP AUDIT ===
async function auditWebApp() {
  if (!fs.existsSync(WEB_APP_DIR)) return;

  for await (const filePath of walk(WEB_APP_DIR)) {
    if (!filePath.match(/\.tsx?$/)) continue;

    const content = await fs.promises.readFile(filePath, "utf8");
    const relativePath = filePath.replace(ROOT_DIR, "");

    // 1. React: useEffect missing deps (Naive regex)
    if (/useEffect\(\s*\(\)\s*=>\s*{[^}]*}\)\s*$/m.test(content)) {
      audit.web.issues.push({
        file: relativePath,
        rule: "useEffect Missing Deps",
        severity: "HIGH",
        details: "useEffect appears to be missing a dependency array.",
      });
    }

    // 2. Large Component
    const lines = content.split("\n").length;
    if (lines > 400) {
      audit.web.issues.push({
        file: relativePath,
        rule: "Large Component",
        severity: "LOW",
        details: `File is ${lines} lines long.`,
      });
    }

    // 3. Img tags (CLS)
    if (/<img(?!.*width)(?!.*height)[^>]*>/.test(content)) {
      audit.web.issues.push({
        file: relativePath,
        rule: "Image Missing Dimensions",
        severity: "MEDIUM",
        details: "<img> tag found without width/height.",
      });
    }

    // 4. Console Logs
    if (content.includes("console.log(")) {
      audit.web.issues.push({
        file: relativePath,
        rule: "Console Log in UI",
        severity: "LOW",
        details: "Found console.log() call.",
      });
    }
  }
}

async function main() {
  console.log("🚀 Starting Ecosystem Audit (Node.js)...");
  await auditFunctions();
  await auditWebApp();

  const reportPath = path.join(ROOT_DIR, "audit_results.json");
  await fs.promises.writeFile(reportPath, JSON.stringify(audit, null, 2));
  console.log(`✅ Audit Complete. Results saved to ${reportPath}`);
}

main().catch(console.error);
