/**
 * SQL validation utilities for the AI deploy pipeline.
 * Direct SQL execution via exec_sql RPC is disabled — all DDL must go through
 * the Supabase migration pipeline (supabase/migrations/ + supabase db push).
 */

export interface SqlValidationResult {
  valid: boolean;
  error?: string;
}

const DANGEROUS_PATTERNS = [
  /DROP\s+(TABLE|DATABASE|SCHEMA|FUNCTION|TRIGGER)/i,
  /TRUNCATE\s+/i,
  /DELETE\s+FROM\s+\w+\s*;?\s*$/i, // DELETE without WHERE
  /UPDATE\s+\w+\s+SET\s+(?!.*\bWHERE\b).*/i, // UPDATE without WHERE (negative lookahead)
  /GRANT\s+/i,
  /REVOKE\s+/i,
  /ALTER\s+USER/i,
  /CREATE\s+USER/i,
  /DROP\s+USER/i,
  /--\s*$/m, // SQL comments at end of line
  /\/\*/i, // Block comments
];

const ALLOWED_OPERATIONS = [
  /^CREATE\s+TABLE\s+/i,
  /^CREATE\s+INDEX\s+/i,
  /^ALTER\s+TABLE\s+\w+\s+ADD\s+COLUMN/i,
  /^INSERT\s+INTO\s+\w+\s*\(/i,
  /^UPDATE\s+\w+\s+SET\s+.*\s+WHERE\s+/i,
  /^DELETE\s+FROM\s+\w+\s+WHERE\s+/i,
];

const WHERE_BYPASS_PATTERNS = [
  /WHERE\s+(1\s*=\s*1|true|'1'\s*=\s*'1')/i,
  /WHERE\s+\w+\s+LIKE\s+'%'/i,
  /WHERE\s+\w+\s+IS\s+NOT\s+NULL/i,
];

export function validateSql(sql: string): SqlValidationResult {
  // Multi-statement check first — reject before any further validation
  const statementCount = sql
    .split(";")
    .filter((s) => s.trim().length > 0).length;
  if (statementCount > 1) {
    return {
      valid: false,
      error:
        "SQL validation failed: Multiple statements not allowed. Execute one statement at a time.",
    };
  }

  if (DANGEROUS_PATTERNS.some((p) => p.test(sql))) {
    return {
      valid: false,
      error:
        "SQL validation failed: Dangerous operation detected. Only safe operations (CREATE TABLE, ALTER TABLE, INSERT with WHERE) are allowed.",
    };
  }

  if (!ALLOWED_OPERATIONS.some((p) => p.test(sql))) {
    return {
      valid: false,
      error:
        "SQL validation failed: Operation not allowed. Permitted operations: CREATE TABLE, CREATE INDEX, ALTER TABLE ADD COLUMN, INSERT INTO, UPDATE with WHERE, DELETE with WHERE.",
    };
  }

  if (WHERE_BYPASS_PATTERNS.some((p) => p.test(sql))) {
    return {
      valid: false,
      error:
        "SQL validation failed: WHERE clause bypass detected. WHERE conditions must be specific (e.g., WHERE id=123, WHERE email='user@example.com').",
    };
  }

  return { valid: true };
}
