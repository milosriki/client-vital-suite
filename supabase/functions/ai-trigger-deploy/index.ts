import {
  withTracing,
  structuredLog,
  getCorrelationId,
} from "../_shared/observability.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { apiSuccess, apiError, apiCorsPreFlight } from "../_shared/api-response.ts";
import { UnauthorizedError, errorToResponse } from "../_shared/app-errors.ts";
import {
  handleError,
  ErrorCode,
  corsHeaders,
} from "../_shared/error-handler.ts";
import { validateSql } from "../_shared/sql-validator.ts";

const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN");
const GITHUB_REPO =
  Deno.env.get("GITHUB_REPO") || "milosriki/client-vital-suite";

// =============================================================================
// SECURITY UTILITIES - Timeout and Retry Logic
// =============================================================================

/**
 * Execute a promise with timeout
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string,
): Promise<T> {
  const timeoutPromise = new Promise<T>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`${operationName} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]);
}

/**
 * Retry a function with exponential backoff
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delayMs: number = 1000,
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error as Error;
      console.warn(`Attempt ${attempt}/${maxAttempts} failed:`, error);

      // Don't retry on the last attempt
      if (attempt === maxAttempts) break;

      // Exponential backoff: 1s, 2s, 4s
      const delay = delayMs * Math.pow(2, attempt - 1);
      console.log(`Retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error("Operation failed after retries");
}

/**
 * Combine timeout and retry for robust operations
 */
async function withTimeoutAndRetry<T>(
  fn: () => Promise<T>,
  timeoutMs: number = 30000,
  maxAttempts: number = 3,
): Promise<T> {
  return withRetry(
    () => withTimeout(fn(), timeoutMs, "Database operation"),
    maxAttempts,
  );
}

serve(async (req) => {
    try { verifyAuth(req); } catch { throw new UnauthorizedError(); } // Security Hardening
  if (req.method === "OPTIONS") {
    return apiCorsPreFlight();
  }

  try {
    const { approval_id, approved, approved_by, rejection_reason } =
      await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Get the action
    const { data: action, error: fetchError } = await supabase
      .from("prepared_actions")
      .select("id, action_type, action_title, action_description, reasoning, confidence, prepared_payload, status")
      .eq("id", approval_id)
      .single();

    if (fetchError || !action) {
      throw new Error("Action not found");
    }

    if (!approved) {
      // ========================================
      // REJECTION - Record for learning
      // ========================================

      await supabase
        .from("prepared_actions")
        .update({
          status: "rejected",
          rejection_reason,
        })
        .eq("id", approval_id);

      // Save to calibration for AI learning
      await supabase.from("business_calibration").insert({
        scenario_type: action.action_type,
        scenario_description: action.action_title,
        ai_recommendation: action.action_description,
        ai_reasoning: action.reasoning,
        ai_confidence: action.confidence,
        your_decision: "REJECTED",
        your_reasoning: rejection_reason || "Not provided",
        was_ai_correct: false,
        learning_weight: 4, // High weight - learn from rejections
        action_id: approval_id,
      });

      return apiSuccess({
          success: true,
          status: "rejected",
          message: "Rejection recorded for AI learning",
        });
    }

    // ========================================
    // APPROVAL - Execute based on type
    // ========================================

    await supabase
      .from("prepared_actions")
      .update({
        status: "executing",
        approved_at: new Date().toISOString(),
        approved_by,
      })
      .eq("id", approval_id);

    if (action.action_type === "code_deploy") {
      // ========================================
      // CODE DEPLOYMENT - Trigger GitHub Actions
      // ========================================

      const files = action.prepared_payload?.files || [];

      if (files.length === 0) {
        throw new Error("No files to deploy");
      }

      // Trigger GitHub Actions via repository dispatch
      const ghResponse = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/dispatches`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${GITHUB_TOKEN}`,
            Accept: "application/vnd.github.v3+json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            event_type: "ai-deploy",
            client_payload: {
              approval_id,
              files,
              commit_message: `🤖 AI Deploy: ${action.action_title}`,
            },
          }),
        },
      );

      if (!ghResponse.ok) {
        const errorText = await ghResponse.text();
        throw new Error(`GitHub API error: ${errorText}`);
      }

      return apiSuccess({
          success: true,
          status: "deploying",
          message: "GitHub Actions triggered. Deployment in progress...",
        });
    } else if (action.action_type === "database") {
      // ========================================
      // DATABASE MIGRATION
      // ========================================

      const sql = action.prepared_payload?.sql;
      if (sql) {
        const validation = validateSql(sql);
        if (!validation.valid) {
          throw new Error(validation.error);
        }

        console.log(
          "✅ SQL validation passed:",
          sql.trim().toUpperCase().split(" ").slice(0, 3).join(" "),
        );

        await supabase.from("prepared_actions").update({
          status: "pending_manual_migration",
          updated_at: new Date().toISOString(),
        }).eq("id", approval_id);

        console.log(
          "✅ SQL validated — apply via supabase/migrations/:",
          sql.slice(0, 120),
        );

        return apiSuccess({
          success: true,
          status: "pending_manual_migration",
          message:
            "SQL validated. Add to supabase/migrations/ and run supabase db push.",
          sql_preview: sql.slice(0, 200),
        });
      } else {
        throw new Error("No SQL query provided in prepared_payload");
      }
    } else {
      // ========================================
      // OTHER ACTIONS (intervention, analysis, etc.)
      // ========================================

      await supabase
        .from("prepared_actions")
        .update({ status: "executed", executed_at: new Date().toISOString() })
        .eq("id", approval_id);

      // Record success for learning
      await supabase.from("business_calibration").insert({
        scenario_type: action.action_type,
        scenario_description: action.action_title,
        ai_recommendation: action.action_description,
        ai_reasoning: action.reasoning,
        ai_confidence: action.confidence,
        your_decision: "APPROVED",
        your_reasoning: "Executed successfully",
        was_ai_correct: true,
        learning_weight: 2,
        action_id: approval_id,
      });

      return apiSuccess({
          success: true,
          status: "executed",
          message: "Action executed successfully",
        });
    }
  } catch (error: unknown) {
    console.error("Deploy trigger error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return apiError("INTERNAL_ERROR", JSON.stringify({
        success: false,
        error: message,
      }), 500);
  }
});
