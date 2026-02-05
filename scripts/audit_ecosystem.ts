import { walk } from "https://deno.land/std@0.177.0/fs/walk.ts";
import { join } from "https://deno.land/std@0.177.0/path/mod.ts";

const ROOT_DIR = Deno.cwd();
const FUNCTIONS_DIR = join(ROOT_DIR, "supabase/functions");
const WEB_APP_DIR = join(ROOT_DIR, "src");

interface AuditResult {
  functions: {
    total: number;
    issues: FunctionIssue[];
  };
  web: {
    issues: WebIssue[];
  };
}

interface FunctionIssue {
  functionName: string;
  rule: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  details: string;
}

interface WebIssue {
  file: string;
  rule: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  details: string;
}

const audit: AuditResult = {
  functions: { total: 0, issues: [] },
  web: { issues: [] },
};

// === FUNCTION AUDIT ===
async function auditFunctions() {
  for await (const entry of Deno.readDir(FUNCTIONS_DIR)) {
    if (entry.isDirectory && !entry.name.startsWith("_")) {
      audit.functions.total++;
      const indexFile = join(FUNCTIONS_DIR, entry.name, "index.ts");

      try {
        const content = await Deno.readTextFile(indexFile);

        // 1. JWT Verification Check (Security)
        if (
          !content.includes("verify_jwt") &&
          !content.includes("verifyJwt") &&
          !content.includes("verifyJWT")
        ) {
          // Heuristic: Check if usage of serve requires it, or if manual check exists
          if (
            !content.includes("Authorization") &&
            !content.includes("x-auth-token")
          ) {
            audit.functions.issues.push({
              functionName: entry.name,
              rule: "Missing Auth Check",
              severity: "HIGH",
              details:
                "No 'verify_jwt', 'Authorization' header check, or 'x-auth-token' check found.",
            });
          }
        }

        // 2. Secret exposure (Heuristic)
        const secretRegex = /(sk_live_|sk_test_|eyJ)[a-zA-Z0-9_\-]+/;
        if (secretRegex.test(content)) {
          // Exclude common false positives like "Bearer eyJ..." strings in comments
          // Simplify: just flag suspicious hardcoded strings
          audit.functions.issues.push({
            functionName: entry.name,
            rule: "Potential Hardcoded Secret",
            severity: "CRITICAL",
            details: "Found pattern matching potential API key or JWT.",
          });
        }

        // 3. Error Handling
        if (!content.includes("try") || !content.includes("catch")) {
          audit.functions.issues.push({
            functionName: entry.name,
            rule: "Missing Try/Catch",
            severity: "MEDIUM",
            details: "No global try/catch block found in main handler.",
          });
        }
      } catch (e) {
        // file might not exist (e.g. index.js or just folder)
      }
    }
  }
}

// === WEB APP AUDIT ===
async function auditWebApp() {
  for await (const entry of walk(WEB_APP_DIR, {
    includeDirs: false,
    match: [/\.tsx?$/],
  })) {
    const content = await Deno.readTextFile(entry.path);
    const relativePath = entry.path.replace(ROOT_DIR, "");

    // 1. React: useEffect missing deps
    if (content.match(/useEffect\(\s*\(\)\s*=>\s*{[^}]*}\)\s*$/m)) {
      // Very naive check for no dependency array
      audit.web.issues.push({
        file: relativePath,
        rule: "useEffect Missing Deps",
        severity: "HIGH",
        details:
          "useEffect appears to be missing a dependency array (runs on every render).",
      });
    }

    // 2. React: Large Component (Heuristic: Lines > 300)
    const lines = content.split("\n").length;
    if (lines > 300) {
      audit.web.issues.push({
        file: relativePath,
        rule: "Large Component",
        severity: "LOW",
        details: `File is ${lines} lines long. Consider breaking it up.`,
      });
    }

    // 3. Performance: <img /> without width/height
    if (content.match(/<img(?!.*width)(?!.*height)[^>]*>/)) {
      audit.web.issues.push({
        file: relativePath,
        rule: "Image Missing Dimensions",
        severity: "MEDIUM",
        details: "<img> tag found without explicit width/height (CLS Risk).",
      });
    }

    // 4. Console Logs (Polishing)
    if (content.includes("console.log(")) {
      audit.web.issues.push({
        file: relativePath,
        rule: "Console Log in UI",
        severity: "LOW",
        details: "Found console.log() call. Remove for production.",
      });
    }
  }
}

async function main() {
  console.log("🚀 Starting Ecosystem Audit...");
  await auditFunctions();
  await auditWebApp();

  const reportPath = join(ROOT_DIR, "audit_results.json");
  await Deno.writeTextFile(reportPath, JSON.stringify(audit, null, 2));
  console.log(`✅ Audit Complete. Results saved to ${reportPath}`);
}

main();
