const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

async function run() {
  const connectionString =
    process.env.DATABASE_URL ||
    "postgresql://postgres:Pazi1stazelis@db.ztjndilxurtsfqdsvfds.supabase.co:5432/postgres";
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }, // Required for Supabase connection
  });

  try {
    console.log("Connecting to database...");
    await client.connect();

    console.log("Reading SQL file...");
    const sqlPath = path.resolve(
      __dirname,
      "../supabase/migrations/20260206_conversation_intelligence.sql",
    );
    const sqlContent = fs.readFileSync(sqlPath, "utf8");

    console.log("Executing SQL...");
    // Split commands if necessary, or run as one block. pg usually handles blocks fine.
    await client.query(sqlContent);

    console.log("✅ SQL Migration Applied Successfully!");
  } catch (err) {
    console.error("❌ Migration Error:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
