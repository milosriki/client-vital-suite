import { PostgrestError } from "@supabase/supabase-js";

export const getErrorMessage = (error: unknown): string => {
  if (!error) {
    return "An unknown error occurred";
  }

  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  // Handle Supabase errors
  if (
    typeof error === "object" &&
    "message" in error &&
    "details" in error &&
    "hint" in error
  ) {
    const pgError = error as PostgrestError;
    return pgError.message || pgError.details || "Database error occurred";
  }

  if (
    typeof error === "object" &&
    "message" in error
  ) {
    return String((error as { message: unknown }).message);
  }

  return "An unexpected error occurred";
};
