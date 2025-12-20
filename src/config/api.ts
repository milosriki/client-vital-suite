/**
 * API Configuration
 * 
 * Centralized API base URL configuration for Vercel deployments.
 * 
 * In Vercel:
 * - Production: Uses window.location.origin (current domain)
 * - Preview: Uses window.location.origin (preview domain)
 * - Development: Uses window.location.origin (localhost)
 * 
 * Can be overridden with VITE_API_BASE environment variable if needed.
 */

export const API_BASE =
    import.meta.env.VITE_API_BASE ||
    (typeof window !== "undefined" ? window.location.origin : "");

/**
 * Get full API URL for a given endpoint
 * @param endpoint - API endpoint path (e.g., '/api/agent')
 * @returns Full URL (e.g., 'https://client-vital-suite.vercel.app/api/agent')
 */
export function getApiUrl(endpoint: string): string {
    // Ensure endpoint starts with /
    const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    return `${API_BASE}${normalizedEndpoint}`;
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

