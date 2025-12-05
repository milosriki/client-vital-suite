/**
 * Shared authentication utilities for Supabase Edge Functions
 */

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

/**
 * Validates API key for service-to-service and webhook calls.
 * 
 * Accepts authentication via:
 * - x-api-key header with WEBHOOK_API_KEY
 * - Authorization: Bearer <key> with service role key
 * 
 * @param req - The incoming request
 * @returns true if the request is authenticated, false otherwise
 */
export function validateApiKey(req: Request): boolean {
  const apiKey = req.headers.get('x-api-key') || req.headers.get('authorization')?.replace('Bearer ', '');
  const expectedKey = Deno.env.get('WEBHOOK_API_KEY');
  
  // If no WEBHOOK_API_KEY is configured, allow service role key
  if (!expectedKey) {
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    return apiKey === supabaseKey;
  }
  
  return apiKey === expectedKey;
}

/**
 * Creates an unauthorized response for failed API key validation
 */
export function unauthorizedResponse(): Response {
  return new Response(
    JSON.stringify({ success: false, error: 'Unauthorized: Invalid or missing API key' }),
    { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
