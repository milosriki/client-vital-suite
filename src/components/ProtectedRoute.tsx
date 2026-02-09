import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthProvider";
import { Loader2 } from "lucide-react";

/**
 * Auth guard component that redirects unauthenticated users to /login.
 * Wraps all dashboard routes to prevent unauthorized access.
 */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
