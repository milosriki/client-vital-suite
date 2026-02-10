import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Client as PostgresClient } from "https://deno.land/x/postgres@v0.17.0/mod.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { handleError, ErrorCode } from "../_shared/error-handler.ts";
import {
  apiSuccess,
  apiError,
  apiValidationError,
  apiCorsPreFlight,
} from "../_shared/api-response.ts";
import { validateOrThrow } from "../_shared/data-contracts.ts";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { withTracing, structuredLog } from "../_shared/observability.ts";
import { unifiedAI } from "../_shared/unified-ai-client.ts";

/**
 * RDS Data Analyst Agent
 *
 * Connects to the AWS RDS Replica (PowerBI source) and provides:
 * 1. Schema discovery — list all tables, views, columns
 * 2. Safe SQL execution — read-only queries with row limits
 * 3. AI interpretation — natural language queries converted to SQL
 * 4. Trainer/session analytics — direct PowerBI-equivalent data
 *
 * Supports TWO RDS replicas:
 *   - "backoffice": en-saas-shared-prod-replica1 (enhancesch schema)
 *   - "powerbi":    ptd-prod-replica-1 (PowerBI data source)
 */

// ============================================================================
// RDS CONFIGURATIONS
// ============================================================================

import { getRDSConfig } from "../_shared/rds-client.ts";
import { UnauthorizedError, errorToResponse } from "../_shared/app-errors.ts";

// ============================================================================
// SAFETY: SQL VALIDATION
// ============================================================================

const BLOCKED_KEYWORDS = [
  "DROP",
  "DELETE",
  "TRUNCATE",
  "ALTER",
  "CREATE",
  "INSERT",
  "UPDATE",
  "GRANT",
  "REVOKE",
  "EXECUTE",
  "CALL",
  "SET ",
  "COPY",
  "pg_",
  "\\\\",
];

function validateSQL(sql: string): { safe: boolean; reason?: string } {
  const upper = sql.toUpperCase().trim();

  // Must start with SELECT or WITH (CTEs)
  if (!upper.startsWith("SELECT") && !upper.startsWith("WITH")) {
    return {
      safe: false,
      reason: "Only SELECT and WITH (CTE) queries are allowed",
    };
  }

  // Block dangerous keywords
  for (const keyword of BLOCKED_KEYWORDS) {
    if (upper.includes(keyword)) {
      return {
        safe: false,
        reason: `Blocked keyword detected: ${keyword.trim()}`,
      };
    }
  }

  // Must not contain semicolon (prevents injection via stacked queries)
  const sqlWithoutStrings = sql.replace(/'[^']*'/g, "");
  if (sqlWithoutStrings.includes(";")) {
    return { safe: false, reason: "Multiple statements not allowed" };
  }

  return { safe: true };
}

// ============================================================================
// SCHEMA DISCOVERY
// ============================================================================

async function discoverSchema(client: PostgresClient): Promise<any> {
  // Get all schemas
  const schemasResult = await client.queryObject(`
    SELECT schema_name 
    FROM information_schema.schemata 
    WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
    ORDER BY schema_name;
  `);

  // Get all tables and views
  const tablesResult = await client.queryObject(`
    SELECT 
      table_schema,
      table_name,
      table_type,
      (SELECT COUNT(*) 
       FROM information_schema.columns c 
       WHERE c.table_schema = t.table_schema AND c.table_name = t.table_name
      ) as column_count
    FROM information_schema.tables t
    WHERE table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
    ORDER BY table_schema, table_name
    LIMIT 200;
  `);

  // Get columns for the key views/tables
  const columnsResult = await client.queryObject(`
    SELECT 
      table_schema,
      table_name,
      column_name,
      data_type,
      is_nullable
    FROM information_schema.columns
    WHERE table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
    ORDER BY table_schema, table_name, ordinal_position
    LIMIT 500;
  `);

  return {
    schemas: schemasResult.rows,
    tables: tablesResult.rows,
    columns: columnsResult.rows,
    summary: {
      total_schemas: schemasResult.rows.length,
      total_tables: tablesResult.rows.length,
      total_columns: columnsResult.rows.length,
    },
  };
}

// ============================================================================
// QUERY EXECUTOR
// ============================================================================

async function executeQuery(
  client: PostgresClient,
  sql: string,
  maxRows: number = 100,
): Promise<{ rows: any[]; rowCount: number; truncated: boolean }> {
  // Add LIMIT if not present
  const upper = sql.toUpperCase();
  let safeSQL = sql;
  if (!upper.includes("LIMIT")) {
    safeSQL = `${sql.replace(/;?\s*$/, "")} LIMIT ${maxRows}`;
  }

  // Set statement timeout (10 seconds max)
  await client.queryObject("SET statement_timeout = '10s'");

  const result = await client.queryObject(safeSQL);
  const rows = result.rows as any[];

  return {
    rows: rows.slice(0, maxRows),
    rowCount: rows.length,
    truncated: rows.length >= maxRows,
  };
}

// ============================================================================
// AI NATURAL LANGUAGE → SQL
// ============================================================================

async function naturalLanguageToSQL(
  question: string,
  schemaContext: string,
): Promise<string> {
  const response = await unifiedAI.chat(
    [
      {
        role: "system",
        content: `You are a PostgreSQL expert. Convert natural language questions into safe, read-only SQL queries.
        
DATABASE SCHEMA:
${schemaContext}

RULES:
- ONLY generate SELECT queries
- Always include LIMIT (max 200)
- Use enhancesch schema prefix for PTD tables
- Return ONLY the SQL query, no explanation
- For trainer performance: use vw_schedulers + vw_client_master
- For packages: use vw_client_packages
- Wrap column names with spaces in double quotes`,
      },
      {
        role: "user",
        content: question,
      },
    ],
    { temperature: 0.1, max_tokens: 500 },
  );

  return response.content
    .replace(/```sql\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();
}

// ============================================================================
// MAIN SERVER
// ============================================================================

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return apiCorsPreFlight();
  }

  // Auth check
  try {
    verifyAuth(req);
  } catch (_e) {
    return errorToResponse(new UnauthorizedError());
  }

  let rdsClient: PostgresClient | null = null;

  try {
    const body = await req.json();
    const {
      action = "discover_schema",
      replica = "powerbi",
      sql,
      question,
      max_rows = 100,
    } = body;

    // Connect to RDS
    const config = getRDSConfig(replica);
    console.log(`[rds-analyst] Connecting to ${replica}: ${config.hostname}`);
    rdsClient = new PostgresClient(config);
    await rdsClient.connect();
    console.log(`[rds-analyst] Connected to ${replica}`);

    let result: any;

    switch (action) {
      case "discover_schema": {
        result = await discoverSchema(rdsClient);
        break;
      }

      case "query": {
        if (!sql) {
          return apiError("BAD_REQUEST", "Missing 'sql' parameter", 400);
        }

        const validation = validateSQL(sql);
        if (!validation.safe) {
          return apiError(
            "FORBIDDEN",
            `Query blocked: ${validation.reason}`,
            403,
          );
        }

        result = await executeQuery(rdsClient, sql, Math.min(max_rows, 200));
        break;
      }

      case "ask": {
        if (!question) {
          return apiError("BAD_REQUEST", "Missing 'question' parameter", 400);
        }

        // First, discover schema for context
        const schema = await discoverSchema(rdsClient);
        const schemaContext = (schema.tables as any[])
          .map((t: any) => {
            const cols = (schema.columns as any[])
              .filter(
                (c: any) =>
                  c.table_schema === t.table_schema &&
                  c.table_name === t.table_name,
              )
              .map((c: any) => `  ${c.column_name} (${c.data_type})`)
              .join("\n");
            return `${t.table_schema}.${t.table_name} (${t.table_type}):\n${cols}`;
          })
          .join("\n\n");

        // Convert to SQL
        const generatedSQL = await naturalLanguageToSQL(
          question,
          schemaContext,
        );
        console.log(`[rds-analyst] Generated SQL: ${generatedSQL}`);

        // Validate and execute
        const validation2 = validateSQL(generatedSQL);
        if (!validation2.safe) {
          result = {
            error: `Generated query was blocked: ${validation2.reason}`,
            generated_sql: generatedSQL,
          };
          break;
        }

        const queryResult = await executeQuery(
          rdsClient,
          generatedSQL,
          Math.min(max_rows, 200),
        );
        result = {
          question,
          generated_sql: generatedSQL,
          ...queryResult,
        };
        break;
      }

      // Pre-built analytics queries
      case "trainer_performance": {
        result = await executeQuery(
          rdsClient,
          `SELECT 
            s.trainer_name,
            COUNT(*) as total_sessions,
            COUNT(CASE WHEN s.status IN ('Completed', 'Attended') THEN 1 END) as completed,
            COUNT(CASE WHEN s.status = 'Cancelled' THEN 1 END) as cancelled,
            COUNT(CASE WHEN s.status = 'No Show' THEN 1 END) as no_shows,
            ROUND(
              COUNT(CASE WHEN s.status IN ('Completed', 'Attended') THEN 1 END)::numeric / 
              NULLIF(COUNT(*), 0) * 100, 1
            ) as completion_rate
          FROM enhancesch.vw_schedulers s
          WHERE s.training_date_utc > NOW() - INTERVAL '30 days'
          GROUP BY s.trainer_name
          ORDER BY total_sessions DESC
          LIMIT 50`,
          50,
        );
        break;
      }

      case "client_session_health": {
        result = await executeQuery(
          rdsClient,
          `SELECT 
            m.email,
            m.full_name,
            p.name_packet as package,
            p.remainingsessions as remaining,
            p.packsize as total_purchased,
            ROUND(
              (p.packsize - p.remainingsessions)::numeric / NULLIF(p.packsize, 0) * 100, 1
            ) as utilization_pct,
            (SELECT MAX(s.training_date_utc) 
             FROM enhancesch.vw_schedulers s 
             WHERE s.id_client = m.id_client 
             AND s.status IN ('Completed', 'Attended')
            ) as last_session,
            (SELECT COUNT(*) 
             FROM enhancesch.vw_schedulers s 
             WHERE s.id_client = m.id_client 
             AND s.training_date_utc > NOW() - INTERVAL '30 days'
             AND s.status IN ('Completed', 'Attended')
            ) as sessions_last_30d
          FROM enhancesch.vw_client_master m
          JOIN enhancesch.vw_client_packages p ON m.id_client = p.id_client
          WHERE p.remainingsessions > 0
          ORDER BY p.remainingsessions DESC
          LIMIT 100`,
          100,
        );
        break;
      }

      default:
        return apiError(
          "BAD_REQUEST",
          `Unknown action: ${action}. Available: discover_schema, query, ask, trainer_performance, client_session_health`,
          400,
        );
    }

    return apiSuccess(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[rds-analyst] Error: ${msg}`);
    return apiError(
      "INTERNAL_ERROR",
      `${msg}. Hint: Check RDS connectivity, credentials, and SSL settings.`,
      500,
    );
  } finally {
    if (rdsClient) {
      try {
        await rdsClient.end();
      } catch (_e) {
        // Connection already closed
      }
    }
  }
});
