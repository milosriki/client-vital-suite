# Deep Prompt — Full Context Evaluation (AI Engineer + Postgres + Code Review)

> Synthesizes: KNOWLEDGE.md, 10X-EVALUATION-REPORT, Context7 MCP, ai-engineer, postgres-best-practices

---

## 1. North Star

**"Which ad made me money?"** — Unanswerable until:
- Deal↔Stripe linked (deal_id → invoice_id)
- Call→ad linked (call_records + attribution_events)
- CAPI purchase_value sent to Meta

---

## 2. Critical Fixes (P0)

| Fix | File | Pattern (Context7) |
|-----|------|-------------------|
| snapshot.kpis crash | BusinessIntelligenceAI.tsx:182–193 | `(snapshot?.kpis?.totalRevenue ?? 0).toLocaleString()` |
| item.change NaN | MetricDrilldownModal.tsx:157 | `(item.change ?? 0)` before Math.abs |
| toFixed null | 10+ components | `(x ?? 0).toFixed(n)` everywhere |

**Postgres:** Use `COALESCE(col, 0)` in views for numeric display. Guard division: `CASE WHEN divisor = 0 THEN 0 ELSE num/divisor END`.

---

## 3. Edge Function Error Shape (Context7 /supabase/supabase)

```ts
try {
  const result = await processRequest(req);
  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  });
} catch (error) {
  console.error('Function error:', error);
  return new Response(JSON.stringify({ error: error.message }), {
    headers: { 'Content-Type': 'application/json' },
    status: 500,
  });
}
```

**Standard:** `{ ok?: boolean, data?: T, error?: { code: string, message: string } }`

---

## 4. Cancel Filter (AWS)

```sql
status LIKE 'Cancelled-%' AND status != 'Cancelled-Rebooked'
```

Never `status = 'Cancelled'` — returns 0 rows.

---

## 5. 10x Priorities (Ranked)

1. Attribution chain (Deal↔Stripe, call→ad) — ~AED 500K impact
2. Schema registry + Zod for all 144 functions
3. Context7 pre-bake into KNOWLEDGE.md; inject into agent prompts
4. Runtime null-safety layer
5. max_iterations=10 in agent loop
6. Source badge + freshness SLA
7. Standardized error shape
8. PowerBI views (vw_powerbi_schedulers, etc.)

---

## 6. Context7 Verification (MCP)

| Library | Query | Key Pattern |
|---------|-------|-------------|
| /supabase/supabase | Edge function error handling | try-catch, JSON `{ error }`, status 500 |
| /websites/postgresql | NULL handling | COALESCE, CASE WHEN divisor=0 |

---

## 7. Statistical Caveats

- MoM +100% when prev=0 → add "from zero" badge
- Churn rate = estimate (RED + 0.3*YELLOW), not actual
- ROAS per ad = Meta-reported only until attribution wired

---

## 8. Execution Checklist

- [ ] `npm run build` + `npx tsc --noEmit`
- [ ] No `.toFixed(` without `?? 0`
- [ ] No `snapshot.kpis` without `?.` and `??`
- [ ] New tables → update introspect_schema_verbose
- [ ] Read WIRING_ANALYSIS.md before new code
