import { createRDSClient } from "../supabase/functions/_shared/rds-client.ts";

async function verify() {
  console.log("Connecting to RDS (PowerBI)...");
  try {
    const client = await createRDSClient("powerbi");
    console.log("Connected. executing query...");
    const res = await client.queryObject(`
      SELECT m.email, p.remainingsessions
      FROM enhancesch.vw_client_master m
      JOIN enhancesch.vw_client_packages p ON m.id_client = p.id_client
      LIMIT 5
    `);
    console.log("Success! Data sample:");
    console.table(res.rows);
    await client.end();
  } catch (e) {
    console.error("Connection failed:", e);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  verify();
}
