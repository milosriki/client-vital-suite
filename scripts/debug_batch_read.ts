import { readFile } from "fs/promises";
import { join } from "path";

async function check() {
  const envPath = join(process.cwd(), ".env.local");
  const content = await readFile(envPath, "utf-8");
  const key = content.match(/HUBSPOT_API_KEY="([^"]+)"/)![1];

  // Test Deal known to have association
  const inputs = [{ id: "51176091513" }];

  console.log(`Checking Batch Read for Deal 51176091513...`);

  const resp = await fetch(
    "https://api.hubapi.com/crm/v3/objects/deals/batch/read",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: inputs,
        properties: ["dealname"],
        associations: ["contacts"],
      }),
    },
  );

  const data = await resp.json();
  console.log("Status:", resp.status);
  console.log(JSON.stringify(data, null, 2));
}
check();
