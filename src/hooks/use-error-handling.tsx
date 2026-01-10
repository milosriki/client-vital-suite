import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";

export type ErrorSeverity = "low" | "medium" | "high";

// Context7 protocol: 7-field error record for consistent handling.
export interface Context7Error {
  id: string;
  message: string;
  context: string;
  source: string;
  severity: ErrorSeverity;
  timestamp: string;
  stack?: string;
}

export interface ErrorReport {
  context?: string;
  source?: string;
  severity?: ErrorSeverity;
}

interface ErrorHandlingContextValue {
  errors: Context7Error[];
  reportError: (error: unknown, report?: ErrorReport) => void;
}

export const ErrorHandlingContext = createContext<ErrorHandlingContextValue | undefined>(undefined);

const MAX_ERROR_HISTORY = 25;

const normalizeError = (error: unknown) => {
  if (error instanceof Error) {
    return { message: error.message || "Unknown error", stack: error.stack };
  }

  if (typeof error === "string") {
    return { message: error };
  }

  try {
    return { message: JSON.stringify(error) };
  } catch {
    return { message: "Unknown error" };
  }
};

const createId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const ErrorHandlingProvider = ({ children }: { children: ReactNode }) => {
  const { toast } = useToast();
  const [errors, setErrors] = useState<Context7Error[]>([]);

  const reportError = useCallback(
    (error: unknown, report?: ErrorReport) => {
      const normalized = normalizeError(error);
      const context7Error: Context7Error = {
        id: createId(),
        message: normalized.message,
        context: report?.context ?? "application",
        source: report?.source ?? "unknown",
        severity: report?.severity ?? "high",
        timestamp: new Date().toISOString(),
        stack: normalized.stack,
      };

      console.error("[Context7Error]", context7Error);

      setErrors((prev) => [context7Error, ...prev].slice(0, MAX_ERROR_HISTORY));

      toast({
        title: "Something went wrong",
        description: context7Error.message,
        variant: "destructive",
      });
    },
    [toast]
  );

  useEffect(() => {
    const handleWindowError = (event: ErrorEvent) => {
      reportError(event.error ?? event.message, {
        context: "window.error",
        source: event.filename || "window",
        severity: "high",
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      reportError(event.reason, {
        context: "window.unhandledrejection",
        source: "promise",
        severity: "high",
      });
    };

    window.addEventListener("error", handleWindowError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleWindowError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, [reportError]);

  const value = useMemo(
    () => ({
      errors,
      reportError,
    }),
    [errors, reportError]
  );

  return <ErrorHandlingContext.Provider value={value}>{children}</ErrorHandlingContext.Provider>;
};

export const useErrorHandling = () => {
  const context = useContext(ErrorHandlingContext);
  if (!context) {
    throw new Error("useErrorHandling must be used within ErrorHandlingProvider");
  }

  return context;
};
