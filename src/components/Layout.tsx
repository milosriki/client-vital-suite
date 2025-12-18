import { Outlet } from "react-router-dom";
import { Navigation } from "./Navigation";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { FloatingChat } from "./FloatingChat";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useVitalState } from "@/hooks/useVitalState";
import { ErrorBoundary } from "./ErrorBoundary";

export const Layout = () => {
  // Enable global keyboard shortcuts
  useKeyboardShortcuts();
  
  // Initialize global real-time subscriptions for the "Living Being" architecture
  // This ensures all dashboard data updates automatically when DB changes occur
  const { systemHealth } = useVitalState();
  
  return (
    <>
      <Navigation />
      <ErrorBoundary>
        <Outlet />
      </ErrorBoundary>
      <Toaster />
      <Sonner />
      <FloatingChat />
    </>
  );
};
