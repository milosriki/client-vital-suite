import {
  assertEquals,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { validateSql } from "./sql-validator.ts";

// ============================================================================
// SQL VALIDATOR TESTS
// Ensures the AI deploy pipeline rejects dangerous SQL and only allows safe
// operations — exec_sql RPC is permanently disabled; all DDL goes through
// the official migration pipeline.
// ============================================================================

// --------------------------------------------------------------------------
// Allowed operations
// --------------------------------------------------------------------------

Deno.test("validateSql - allows CREATE TABLE", () => {
  const result = validateSql("CREATE TABLE new_table (id uuid PRIMARY KEY)");
  assertEquals(result.valid, true);
  assertEquals(result.error, undefined);
});

Deno.test("validateSql - allows CREATE INDEX", () => {
  const result = validateSql("CREATE INDEX idx_contacts_email ON contacts(email)");
  assertEquals(result.valid, true);
});

Deno.test("validateSql - allows ALTER TABLE ADD COLUMN", () => {
  const result = validateSql("ALTER TABLE contacts ADD COLUMN phone_verified boolean");
  assertEquals(result.valid, true);
});

Deno.test("validateSql - allows INSERT INTO", () => {
  const result = validateSql("INSERT INTO settings (key, value) VALUES ('foo', 'bar')");
  assertEquals(result.valid, true);
});

Deno.test("validateSql - allows UPDATE with WHERE", () => {
  const result = validateSql("UPDATE contacts SET status = 'active' WHERE id = '123'");
  assertEquals(result.valid, true);
});

Deno.test("validateSql - allows DELETE with WHERE", () => {
  const result = validateSql("DELETE FROM sessions WHERE id = 'abc'");
  assertEquals(result.valid, true);
});

// --------------------------------------------------------------------------
// Dangerous operations — should be blocked
// --------------------------------------------------------------------------

Deno.test("validateSql - blocks DROP TABLE", () => {
  const result = validateSql("DROP TABLE contacts");
  assertEquals(result.valid, false);
  assertEquals(result.error?.includes("Dangerous operation"), true);
});

Deno.test("validateSql - blocks TRUNCATE", () => {
  const result = validateSql("TRUNCATE contacts");
  assertEquals(result.valid, false);
  assertEquals(result.error?.includes("Dangerous operation"), true);
});

Deno.test("validateSql - blocks DELETE without WHERE", () => {
  const result = validateSql("DELETE FROM contacts");
  assertEquals(result.valid, false);
  assertEquals(result.error?.includes("Dangerous operation"), true);
});

Deno.test("validateSql - blocks UPDATE without WHERE", () => {
  const result = validateSql("UPDATE contacts SET status = 'deleted'");
  assertEquals(result.valid, false);
  assertEquals(result.error?.includes("Dangerous operation"), true);
});

Deno.test("validateSql - blocks GRANT", () => {
  const result = validateSql("GRANT ALL ON contacts TO public");
  assertEquals(result.valid, false);
  assertEquals(result.error?.includes("Dangerous operation"), true);
});

Deno.test("validateSql - blocks DROP DATABASE", () => {
  const result = validateSql("DROP DATABASE production");
  assertEquals(result.valid, false);
});

Deno.test("validateSql - blocks block comments (potential obfuscation)", () => {
  const result = validateSql("INSERT INTO t (a) VALUES (/* comment */ 1)");
  assertEquals(result.valid, false);
});

// --------------------------------------------------------------------------
// WHERE clause bypass attacks
// --------------------------------------------------------------------------

Deno.test("validateSql - blocks WHERE 1=1 bypass", () => {
  const result = validateSql("DELETE FROM contacts WHERE 1=1");
  assertEquals(result.valid, false);
  assertEquals(result.error?.includes("WHERE clause bypass"), true);
});

Deno.test("validateSql - blocks WHERE col LIKE '%' bypass", () => {
  const result = validateSql("UPDATE contacts SET status = 'x' WHERE email LIKE '%'");
  assertEquals(result.valid, false);
  assertEquals(result.error?.includes("WHERE clause bypass"), true);
});

Deno.test("validateSql - blocks WHERE col IS NOT NULL bypass", () => {
  const result = validateSql("DELETE FROM sessions WHERE id IS NOT NULL");
  assertEquals(result.valid, false);
  assertEquals(result.error?.includes("WHERE clause bypass"), true);
});

// --------------------------------------------------------------------------
// Multi-statement injection
// --------------------------------------------------------------------------

Deno.test("validateSql - blocks multiple statements", () => {
  const result = validateSql(
    "INSERT INTO t (a) VALUES (1); DROP TABLE t",
  );
  assertEquals(result.valid, false);
  assertEquals(result.error?.includes("Multiple statements"), true);
});

Deno.test("validateSql - allows single statement ending with semicolon", () => {
  const result = validateSql("CREATE TABLE foo (id uuid PRIMARY KEY);");
  assertEquals(result.valid, true);
});

// --------------------------------------------------------------------------
// Disallowed operation types (not in allowedOperations)
// --------------------------------------------------------------------------

Deno.test("validateSql - blocks SELECT", () => {
  const result = validateSql("SELECT * FROM contacts");
  assertEquals(result.valid, false);
  assertEquals(result.error?.includes("Operation not allowed"), true);
});

Deno.test("validateSql - blocks CREATE FUNCTION", () => {
  const result = validateSql("CREATE FUNCTION foo() RETURNS void AS $$ $$ LANGUAGE sql");
  assertEquals(result.valid, false);
  assertEquals(result.error?.includes("Operation not allowed"), true);
});
