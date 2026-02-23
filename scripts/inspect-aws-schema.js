import pg from "pg";
const { Client } = pg;

const RDS_CONFIG = {
  host: "ptd-prod-replica-1.c5626gic29ju.me-central-1.rds.amazonaws.com",
  port: 5432,
  user: "4revops",
  password: "vakiphetH1qospuS",
  database: "ptd",
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
};

async function inspect() {
  const client = new Client(RDS_CONFIG);
  try {
    await client.connect();
    console.log("Connected. Fetching one row...");
    const res = await client.query('SELECT * FROM enhancesch.vw_schedulers LIMIT 1');
    if (res.rows.length === 0) {
        console.log("Table is empty, fetching columns from schema...");
        // Fallback or just print message
    } else {
        console.log("Columns found:", Object.keys(res.rows[0]));
    }
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await client.end();
  }
}

inspect();
