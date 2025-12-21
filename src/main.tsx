import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Analytics as VercelAnalytics } from "@vercel/analytics/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/Layout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { startBackgroundLearning } from "@/lib/ptd-auto-learn";
import { testAllFunctions } from "@/utils/testFunctions";
import { verifyAllConnections } from "@/utils/verifyBrowserConnection";
import Dashboard from "./pages/Dashboard";
import Operations from "./pages/Operations";
import Overview from "./pages/Overview";
import Clients from "./pages/Clients";
import ClientDetail from "./pages/ClientDetail";
import Coaches from "./pages/Coaches";
import Interventions from "./pages/Interventions";
import AnalyticsPage from "./pages/Analytics";
import MetaDashboard from "./pages/MetaDashboard";
import PTDControl from "./pages/PTDControl";
import HubSpotAnalyzer from "./pages/HubSpotAnalyzer";
import SalesCoachTracker from "./pages/SalesCoachTracker";
import SetterActivityToday from "./pages/SetterActivityToday";
import YesterdayBookings from "./pages/YesterdayBookings";
import HubSpotLiveData from "./pages/HubSpotLiveData";
import SalesPipeline from "./pages/SalesPipeline";
import CallTracking from "./pages/CallTracking";
import AIKnowledge from "./pages/AIKnowledge";
import AILearning from "./pages/AILearning";
import NotFound from "./pages/NotFound";
import UltimateCEO from "./pages/UltimateCEO";
import StripeIntelligence from "./pages/StripeIntelligence";
import AuditTrail from "./pages/AuditTrail";
import WarRoom from "./pages/WarRoom";
import MarketingStressTest from "./pages/MarketingStressTest";
import AIDevConsole from "./pages/AIDevConsole";
import GlobalBrain from "./pages/GlobalBrain";
import "./index.css";

// Start background learning on app init
startBackgroundLearning();

// Make testing utilities available in browser console (development only)
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as any).testAllFunctions = testAllFunctions;
  (window as any).verifyConnections = verifyAllConnections;
  console.log('🧪 Browser utilities loaded:');
  console.log('   - testAllFunctions() - Test all functions');
  console.log('   - verifyConnections() - Verify all connections');
}

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: "/", element: <Dashboard /> },
      { path: "/dashboard", element: <Dashboard /> },
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
      { path: "/ptd-control", element: <PTDControl /> },
      { path: "/hubspot-analyzer", element: <HubSpotAnalyzer /> },
      { path: "/sales-coach-tracker", element: <SalesCoachTracker /> },
      { path: "/setter-activity-today", element: <SetterActivityToday /> },
      { path: "/yesterday-bookings", element: <YesterdayBookings /> },
      { path: "/hubspot-live", element: <HubSpotLiveData /> },
      { path: "/ultimate-ceo", element: <UltimateCEO /> },
      { path: "/marketing-stress-test", element: <MarketingStressTest /> },
      { path: "/ai-dev", element: <AIDevConsole /> },
      { path: "/global-brain", element: <GlobalBrain /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 3, // Retry up to 3 times on failure
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    },
    mutations: {
      retry: 2,
    },
  },
});

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found");
}

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <RouterProvider router={router} />
          <VercelAnalytics />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>
);
