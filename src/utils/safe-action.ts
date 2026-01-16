import { toast } from "sonner";
import { getErrorMessage } from "./api-error-handler";

/**
 * Wraps an async function with automatic error handling and toast notifications.
 * @param action The async function to execute
 * @param options Configuration options
 * @returns A safe version of the function that returns [data, error] tuple
 */
export async function safeAction<T>(
  action: () => Promise<T>,
  options: {
    errorMessage?: string;
    successMessage?: string;
    showErrorToast?: boolean;
    showSuccessToast?: boolean;
    onSuccess?: (data: T) => void;
    onError?: (error: unknown) => void;
  } = {}
): Promise<[T | null, unknown | null]> {
  const {
    errorMessage = "An error occurred",
    successMessage,
    showErrorToast = true,
    showSuccessToast = false,
    onSuccess,
    onError,
  } = options;

  try {
    const data = await action();

    if (showSuccessToast && successMessage) {
      toast.success(successMessage);
    }

    if (onSuccess) {
      onSuccess(data);
    }

    return [data, null];
  } catch (error) {
    const message = getErrorMessage(error);
    const finalErrorMessage = errorMessage === "An error occurred" ? message : `${errorMessage}: ${message}`;

    if (showErrorToast) {
      toast.error(finalErrorMessage);
    }

    if (onError) {
      onError(error);
    }

    console.error(`SafeAction Error: ${finalErrorMessage}`, error);

    return [null, error];
  }
}
