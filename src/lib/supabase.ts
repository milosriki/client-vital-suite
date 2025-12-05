import { createClient } from '@supabase/supabase-js'

// Use environment variables with fallback to hardcoded values for the developed Supabase project
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://ztjndilxurtsfqdsvfds.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0am5kaWx4dXJ0c2ZxZHN2ZmRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxMjA2MDcsImV4cCI6MjA2OTY5NjYwN30.e665i3sdaMOBcD_OLzA6xjnTLQZ-BpiQ6GlgYkV15Lo";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
})
