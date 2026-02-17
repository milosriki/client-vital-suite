import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import * as Sentry from "@sentry/react";
import {
  QueryClient,
  QueryClientProvider,
  QueryCache,
  MutationCache,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { getErrorMessage } from "@/utils/api-error-handler";
import { ErrorDetective } from "@/lib/error-detective";
import { Analytics as VercelAnalytics } from "@vercel/analytics/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/Layout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/contexts/AuthProvider";
import { TimeMachineProvider } from "@/contexts/TimeMachineContext";
import { startBackgroundLearning } from "@/lib/ptd-auto-learn";
import { testAllFunctions } from "@/utils/testFunctions";
import { verifyAllConnections } from "@/utils/verifyBrowserConnection";
import { Fishbird } from "@/lib/fishbird-analytics";
import { SidebarProvider } from "@/hooks/use-sidebar";
import { PageSkeleton } from "@/components/ui/page-skeleton";

Fishbird.init();

// Static imports — critical path (login, error, not-found)
import ErrorPage from "./pages/ErrorPage";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import "./index.css";

// Lazy-loaded page imports — route-level code splitting
const ExecutiveOverview = lazy(() => import("./pages/ExecutiveOverview"));
const RevenueIntelligence = lazy(() => import("./pages/RevenueIntelligence"));
const Operations = lazy(() => import("./pages/Operations"));
const Overview = lazy(() => import("./pages/Overview"));
const Clients = lazy(() => import("./pages/Clients"));
const ClientDetail = lazy(() => import("./pages/ClientDetail"));
const Coaches = lazy(() => import("./pages/Coaches"));
const Interventions = lazy(() => import("./pages/Interventions"));
const AnalyticsPage = lazy(() => import("./pages/Analytics"));
// MetaDashboard archived → absorbed into MarketingIntelligence "Meta Ads" tab
const HubSpotAnalyzer = lazy(() => import("./pages/HubSpotAnalyzer"));
const SalesCoachTracker = lazy(() => import("./pages/SalesCoachTracker"));
const SetterActivityToday = lazy(() => import("./pages/SetterActivityToday"));
const YesterdayBookings = lazy(() => import("./pages/YesterdayBookings"));
const HubSpotLiveData = lazy(() => import("./pages/HubSpotLiveData"));
const CampaignMoneyMap = lazy(() => import("./pages/CampaignMoneyMap"));
const TeamLeaderboard = lazy(() => import("./pages/TeamLeaderboard"));
const AIBusinessAdvisor = lazy(() => import("./pages/AIBusinessAdvisor"));
const SalesPipeline = lazy(() => import("./pages/SalesPipeline"));
const CallTracking = lazy(() => import("./pages/CallTracking"));
const AIKnowledge = lazy(() => import("./pages/AIKnowledge"));
const AILearning = lazy(() => import("./pages/AILearning"));
const StripeIntelligence = lazy(() => import("./pages/StripeIntelligence"));
const AuditTrail = lazy(() => import("./pages/AuditTrail"));
const WarRoom = lazy(() => import("./pages/WarRoom"));
const AIDevConsole = lazy(() => import("./pages/AIDevConsole"));
const GlobalBrain = lazy(() => import("./pages/GlobalBrain"));
const Observability = lazy(() => import("./pages/Observability"));
const ExecutiveDashboard = lazy(() => import("./pages/ExecutiveDashboard"));
const EdgeFunctionsPage = lazy(() => import("./pages/admin/EdgeFunctions"));
const MasterControlPanel = lazy(() => import("./pages/MasterControlPanel"));
// AttributionWarRoom archived → absorbed into MarketingIntelligence "Source Truth" tab
const SkillCommandCenter = lazy(() => import("./pages/SkillCommandCenter"));
const ReconciliationDashboard = lazy(() => import("./pages/ReconciliationDashboard"));
const MarketingIntelligence = lazy(() => import("./pages/MarketingIntelligence"));
// MarketingDeepIntelligence archived → absorbed into MarketingIntelligence "Deep Intel" tab
const CommandCenter = lazy(() => import("./pages/CommandCenter"));
const SetterCommandCenter = lazy(() => import("./pages/SetterCommandCenter"));

// Enterprise pages — real data, production hooks
const EnterpriseStrategy = lazy(() => import("./pages/enterprise/EnterpriseStrategy"));
const EnterpriseCallAnalytics = lazy(() => import("./pages/enterprise/CallAnalytics"));
const EnterpriseSystemObservability = lazy(() => import("./pages/enterprise/SystemObservability"));
const EnterpriseAIAdvisor = lazy(() => import("./pages/enterprise/AIAdvisor"));
const EnterpriseClientHealth = lazy(() => import("./pages/enterprise/ClientHealth"));
const EnterpriseCoachPerformance = lazy(() => import("./pages/enterprise/CoachPerformance"));
const EnterpriseKnowledgeBase = lazy(() => import("./pages/enterprise/KnowledgeBase"));
const LeadFollowUp = lazy(() => import("./pages/LeadFollowUp"));

// Suspense wrapper helpers with per-route skeleton variants
function SuspensePage({ children, variant = "dashboard" }: { children: React.ReactNode; variant?: "dashboard" | "table" | "detail" | "cards" }) {
  return (
    <Suspense fallback={<PageSkeleton variant={variant} />}>
      {children}
    </Suspense>
  );
}
function SuspenseTable({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageSkeleton variant="table" />}>{children}</Suspense>;
}
function SuspenseDetail({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageSkeleton variant="detail" />}>{children}</Suspense>;
}

// Initialize Sentry
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN, // Will be undefined in dev if not set, which is fine (no-op)
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  // Performance Monitoring
  tracesSampleRate: 1.0,
  // Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});

// Start background learning on app init
startBackgroundLearning();

// Make testing utilities available in browser console (development only)
if (import.meta.env.DEV && typeof window !== "undefined") {
  (window as any).testAllFunctions = testAllFunctions;
  (window as any).verifyConnections = verifyAllConnections;
}

const router = createBrowserRouter([
  // Login Route (Outside Layout for full screen)
  { path: "/login", element: <Login /> },
  {
    element: (
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    ),
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <SuspensePage><ErrorBoundary><ExecutiveOverview /></ErrorBoundary></SuspensePage> },
      { path: "/dashboard", element: <SuspensePage><ErrorBoundary><ExecutiveOverview /></ErrorBoundary></SuspensePage> },
      { path: "/operations", element: <SuspensePage><Operations /></SuspensePage> },
      { path: "/marketing", element: <SuspensePage><MarketingIntelligence /></SuspensePage> },
      { path: "/revenue", element: <SuspensePage><RevenueIntelligence /></SuspensePage> },
      { path: "/sales-pipeline", element: <SuspensePage><SalesPipeline /></SuspensePage> },
      { path: "/stripe", element: <SuspensePage><StripeIntelligence /></SuspensePage> },
      { path: "/call-tracking", element: <SuspensePage><CallTracking /></SuspensePage> },
      { path: "/audit-trail", element: <SuspenseTable><AuditTrail /></SuspenseTable> },
      { path: "/war-room", element: <SuspensePage><WarRoom /></SuspensePage> },
      { path: "/ai-knowledge", element: <SuspenseTable><AIKnowledge /></SuspenseTable> },
      { path: "/ai-learning", element: <SuspenseTable><AILearning /></SuspenseTable> },
      { path: "/overview", element: <SuspensePage><Overview /></SuspensePage> },
      { path: "/clients", element: <SuspenseTable><Clients /></SuspenseTable> },
      { path: "/clients/:email", element: <SuspenseDetail><ClientDetail /></SuspenseDetail> },
      { path: "/coaches", element: <SuspenseTable><Coaches /></SuspenseTable> },
      { path: "/interventions", element: <SuspenseTable><Interventions /></SuspenseTable> },
      { path: "/analytics", element: <SuspensePage><AnalyticsPage /></SuspensePage> },
      { path: "/meta-dashboard", element: <SuspensePage><MarketingIntelligence /></SuspensePage> },
      { path: "/hubspot-analyzer", element: <SuspenseTable><HubSpotAnalyzer /></SuspenseTable> },
      { path: "/sales-coach-tracker", element: <SuspensePage><SalesCoachTracker /></SuspensePage> },
      { path: "/setter-activity-today", element: <SuspensePage><ErrorBoundary><SetterActivityToday /></ErrorBoundary></SuspensePage> },
      { path: "/setter-command-center", element: <SuspensePage><ErrorBoundary><SetterCommandCenter /></ErrorBoundary></SuspensePage> },
      { path: "/yesterday-bookings", element: <SuspensePage><YesterdayBookings /></SuspensePage> },
      { path: "/hubspot-live", element: <SuspenseTable><HubSpotLiveData /></SuspenseTable> },
      { path: "/money-map", element: <SuspensePage><CampaignMoneyMap /></SuspensePage> },
      { path: "/lead-follow-up", element: <SuspenseTable><LeadFollowUp /></SuspenseTable> },
      { path: "/leaderboard", element: <SuspensePage><TeamLeaderboard /></SuspensePage> },
      { path: "/ai-advisor", element: <SuspensePage><AIBusinessAdvisor /></SuspensePage> },
      { path: "/ai-dev", element: <SuspensePage><AIDevConsole /></SuspensePage> },
      { path: "/global-brain", element: <SuspensePage><GlobalBrain /></SuspensePage> },
      { path: "/observability", element: <SuspensePage><Observability /></SuspensePage> },
      { path: "/admin/edge-functions", element: <SuspensePage><EdgeFunctionsPage /></SuspensePage> },
      { path: "/executive-dashboard", element: <SuspensePage><ExecutiveDashboard /></SuspensePage> },
      { path: "/master-control", element: <SuspensePage><MasterControlPanel /></SuspensePage> },
      { path: "/attribution-leaks", element: <SuspensePage><MarketingIntelligence /></SuspensePage> },
      { path: "/attribution", element: <SuspensePage><MarketingIntelligence /></SuspensePage> },
      { path: "/reconciliation", element: <SuspenseTable><ReconciliationDashboard /></SuspenseTable> },
      { path: "/marketing-intelligence", element: <SuspensePage><MarketingIntelligence /></SuspensePage> },
      { path: "/deep-intel", element: <SuspensePage><MarketingIntelligence /></SuspensePage> },
      { path: "/skills-matrix", element: <SuspensePage><SkillCommandCenter /></SuspensePage> },
      { path: "/command-center", element: <SuspensePage><ErrorBoundary><CommandCenter /></ErrorBoundary></SuspensePage> },

      // Enterprise pages
      { path: "/enterprise/strategy", element: <SuspensePage><EnterpriseStrategy /></SuspensePage> },
      { path: "/enterprise/call-analytics", element: <SuspensePage><EnterpriseCallAnalytics /></SuspensePage> },
      { path: "/enterprise/observability", element: <SuspensePage><EnterpriseSystemObservability /></SuspensePage> },
      { path: "/enterprise/ai-advisor", element: <SuspensePage><EnterpriseAIAdvisor /></SuspensePage> },
      { path: "/enterprise/client-health", element: <SuspensePage><EnterpriseClientHealth /></SuspensePage> },
      { path: "/enterprise/coach-performance", element: <SuspensePage><EnterpriseCoachPerformance /></SuspensePage> },
      { path: "/enterprise/knowledge-base", element: <SuspensePage><EnterpriseKnowledgeBase /></SuspensePage> },

      { path: "*", element: <NotFound /> },
    ],
  },
]);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: 2,
    },
  },
  queryCache: new QueryCache({
    onError: (error) => {
      // Use Detective for unified logging and toast
      ErrorDetective.capture(error, {
        context: { source: "react-query-cache" },
        showToast: true,
        toastMessage: getErrorMessage(error),
      });
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      ErrorDetective.capture(error, {
        context: { source: "react-mutation-cache" },
        showToast: true,
        toastMessage: getErrorMessage(error),
      });
    },
  }),
});

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found");
}

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TimeMachineProvider>
            <TooltipProvider>
              <SidebarProvider>
                <RouterProvider router={router} />
                <VercelAnalytics />
              </SidebarProvider>
            </TooltipProvider>
          </TimeMachineProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
// Deploy Trigger: Sun Feb  1 01:45:30 PST 2026
// Fix TabsContent context error: Sun Feb  1 02:07:14 PST 2026
