/**
 * Enterprise API Response Envelope
 * Per api-patterns/response.md: "Consistency is key"
 *
 * Standardized response format:
 * { success: boolean, data?: T, error?: { code, message, requestId } }
 */

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    cached?: boolean;
    freshness?: string;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: Record<string, string[]>;
  };
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Create a success response with the envelope pattern
 * Per api-patterns/response.md: Include data + optional meta
 */
export function apiSuccess<T>(
  data: T,
  meta?: ApiSuccessResponse<T>["meta"],
  status = 200,
): Response {
  const body: ApiSuccessResponse<T> = { success: true, data };
  if (meta) body.meta = meta;

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
    },
  });
}

/**
 * Create an error response with the envelope pattern
 * Per api-patterns/response.md: Include code + user message + request ID
 * Per api-patterns/rest.md: Use proper HTTP status codes
 */
export function apiError(
  code: string,
  message: string,
  status = 400,
  details?: Record<string, string[]>,
): Response {
  const requestId = crypto.randomUUID();
  const body: ApiErrorResponse = {
    success: false,
    error: { code, message, requestId, ...(details && { details }) },
  };

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
    },
  });
}

/**
 * Create a 201 Created response
 * Per api-patterns/rest.md: "Created → 201"
 */
export function apiCreated<T>(data: T): Response {
  return apiSuccess(data, undefined, 201);
}

/**
 * Create a 204 No Content response
 * Per api-patterns/rest.md: "No content → 204"
 */
export function apiNoContent(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
    },
  });
}

/**
 * Create a validation error response (422)
 * Per api-patterns/rest.md: "Validation error → 422"
 * Per data-contracts.ts: Use with Zod validation errors
 */
export function apiValidationError(errors: string[]): Response {
  return apiError("VALIDATION_ERROR", "Request validation failed", 422, {
    validation: errors,
  });
}

/**
 * Create a rate limit response (429)
 * Per api-patterns/rate-limiting.md: Return 429 + rate limit headers
 */
export function apiRateLimited(
  retryAfterSeconds = 60,
  limit = 100,
  remaining = 0,
): Response {
  const body: ApiErrorResponse = {
    success: false,
    error: {
      code: "RATE_LIMITED",
      message: `Rate limit exceeded. Try again in ${retryAfterSeconds} seconds.`,
      requestId: crypto.randomUUID(),
    },
  };

  return new Response(JSON.stringify(body), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "X-RateLimit-Limit": String(limit),
      "X-RateLimit-Remaining": String(remaining),
      "X-RateLimit-Reset": String(
        Math.floor(Date.now() / 1000) + retryAfterSeconds,
      ),
      "Retry-After": String(retryAfterSeconds),
    },
  });
}

/**
 * CORS preflight handler
 */
export function apiCorsPreFlight(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
      "Access-Control-Max-Age": "86400",
    },
  });
}
