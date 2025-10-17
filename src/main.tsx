import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Layout } from "@/components/Layout";
import Overview from "./pages/Overview";
import Clients from "./pages/Clients";
import Coaches from "./pages/Coaches";
import WorkflowFixer from "./pages/WorkflowFixer";
import WorkflowStrategy from "./pages/WorkflowStrategy";
import NotFound from "./pages/NotFound";
import "./index.css";

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: "/", element: <Overview /> },
      { path: "/clients", element: <Clients /> },
      { path: "/coaches", element: <Coaches /> },
      { path: "/fix-workflows", element: <WorkflowFixer /> },
      { path: "/workflow-strategy", element: <WorkflowStrategy /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <RouterProvider router={router} />
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>
);
