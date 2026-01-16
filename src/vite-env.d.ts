/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_API_BASE: string;
  readonly VITE_PTD_INTERNAL_ACCESS_KEY: string;
  readonly VITE_META_CAPI_URL: string;
  readonly VITE_GEMINI_API_KEY: string;
  // Add other env vars here as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
