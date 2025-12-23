/**
 * API Configuration
 * 
 * Works in BOTH environments:
 * - Lovable: Calls Supabase edge functions directly
 * - Vercel: Uses /api/* serverless routes
 */

// Supabase project credentials (public - safe to include)
const SUPABASE_URL = "https://ztjndilxurtsfqdsvfds.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0am5kaWx4dXJ0c2ZxZHN2ZmRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxMjA2MDcsImV4cCI6MjA2OTY5NjYwN30.e665i3sdaMOBcD_OLzA6xjnTLQZ-BpiQ6GlgYkV15Lo";

/**
 * Detect if running in Lovable preview environment
 */
function isLovableEnvironment(): boolean {
    if (typeof window === 'undefined') return false;
    const hostname = window.location.hostname;
    return hostname.includes('lovableproject.com') || 
           hostname.includes('lovable.app') ||
           hostname === 'localhost';
}

/**
 * Detect if running in Vercel environment
 */
function isVercelEnvironment(): boolean {
    if (typeof window === 'undefined') return false;
    const hostname = window.location.hostname;
    return hostname.includes('vercel.app') || 
           hostname.includes('client-vital-suite');
}

/**
 * Map Vercel API routes to Supabase edge functions
 */
const ROUTE_TO_EDGE_FUNCTION: Record<string, string> = {
    "/api/agent": "ptd-agent-gemini",
    "/api/system-check": "system-check",
    "/api/events": "meta-capi",
    "/api/events/batch": "meta-capi",
};

/**
 * Get full URL for a Supabase edge function
 */
export function getEdgeFunctionUrl(functionName: string): string {
    return `${SUPABASE_URL}/functions/v1/${functionName}`;
}

/**
 * Get API URL - works in BOTH Vercel and Lovable
 * - In Lovable: Returns Supabase edge function URL
 * - In Vercel: Returns relative /api/* path
 */
export function getApiUrl(endpoint: string): string {
    // In Lovable environment, always use Supabase edge functions
    if (isLovableEnvironment()) {
        const functionName = ROUTE_TO_EDGE_FUNCTION[endpoint];
        if (functionName) {
            return getEdgeFunctionUrl(functionName);
        }
    }
    
    // In Vercel environment, use relative API routes
    if (isVercelEnvironment()) {
        return endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    }
    
    // Default: Use Supabase edge functions (safest fallback)
    const functionName = ROUTE_TO_EDGE_FUNCTION[endpoint];
    if (functionName) {
        return getEdgeFunctionUrl(functionName);
    }
    
    return endpoint;
}

/**
 * Get auth headers for API calls
 * - In Lovable: Use Supabase anon key
 * - In Vercel: Headers handled by serverless function
 */
export function getAuthHeaders(): Record<string, string> {
    if (isLovableEnvironment()) {
        return {
            "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
            "Content-Type": "application/json",
        };
    }
    return {
        "Content-Type": "application/json",
    };
}

/**
 * Common API endpoints
 */
export const API_ENDPOINTS = {
    agent: "/api/agent",
    systemCheck: "/api/system-check",
    events: "/api/events",
    eventsBatch: "/api/events/batch",
} as const;

/**
 * Environment info for debugging
 */
export function getEnvironmentInfo(): { env: string; apiMode: string } {
    if (isVercelEnvironment()) {
        return { env: "vercel", apiMode: "serverless" };
    }
    if (isLovableEnvironment()) {
        return { env: "lovable", apiMode: "edge-functions" };
    }
    return { env: "unknown", apiMode: "edge-functions" };
}
