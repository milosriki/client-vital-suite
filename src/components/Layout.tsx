import { Outlet } from "react-router-dom";
import { Navigation } from "./Navigation";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { FloatingChat } from "./FloatingChat";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { ErrorBoundary } from "./ErrorBoundary";

export const Layout = () => {
  // Enable global keyboard shortcuts
  useKeyboardShortcuts();
  
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
