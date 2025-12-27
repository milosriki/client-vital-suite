# 🤖 PARALLEL CLAUDE AGENT PROMPTS
## PTD Client-Vital-Suite Full Tracing Implementation

**Total Functions to Instrument:** 98
**Strategy:** 5 parallel agents, ~20 functions each

---

## 📋 HOW TO USE

1. Open 5 separate Claude.ai conversations (or Claude Code instances)
2. Copy-paste each AGENT prompt below into a separate conversation
3. Each agent will work on its batch independently
4. All agents push to separate branches, then we merge

---

# ═══════════════════════════════════════════════════════════════
# AGENT 1: AI & INTELLIGENCE FUNCTIONS (20 functions)
# ═══════════════════════════════════════════════════════════════

```
You are working on the GitHub repository: milosriki/client-vital-suite

TASK: Add LangSmith tracing to AI/Intelligence edge functions

SETUP:
1. Clone the repo: git clone https://github.com/milosriki/client-vital-suite.git
2. cd client-vital-suite
3. git checkout -b claude/trace-ai-functions
4. Pull latest: git pull origin main

FUNCTIONS TO INSTRUMENT (20):
1. ai-ceo-master
2. ai-config-status  
3. ai-deploy-callback
4. ai-trigger-deploy
5. agent-analyst
6. anomaly-detector
7. business-intelligence
8. churn-predictor
9. deep-research
10. intervention-recommender
11. proactive-insights-generator
12. ptd-agent
13. ptd-agent-claude
14. ptd-agent-gemini
15. ptd-execute-action
16. ptd-proactive-scanner
17. ptd-self-developer
18. ptd-self-learn
19. ptd-ultimate-intelligence
20. ultimate-truth-alignment

FOR EACH FUNCTION:
1. Open supabase/functions/{function-name}/index.ts
2. Add import at top (after any /// reference lines):
   import { withTracing, structuredLog, getCorrelationId } from "../_shared/observability.ts";

3. Find the serve() or Deno.serve() call
4. Wrap the handler with withTracing:

BEFORE:
serve(async (req) => {
  // handler code
});

AFTER:
const handler = async (req: Request): Promise<Response> => {
  const correlationId = getCorrelationId(req);
  // existing handler code (keep all of it)
};

serve(withTracing(handler, { 
  functionName: "{function-name}",
  runType: "chain",
  tags: ["ai-agent"]
}));

COMMIT AND PUSH:
git add -A
git commit -m "feat: Add tracing to AI/Intelligence functions (20 functions)"
git push origin claude/trace-ai-functions

CREATE PR:
gh pr create --title "feat: Add tracing to AI/Intelligence functions" --body "Instruments 20 AI functions with observability wrapper" --base main
```

---

# ═══════════════════════════════════════════════════════════════
# AGENT 2: STRIPE & PAYMENT FUNCTIONS (18 functions)
# ═══════════════════════════════════════════════════════════════

```
You are working on the GitHub repository: milosriki/client-vital-suite

TASK: Add LangSmith tracing to Stripe/Payment edge functions

SETUP:
1. Clone the repo: git clone https://github.com/milosriki/client-vital-suite.git
2. cd client-vital-suite
3. git checkout -b claude/trace-stripe-functions
4. Pull latest: git pull origin main

FUNCTIONS TO INSTRUMENT (18):
1. enrich-with-stripe
2. stripe-account-details
3. stripe-checkout
4. stripe-connect
5. stripe-deep-agent
6. stripe-enterprise-intelligence
7. stripe-error-handler
8. stripe-forensics
9. stripe-history
10. stripe-issuing
11. stripe-issuing-tokens
12. stripe-payout-controls
13. stripe-payouts-ai
14. stripe-treasury
15. stripe-webhook
16. capi-validator
17. process-capi-batch
18. send-to-stape-capi

FOR EACH FUNCTION:
1. Open supabase/functions/{function-name}/index.ts
2. Check if already has tracing (grep for "observability" or "withTracing")
3. If NOT already instrumented, add import at top:
   import { withTracing, structuredLog, getCorrelationId } from "../_shared/observability.ts";

4. Wrap handler with withTracing (same pattern as Agent 1)

IMPORTANT: Some Stripe functions may already have tracing from PR #92. Skip those.

COMMIT AND PUSH:
git add -A
git commit -m "feat: Add tracing to Stripe/Payment functions"
git push origin claude/trace-stripe-functions

CREATE PR:
gh pr create --title "feat: Add tracing to Stripe functions" --body "Instruments Stripe and payment functions with observability" --base main
```

---

# ═══════════════════════════════════════════════════════════════
# AGENT 3: HUBSPOT & CRM FUNCTIONS (15 functions)
# ═══════════════════════════════════════════════════════════════

```
You are working on the GitHub repository: milosriki/client-vital-suite

TASK: Add LangSmith tracing to HubSpot/CRM edge functions

SETUP:
1. Clone the repo: git clone https://github.com/milosriki/client-vital-suite.git
2. cd client-vital-suite
3. git checkout -b claude/trace-hubspot-functions
4. Pull latest: git pull origin main

FUNCTIONS TO INSTRUMENT (15):
1. hubspot-analyzer
2. hubspot-anytrack-webhook
3. hubspot-command-center
4. hubspot-error-handler
5. hubspot-live-query
6. hubspot-webhook
7. fetch-hubspot-live
8. sync-hubspot-data
9. sync-hubspot-to-capi
10. sync-hubspot-to-supabase
11. auto-reassign-leads
12. generate-lead-replies
13. generate-lead-reply
14. reassign-owner
15. cleanup-fake-contacts

FOR EACH FUNCTION:
Add the observability import and wrap with withTracing (same pattern).
Use tags: ["hubspot", "crm"]

COMMIT AND PUSH:
git add -A
git commit -m "feat: Add tracing to HubSpot/CRM functions"
git push origin claude/trace-hubspot-functions

CREATE PR:
gh pr create --title "feat: Add tracing to HubSpot functions" --body "Instruments HubSpot and CRM functions" --base main
```

---

# ═══════════════════════════════════════════════════════════════
# AGENT 4: ERROR HANDLING FUNCTIONS (20 functions)
# ═══════════════════════════════════════════════════════════════

```
You are working on the GitHub repository: milosriki/client-vital-suite

TASK: Add LangSmith tracing to Error handling edge functions

SETUP:
1. Clone the repo: git clone https://github.com/milosriki/client-vital-suite.git
2. cd client-vital-suite
3. git checkout -b claude/trace-error-functions
4. Pull latest: git pull origin main

FUNCTIONS TO INSTRUMENT (20):
1. error-auto-resolver
2. error-cleanup-agent
3. error-correlation-agent
4. error-health-monitor
5. error-notification-agent
6. error-pattern-analyzer
7. error-prediction-agent
8. error-prevention-agent
9. error-recovery-agent
10. error-retry-orchestrator
11. error-rollback-agent
12. error-root-cause-analyzer
13. error-severity-classifier
14. error-trend-analyzer
15. error-triage-agent
16. api-rate-limit-handler
17. callgear-error-handler
18. meta-error-handler
19. system-health-check
20. integration-health

FOR EACH FUNCTION:
Add the observability import and wrap with withTracing.
Use tags: ["error-handling", "monitoring"]

COMMIT AND PUSH:
git add -A  
git commit -m "feat: Add tracing to Error handling functions"
git push origin claude/trace-error-functions

CREATE PR:
gh pr create --title "feat: Add tracing to Error handling functions" --body "Instruments error handling and monitoring functions" --base main
```

---

# ═══════════════════════════════════════════════════════════════
# AGENT 5: REMAINING FUNCTIONS (25 functions)
# ═══════════════════════════════════════════════════════════════

```
You are working on the GitHub repository: milosriki/client-vital-suite

TASK: Add LangSmith tracing to remaining edge functions

SETUP:
1. Clone the repo: git clone https://github.com/milosriki/client-vital-suite.git
2. cd client-vital-suite
3. git checkout -b claude/trace-remaining-functions
4. Pull latest: git pull origin main

FUNCTIONS TO INSTRUMENT (25):
1. anytrack-webhook
2. calculate-health-scores
3. calendly-webhook
4. callgear-icp-router
5. callgear-live-monitor
6. callgear-sentinel
7. callgear-supervisor
8. coach-analyzer
9. daily-report
10. data-quality
11. fetch-callgear-data
12. fetch-facebook-insights
13. fetch-forensic-data
14. generate-embeddings
15. health-calculator
16. marketing-stress-test
17. openai-embeddings
18. pipeline-monitor
19. process-knowledge
20. ptd-24x7-monitor
21. ptd-watcher
22. run-migration
23. smart-coach-analytics
24. super-agent-orchestrator
25. verify-all-keys

FOR EACH FUNCTION:
Add the observability import and wrap with withTracing.
Use appropriate tags based on function type.

COMMIT AND PUSH:
git add -A
git commit -m "feat: Add tracing to remaining utility functions"
git push origin claude/trace-remaining-functions

CREATE PR:
gh pr create --title "feat: Add tracing to remaining functions" --body "Instruments remaining utility and webhook functions" --base main
```

---

## 📊 SUMMARY

| Agent | Category | Functions | Branch |
|-------|----------|-----------|--------|
| 1 | AI/Intelligence | 20 | claude/trace-ai-functions |
| 2 | Stripe/Payments | 18 | claude/trace-stripe-functions |
| 3 | HubSpot/CRM | 15 | claude/trace-hubspot-functions |
| 4 | Error Handling | 20 | claude/trace-error-functions |
| 5 | Remaining | 25 | claude/trace-remaining-functions |
| **TOTAL** | | **98** | |

## ⚡ AFTER ALL AGENTS COMPLETE

1. Merge all 5 PRs to main
2. Run Supabase migration: `supabase db push`
3. Deploy edge functions: `supabase functions deploy`
4. Verify in LangSmith dashboard

