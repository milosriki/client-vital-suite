import { readFile } from "fs/promises";
import { join } from "path";

async function check() {
  const envPath = join(process.cwd(), ".env.local");
  try {
    const content = await readFile(envPath, "utf-8");
    const keys = content.split("\n").map((l) => l.split("=")[0]);
    console.log("Available Keys:", keys.join(", "));
  } catch {
    console.log("No .env.local found");
  }
}
check();
