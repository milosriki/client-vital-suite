// Supabase client configuration
// These are PUBLIC credentials (anon key) - safe to include in client-side code
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Supabase project credentials (public/publishable - NOT secrets)
const DEFAULT_SUPABASE_URL = "https://ztjndilxurtsfqdsvfds.supabase.co";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? DEFAULT_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  "";

if (!SUPABASE_PUBLISHABLE_KEY) {
  throw new Error(
    "Missing Supabase publishable key. Set VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY)."
  );
}

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});

const originalInvoke = supabase.functions.invoke.bind(supabase.functions);
supabase.functions.invoke = async (functionName, options) => {
  try {
    const result = await originalInvoke(functionName, options);

    if (result.error && typeof window !== "undefined") {
      window.__context7ReportError?.(result.error, {
        context: `supabase.function:${functionName}`,
        source: "supabase",
        severity: "high",
      });
    }

    return result;
  } catch (error) {
    if (typeof window !== "undefined") {
      window.__context7ReportError?.(error, {
        context: `supabase.function:${functionName}`,
        source: "supabase",
        severity: "high",
      });
    }
    throw error;
  }
};
