# 🤖 Complete Agent & Function Inventory

**Total:** 70+ Edge Functions  
**Status:** All independent (serverless, no MCP/Cursor dependency)

---

## 📊 Categories

### 1. **AI Agents** (11 functions)
| Function | Purpose | API Route Needed? |
|----------|---------|-------------------|
| `ptd-agent-gemini` | Main Gemini AI agent | ✅ `/api/agent` (exists) |
| `ptd-agent-claude` | Claude AI agent | ✅ `/api/agent` (exists) |
| `ptd-agent` | Legacy agent | ✅ `/api/agent` (exists) |
| `ptd-ultimate-intelligence` | Ultimate intelligence system | ⚠️ Add to `/api/agent` |
| `ai-ceo-master` | CEO-level decision making | ⚠️ Add to `/api/agent` |
| `smart-agent` | LangChain-style agent | ⚠️ Add to `/api/agent` |
| `agent-orchestrator` | Multi-agent orchestration | ⚠️ Add to `/api/agent` |
| `super-agent-orchestrator` | Super orchestration | ⚠️ Add to `/api/agent` |
| `agent-analyst` | Business intelligence analyst | ⚠️ Add to `/api/agent` |
| `ptd-self-developer` | AI code generation | ⚠️ Add to `/api/agent` |
| `ptd-self-learn` | Self-learning system | ⚠️ Cron only |

---

### 2. **Health & Intelligence** (5 functions)
| Function | Purpose | API Route Needed? |
|----------|---------|-------------------|
| `health-calculator` | Calculate client health scores | ✅ Via cron |
| `churn-predictor` | Predict churn risk | ⚠️ Add `/api/intelligence` |
| `anomaly-detector` | Detect anomalies | ⚠️ Add `/api/intelligence` |
| `intervention-recommender` | Recommend interventions | ⚠️ Add `/api/intelligence` |
| `coach-analyzer` | Analyze coach performance | ⚠️ Add `/api/intelligence` |

---

### 3. **HubSpot Operations** (9 functions)
| Function | Purpose | API Route Needed? |
|----------|---------|-------------------|
| `hubspot-command-center` | Main HubSpot operations | ✅ `/api/hubspot` (just created) |
| `sync-hubspot-to-supabase` | Sync contacts/deals | ✅ Via `/api/hubspot` |
| `fetch-hubspot-live` | Real-time queries | ✅ Via `/api/hubspot` |
| `reassign-owner` | Change owner | ✅ Via `/api/hubspot` |
| `auto-reassign-leads` | Auto reassignment | ✅ Via cron |
| `hubspot-analyzer` | Lead analysis | ⚠️ Add to `/api/hubspot` |
| `hubspot-live-query` | Live queries | ✅ Via `/api/hubspot` |
| `sync-hubspot-data` | Lightweight sync | ✅ Via `/api/hubspot` |
| `sync-hubspot-to-capi` | Meta CAPI conversion | ✅ Via cron |

---

### 4. **Stripe Operations** (7 functions)
| Function | Purpose | API Route Needed? |
|----------|---------|-------------------|
| `stripe-dashboard-data` | Dashboard data | ⚠️ Add `/api/stripe` |
| `stripe-forensics` | Fraud detection | ⚠️ Add `/api/stripe` |
| `stripe-payouts-ai` | AI payout analysis | ⚠️ Add `/api/stripe` |
| `enrich-with-stripe` | Enrich data | ⚠️ Add `/api/stripe` |
| `stripe-history` | Historical data | ⚠️ Add `/api/stripe` |
| `stripe-payout-controls` | Payout controls | ⚠️ Add `/api/stripe` |
| `stripe-webhook` | Webhook receiver | ✅ Webhook only |

---

### 5. **Monitoring & Operations** (8 functions)
| Function | Purpose | API Route Needed? |
|----------|---------|-------------------|
| `ptd-24x7-monitor` | 24/7 monitoring | ✅ Cron only |
| `ptd-watcher` | Watch for issues | ✅ Cron only |
| `ptd-proactive-scanner` | Proactive scanning | ✅ Cron only |
| `daily-report` | Daily reports | ✅ Cron only |
| `data-quality` | Data quality checks | ⚠️ Add `/api/system` |
| `integration-health` | Integration health | ⚠️ Add `/api/system` |
| `pipeline-monitor` | Pipeline monitoring | ⚠️ Add `/api/system` |
| `proactive-insights-generator` | Generate insights | ✅ Cron only |

---

### 6. **CallGear Operations** (5 functions)
| Function | Purpose | API Route Needed? |
|----------|---------|-------------------|
| `callgear-sentinel` | Impersonation detection | ⚠️ Add `/api/callgear` |
| `callgear-supervisor` | Barge-in/Whisper | ⚠️ Add `/api/callgear` |
| `callgear-live-monitor` | Live monitoring | ⚠️ Add `/api/callgear` |
| `callgear-icp-router` | ICP routing | ⚠️ Add `/api/callgear` |
| `fetch-callgear-data` | Fetch data | ⚠️ Add `/api/callgear` |

---

### 7. **Meta/Facebook CAPI** (4 functions)
| Function | Purpose | API Route Needed? |
|----------|---------|-------------------|
| `send-to-stape-capi` | Send to Stape CAPI | ✅ Via cron |
| `process-capi-batch` | Batch processing | ✅ Via cron |
| `capi-validator` | Validate events | ⚠️ Add `/api/capi` |
| `fetch-facebook-insights` | Fetch insights | ⚠️ Add `/api/capi` |

---

### 8. **Knowledge & RAG** (4 functions)
| Function | Purpose | API Route Needed? |
|----------|---------|-------------------|
| `process-knowledge` | Process knowledge | ⚠️ Add `/api/knowledge` |
| `generate-embeddings` | Generate embeddings | ⚠️ Add `/api/knowledge` |
| `openai-embeddings` | OpenAI embeddings | ⚠️ Add `/api/knowledge` |
| `business-intelligence` | BI queries | ⚠️ Add `/api/intelligence` |

---

### 9. **Lead Management** (3 functions)
| Function | Purpose | API Route Needed? |
|----------|---------|-------------------|
| `generate-lead-reply` | Single reply | ⚠️ Add `/api/leads` |
| `generate-lead-replies` | Batch replies | ⚠️ Add `/api/leads` |
| `cleanup-fake-contacts` | Cleanup | ✅ Cron only |

---

### 10. **Webhooks** (4 functions)
| Function | Purpose | API Route Needed? |
|----------|---------|-------------------|
| `anytrack-webhook` | AnyTrack events | ✅ Webhook only |
| `hubspot-anytrack-webhook` | HubSpot+AnyTrack | ✅ Webhook only |
| `hubspot-webhook` | HubSpot webhooks | ✅ Webhook only |
| `calendly-webhook` | Calendly appointments | ✅ Webhook only |

---

### 11. **Specialized** (6 functions)
| Function | Purpose | API Route Needed? |
|----------|---------|-------------------|
| `marketing-stress-test` | 20 questions test | ⚠️ Add `/api/marketing` |
| `ultimate-truth-alignment` | Truth alignment | ⚠️ Add `/api/truth` (exists) |
| `verify-all-keys` | Verify API keys | ⚠️ Add `/api/system` |
| `ptd-execute-action` | Execute actions | ⚠️ Add `/api/actions` |
| `fetch-forensic-data` | Forensic data | ⚠️ Add `/api/forensics` |
| `smart-coach-analytics` | Coach analytics | ⚠️ Add `/api/intelligence` |

---

## 🎯 Priority API Routes to Create

### **High Priority** (Most Used)

1. **`/api/intelligence`** - Health, churn, anomalies, interventions
2. **`/api/stripe`** - Stripe operations
3. **`/api/system`** - System health, data quality, integrations

### **Medium Priority**

4. **`/api/callgear`** - CallGear operations
5. **`/api/leads`** - Lead reply generation
6. **`/api/knowledge`** - Knowledge base operations

### **Low Priority** (Cron/Webhook Only)

- Most monitoring functions (cron-only)
- Webhook receivers (webhook-only)
- Batch processors (cron-only)

---

## ✅ Already Independent (No Action Needed)

**These work via:**
- ✅ `/api/agent` - AI agents
- ✅ `/api/hubspot` - HubSpot operations (just created)
- ✅ `/api/truth` - Truth/query API (exists)
- ✅ `/api/memory` - Memory operations (exists)
- ✅ `/api/session` - Session management (exists)
- ✅ `/api/system-check` - System check (exists)

---

## 📝 Summary

**Total Functions:** 70+  
**Need API Routes:** ~20 functions  
**Already Independent:** 50+ functions  
**Cron/Webhook Only:** 15+ functions  

**Next Steps:** Create unified API routes for each category!

