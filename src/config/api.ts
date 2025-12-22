/**
 * API Configuration
 * 
 * Centralized API configuration for Supabase Edge Functions.
 * In Lovable, we call Supabase edge functions directly instead of Vercel API routes.
 */

// Supabase project URL (public - safe to include)
const SUPABASE_URL = "https://ztjndilxurtsfqdsvfds.supabase.co";

/**
 * Get full URL for a Supabase edge function
 * @param functionName - Edge function name (e.g., 'ptd-agent-claude')
 * @returns Full URL (e.g., 'https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/ptd-agent-claude')
 */
export function getEdgeFunctionUrl(functionName: string): string {
    return `${SUPABASE_URL}/functions/v1/${functionName}`;
}

/**
 * Legacy API URL function for backward compatibility
 * Maps old Vercel API routes to Supabase edge functions
 */
export function getApiUrl(endpoint: string): string {
    // Map old Vercel API routes to Supabase edge functions
    const routeMap: Record<string, string> = {
        "/api/agent": getEdgeFunctionUrl("ptd-agent-claude"),
        "/api/system-check": getEdgeFunctionUrl("system-check"),
        "/api/events": getEdgeFunctionUrl("meta-capi"),
        "/api/events/batch": getEdgeFunctionUrl("meta-capi"),
    };
    
    return routeMap[endpoint] || endpoint;
}

/**
 * Common API endpoints - now mapped to edge functions
 */
export const API_ENDPOINTS = {
    agent: "/api/agent",
    systemCheck: "/api/system-check",
    events: "/api/events",
    eventsBatch: "/api/events/batch",
} as const;

/**
 * Supabase anon key for authentication
 */
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0am5kaWx4dXJ0c2ZxZHN2ZmRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxMjA2MDcsImV4cCI6MjA2OTY5NjYwN30.e665i3sdaMOBcD_OLzA6xjnTLQZ-BpiQ6GlgYkV15Lo";
