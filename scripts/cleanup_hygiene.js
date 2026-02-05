import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = process.cwd();
const SRC_DIR = path.join(ROOT_DIR, "src");

// Helper to walk directory
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

async function cleanHygiene() {
  console.log("🧹 Starting Hygiene Cleanup (Removing console.logs)...");
  let count = 0;

  if (!fs.existsSync(SRC_DIR)) {
    console.log("No src directory found.");
    return;
  }

  for await (const filePath of walk(SRC_DIR)) {
    if (!filePath.match(/\.tsx?$/)) continue;

    let content = await fs.promises.readFile(filePath, "utf8");

    // Remove console.log(...) lines
    // Regex: console.log followed by anything until ); potentially multiline?
    // Simple regex for single line console.logs first as it is safer
    const originalContent = content;

    // Remove "console.log(...);" or "console.log(...)"
    content = content.replace(
      /console\.log\((?:[^)(]|\((?:[^)(]+|\([^)(]*\))*\))*\);?/g,
      "",
    );

    if (content !== originalContent) {
      await fs.promises.writeFile(filePath, content);
      console.log(`✨ Cleaned: ${path.relative(ROOT_DIR, filePath)}`);
      count++;
    }
  }
  console.log(`✅ Cleaned ${count} files.`);
}

cleanHygiene();
