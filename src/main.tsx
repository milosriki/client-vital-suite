import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/Layout";
import Dashboard from "./pages/Dashboard";
import Overview from "./pages/Overview";
import Clients from "./pages/Clients";
import ClientDetail from "./pages/ClientDetail";
import Coaches from "./pages/Coaches";
import Interventions from "./pages/Interventions";
import Analytics from "./pages/Analytics";
import WorkflowFixer from "./pages/WorkflowFixer";
import WorkflowStrategy from "./pages/WorkflowStrategy";
import MetaDashboard from "./pages/MetaDashboard";
import PTDControl from "./pages/PTDControl";
import HubSpotAnalyzer from "./pages/HubSpotAnalyzer";
import SalesCoachTracker from "./pages/SalesCoachTracker";
import SetterActivityToday from "./pages/SetterActivityToday";
import NotFound from "./pages/NotFound";
import "./index.css";

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: "/", element: <Dashboard /> },
      { path: "/overview", element: <Overview /> },
      { path: "/clients", element: <Clients /> },
      { path: "/clients/:email", element: <ClientDetail /> },
      { path: "/coaches", element: <Coaches /> },
      { path: "/interventions", element: <Interventions /> },
      { path: "/analytics", element: <Analytics /> },
      { path: "/fix-workflows", element: <WorkflowFixer /> },
      { path: "/workflow-strategy", element: <WorkflowStrategy /> },
      { path: "/meta-dashboard", element: <MetaDashboard /> },
      { path: "/ptd-control", element: <PTDControl /> },
      { path: "/hubspot-analyzer", element: <HubSpotAnalyzer /> },
      { path: "/sales-coach-tracker", element: <SalesCoachTracker /> },
      { path: "/setter-activity-today", element: <SetterActivityToday /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found");
}

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>
);
