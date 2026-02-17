# Design & Performance Overhaul — Execution Plan

Created: 2026-02-17
Status: IN PROGRESS

## Phase 1: Contrast & Typography (Target: 1h)
### Problem
- 1,134+ low-contrast text instances (text-slate-400/500, text-muted-foreground on OLED black)
- WCAG AA requires 4.5:1 contrast ratio; current ~2.5:1 on many elements
- Inconsistent typography hierarchy across pages

### Fix Strategy
1. **CSS variable approach** — bump `--muted-foreground` from `215 20% 65%` to `215 20% 75%` (single change fixes ~1,058 `text-muted-foreground` instances)
2. **Replace text-slate-400** → `text-slate-300` (98 instances)
3. **Replace text-gray-400** → `text-gray-300` where used
4. **Card borders**: `rgba(255,255,255,0.06)` → `rgba(255,255,255,0.12)` (double visibility)
5. **Typography hierarchy**: h1=white, h2=slate-100, h3=slate-200, body=slate-300, muted=slate-400 (not 500)

### Files
- `src/index.css` — CSS variables (1 change)
- `tailwind.config.ts` — enterprise.border color
- ~50 .tsx files with hardcoded `text-slate-400`

## Phase 2: Bundle Surgery (Target: 2h)
### Problem
- Main bundle: 1,309KB (401KB gzip)
- No code splitting beyond route-level
- Recharts: ~350KB shared chunk (loaded on every page)
- SalesPipeline: 163KB single chunk (606 lines)
- lucide-react barrel imports

### Fix Strategy
1. **Vite manualChunks** in vite.config.ts:
   - `vendor-ui`: @radix-ui/* 
   - `vendor-charts`: recharts
   - `vendor-query`: @tanstack/react-query + react-table
   - `vendor-supabase`: @supabase/supabase-js
   - `vendor-motion`: framer-motion
2. **Lazy load chart-heavy pages**: SalesPipeline, RevenueIntelligence, MarketingIntelligence, CommandCenter, CampaignMoneyMap
3. **Route-level React.lazy + Suspense** with skeleton fallbacks
4. **Remove server-only deps from client bundle**: pg, stripe, @hubspot/api-client, @vercel/node, dotenv, gray-matter, axios
5. **Tree-shake Recharts**: Import only used components (BarChart, LineChart, PieChart, etc.)

### Files
- `vite.config.ts` — manualChunks + external
- `src/App.tsx` — React.lazy routes
- `src/pages/SalesPipeline.tsx` — split into 5 components
- Package.json — move 6 deps to devDependencies

## Phase 3: UX Polish (Target: 2h)
### Problem
- 37 nav items (overwhelming)
- No page transitions
- Inconsistent card layouts across pages
- No loading skeletons (just spinners)

### Fix Strategy
1. **Navigation consolidation**: 37 → ~15 items with grouping
2. **Page transition wrapper**: framer-motion AnimatePresence on route changes
3. **Skeleton components**: Reusable DashboardSkeleton, TableSkeleton, ChartSkeleton
4. **Card grid standardization**: Consistent 2-col, 3-col, 4-col layouts
5. **Responsive breakpoints**: Verify all pages at 1024, 1280, 1440, 1920px

## Phase 4: Smart Defaults (Target: 1h)
### Problem
- No prefetching
- No progressive loading
- All queries fire on mount

### Fix Strategy
1. **TanStack Query defaults**: staleTime 5min, gcTime 30min, refetchOnWindowFocus false
2. **Prefetch on nav hover**: queryClient.prefetchQuery on link hover
3. **Progressive loading**: Above-fold content first, charts lazy
4. **Realtime consolidation**: 35 subscriptions → <10 (batch by table)
