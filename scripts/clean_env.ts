import { readFile, writeFile } from "fs/promises";
import { join } from "path";

async function cleanEnv() {
  const envPath = join(process.cwd(), ".env.local");
  try {
    const content = await readFile(envPath, "utf-8");
    const lines = content.split("\n");
    const cleaned = lines
      .map((line) => {
        // Remove literal \n at the end of values if present inside quotes
        // e.g. KEY="value\n" -> KEY="value"
        return line.replace(/\\n"/g, '"');
      })
      .join("\n");

    await writeFile(envPath, cleaned);
    console.log("✅ Cleaned .env.local");
  } catch (e) {
    console.error("Error cleaning env:", e);
  }
}

cleanEnv();
