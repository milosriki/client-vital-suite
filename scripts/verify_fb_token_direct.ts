import { config } from "dotenv";
import { readFile } from "fs/promises";
import { join } from "path";

config();

async function verifyToken() {
  console.log("🔍 Reading clean token...");
  const envPath = join(process.cwd(), ".env.local");
  const content = await readFile(envPath, "utf-8");
  const match = content.match(/FB_ACCESS_TOKEN="([^"]+)"/);

  if (!match) {
    console.error("❌ No token found");
    return;
  }

  const token = match[1].replace(/\\n/g, "").trim();
  console.log(`🔑 Token suffix: ...${token.slice(-5)}`);

  const url = `https://graph.facebook.com/v24.0/me/adaccounts?fields=id,name,currency&access_token=${token}`;

  try {
    const resp = await fetch(url);
    const data = await resp.json();

    if (data.error) {
      console.error(
        "❌ Facebook API Error:",
        JSON.stringify(data.error, null, 2),
      );
    } else {
      console.log("✅ Facebook API Success!");
      console.log("Accounts found:", data.data?.length);
      if (data.data && data.data.length > 0) {
        console.log("First Account:", JSON.stringify(data.data[0], null, 2));
      }
    }
  } catch (e: any) {
    console.error("❌ Network/Fetch Error:", e.message);
  }
}

verifyToken();
