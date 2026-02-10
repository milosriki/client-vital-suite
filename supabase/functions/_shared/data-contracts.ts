/**
 * Enterprise Data Contracts
 * Zod-based request/response validation at function boundaries
 *
 * Per error-handling-patterns skill: "Schema validation at function boundaries"
 * Per database-design skill: "Define contracts between services"
 */

// NOTE: Zod import path for Deno edge functions
// deno-lint-ignore-file
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// ============================================================================
// COMMON SCHEMAS
// ============================================================================

export const PaginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().min(1).max(100).default(25),
});

export const DateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const ContactIdSchema = z.object({
  contact_id: z.string().min(1, "contact_id is required"),
});

// ============================================================================
// AGENT REQUEST SCHEMAS
// ============================================================================

export const AgentChatSchema = z.object({
  message: z.string().min(1, "Message is required"),
  conversation_id: z.string().optional(),
  contact_id: z.string().optional(),
  context: z.record(z.unknown()).optional(),
});

export const AppointmentRequestSchema = z.object({
  message: z.string().min(1, "Message is required"),
  contact_id: z.string().optional(),
  current_slots: z.array(z.string()).optional().default([]),
});

export const LeadReplySchema = z.object({
  lead_id: z.string().min(1),
  message: z.string().min(1),
  channel: z.enum(["whatsapp", "email", "sms"]).default("whatsapp"),
});

// ============================================================================
// SYNC SCHEMAS
// ============================================================================

export const SyncRequestSchema = z.object({
  incremental: z.boolean().default(true),
  platforms: z.array(z.string()).optional(),
  force: z.boolean().default(false),
});

export const WebhookPayloadSchema = z.object({
  event: z.string().min(1),
  data: z.record(z.unknown()),
  timestamp: z.string().datetime().optional(),
});

// ============================================================================
// STRIPE SCHEMAS
// ============================================================================

export const StripeDashboardSchema = z.object({
  period: z.enum(["day", "week", "month", "quarter", "year"]).default("month"),
  currency: z.string().length(3).default("AED"),
});

export const StripeCheckoutSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().length(3).default("AED"),
  description: z.string().optional(),
  customer_email: z.string().email().optional(),
});

// ============================================================================
// ANALYTICS SCHEMAS
// ============================================================================

export const HealthScoreRequestSchema = z.object({
  client_id: z.string().optional(),
  recalculate: z.boolean().default(false),
});

export const BusinessIntelligenceSchema = z.object({
  query: z.string().min(1),
  filters: z.record(z.unknown()).optional(),
  format: z.enum(["json", "summary", "chart"]).default("json"),
});

// ============================================================================
// VALIDATION HELPER
// ============================================================================

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; errors: string[] };

/**
 * Validate request body against a Zod schema
 * Returns typed data or structured errors
 */
export function validateRequest<T>(
  schema: z.ZodType<T>,
  data: unknown,
): ValidationResult<T> {
  const result = schema.safeParse(data);
  if (result.success) {
    return { ok: true, data: result.data };
  }
  return {
    ok: false,
    errors: result.error.issues.map(
      (issue) => `${issue.path.join(".")}: ${issue.message}`,
    ),
  };
}

/**
 * Validate and throw on failure (for use with handleError)
 */
export function validateOrThrow<T>(
  schema: z.ZodType<T>,
  data: unknown,
  functionName: string,
): T {
  const result = validateRequest(schema, data);
  if (!result.ok) {
    throw new Error(
      `[${functionName}] Validation failed: ${result.errors.join(", ")}`,
    );
  }
  return result.data;
}
