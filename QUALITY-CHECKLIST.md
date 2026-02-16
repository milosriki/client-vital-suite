# Quality Checklist — Enterprise Grade (Vercel Best Practices)

Run after each PRD completion, before deploy.

## 1. Build Verification
- [ ] `npx tsc --noEmit` — zero type errors
- [ ] `npm run build` — clean Vite build
- [ ] No `any` type casts unless absolutely necessary (check `as any` usage)

## 2. Data Integrity
- [ ] No hardcoded arrays that should be queries
- [ ] No fake names (John Smith, Sarah Johnson, etc.)
- [ ] Coaches page shows 31 real coaches (not 6 or 13)
- [ ] Clients page distinguishes active (126) from total customers (504)
- [ ] Empty states handled gracefully (not blank pages)
- [ ] Loading skeletons on all query-dependent sections

## 3. Async Patterns (CRITICAL impact)
- [ ] `async-parallel`: Independent queries use `Promise.all()` not sequential await
- [ ] `async-defer-await`: Await moved to branches where actually used
- [ ] No request waterfalls in queryFn callbacks

## 4. Re-render Optimization (MEDIUM impact)
- [ ] `rerender-derived-state-no-effect`: No useState+useEffect for derived values
- [ ] `rerender-memo`: Expensive computations extracted to memoized components
- [ ] `rerender-functional-setstate`: Callbacks use functional setState
- [ ] `rerender-lazy-state-init`: Expensive initial values use lazy init

## 5. Error Handling
- [ ] Every useQuery has error state handling
- [ ] Edge function invocations handle non-200 responses
- [ ] Network failures show user-friendly messages (not raw errors)

## 6. Supabase Patterns
- [ ] Queries use proper `.select()` — no `select(*)` unless needed
- [ ] Pagination for large result sets (contacts: 10K+, deals: 19K+, calls: 31K+)
- [ ] Realtime subscriptions have cleanup in useEffect return
- [ ] Service role key NEVER exposed in client code

## 7. Live Verification
- [ ] Every page route loads without runtime errors
- [ ] Every page shows real data (not empty or mock)
- [ ] Dashboard navigation works between all pages
- [ ] Browser console has no uncaught errors
