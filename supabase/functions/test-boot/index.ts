import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildSmartPrompt,
  ConversationContext,
} from "../_shared/smart-prompt.ts";
import { parseAIResponse } from "../_shared/response-parser.ts";
import { calculateLeadScore, ScoringSignals } from "../_shared/lead-scorer.ts";
import { HubSpotManager } from "../_shared/hubspot-manager.ts";
import { SentimentTriage } from "../_shared/sentiment.ts";
import { RepairEngine } from "../_shared/repair-engine.ts";
import { AntiRobot } from "../_shared/anti-robot.ts";
import { DubaiContext, AvatarLogic } from "../_shared/avatar-logic.ts";
import { unifiedAI } from "../_shared/unified-ai-client.ts";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import {
  handleError,
  ErrorCode,
  corsHeaders as defaultCorsHeaders,
} from "../_shared/error-handler.ts";
import { withTracing, structuredLog } from "../_shared/observability.ts";
import {
  apiSuccess,
  apiError,
  apiCorsPreFlight,
} from "../_shared/api-response.ts";
import { UnauthorizedError, errorToResponse } from "../_shared/app-errors.ts";

Deno.serve(async (req) => {
  verifyAuth(req);

  return apiSuccess({ status: "ok", message: "OK with ALL imports" });
});
