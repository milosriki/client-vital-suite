import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = "https://boowptjtwadxpjkpctna.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvb3dwdGp0d2FkeHBqa3BjdG5hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxNzg4NTQsImV4cCI6MjA3Mjc1NDg1NH0.ka1coMBcGClLN9nrnuuLZq3S48tVuzb9qbe5aQLhDpU";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
})
