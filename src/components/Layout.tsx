import { Outlet } from "react-router-dom";
import { Navigation } from "./Navigation";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import PTDUnlimitedChat from "@/components/ai/PTDUnlimitedChat";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useVitalState } from "@/hooks/useVitalState";
import { ErrorBoundary } from "./ErrorBoundary";

export const Layout = () => {
  // Enable global keyboard shortcuts
  useKeyboardShortcuts();
  
  // Initialize global real-time subscriptions for the "Living Being" architecture
  const { systemHealth } = useVitalState();
  
  return (
    <>
      <Navigation />
      <ErrorBoundary>
        <Outlet />
      </ErrorBoundary>
      <Toaster />
      <Sonner />
      {/* Super-Intelligence Agent (Global) */}
      <PTDUnlimitedChat />
    </>
  );
};
