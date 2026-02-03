import { readFile } from "fs/promises";
import { join } from "path";

async function check() {
  const envPath = join(process.cwd(), ".env.local");
  const content = await readFile(envPath, "utf-8");
  const key = content.match(/HUBSPOT_API_KEY="([^"]+)"/)![1];

  const dealId = "51176091513";
  console.log(`Checking Deal ${dealId}...`);

  const resp = await fetch(
    `https://api.hubapi.com/crm/v3/objects/deals/${dealId}?associations=contacts`,
    {
      headers: { Authorization: `Bearer ${key}` },
    },
  );

  const data = await resp.json();
  console.log(JSON.stringify(data, null, 2));
}
check();
