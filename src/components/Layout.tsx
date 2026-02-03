import { Outlet } from "react-router-dom";
import { Navigation } from "./Navigation";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import PTDUnlimitedChat from "@/components/ai/PTDUnlimitedChat";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useVitalState } from "@/hooks/useVitalState";
import { ErrorBoundary } from "./ErrorBoundary";

import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthProvider";

export const Layout = () => {
  // Enable global keyboard shortcuts
  useKeyboardShortcuts();

  // Initialize global real-time subscriptions for the "Living Being" architecture
  const { systemHealth } = useVitalState();

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
      <Navigation />
      <ErrorBoundary>
        <div className="min-h-screen bg-background gradient-mesh font-sans antialiased">
          <main className="flex-1 overflow-x-hidden pt-16 lg:pt-0 lg:pl-[72px] transition-all duration-300 ease-in-out">
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
