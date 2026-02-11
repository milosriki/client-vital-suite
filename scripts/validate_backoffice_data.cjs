const { Client } = require("pg");
const { createClient } = require("@supabase/supabase-js");

// RDS Configuration
const RDS_CONFIG = {
  host:
    process.env.RDS_HOST ||
    "ptd-prod-replica-1.c5626gic29ju.me-central-1.rds.amazonaws.com",
  port: 5432,
  user: "ptd-milos",
  database: "ptd",
  ssl: { rejectUnauthorized: false },
};

// Supabase Configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RDS_PASSWORD = process.env.DB_PASSWORD;

if (!SUPABASE_URL || !SUPABASE_KEY || !RDS_PASSWORD) {
  console.error(
    "❌ Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DB_PASSWORD",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const rdsClient = new Client({ ...RDS_CONFIG, password: RDS_PASSWORD });

async function validateData() {
  console.log("🦅 Fishbird Data Validator: RDS Replica vs Supabase Live");
  console.log("=======================================================");

  try {
    // 1. Connect to RDS
    console.log("⏳ Connecting to RDS Replica...");
    await rdsClient.connect();
    console.log("✅ RDS Connected.");

    // 2. Define Comparison Queries
    const queries = [
      { table: "contacts", query: "SELECT count(*) as count FROM contacts" },
      { table: "deals", query: "SELECT count(*) as count FROM deals" },
      // Add more tables as needed
    ];

    console.log("\n📊 Comparison Report:");
    console.log(
      "----------------------------------------------------------------",
    );
    console.log(
      "| Table       | RDS Count | Supabase Count | Diff | Status     |",
    );
    console.log(
      "----------------------------------------------------------------",
    );

    for (const q of queries) {
      // Fetch RDS
      const rdsRes = await rdsClient.query(q.query);
      const rdsCount = parseInt(rdsRes.rows[0].count, 10);

      // Fetch Supabase
      const { count: sbCount, error } = await supabase
        .from(q.table)
        .select("*", { count: "exact", head: true });

      if (error) {
        console.error(
          `❌ Error fetching ${q.table} from Supabase:`,
          error.message,
        );
        continue;
      }

      const diff = rdsCount - (sbCount || 0);
      const icon = diff === 0 ? "✅" : Math.abs(diff) < 5 ? "⚠️" : "❌";

      console.log(
        `| ${q.table.padEnd(11)} | ${rdsCount.toString().padEnd(9)} | ${(sbCount || 0).toString().padEnd(14)} | ${diff.toString().padEnd(4)} | ${icon}         |`,
      );
    }
    console.log(
      "----------------------------------------------------------------",
    );
  } catch (err) {
    console.error("\n❌ Validation Failed:", err.message);
  } finally {
    await rdsClient.end();
  }
}

validateData();
