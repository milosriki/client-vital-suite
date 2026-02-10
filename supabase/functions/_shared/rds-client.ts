import { Client as PostgresClient } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

export interface RDSConfig {
  hostname: string;
  port: number;
  user: string;
  database: string;
  password: string;
  tls: { enabled: boolean; enforce: boolean };
}

export function getRDSConfig(
  replica: "backoffice" | "powerbi" = "powerbi",
): RDSConfig {
  if (replica === "backoffice") {
    return {
      hostname:
        "en-saas-shared-prod-replica1.c8r6miwj9nkr.me-central-1.rds.amazonaws.com",
      port: 5432,
      user: "ptd-milos",
      database: "ptd",
      password: Deno.env.get("RDS_BACKOFFICE_PASSWORD") || "",
      tls: { enabled: true, enforce: false },
    };
  }

  // PowerBI replica (default)
  return {
    hostname: "ptd-prod-replica-1.c5626gic29ju.me-central-1.rds.amazonaws.com",
    port: 5432,
    user: Deno.env.get("RDS_POWERBI_USER") || "ptd-milos",
    database: Deno.env.get("RDS_POWERBI_DB") || "ptd",
    password: Deno.env.get("RDS_POWERBI_PASSWORD") || "",
    tls: { enabled: true, enforce: false },
  };
}

export async function createRDSClient(
  replica: "backoffice" | "powerbi" = "powerbi",
): Promise<PostgresClient> {
  const config = getRDSConfig(replica);
  const client = new PostgresClient(config);
  await client.connect();
  return client;
}
