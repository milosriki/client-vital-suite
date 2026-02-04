import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const DB_CONFIG = {
  hostname:
    "en-saas-shared-prod-replica1.c8r6miwj9nkr.me-central-1.rds.amazonaws.com",
  port: 5432,
  user: "ptd-milos",
  database: "ptd",
  tls: {
    enabled: true,
    enforce: false, // RDS often needs this relaxed or specific certs, start with relaxed
  },
};

console.log("🔒 PTD Read-Only Replica Connection Verifier");
console.log("---------------------------------------------");
console.log(`Target: ${DB_CONFIG.hostname}`);
console.log(`User:   ${DB_CONFIG.user}`);
console.log(`DB:     ${DB_CONFIG.database}`);
console.log("---------------------------------------------");

// Securely prompt for password
const password =
  Deno.env.get("DB_PASSWORD") ||
  prompt("Enter Database Password (from WhatsApp):");

if (!password) {
  console.error("❌ Password is required.");
  Deno.exit(1);
}

const client = new Client({
  ...DB_CONFIG,
  password,
});

try {
  console.log("⏳ Connecting...");
  await client.connect();
  console.log("✅ Connected successfully!");

  console.log("🔍 Running verification query...");
  const result =
    await client.queryObject`SELECT current_database(), current_user, version()`;

  console.log("\n📊 Connection Details:");
  console.table(result.rows);

  console.log("\n🔍 Checking assess permission (listing public tables)...");
  const tables = await client.queryObject`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    LIMIT 5;
  `;

  console.log(
    `Found ${tables.rows.length} accessible tables (showing first 5):`,
  );
  console.table(tables.rows);
} catch (error) {
  console.error("\n❌ Connection Failed:");
  console.error(error.message);

  if (error.message.includes("password")) {
    console.error("💡 Hint: Check the password from WhatsApp.");
  }
  if (error.message.includes("timeout") || error.message.includes("refused")) {
    console.error(
      "💡 Hint: Ensure you are on the whitelisted IP: 94.204.145.218",
    );
  }
} finally {
  await client.end();
}
