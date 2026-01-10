import { ReactNode, useMemo } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ErrorHandlingProvider, useErrorHandling } from "@/hooks/use-error-handling";

const QueryClientBridge = ({ children }: { children: ReactNode }) => {
  const { reportError } = useErrorHandling();

  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            retry: 3,
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
            onError: (error) =>
              reportError(error, {
                context: "react-query.query",
                source: "query",
                severity: "medium",
              }),
          },
          mutations: {
            retry: 2,
            onError: (error) =>
              reportError(error, {
                context: "react-query.mutation",
                source: "mutation",
                severity: "medium",
              }),
          },
        },
        logger: {
          log: console.log,
          warn: console.warn,
          error: (error) =>
            reportError(error, {
              context: "react-query.logger",
              source: "logger",
              severity: "high",
            }),
        },
      }),
    [reportError]
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

export const AppProviders = ({ children }: { children: ReactNode }) => (
  <ErrorHandlingProvider>
    <QueryClientBridge>{children}</QueryClientBridge>
  </ErrorHandlingProvider>
);
