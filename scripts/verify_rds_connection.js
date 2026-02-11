const { Client } = require("pg");

const DB_CONFIG = {
  host:
    process.env.RDS_HOST ||
    "ptd-prod-replica-1.c5626gic29ju.me-central-1.rds.amazonaws.com",
  port: 5432,
  user: "ptd-milos",
  database: "ptd",
  ssl: {
    rejectUnauthorized: false,
  },
};

const password = process.env.DB_PASSWORD;

if (!password) {
  console.error("❌ DB_PASSWORD environment variable is required.");
  process.exit(1);
}

const client = new Client({
  ...DB_CONFIG,
  password,
});

async function main() {
  try {
    console.log("🔒 PTD Read-Only Replica Connection Verifier (Node.js)");
    console.log("---------------------------------------------");
    console.log(`Target: ${DB_CONFIG.host}`);
    console.log(`User:   ${DB_CONFIG.user}`);
    console.log("---------------------------------------------");

    console.log("⏳ Connecting...");
    await client.connect();
    console.log("✅ Connected successfully!");

    console.log("🔍 Running verification query...");
    const res = await client.query(
      "SELECT current_database(), current_user, version()",
    );

    console.log("\n📊 Connection Details:");
    console.table(res.rows);

    console.log("\n🔍 Checking assess permission (listing public tables)...");
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      LIMIT 5
    `);

    console.log(
      `Found ${tables.rows.length} accessible tables (showing first 5):`,
    );
    console.table(tables.rows);
  } catch (err) {
    console.error("\n❌ Connection Failed:");
    console.error(err.message);
    if (err.message.includes("password")) {
      console.error("💡 Hint: Check the password.");
    }
  } finally {
    await client.end();
  }
}

main();
