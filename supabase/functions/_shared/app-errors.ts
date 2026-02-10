/**
 * Enterprise Error Architecture
 * Per error-handling-patterns skill: Custom Error Hierarchy + Result Type
 *
 * Why: Raw `throw new Error("...")` loses context. Typed errors carry
 * structured data (code, statusCode, service, details) so the handler
 * can produce the correct API envelope automatically.
 */

// ─── Base Error ────────────────────────────────────────────────
export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;
  public readonly timestamp: string;

  constructor(
    message: string,
    code: string,
    statusCode = 500,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

// ─── Validation (400 / 422) ────────────────────────────────────
export class ValidationError extends AppError {
  public readonly fields: string[];

  constructor(message: string, fields: string[] = []) {
    super(message, "VALIDATION_ERROR", 422, { fields });
    this.fields = fields;
  }
}

// ─── Not Found (404) ───────────────────────────────────────────
export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(`${resource}${id ? ` (${id})` : ""} not found`, "NOT_FOUND", 404, {
      resource,
      ...(id && { id }),
    });
  }
}

// ─── Unauthorized (401) ────────────────────────────────────────
export class UnauthorizedError extends AppError {
  constructor(reason = "Invalid or missing authentication") {
    super(reason, "UNAUTHORIZED", 401);
  }
}

// ─── Forbidden (403) ───────────────────────────────────────────
export class ForbiddenError extends AppError {
  constructor(reason = "Insufficient permissions") {
    super(reason, "FORBIDDEN", 403);
  }
}

// ─── Rate Limited (429) ────────────────────────────────────────
export class RateLimitError extends AppError {
  public readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds = 60) {
    super(
      `Rate limit exceeded. Retry after ${retryAfterSeconds}s`,
      "RATE_LIMITED",
      429,
      { retryAfterSeconds },
    );
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

// ─── External Service (502) ────────────────────────────────────
export class ExternalServiceError extends AppError {
  public readonly service: string;

  constructor(
    service: string,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(`${service}: ${message}`, "EXTERNAL_SERVICE_ERROR", 502, {
      service,
      ...details,
    });
    this.service = service;
  }
}

// ─── Conflict (409) ────────────────────────────────────────────
export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "CONFLICT", 409, details);
  }
}

// ─── Result Type ───────────────────────────────────────────────
// Per error-handling-patterns skill: Explicit Ok/Err for expected failures
export type Result<T, E = AppError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function Ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function Err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

// ─── Error-to-Response Converter ───────────────────────────────
// Maps typed errors → apiError() automatically
import {
  apiError,
  apiValidationError,
  apiRateLimited,
} from "./api-response.ts";

export function errorToResponse(error: unknown): Response {
  if (error instanceof ValidationError) {
    return apiValidationError(
      error.fields.length > 0 ? error.fields : [error.message],
    );
  }
  if (error instanceof RateLimitError) {
    return apiRateLimited(error.retryAfterSeconds);
  }
  if (error instanceof AppError) {
    return apiError(
      error.code,
      error.message,
      error.statusCode,
      error.details
        ? Object.fromEntries(
            Object.entries(error.details).map(([k, v]) => [k, [String(v)]]),
          )
        : undefined,
    );
  }
  // Unknown errors → 500
  const msg = error instanceof Error ? error.message : "Internal server error";
  return apiError("INTERNAL_ERROR", msg, 500);
}
