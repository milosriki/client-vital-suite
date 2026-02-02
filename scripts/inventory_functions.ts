import fs from "fs";
import path from "path";

const FUNCTIONS_DIR = path.resolve("supabase/functions");
const SRC_DIR = path.resolve("src");

interface FunctionStatus {
  name: string;
  hasEnvVars: boolean;
  usedInSrc: boolean;
  usageCount: number;
  envVarsDetected: string[];
}

function scanDirForUsage(dir: string, functionName: string): number {
  let count = 0;
  if (!fs.existsSync(dir)) return 0;

  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      count += scanDirForUsage(fullPath, functionName);
    } else if (
      file.endsWith(".ts") ||
      file.endsWith(".tsx") ||
      file.endsWith(".js")
    ) {
      const content = fs.readFileSync(fullPath, "utf8");
      // Look for string literals matching the function name
      if (
        content.includes(`"${functionName}"`) ||
        content.includes(`'${functionName}'`)
      ) {
        count++;
      }
    }
  }
  return count;
}

function checkEnvVars(functionPath: string): {
  hasEnvVars: boolean;
  vars: string[];
} {
  const indexFile = path.join(functionPath, "index.ts");
  if (!fs.existsSync(indexFile)) return { hasEnvVars: false, vars: [] };

  const content = fs.readFileSync(indexFile, "utf8");
  const regex = /Deno\.env\.get\(['"]([^'"]+)['"]\)/g;
  const vars = new Set<string>();
  let match;
  while ((match = regex.exec(content)) !== null) {
    vars.add(match[1]);
  }
  return { hasEnvVars: vars.size > 0, vars: Array.from(vars) };
}

async function main() {
  console.log("🔍 Starting Deep Inventory of Supabase Edge Functions...\n");

  const functions = fs.readdirSync(FUNCTIONS_DIR).filter((f) => {
    return (
      fs.statSync(path.join(FUNCTIONS_DIR, f)).isDirectory() &&
      !f.startsWith("_") &&
      !f.startsWith(".")
    );
  });

  const inventory: FunctionStatus[] = [];

  for (const func of functions) {
    const envStatus = checkEnvVars(path.join(FUNCTIONS_DIR, func));
    const usageCount = scanDirForUsage(SRC_DIR, func);

    inventory.push({
      name: func,
      hasEnvVars: envStatus.hasEnvVars,
      envVarsDetected: envStatus.vars,
      usedInSrc: usageCount > 0,
      usageCount,
    });
  }

  // Report
  console.log(`Found ${inventory.length} Functions.\n`);

  console.log("👻 GHOST FUNCTIONS (Backend exists, NO UI Usage):");
  const ghosts = inventory.filter((i) => !i.usedInSrc);
  ghosts.forEach((g) =>
    console.log(` - ${g.name} (EnvVars: ${g.envVarsDetected.length})`),
  );
  console.log(`\nTotal Ghosts: ${ghosts.length}\n`);

  console.log("🔌 CONNECTED FUNCTIONS (Used in UI):");
  const connected = inventory.filter((i) => i.usedInSrc);
  connected
    .slice(0, 10)
    .forEach((c) => console.log(` - ${c.name} (Used ${c.usageCount} times)`));
  console.log(`... and ${connected.length - 10} more.\n`);

  console.log("⚠️ POTENTIAL CONFIG ISSUES (Many Env Vars):");
  const heavyConfig = inventory.filter((i) => i.envVarsDetected.length > 3);
  heavyConfig.forEach((h) =>
    console.log(` - ${h.name} needs ${h.envVarsDetected.join(", ")}`),
  );

  // Save full report
  fs.writeFileSync(
    "function_inventory.json",
    JSON.stringify(inventory, null, 2),
  );
  console.log("\n✅ Inventory saved to function_inventory.json");
}

main();
