import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
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

// Chunk load error recovery — handles stale deployments
function lazyWithRetry(importFn: () => Promise<any>) {
  return lazy(() =>
    importFn().catch((error: Error) => {
      // If chunk fails to load (stale deployment), reload the page once
      if (
        error.message.includes("dynamically imported module") ||
        error.message.includes("Failed to fetch") ||
        error.message.includes("Loading chunk") ||
        error.name === "ChunkLoadError"
      ) {
        const hasReloaded = sessionStorage.getItem("chunk_reload");
        if (!hasReloaded) {
          sessionStorage.setItem("chunk_reload", "1");
          window.location.reload();
          return { default: () => null } as any;
        }
        sessionStorage.removeItem("chunk_reload");
      }
      throw error;
    })
  );
}

// Clear reload flag on successful load
if (sessionStorage.getItem("chunk_reload")) {
  sessionStorage.removeItem("chunk_reload");
}

// Lazy-loaded page imports — route-level code splitting
const ExecutiveOverview = lazyWithRetry(() => import("./pages/ExecutiveOverview"));
const RevenueIntelligence = lazyWithRetry(() => import("./pages/RevenueIntelligence"));
const Clients = lazyWithRetry(() => import("./pages/Clients"));
const ClientDetail = lazyWithRetry(() => import("./pages/ClientDetail"));
const Coaches = lazyWithRetry(() => import("./pages/Coaches"));
const Interventions = lazyWithRetry(() => import("./pages/Interventions"));
const SalesCoachTracker = lazyWithRetry(() => import("./pages/SalesCoachTracker"));
const SalesPipeline = lazyWithRetry(() => import("./pages/SalesPipeline"));
const CallTracking = lazyWithRetry(() => import("./pages/CallTracking"));
const AuditTrail = lazyWithRetry(() => import("./pages/AuditTrail"));
const WarRoom = lazyWithRetry(() => import("./pages/WarRoom"));
const GlobalBrain = lazyWithRetry(() => import("./pages/GlobalBrain"));
const SkillCommandCenter = lazyWithRetry(() => import("./pages/SkillCommandCenter"));
const MarketingIntelligence = lazyWithRetry(() => import("./pages/MarketingIntelligence"));
const CommandCenter = lazyWithRetry(() => import("./pages/CommandCenter"));

// Enterprise pages — real data, production hooks
const EnterpriseStrategy = lazyWithRetry(() => import("./pages/enterprise/EnterpriseStrategy"));
const EnterpriseCallAnalytics = lazyWithRetry(() => import("./pages/enterprise/CallAnalytics"));
const EnterpriseSystemObservability = lazyWithRetry(() => import("./pages/enterprise/SystemObservability"));
const EnterpriseAIAdvisor = lazyWithRetry(() => import("./pages/enterprise/AIAdvisor"));
const EnterpriseClientHealth = lazyWithRetry(() => import("./pages/enterprise/ClientHealth"));
const EnterpriseCoachPerformance = lazyWithRetry(() => import("./pages/enterprise/CoachPerformance"));
const EnterpriseKnowledgeBase = lazyWithRetry(() => import("./pages/enterprise/KnowledgeBase"));

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
      // Primary routes
      { index: true, element: <SuspensePage><ErrorBoundary><ExecutiveOverview /></ErrorBoundary></SuspensePage> },
      { path: "/dashboard", element: <SuspensePage><ErrorBoundary><ExecutiveOverview /></ErrorBoundary></SuspensePage> },
      { path: "/command-center", element: <SuspensePage><ErrorBoundary><CommandCenter /></ErrorBoundary></SuspensePage> },
      { path: "/marketing", element: <SuspensePage><MarketingIntelligence /></SuspensePage> },
      { path: "/sales-pipeline", element: <SuspensePage><SalesPipeline /></SuspensePage> },
      { path: "/revenue", element: <SuspensePage><RevenueIntelligence /></SuspensePage> },
      { path: "/attribution", element: <SuspensePage><MarketingIntelligence /></SuspensePage> },
      { path: "/clients", element: <SuspenseTable><Clients /></SuspenseTable> },
      { path: "/clients/:email", element: <SuspenseDetail><ClientDetail /></SuspenseDetail> },
      { path: "/coaches", element: <SuspenseTable><Coaches /></SuspenseTable> },
      { path: "/interventions", element: <SuspenseTable><Interventions /></SuspenseTable> },
      { path: "/global-brain", element: <SuspensePage><GlobalBrain /></SuspensePage> },
      { path: "/ai-advisor", element: <SuspensePage><EnterpriseAIAdvisor /></SuspensePage> },
      { path: "/sales-tracker", element: <SuspensePage><SalesCoachTracker /></SuspensePage> },
      { path: "/calls", element: <SuspensePage><CallTracking /></SuspensePage> },
      { path: "/skills", element: <SuspensePage><SkillCommandCenter /></SuspensePage> },
      { path: "/war-room", element: <SuspensePage><WarRoom /></SuspensePage> },
      { path: "/audit", element: <SuspenseTable><AuditTrail /></SuspenseTable> },

      // Enterprise pages
      { path: "/enterprise/strategy", element: <SuspensePage><EnterpriseStrategy /></SuspensePage> },
      { path: "/enterprise/call-analytics", element: <SuspensePage><EnterpriseCallAnalytics /></SuspensePage> },
      { path: "/enterprise/observability", element: <SuspensePage><EnterpriseSystemObservability /></SuspensePage> },
      { path: "/enterprise/ai-advisor", element: <SuspensePage><EnterpriseAIAdvisor /></SuspensePage> },
      { path: "/enterprise/client-health", element: <SuspensePage><EnterpriseClientHealth /></SuspensePage> },
      { path: "/enterprise/coach-performance", element: <SuspensePage><EnterpriseCoachPerformance /></SuspensePage> },
      { path: "/enterprise/knowledge-base", element: <SuspensePage><EnterpriseKnowledgeBase /></SuspensePage> },

      // Backward-compat redirects
      { path: "/overview", element: <Navigate to="/" replace /> },
      { path: "/executive-dashboard", element: <Navigate to="/command-center" replace /> },
      { path: "/marketing-intelligence", element: <Navigate to="/marketing" replace /> },
      { path: "/deep-intel", element: <Navigate to="/marketing" replace /> },
      { path: "/meta-dashboard", element: <Navigate to="/marketing" replace /> },
      { path: "/money-map", element: <Navigate to="/marketing" replace /> },
      { path: "/attribution-leaks", element: <Navigate to="/attribution" replace /> },
      { path: "/reconciliation", element: <Navigate to="/attribution" replace /> },
      { path: "/hubspot-analyzer", element: <Navigate to="/sales-pipeline" replace /> },
      { path: "/setter-activity-today", element: <Navigate to="/sales-tracker" replace /> },
      { path: "/yesterday-bookings", element: <Navigate to="/sales-tracker" replace /> },
      { path: "/stripe", element: <Navigate to="/revenue" replace /> },
      { path: "/leaderboard", element: <Navigate to="/sales-tracker" replace /> },
      { path: "/ai-knowledge", element: <Navigate to="/global-brain" replace /> },
      { path: "/ai-learning", element: <Navigate to="/global-brain" replace /> },
      { path: "/operations", element: <Navigate to="/calls" replace /> },
      { path: "/observability", element: <Navigate to="/enterprise/observability" replace /> },
      { path: "/sales-coach-tracker", element: <Navigate to="/sales-tracker" replace /> },
      { path: "/call-tracking", element: <Navigate to="/calls" replace /> },
      { path: "/audit-trail", element: <Navigate to="/audit" replace /> },
      { path: "/skills-matrix", element: <Navigate to="/skills" replace /> },

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
