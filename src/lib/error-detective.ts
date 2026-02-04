import { toast } from "sonner";
import * as Sentry from "@sentry/react";

/**
 * Error Detective: The frontline guard for frontend errors.
 * Captures, logs, and reports errors with context.
 */
export class ErrorDetective {
  private static context: Record<string, any> = {};

  /**
   * Set global context for all subsequent errors (e.g. user ID, session ID)
   */
  static setContext(key: string, value: any) {
    this.context[key] = value;
    Sentry.setContext(key, value);
  }

  /**
   * Capture an error, log it, and optionally show a toast.
   */
  static async capture(
    error: unknown,
    options?: {
      showToast?: boolean;
      toastMessage?: string;
      context?: Record<string, any>;
      level?: "info" | "warning" | "error" | "fatal";
    },
  ) {
    const {
      showToast = true,
      toastMessage = "An unexpected error occurred",
      context = {},
      level = "error",
    } = options || {};

    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    // 1. Console Log (Dev Friendly)
    console.group("🕵️‍♂️ Error Detective Report");
    console.error(errorMessage);
    if (
      Object.keys(context).length > 0 ||
      Object.keys(this.context).length > 0
    ) {
      console.table({ ...this.context, ...context });
    }
    if (errorStack) console.debug(errorStack);
    console.groupEnd();

    // 2. Sentry Report
    Sentry.withScope((scope) => {
      scope.setLevel(level);
      scope.setExtras({ ...this.context, ...context });
      Sentry.captureException(error);
    });

    // 3. UI Feedback
    if (showToast) {
      toast.error(toastMessage, {
        description: errorMessage, // Show actual error detail in description
        duration: 5000,
      });
    }
  }

  /**
   * Guard a function execution.
   * If it fails, it captures the error automatically.
   */
  static async guard<T>(
    fn: () => Promise<T>,
    options?: {
      context?: Record<string, any>;
      showToast?: boolean;
      toastMessage?: string;
      fallback?: T;
    },
  ): Promise<T | undefined> {
    try {
      return await fn();
    } catch (error) {
      this.capture(error, options);
      return options?.fallback;
    }
  }

  /**
   * Wrap an API call with standard error handling.
   */
  static async apiGuard<T>(
    fn: () => Promise<T>,
    errorMessage: string = "Failed to fetch data",
  ): Promise<T | null> {
    return (
      this.guard(fn, {
        showToast: true,
        toastMessage: errorMessage,
        fallback: null,
      }) || null
    );
  }
}

export const detective = ErrorDetective;
