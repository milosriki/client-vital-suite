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
  // Both replicas default to ptd-prod-replica-1 but can be overridden
  // The old backoffice hostname (en-saas-shared-prod-replica1) was timing out;
  // it may be a different instance — set RDS_BACKOFFICE_HOST to override if needed.
  const DEFAULT_HOST =
    "ptd-prod-replica-1.c5626gic29ju.me-central-1.rds.amazonaws.com";

  if (replica === "backoffice") {
    return {
      hostname: Deno.env.get("RDS_BACKOFFICE_HOST") || DEFAULT_HOST,
      port: 5432,
      user: Deno.env.get("RDS_BACKOFFICE_USER") || "ptd-milos",
      database: Deno.env.get("RDS_BACKOFFICE_DB") || "ptd",
      password: Deno.env.get("RDS_BACKOFFICE_PASSWORD") || "",
      tls: { enabled: true, enforce: false },
    };
  }

  // PowerBI replica (default) — uses 4revops credential
  return {
    hostname: Deno.env.get("RDS_POWERBI_HOST") || DEFAULT_HOST,
    port: 5432,
    user: Deno.env.get("RDS_POWERBI_USER") || "4revops",
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
