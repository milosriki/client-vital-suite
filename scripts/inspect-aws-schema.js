import pg from "pg";
const { Client } = pg;

const requiredEnv = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} env var required`);
  return value;
};

const RDS_CONFIG = {
  host: process.env.RDS_HOST || "ptd-prod-replica-1.c5626gic29ju.me-central-1.rds.amazonaws.com",
  port: Number(process.env.RDS_PORT || 5432),
  user: process.env.RDS_USER || "4revops",
  password: requiredEnv("RDS_PASSWORD"),
  database: process.env.RDS_DATABASE || "ptd",
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
