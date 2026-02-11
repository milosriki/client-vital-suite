import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import * as Sentry from "@sentry/react"; // Sentry Import
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
import { AuthProvider } from "@/contexts/AuthProvider"; // Import AuthProvider
import { TimeMachineProvider } from "@/contexts/TimeMachineContext"; // Import TimeMachineProvider
import { startBackgroundLearning } from "@/lib/ptd-auto-learn";
import { testAllFunctions } from "@/utils/testFunctions";
import { verifyAllConnections } from "@/utils/verifyBrowserConnection";
import { Fishbird } from "@/lib/fishbird-analytics"; // Import Fishbird
import { SidebarProvider } from "@/hooks/use-sidebar";

Fishbird.init(); // Initialize Fishbird "Truth Layer"
import Operations from "./pages/Operations";
import Overview from "./pages/Overview";
import Clients from "./pages/Clients";
import ClientDetail from "./pages/ClientDetail";
import Coaches from "./pages/Coaches";
import Interventions from "./pages/Interventions";
import AnalyticsPage from "./pages/Analytics";
import MetaDashboard from "./pages/MetaDashboard";
import HubSpotAnalyzer from "./pages/HubSpotAnalyzer";
import SalesCoachTracker from "./pages/SalesCoachTracker";
import SetterActivityToday from "./pages/SetterActivityToday";
import YesterdayBookings from "./pages/YesterdayBookings";
import HubSpotLiveData from "./pages/HubSpotLiveData";
import CampaignMoneyMap from "./pages/CampaignMoneyMap";
import TeamLeaderboard from "./pages/TeamLeaderboard";
import AIBusinessAdvisor from "./pages/AIBusinessAdvisor";
import SalesPipeline from "./pages/SalesPipeline";
import CallTracking from "./pages/CallTracking";
import AIKnowledge from "./pages/AIKnowledge";
import AILearning from "./pages/AILearning";
import NotFound from "./pages/NotFound";
import StripeIntelligence from "./pages/StripeIntelligence";
import AuditTrail from "./pages/AuditTrail";
import WarRoom from "./pages/WarRoom";
import AIDevConsole from "./pages/AIDevConsole";
import GlobalBrain from "./pages/GlobalBrain";
import Observability from "./pages/Observability";
import ExecutiveDashboard from "./pages/ExecutiveDashboard";
import EdgeFunctionsPage from "./pages/admin/EdgeFunctions";
import MasterControlPanel from "./pages/MasterControlPanel";
import AttributionWarRoom from "./pages/AttributionWarRoom";
import ErrorPage from "./pages/ErrorPage"; // Import ErrorPage
import Login from "./pages/Login"; // Import Login Page
import SkillCommandCenter from "./pages/SkillCommandCenter";
import { ProtectedRoute } from "@/components/ProtectedRoute"; // Auth Guard
import ReconciliationDashboard from "./pages/ReconciliationDashboard";
import MarketingIntelligence from "./pages/MarketingIntelligence";
import "./index.css";

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
      { index: true, element: <ExecutiveDashboard /> },
      { path: "/dashboard", element: <ExecutiveDashboard /> },
      { path: "/operations", element: <Operations /> },
      { path: "/sales-pipeline", element: <SalesPipeline /> },
      { path: "/stripe", element: <StripeIntelligence /> },
      { path: "/call-tracking", element: <CallTracking /> },
      { path: "/audit-trail", element: <AuditTrail /> },
      { path: "/war-room", element: <WarRoom /> },
      { path: "/ai-knowledge", element: <AIKnowledge /> },
      { path: "/ai-learning", element: <AILearning /> },
      { path: "/overview", element: <Overview /> },
      { path: "/clients", element: <Clients /> },
      { path: "/clients/:email", element: <ClientDetail /> },
      { path: "/coaches", element: <Coaches /> },
      { path: "/interventions", element: <Interventions /> },
      { path: "/analytics", element: <AnalyticsPage /> },
      { path: "/meta-dashboard", element: <MetaDashboard /> },
      { path: "/hubspot-analyzer", element: <HubSpotAnalyzer /> },
      { path: "/sales-coach-tracker", element: <SalesCoachTracker /> },
      { path: "/setter-activity-today", element: <SetterActivityToday /> },
      { path: "/yesterday-bookings", element: <YesterdayBookings /> },
      { path: "/hubspot-live", element: <HubSpotLiveData /> },
      { path: "/money-map", element: <CampaignMoneyMap /> },
      { path: "/leaderboard", element: <TeamLeaderboard /> },
      { path: "/ai-advisor", element: <AIBusinessAdvisor /> },
      { path: "/ai-dev", element: <AIDevConsole /> },
      { path: "/global-brain", element: <GlobalBrain /> },
      { path: "/observability", element: <Observability /> },
      { path: "/admin/edge-functions", element: <EdgeFunctionsPage /> },
      { path: "/executive-dashboard", element: <ExecutiveDashboard /> },
      { path: "/master-control", element: <MasterControlPanel /> },
      { path: "/attribution", element: <AttributionWarRoom /> },
      { path: "/reconciliation", element: <ReconciliationDashboard /> },
      { path: "/marketing-intelligence", element: <MarketingIntelligence /> },
      { path: "/skills-matrix", element: <SkillCommandCenter /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
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
