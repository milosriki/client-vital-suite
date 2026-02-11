const { Client } = require("pg");

const DB_CONFIG = {
  host:
    process.env.RDS_HOST ||
    "ptd-prod-replica-1.c5626gic29ju.me-central-1.rds.amazonaws.com",
  port: 5432,
  user: "ptd-milos",
  database: "ptd",
  password: process.env.RDS_BACKOFFICE_PASSWORD || "", // Set via: export RDS_BACKOFFICE_PASSWORD=xxx
  ssl: { rejectUnauthorized: false },
};

const client = new Client(DB_CONFIG);

async function main() {
  try {
    await client.connect();
    console.log("connected to replica to scan schema...");

    const res = await client.query(`
      SELECT table_name, table_schema
      FROM information_schema.tables 
      WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
      ORDER BY table_schema, table_name;
    `);

    console.log("📂 Found Tables across ALL schemas:");
    console.table(res.rows);

    // List of promising tables/views to inspect
    const targets = [
      { schema: "enhancesch", table: "vw_client_packages" },
      { schema: "enhancesch", table: "vw_schedulers" },
      { schema: "enhancesch", table: "vw_powerbi_trainers" },
      { schema: "enhancesch", table: "vw_client_master" },
    ];

    for (const target of targets) {
      const cols = await client.query(
        `
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = $1 AND table_name = $2;
      `,
        [target.schema, target.table],
      );

      console.log(`\n🔍 '${target.schema}.${target.table}' Columns:`);
      console.table(
        cols.rows.map((r) => ({ name: r.column_name, type: r.data_type })),
      );
    }
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
