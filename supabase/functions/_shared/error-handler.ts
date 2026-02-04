import {
  createClient,
  SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Standard error response format
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    timestamp: string;
  };
}

/**
 * Error codes for categorizing errors
 */
export enum ErrorCode {
  // Validation errors (400)
  VALIDATION_ERROR = "VALIDATION_ERROR",
  MISSING_PARAMETER = "MISSING_PARAMETER",
  INVALID_PARAMETER = "INVALID_PARAMETER",

  // Authentication/Authorization errors (401/403)
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  MISSING_API_KEY = "MISSING_API_KEY",
  INVALID_API_KEY = "INVALID_API_KEY",

  // External API errors (502/503)
  EXTERNAL_API_ERROR = "EXTERNAL_API_ERROR",
  STRIPE_API_ERROR = "STRIPE_API_ERROR",
  HUBSPOT_API_ERROR = "HUBSPOT_API_ERROR",

  // Database errors (500)
  DATABASE_ERROR = "DATABASE_ERROR",

  // General errors (500)
  INTERNAL_ERROR = "INTERNAL_ERROR",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",

  // Rate limiting (429)
  // Rate limiting (429)
  RATE_LIMIT_ERROR = "RATE_LIMIT_ERROR",

  // Execution/Runtime errors
  ISOLATE_ERROR = "ISOLATE_ERROR",
  DATA_INTEGRITY_ERROR = "DATA_INTEGRITY_ERROR",
}

/**
 * Maps error codes to HTTP status codes
 */
const ERROR_STATUS_MAP: Record<ErrorCode, number> = {
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.MISSING_PARAMETER]: 400,
  [ErrorCode.INVALID_PARAMETER]: 400,
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.MISSING_API_KEY]: 401,
  [ErrorCode.INVALID_API_KEY]: 401,
  [ErrorCode.EXTERNAL_API_ERROR]: 502,
  [ErrorCode.STRIPE_API_ERROR]: 502,
  [ErrorCode.HUBSPOT_API_ERROR]: 502,
  [ErrorCode.DATABASE_ERROR]: 500,
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.UNKNOWN_ERROR]: 500,
  [ErrorCode.RATE_LIMIT_ERROR]: 429,
  [ErrorCode.ISOLATE_ERROR]: 500,
  [ErrorCode.DATA_INTEGRITY_ERROR]: 422, // Unprocessable Entity
};

/**
 * CORS headers to include in all responses
 */
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, stripe-signature, x-hubspot-signature",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};

/**
 * Map error codes to sync_errors error_type
 */
function mapErrorCodeToType(errorCode: ErrorCode): string {
  const mapping: Record<ErrorCode, string> = {
    [ErrorCode.VALIDATION_ERROR]: "validation",
    [ErrorCode.MISSING_PARAMETER]: "validation",
    [ErrorCode.INVALID_PARAMETER]: "validation",
    [ErrorCode.UNAUTHORIZED]: "auth",
    [ErrorCode.FORBIDDEN]: "auth",
    [ErrorCode.MISSING_API_KEY]: "auth",
    [ErrorCode.INVALID_API_KEY]: "auth",
    [ErrorCode.EXTERNAL_API_ERROR]: "network",
    [ErrorCode.STRIPE_API_ERROR]: "network",
    [ErrorCode.HUBSPOT_API_ERROR]: "network",
    [ErrorCode.DATABASE_ERROR]: "network",
    [ErrorCode.INTERNAL_ERROR]: "network",
    [ErrorCode.UNKNOWN_ERROR]: "network",
    [ErrorCode.RATE_LIMIT_ERROR]: "rate_limit",
    [ErrorCode.ISOLATE_ERROR]: "runtime",
    [ErrorCode.DATA_INTEGRITY_ERROR]: "data_integrity",
  };

  return mapping[errorCode] || "network";
}

/**
 * Map function name to source
 */
function mapFunctionNameToSource(functionName: string): string {
  if (functionName.includes("hubspot")) return "hubspot";
  if (functionName.includes("stripe")) return "stripe";
  if (functionName.includes("meta") || functionName.includes("facebook"))
    return "meta";
  return "internal";
}

/**
 * Log error to sync_errors table for tracking and debugging
 */
export async function logError(
  supabase: SupabaseClient | null,
  functionName: string,
  error: Error | unknown,
  errorCode: ErrorCode,
  context?: Record<string, unknown>,
): Promise<void> {
  if (!supabase) {
    console.warn(
      "⚠️ Cannot log error to database: Supabase client not provided",
    );
    return;
  }

  const err = error as Error | null;

  try {
    const errorLog = {
      error_type: mapErrorCodeToType(errorCode),
      source: mapFunctionNameToSource(functionName),
      object_type: context?.objectType || null,
      object_id: context?.objectId || null,
      operation: context?.operation || null,
      error_message: err?.message || String(error),
      error_details: {
        function_name: functionName,
        error_code: errorCode,
        error_stack: err?.stack || null,
        context: context || {},
      },
      request_payload: context?.requestPayload || null,
      response_payload: context?.responsePayload || null,
      created_at: new Date().toISOString(),
    };

    const { error: insertError } = await supabase
      .from("sync_errors")
      .insert(errorLog);

    if (insertError) {
      console.error("❌ Failed to log error to database:", insertError);
    } else {
      console.log(
        `✅ Error logged to database: ${functionName} - ${errorCode}`,
      );
    }
  } catch (dbError) {
    console.error("❌ Exception while logging error to database:", dbError);
  }
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>,
): ErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      details,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Handle error and return a Response object with proper status code and logging
 */
export async function handleError(
  error: Error | unknown,
  functionName: string,
  options?: {
    supabase?: SupabaseClient;
    errorCode?: ErrorCode;
    context?: Record<string, unknown>;
    includeStack?: boolean;
  },
): Promise<Response> {
  const {
    supabase = null,
    errorCode = ErrorCode.UNKNOWN_ERROR,
    context = {},
    includeStack = false,
  } = options || {};

  // Log to console
  console.error(`❌ Error in ${functionName}:`, error);
  if (context && Object.keys(context).length > 0) {
    console.error("Context:", context);
  }

  // Log to database
  await logError(supabase, functionName, error, errorCode, context);

  // Create error response
  const err = error as Error | null;
  const errorResponse = createErrorResponse(
    errorCode,
    err?.message || "An unexpected error occurred",
    includeStack ? { stack: err?.stack, ...context } : context,
  );

  // Get appropriate status code
  const statusCode = ERROR_STATUS_MAP[errorCode] || 500;

  return new Response(JSON.stringify(errorResponse), {
    status: statusCode,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

/**
 * Validate required environment variables
 */
export function validateEnvVars(
  required: string[],
  functionName: string,
): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  for (const varName of required) {
    const value = Deno.env.get(varName);
    if (!value) {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    console.error(
      `❌ ${functionName}: Missing environment variables:`,
      missing,
    );
    return { valid: false, missing };
  }

  return { valid: true, missing: [] };
}

/**
 * Validate request body parameters
 */
export function validateRequestBody(
  body: Record<string, unknown> | null | undefined,
  requiredFields: string[],
  functionName: string,
): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  if (!body) {
    return { valid: false, missing: requiredFields };
  }

  for (const field of requiredFields) {
    if (!(field in body) || body[field] === null || body[field] === undefined) {
      missing.push(field);
    }
  }

  if (missing.length > 0) {
    console.error(`❌ ${functionName}: Missing required fields:`, missing);
    return { valid: false, missing };
  }

  return { valid: true, missing: [] };
}

/**
 * Create a standardized success response
 */
export interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
  timestamp: string;
}

export function createSuccessResponse<T>(data: T): SuccessResponse<T> {
  return {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Wrap a response with CORS headers
 */
export function withCors(response: Response): Response {
  const newHeaders = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => {
    newHeaders.set(key, value);
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

/**
 * Handle CORS preflight requests
 */
export function handleCorsPreFlight(): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

/**
 * Try to parse JSON with error handling
 */
export async function parseJsonSafely<T = unknown>(
  req: Request,
  functionName: string,
): Promise<{ success: true; data: T } | { success: false; error: Error }> {
  try {
    const text = await req.text();
    if (!text || text.trim() === "") {
      return { success: true, data: {} as T };
    }
    const data = JSON.parse(text);
    return { success: true, data };
  } catch (error) {
    console.error(`❌ ${functionName}: Failed to parse JSON:`, error);
    return { success: false, error: error as Error };
  }
}

/**
 * Create Supabase client with error handling
 */
export function createSupabaseClient(
  functionName: string,
): SupabaseClient | null {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseKey) {
    console.error(
      `❌ ${functionName}: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY`,
    );
    return null;
  }

  return createClient(supabaseUrl, supabaseKey);
}
