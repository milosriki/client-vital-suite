import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const dbUrl =
  "postgresql://postgres:Pazi1stazelis@db.ztjndilxurtsfqdsvfds.supabase.co:5432/postgres";
const client = new Client(dbUrl);

console.log("Connecting to database...");
await client.connect();

try {
  console.log("Reading SQL file...");
  const sqlContent = await Deno.readTextFile(
    "./supabase/migrations/20260206_conversation_intelligence.sql",
  );

  console.log("Executing SQL migration...");
  await client.queryArray(sqlContent);

  console.log("✅ Migration successful!");
} catch (err) {
  console.error("❌ Migration failed:", err);
} finally {
  await client.end();
}
