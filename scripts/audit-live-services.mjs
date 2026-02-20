import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://ztjndilxurtsfqdsvfds.supabase.co";
const KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!KEY) {
  console.error("No service role or anon key found in .env");
  process.exit(1);
}

const functionsDir = path.join(process.cwd(), "supabase", "functions");
const functions = fs.readdirSync(functionsDir).filter((f) => {
  const stat = fs.statSync(path.join(functionsDir, f));
  return (
    stat.isDirectory() &&
    f !== "_shared" &&
    f !== "_archive" &&
    !f.startsWith(".")
  );
});

console.log(
  `Auditing ${functions.length} Edge Functions against live project...`,
);

let successCount = 0;
let failCount = 0;
const failures = [];

async function run() {
  // Batch the requests to avoid overloading in one go, but do it fast
  const batchSize = 10;
  for (let i = 0; i < functions.length; i += batchSize) {
    const batch = functions.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async (func) => {
        try {
          const res = await fetch(`${SUPABASE_URL}/functions/v1/${func}`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({}),
          });

          if (res.status === 404) {
            failures.push({ func, reason: "Not Deployed or Offline (404)" });
            failCount++;
          } else if (res.status >= 500) {
            failures.push({
              func,
              reason: `Server Error (${res.status}) - ${await res.text().catch(() => "")}`,
            });
            failCount++;
          } else {
            // 200, 400, 401, 403 are "alive" in the sense they are deployed and responding
            successCount++;
          }
        } catch (err) {
          failures.push({ func, reason: `Network Error: ${err.message}` });
          failCount++;
        }
      }),
    );
  }

  console.log(`\n--- Audit Complete ---`);
  console.log(`✅ Alive & Responding: ${successCount}`);
  console.log(`❌ Failed / Not Deployed: ${failCount}`);
  if (failures.length > 0) {
    console.log(`\nFailure Details:`);
    failures.forEach((f) => console.log(`- ${f.func}: ${f.reason}`));
  }
}

run();
