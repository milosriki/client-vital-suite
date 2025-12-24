/**
 * API Configuration
 * 
 * Works in BOTH environments:
 * - Lovable: Calls Supabase edge functions directly
 * - Vercel: Uses /api/* serverless routes
 */

// Supabase project credentials (public/publishable)
const DEFAULT_SUPABASE_URL = "https://ztjndilxurtsfqdsvfds.supabase.co";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? DEFAULT_SUPABASE_URL;

export const SUPABASE_ANON_KEY =
    import.meta.env.VITE_SUPABASE_ANON_KEY ??
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    "";

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
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };

    if (SUPABASE_ANON_KEY) {
        headers["Authorization"] = `Bearer ${SUPABASE_ANON_KEY}`;
    }

    return headers;
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
