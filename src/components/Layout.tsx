import { Outlet } from "react-router-dom";
import { Navigation } from "./Navigation";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import PTDUnlimitedChat from "@/components/ai/PTDUnlimitedChat";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useVitalState } from "@/hooks/useVitalState";
import { ErrorBoundary } from "./ErrorBoundary";
import { SkipNavigation } from "@/components/ui/skip-navigation";

import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthProvider";
import { useSidebar } from "@/hooks/use-sidebar";
import { cn } from "@/lib/utils";

export const Layout = () => {
  // Enable global keyboard shortcuts
  useKeyboardShortcuts();

  // Initialize global real-time subscriptions for the "Living Being" architecture
  const { systemHealth } = useVitalState();
  const { isCollapsed } = useSidebar();

  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) {
      navigate("/login");
    }
  }, [session, loading, navigate]);

  if (loading) return null; // Or a loading spinner

  return (
    <>
      <SkipNavigation />
      <Navigation />
      <ErrorBoundary>
        <div className="min-h-screen bg-background gradient-mesh font-sans antialiased">
          <main
            id="main-content"
            role="main"
            aria-label="Main content"
            className={cn(
              "flex-1 overflow-x-hidden pt-16 lg:pt-0 transition-all duration-300 ease-in-out",
              isCollapsed ? "lg:pl-[72px]" : "lg:pl-64"
            )}
          >
            <Outlet />
          </main>
        </div>
      </ErrorBoundary>
      <Toaster />
      <Sonner />
      {/* Super-Intelligence Agent (Global) */}
      <PTDUnlimitedChat />
    </>
  );
};
