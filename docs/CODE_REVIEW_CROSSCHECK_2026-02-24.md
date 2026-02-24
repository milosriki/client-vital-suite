# Code Review Cross-Check — 2026-02-24

## Scope
- Full stack review: `src`, `supabase/functions`, `supabase/migrations`, `api`, `backend`, `services`, `scripts`.
- Cross-checks: local vs git, git vs deployed, local vs deployed.
- Reverse engineering: compiled `dist` bundle analysis and asset inventory.

## Baselines
- Branch: `main`
- HEAD: `674a0163757b55b2b56abd8d97d6608af119b568`
- origin/main: `674a016 feat(audit): sync migrations and scripts [skip ci]`
- Working tree: clean (no local diffs)

## Local vs Git
- `origin/main...HEAD`: no diffs.

## Local Build + Asset Inventory
- Build command: `npm run build -- --sourcemap`
- Status: success
- Output: `dist/`
- `dist/index.html` SHA-256: `dde4466ea8719ab333ccc74948bed1180af66baa70c657416a0bf95c3a53fccd`

### Top Asset Sizes (bytes)
| Size | File |
| --- | --- |
| 450116 | `assets/vendor-charts-BHwiixh6.js` |
| 435787 | `assets/vendor-analytics-BlWQkg6Y.js` |
| 296710 | `assets/index-CfE0oQ3_.js` |
| 246827 | `assets/vendor-ui-BzITi9DB.js` |
| 211638 | `assets/vendor-data-B_EeY4q0.js` |
| 174500 | `assets/index-DyN-GwXz.css` |
| 121286 | `assets/vendor-motion-BYYpl-6f.js` |
| 109482 | `assets/MetaAds-DUd01-5O.js` |
| 97674 | `assets/vendor-forms-CjI3HiAd.js` |
| 65358 | `assets/MarketingIntelligence-NEey-_hB.js` |
| 63557 | `assets/vendor-react-ZKuZPCA7.js` |
| 51772 | `assets/SalesPipeline-BeE4kkx3.js` |
| 43026 | `assets/CallTracking-Cyz-sHR8.js` |
| 35472 | `assets/CoachLocations-DJO4CPGI.js` |
| 34503 | `assets/RevenueIntelligence-C9Q5UYAk.js` |

### Asset Hash Manifest (JS/CSS)
```
ce243cbb41ec9c73eefe947bf53d951a5b99e13f5d419163d1b238c8e7092595  assets/AIAdvisor-Bj2CI0cg.js
1d7714f5cfa4faa710cefd9626f3df6bf4097eeba418d03e8d9c4511a494b587  assets/AlertCenter-Co9DJDeb.js
17c95e001985353e7d8f7a7afc8d9622e66905a5f1d65fc966bc9e8902f78c29  assets/AuditTrail-7HEQwPGs.js
3da1e9af5e6fe5a6f4ef61f287baccfd54ce8592d9d18eae666e756f46607cf3  assets/BusinessIntelligenceAI-D20qr7hS.js
3ab521662792595b5910a8151d60129a2c14d25379941a0d65492ef35a4059bb  assets/CallAnalytics-Bv5QAysT.js
2d1714711ece6f616ba3d2a7001495785fe58a221ab8c38e3abd8c701962068f  assets/CallTracking-Cyz-sHR8.js
c88c3b8df5bfa97d60b2831f04a87e0c67241cd5dcbe4a24eb644a26350ff556  assets/ClientActivity-CUzYwNgG.js
63dc6c36a978913ba806feb7bf6ba4d69e72886b81e197fa15ae033e3740c5f9  assets/ClientDetail-Cur_g6Jr.js
b4d8ba1b493c20cc0547ce3ccb02e941c9833a8f3ecbdb461e766a626f0389d0  assets/ClientHealth-D4qGpomj.js
216100187672cc59537653eeb3ebfc430d7cd9ba118cce9c2d1cb60d5a3904d2  assets/Clients-CsUARJq_.js
5b24f5536237533fe0b6ae5d1ab1f31e3e9e096c940e9170160819624a6c8b0a  assets/CoachLocations-DJO4CPGI.js
fbc9555aa6f3c3ff7c4e0357e825ed4f6c3eb90814b42bd3f9328dca518176ce  assets/CoachPerformance-DMo1VPsb.js
1f32bbe43558064304c94d40fb07b2c12f27d125c8da77a58b5ae8756cb1fb8e  assets/Coaches-fHYXgNvQ.js
19d1e7549ad6f690037dcefeeee981da59991806d351516361ce9c1b8e3f063c  assets/CommandCenter-yJHrgxwB.js
4a0f3d6807230ae2f0b2769946156e7154cd7401a85b4af5127032e09846af19  assets/ConversionFunnel-HYYqKNuK.js
a025af6db1a4d114e867df1b5cd970a22cd6b37ee92fb4c736f0274b0d8408f9  assets/DailyOps-CK7plVf2.js
b36959ca850775882b22c5fdc651e9918f73caf23c92e1960a533a7cf696770e  assets/DashboardHeader-C2ecfNOC.js
1e030d030c008adcce67d3cdf45dc5ccfb5aac0cd9b87ba8fb61d5ee0ce7e50a  assets/DataTableCard-B4vKpZ1Q.js
dea004311990229009c52bd93fa8296a2577c1154a869db0130abb8b87d2297c  assets/EnterpriseStrategy-DhE-7LrI.js
0364fed051926a7aacfd4ec6373980958af2c869c1c19e7074dde6c359b4dfb8  assets/ExecutiveOverview-BfbKjaN0.js
925028229de4c13e85268948872215ff05e67643cb76b6dcdb6a1cce368f55ab  assets/GlobalBrain-Di7A8EwA.js
d9287354fb7579015feba2e69e278e2473cb1739c89f38d75dd4a05fe5e4ea53  assets/Interventions-75Jet11-.js
24f669a97fe5aa82eeac32eb760521b9f6dfa30e74ffe3db6d7d58de7a400818  assets/KnowledgeBase-BypQ-IM9.js
689caff7efb58d0e83d6a3fd4bb3d36efccb31d9123cfcc56650653784204c2e  assets/LeadTracking-DTCBETkG.js
490cc9a99733f5ca238293e9a90c8409010f2b892b15f84a52995fb901d44725  assets/MarketingIntelligence-NEey-_hB.js
bbe41c199ad4d8130348e50a83e6b6c5d6322e60cd5ce2b2052e8639d404c40b  assets/MetaAds-DUd01-5O.js
b61a56785f0cd9696d37a95295a40a631fa5a90094c310f71975afad6755a335  assets/MetricCard-tEAWIihO.js
d3777150b8031c80b26896e329ffc4efaeb6d5e1ea0c3b34b1be08c24d484a86  assets/PredictiveIntelligence-BxA8Ixf2.js
f1e75634a185cd70bb31d5cf9a2bf9afbdea6b91fa52ca729b94d227b6882c80  assets/RevenueIntelligence-C9Q5UYAk.js
042f682baa618fe42d60147426fb60662753ef596fa6109659ea6cabe90c1669  assets/SalesCoachTracker-BjANJeI6.js
e4419e96847df8d00678db64a11ee06edaa0db4ef467937f07ae50413cc01b26  assets/SalesPipeline-BeE4kkx3.js
defb35f5815447c225105ef6851e74dc310b71e99df37382659fb1f443afd25e  assets/SetterCommandCenter-BvPkIrF0.js
bf8c3cd47c4633c740fd1e07cbd8b8c0d9da3b5679310650731dc0dee6c463ff  assets/SkillCommandCenter-n7WyXkIe.js
526a7c7960e679141c8ec98315565d39d05a69f3fbb85a520fb0838427de39fb  assets/StatusBadge-ThbqYBy9.js
a95bbc0ee51d6ef070075df1e4fb03e6b6436681737cac155e7585ff8feb2b88  assets/SystemObservability-Ca3CByQe.js
9446e027dbb59f2cbf19d6a7b29283e4bcb7a979c458de02f2faf921c2e477fd  assets/WarRoom-667F1TlY.js
9f110495728c5fc9c1c0d5d465ef03495afe47bda1f3cd781397b1b2b51b3792  assets/chartColors-BmYArI8w.js
d90e601aca8bc16c64c9b76118e19f4c445be698e0727932c6ce41323bad9e9b  assets/date-utils-ftjVz9ia.js
092663c09835d2571547431ddb1caeedccc54d2b86135a5718f1497b6170960f  assets/dealStages-C7hLRChW.js
6142db428e800bccbadb9378df8a282a334b2164dcf9494abbd83a2788829a4c  assets/dialog-DZqpfmAi.js
7c5f4efb42d2ccc10170ffb370e3b335073f6078e9d5a8a822799d046022144a  assets/index-CfE0oQ3_.js
1f83c0cc376ddee83175b758fc72f5072363de3232d0334692c3ecaeb8c09ea0  assets/index-DyN-GwXz.css
d51dd2d51a11751f23c5d520719e6dc1046308d6540eb5968bc0e40ab9108aa9  assets/progress-U1ZE82so.js
54be46b11fe9f199a8aba54cd7b9de46b19792751ce29828b2c98699c6cf7c8f  assets/select-vLPxnyjQ.js
e3b784f89e8f022283d95ad2438b93378c6d6473a1f98d28c798fa7adff50e11  assets/table-3q5ho5B4.js
bcc75ad7e411f2829d5db21a9529641301e906fe57f923440f0e72edf05b292b  assets/tabs-B980FaHp.js
d0571de41e705b70482ffc3a621021e599c7f152c6993d479a56873b6da86dba  assets/textarea-CNit6UpO.js
9ba7943ba3654a28d6c2edb837648ab10028939ab92c24b2b3eacdb00620ebf1  assets/useDailyOps-Bi49a_L2.js
417fdbcd4b6738940621c0cf8c3886eb9f3ec61075e4c0ecf157fe81a229bdbe  assets/vendor-analytics-BlWQkg6Y.js
1884f4f3fe341f778d1a1861aff6e14a1be82953b863be04680405f858602a64  assets/vendor-charts-BHwiixh6.js
2f4e8fece0d34495713f1f3fe80530f920acb7b0603bcb10fee2fa106e36dc18  assets/vendor-data-B_EeY4q0.js
3b7a7766ad89339369c8cde70806c04a0c7ae0a97ee89166b525decf9011b469  assets/vendor-forms-CjI3HiAd.js
de146dee33d5b48373caa1bf12d9548f6a4bb762127c04f9ac15209a4b351e02  assets/vendor-motion-BYYpl-6f.js
633107a9fd177d8454473823f293d11ef75bebb9d2af0940e990bcb93a919521  assets/vendor-react-ZKuZPCA7.js
6f5186bd8f49d55f39241d5b9aa5e89c24d6022a5533eab71b8ed2d946971cd6  assets/vendor-ui-BzITi9DB.js
8e35d8b8dd34d4cd4ad357fd6bc714058b49155004d0102901c3af7a10781c30  assets/x-ray-tooltip-CjheTxu7.js
```

### Public Docs Shipped
The following files are in `public/docs` and are copied into `dist/docs` (publicly accessible if deployed):
- `public/docs/HubSpot_Automation_Analysis_Report.md`
- `public/docs/Implementation_Guide.md`
- `public/docs/PTD_HubSpot_Key_Findings.md`
- `public/docs/contact_property_audit.csv`

## Reverse Engineering Notes (Compiled Output)
- Route map is embedded in `dist/assets/index-CfE0oQ3_.js` and matches the router setup in `src/main.tsx`.
- Lazy-loaded chunks exist for all major pages (`ExecutiveOverview`, `RevenueIntelligence`, `Clients`, `Coaches`, `GlobalBrain`, etc.).
- The compiled bundle exposes console helpers `window.testFunction`, `window.testAllFunctions`, `window.quickTest`, `window.verifyConnections`, `window.verifySupabase` in production builds because `src/utils/testFunctions.ts` and `src/utils/verifyBrowserConnection.ts` assign them unconditionally on module load.
- Supabase Edge Function invocations are embedded in the client bundle and use the project URL `https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/*`.
- PostHog key in local build is `phc_placeholder_key` and Sentry DSN resolves to `undefined` unless `VITE_SENTRY_DSN` is set.

## Deployed Asset Capture
- Local shell cannot resolve `client-vital-suite.vercel.app` (DNS blocked), so deployed HTML/assets could not be fetched for hash/size comparison.
- This blocks `git vs deployed` and `local vs deployed` verification in this environment.

## Lint and Test Results
### Lint
- `npm run lint` failed with 3206 problems (3142 errors, 64 warnings).
- Root cause: ESLint scans non-product folders (`.agent`, `.gemini`, `.worktrees`) plus real errors in `supabase/functions` and tests.
- Representative errors in repo code:
  - `supabase/functions/system-health-check/index.ts` uses `any` (line 238).
  - `supabase/functions/validate-truth/index.ts` uses `@ts-ignore` and `any`.
  - `tailwind.config.ts` uses `require()` import.

### Unit Tests
- `npm test` failed: 13 failed, 9 passed, 22 total suites.
- Key failures:
  - `tests/response-parser.test.ts`: `supabase/functions/_shared/response-parser.ts` imports `./smart-prompt.ts` with `.ts` extension (TS5097).
  - `tests/smart-pause.test.ts`: timing expectation mismatch (avg over/under 30 words = 0).
  - `tests/MarketingAnalytics.test.tsx`: missing module `src/pages/MarketingAnalytics`.
  - `tests/smart-prompt.test.ts`: expected phase marker missing.
  - `tests/pages/GlobalBrain.test.tsx`: `getPtdInternalHeaders` not a function at runtime.
  - `tests/pages/SkillCommandCenter.test.tsx`: UI expectations not met.
  - `tests/AttributionLeaks.test.tsx`: UI values not rendered within waitFor.
  - `tests/Observability.test.tsx`: `act(...)` warnings and timeout in archived page.

### E2E Tests
- `npm run test:e2e` failed: Playwright could not start dev server (`listen EPERM :::8080`).

## Findings (Severity Ordered)
### High
1. **Debug/test helpers exposed in production bundle**
   - `src/utils/testFunctions.ts:96-100` and `src/utils/verifyBrowserConnection.ts:128-131` attach helpers to `window` unconditionally. This enables anyone with browser access to invoke internal Supabase functions if those functions are not strictly protected.
2. **Internal key compiled into the client**
   - `src/config/api.ts:103-113` and `src/lib/serverMemory.ts:8-16` use `VITE_PTD_INTERNAL_ACCESS_KEY`, which is exposed to the browser and bundled. If this key gates internal APIs, it is not secret in production.

### Medium
1. **Public docs bundled for production**
   - Files under `public/docs` (HubSpot audit reports and CSV) are shipped to `dist/docs`. If these are internal-only, this is a data exposure risk.
2. **Unauthenticated functions in Supabase config**
   - `supabase/config.toml` sets `verify_jwt = false` for `system-health-check`, `antigravity-followup-engine`, and multiple webhook endpoints. Ensure all such endpoints validate signatures and enforce rate limits.
3. **ESLint scope includes non-product directories**
   - Lint results are dominated by `.agent`, `.gemini`, and `.worktrees` paths, hiding real issues and breaking CI if lint is enforced.

### Low
1. **Sentry/PostHog not configured in local build**
   - Local build defaults to undefined DSN and placeholder PostHog key. If these are expected, fine; otherwise, configure per environment.
2. **E2E server port permission**
   - Playwright dev server failed to bind `:::8080` in this environment; CI or a different port may be needed for local runs.

## Recommended Remediations (Short List)
- Gate `window.*` debug helpers behind `import.meta.env.DEV` or remove from production bundles.
- Move any internal keys to server-only env variables; do not expose in `VITE_*` settings.
- Review `public/docs` contents and remove/move any sensitive materials.
- Update ESLint config to ignore `.agent/`, `.gemini/`, `.worktrees/`, and other non-app directories.
- Fix unit test failures by aligning prompt logic, correcting imports, and adding test-only mocks.
- Adjust Playwright config to use a permitted port or reuse a running server.
