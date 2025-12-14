# AI Agent Prompt Quality Analysis & Ratings

## Current System Flow

```
User Query (Voice/Text)
    ↓
Frontend Components
├── VoiceChat.tsx
├── FloatingChat.tsx
└── AIAssistantPanel.tsx
    ↓
Agent Selection
├── ptd-agent-claude (Claude Sonnet 4)
├── ptd-agent-gemini (Gemini 2.5 Flash)
├── ptd-ultimate-intelligence (Multi-persona)
├── smart-agent (LangChain-style)
└── ptd-agent (Simple, formula-based)
    ↓
Knowledge Retrieval Layer
├── Memory (vector search via embeddings)
├── RAG (knowledge_documents table)
├── Learned Patterns (agent_patterns table)
└── Dynamic Knowledge (business context)
    ↓
Tool Execution Layer
├── client_control (health, calls, deals)
├── lead_control (search, score, track)
├── stripe_control (fraud, payments)
├── hubspot_control (sync, contacts)
├── analytics_control (dashboards)
├── call_control (transcripts, patterns)
├── intelligence_control (AI functions)
└── universal_search (cross-table search)
    ↓
Specialized Agents (Parallel Processing)
├── churn-predictor
├── intervention-recommender
├── business-intelligence
└── generate-lead-replies
    ↓
Response + Memory Storage
└── agent_memory table (with embeddings)
```

---

## Prompt Quality Ratings (1-10 Scale)

### 🏆 Tier 1: Excellent (8-10/10)

#### 1. `ptd-agent-gemini` - **Rating: 9/10** ⭐⭐⭐⭐⭐

**Strengths:**
- ✅ **Excellent chain-of-thought reasoning** (5-step mandatory process)
- ✅ **Tool selection matrix** (query type → tool mapping)
- ✅ **Tool chaining rules** (start broad → get specific → add context → validate)
- ✅ **Clear "NEVER ASK FOR CLARIFICATION" rule** (proactive tool usage)
- ✅ **Universal search emphasis** (primary tool for lookups)
- ✅ **Response format with visible reasoning** (users see thought process)
- ✅ **Comprehensive HubSpot ID mappings** (translates IDs to names)
- ✅ **Good knowledge base integration** (RAG + memory + patterns)
- ✅ **Data enrichment strategy** (always check multiple sources)

**Weaknesses:**
- ⚠️ Prompt is very long (~2000 tokens) - could be optimized
- ⚠️ Some redundancy in instructions
- ⚠️ Could use more concrete examples

**Current Structure:**
```
1. Mission statement
2. Chain-of-thought reasoning (mandatory 5 steps)
3. Smart tool usage strategy
4. Tool selection matrix
5. Tool chaining rules
6. Critical behavior rules (4 rules)
7. HubSpot data mappings
8. Knowledge base sections (RAG, memory, patterns)
9. Response format template
10. Mandatory instructions (8 points)
```

**Token Usage:** ~2000 tokens (system prompt)

**Recommendations:**
- Condense redundant sections
- Add more concrete examples
- Optimize token usage (target: ~1500 tokens)

---

### 🥈 Tier 2: Very Good (7-8/10)

#### 2. `ptd-agent-claude` - **Rating: 8/10** ⭐⭐⭐⭐

**Strengths:**
- ✅ **Good tool definitions** (9 tools, clear schemas)
- ✅ **Memory + RAG integration** (vector search + keyword fallback)
- ✅ **Anti-hallucination rules present** (data verification)
- ✅ **Clear "ALWAYS USE LIVE DATA" instruction**
- ✅ **Good system knowledge base structure**
- ✅ **Learned patterns integration** (auto-detected patterns)
- ✅ **Tool execution logic** (parallel tool calls)

**Weaknesses:**
- ⚠️ **Missing chain-of-thought reasoning** (no step-by-step thinking)
- ⚠️ **No explicit response format** (inconsistent outputs)
- ⚠️ **Tool descriptions could be more detailed** (usage examples missing)
- ⚠️ **No tool selection matrix** (agents must figure it out)

**Current Structure:**
```
1. System prompt (basic)
2. Critical: Always use live data
3. Uploaded knowledge documents (RAG)
4. System knowledge base (static)
5. Learned patterns
6. Memory from past conversations
7. Capabilities list
8. Mandatory instructions (6 points)
```

**Token Usage:** ~1200 tokens (system prompt)

**Recommendations:**
- Add chain-of-thought reasoning framework
- Add tool selection matrix
- Standardize response format
- Add tool usage examples
- Better error handling instructions

---

#### 3. `churn-predictor` - **Rating: 8/10** ⭐⭐⭐⭐

**Strengths:**
- ✅ **Clear calculation logic** (factor-based scoring)
- ✅ **Risk categories defined** (CRITICAL, HIGH, MEDIUM, LOW)
- ✅ **Good structure** (factors → score → category → actions)
- ✅ **Comprehensive factor analysis** (6 major factors)

**Weaknesses:**
- ⚠️ **No AI prompt** (just calculations, no AI analysis layer)
- ⚠️ **Could add AI insights** (root cause analysis)
- ⚠️ **No business context** (doesn't consider client history)

**Current Structure:**
```
1. Calculation functions only
2. Factor-based scoring
3. Risk categorization
4. No AI prompting
```

**Token Usage:** ~0 tokens (no AI prompt)

**Recommendations:**
- Add AI analysis layer with Claude/Gemini
- Add business context (client history, coach, package)
- Add root cause analysis
- Add intervention recommendations

---

### 🥉 Tier 3: Good (6-7/10)

#### 4. `ptd-ultimate-intelligence` - **Rating: 7/10** ⭐⭐⭐

**Strengths:**
- ✅ **Excellent persona definitions** (5 personas: ATLAS, SHERLOCK, REVENUE, HUNTER, GUARDIAN)
- ✅ **Good anti-hallucination rules** (comprehensive)
- ✅ **Dynamic business context builder** (real-time metrics)
- ✅ **Persona router logic** (intelligent selection)
- ✅ **Model selection** (Claude for reasoning, Gemini for speed)

**Weaknesses:**
- ⚠️ **No tool usage** (personas can't execute tools)
- ⚠️ **Limited agentic loop** (single response, no iteration)
- ⚠️ **No memory/RAG integration** (missing knowledge retrieval)
- ⚠️ **Persona prompts could be more structured** (varying quality)
- ⚠️ **No chain-of-thought** (personas don't show reasoning)

**Current Structure:**
```
1. Persona definitions (5 personas)
2. Anti-hallucination rules
3. Business context builder (dynamic)
4. Persona router (query → persona selection)
5. LLM generation (Claude or Gemini)
```

**Token Usage:** ~800-1200 tokens per persona

**Recommendations:**
- Add tool capabilities to personas
- Add memory/RAG per persona
- Add chain-of-thought reasoning
- Better persona-specific prompts
- Unified response format

---

#### 5. `smart-agent` - **Rating: 7/10** ⭐⭐⭐

**Strengths:**
- ✅ **Good tool definitions** (13 tools, clear descriptions)
- ✅ **Clear tool descriptions** (what each tool does)
- ✅ **Example usage patterns** (when user asks X → use tool Y)
- ✅ **Agentic loop implementation** (iterative tool calling)

**Weaknesses:**
- ⚠️ **Basic system prompt** (lacks depth)
- ⚠️ **No memory/RAG** (missing knowledge retrieval)
- ⚠️ **No anti-hallucination rules** (no data verification)
- ⚠️ **No chain-of-thought** (no reasoning framework)
- ⚠️ **Limited knowledge base** (just tool list)

**Current Structure:**
```
1. System coverage list
2. Available tools (13 tools)
3. When user asks examples
4. Important notes
```

**Token Usage:** ~600 tokens (system prompt)

**Recommendations:**
- Add memory/RAG integration
- Add anti-hallucination rules
- Add chain-of-thought reasoning
- Better knowledge base
- Tool selection matrix

---

#### 6. `intervention-recommender` - **Rating: 7/10** ⭐⭐⭐

**Strengths:**
- ✅ **Clear intervention types** (6 types defined)
- ✅ **Selection logic** (health zone → intervention type)
- ✅ **Psychological insights** (personality-based)
- ✅ **Success probability** (scoring system)

**Weaknesses:**
- ⚠️ **Basic AI prompt** (if used, very simple)
- ⚠️ **No memory of past interventions** (doesn't learn)
- ⚠️ **No success tracking** (can't improve)
- ⚠️ **Limited personalization** (basic rules only)

**Current Structure:**
```
1. Intervention type definitions
2. Selection function (rules-based)
3. Basic prompt template (if AI used)
```

**Token Usage:** ~200 tokens (if AI used)

**Recommendations:**
- Add intervention history tracking
- Add success rate learning
- Better AI prompt structure
- More personalization
- Add business context

---

### ⚠️ Tier 4: Needs Improvement (5-6/10)

#### 7. `ptd-agent` (Simple) - **Rating: 6/10** ⭐⭐

**Strengths:**
- ✅ **Clear knowledge base formulas** (health score, engagement, etc.)
- ✅ **Dashboard state integration** (live data)
- ✅ **Formula-based approach** (deterministic)

**Weaknesses:**
- ⚠️ **No tool usage** (can't query data)
- ⚠️ **Limited agentic capabilities** (no iterative reasoning)
- ⚠️ **No memory/RAG** (missing knowledge retrieval)
- ⚠️ **Basic prompt structure** (formula list only)
- ⚠️ **No anti-hallucination rules** (no data verification)

**Current Structure:**
```
1. Knowledge base formulas
2. Dashboard state (live data)
3. Conversation history
4. Successful decisions
```

**Token Usage:** ~800 tokens (system prompt)

**Recommendations:**
- Add tool capabilities
- Add memory/RAG integration
- Add anti-hallucination rules
- Better structure
- Add chain-of-thought

---

#### 8. `business-intelligence` - **Rating: 6/10** ⭐⭐

**Strengths:**
- ✅ **Data-driven approach** (queries real data)
- ✅ **Stale data detection** (warns if data old)
- ✅ **Clear output format** (JSON structure)

**Weaknesses:**
- ⚠️ **Very basic AI prompt** (just data summary)
- ⚠️ **No deep analysis** (surface-level only)
- ⚠️ **No recommendations** (just reports facts)
- ⚠️ **Limited context** (no business knowledge)

**Current Prompt:**
```
You are the COO of PTD Fitness. Analyze yesterday's business performance.

DATA CONTEXT:
[metrics listed]

OUTPUT FORMAT (JSON):
{executive_summary, system_status, data_freshness, action_plan}
```

**Token Usage:** ~300 tokens (system prompt)

**Recommendations:**
- Add deeper analysis framework
- Add trend analysis
- Add recommendations with impact
- Better prompt structure
- Add business context

---

#### 9. `generate-lead-reply` - **Rating: 5/10** ⭐

**Strengths:**
- ✅ **Simple, focused task** (one job: generate SMS)
- ✅ **Clear rules** (character limit, question ending)

**Weaknesses:**
- ⚠️ **Very basic prompt** (minimal instructions)
- ⚠️ **No context about lead history** (doesn't know past interactions)
- ⚠️ **No personalization beyond name** (generic approach)
- ⚠️ **No A/B testing** (can't learn what works)
- ⚠️ **No success tracking** (can't improve)

**Current Prompt:**
```
You are a senior fitness consultant at PTD Fitness. Draft a short, personalized, and high-converting SMS reply for a new lead.

LEAD DETAILS:
Name: [name]
Goal: [goal]
Budget: [budget]

RULES:
- Keep it under 160 characters if possible.
- End with a question to encourage response.
- Be friendly but professional.
- If budget is high (>15k), mention premium/exclusive coaching.
- If budget is not specified, keep it general.

Reply with ONLY the SMS text, no quotes or explanation.
```

**Token Usage:** ~150 tokens (system prompt)

**Recommendations:**
- Add lead history context
- Add conversion data (what works)
- Add personalization rules (source, profile)
- Better prompt structure
- Add success tracking

---

#### 10. `ai-ceo-master` - **Rating: 6/10** ⭐⭐

**Strengths:**
- ✅ **Persona definitions** (5 personas)
- ✅ **Multiple personas** (different roles)

**Weaknesses:**
- ⚠️ **Very short prompts** (minimal detail)
- ⚠️ **No tools** (can't execute actions)
- ⚠️ **No memory/RAG** (missing knowledge)
- ⚠️ **Basic implementation** (simple generation)

**Current Structure:**
```
1. Short persona prompts (3-5 lines each)
2. No tool usage
3. Basic generation
```

**Token Usage:** ~200 tokens per persona

**Recommendations:**
- Expand persona prompts
- Add tools to personas
- Add memory/RAG
- Better structure
- Add chain-of-thought

---

## Summary Ratings Table

| Agent | Rating | Strengths | Critical Missing |
|-------|--------|-----------|------------------|
| `ptd-agent-gemini` | **9/10** | Chain-of-thought, tool matrix, proactive | Token optimization |
| `ptd-agent-claude` | **8/10** | Tools, memory/RAG, anti-hallucination | Chain-of-thought, tool matrix |
| `churn-predictor` | **8/10** | Clear logic, risk categories | AI analysis layer |
| `ptd-ultimate-intelligence` | **7/10** | Personas, anti-hallucination | Tools, memory/RAG |
| `smart-agent` | **7/10** | Good tools, agentic loop | Memory/RAG, anti-hallucination |
| `intervention-recommender` | **7/10** | Clear types, selection logic | Memory, success tracking |
| `ptd-agent` | **6/10** | Formulas, dashboard | Tools, memory/RAG |
| `business-intelligence` | **6/10** | Data-driven, format | Deep analysis, recommendations |
| `generate-lead-reply` | **5/10** | Simple, focused | Context, personalization |
| `ai-ceo-master` | **6/10** | Personas | Tools, memory, depth |

---

## Best Practices Identified

### What Makes a 9-10/10 Prompt:

1. **Chain-of-Thought Reasoning** ✅
   - Step-by-step thinking process
   - Visible reasoning steps
   - Clear analysis framework

2. **Tool Selection Matrix** ✅
   - Query type → Tool mapping
   - Tool chaining rules
   - Usage examples

3. **Anti-Hallucination Rules** ✅
   - Data verification requirements
   - Citation requirements
   - Confidence levels
   - Fact vs inference distinction

4. **Memory + RAG Integration** ✅
   - Past conversations
   - Knowledge documents
   - Learned patterns
   - Dynamic knowledge

5. **Clear Response Format** ✅
   - Structured output
   - Reasoning visible
   - Data sources cited
   - Actionable recommendations

6. **Proactive Behavior** ✅
   - Never ask for clarification
   - Try first, ask later
   - Universal search emphasis

---

## Unified Prompt Architecture

### Core Components (All Agents Should Have):

1. **Base System Prompt**
   - Mission statement
   - Business context
   - Core capabilities
   - Anti-hallucination rules

2. **Knowledge Integration Layer**
   - Memory (past conversations)
   - RAG (knowledge documents)
   - Learned patterns
   - Dynamic knowledge

3. **Reasoning Framework**
   - Chain-of-thought steps
   - Tool selection logic
   - Data verification process

4. **Tool Definitions**
   - Clear descriptions
   - Usage examples
   - Tool chaining rules
   - Error handling

5. **Response Format**
   - Structured output
   - Reasoning visible
   - Sources cited
   - Actions recommended

---

## Next Steps

1. ✅ **Created:** `src/lib/prompt-library.ts` - Unified prompt components
2. **Next:** Update `ptd-agent-claude` to use unified library
3. **Next:** Optimize `ptd-agent-gemini` token usage
4. **Next:** Add tools to `ptd-ultimate-intelligence`
5. **Next:** Enhance specialized agents with better prompts

---

**Status:** Phase 1 Complete - Unified Prompt Library Created ✅
