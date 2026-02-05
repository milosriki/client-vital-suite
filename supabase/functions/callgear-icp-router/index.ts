import { withTracing, structuredLog, getCorrelationId } from "../_shared/observability.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifyAuth } from "../_shared/auth-middleware.ts";

interface CallGearICPRequest {
  cdr_id: string;
  numa: string; // Caller number
  numb: string; // Called number
  input_result?: string; // DTMF input
  start_time?: string;
}

interface CallGearICPResponse {
  text?: string;
  phones?: string[];
  operator_message?: string;
  returned_code?: string;
}

serve(async (req) => {
    try { verifyAuth(req); } catch(e) { return new Response("Unauthorized", {status: 401}); } // Security Hardening
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate API key
    const apiKey = Deno.env.get('CALLGEAR_API_KEY');
    const authHeader = req.headers.get('Authorization');

    if (!apiKey || authHeader !== `Bearer ${apiKey}`) {
      console.warn('Unauthorized request attempt');
      // Fail-safe: Return basic routing even on auth failure
      return new Response(
        JSON.stringify({
          text: "Please wait while we connect you.",
          phones: []
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Only accept POST
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse request with timeout consideration (must respond within 2 seconds)
    const callData: CallGearICPRequest = await req.json();
    console.log('Received CallGear ICP webhook:', callData);

    // Validate required fields
    if (!callData.cdr_id || !callData.numa || !callData.numb) {
      throw new Error('Missing required fields: cdr_id, numa, or numb');
    }

    // Analyze caller and determine routing
    const routingDecision = await analyzeAndRoute(callData);

    console.log('Routing decision:', routingDecision);

    // Return routing instructions
    return new Response(
      JSON.stringify(routingDecision),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error processing CallGear ICP request:', error);

    // Fail-safe routing on error - always return 200 with instructions to avoid dropped calls
    const failsafeResponse: CallGearICPResponse = {
      text: "We're experiencing technical difficulties. Please wait while we connect you to an operator.",
      phones: (Deno.env.get('FAILSAFE_ROUTING_PHONES') || '').split(',').filter(Boolean),
      operator_message: "System error - call routed via failsafe",
      returned_code: 'ERROR_FAILSAFE'
    };

    return new Response(
      JSON.stringify(failsafeResponse),
      {
        status: 200, // Return 200 with failsafe to ensure call isn't dropped
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function analyzeAndRoute(callData: CallGearICPRequest): Promise<CallGearICPResponse> {
  const { numa, numb, input_result, cdr_id } = callData;

  // VIP list (could be loaded from env or database)
  const vipNumbers = (Deno.env.get('VIP_NUMBERS') || '').split(',').filter(Boolean);
  const blacklistedNumbers = (Deno.env.get('BLACKLISTED_NUMBERS') || '').split(',').filter(Boolean);

  // Check blacklist first
  if (blacklistedNumbers.includes(numa)) {
    console.log(`Blacklisted caller: ${numa} for CDR ${cdr_id}`);
    return {
      text: "Thank you for calling. All our representatives are currently busy. Please try again later.",
      phones: [], // Don't route
      returned_code: 'BLACKLISTED'
    };
  }

  // Check VIP status
  const isVIP = vipNumbers.includes(numa);

  if (isVIP) {
    console.log(`VIP caller detected: ${numa} for CDR ${cdr_id}`);
    const vipPhones = (Deno.env.get('VIP_ROUTING_PHONES') || '').split(',').filter(Boolean);
    return {
      text: "Welcome back! Connecting you to our priority support team.",
      phones: vipPhones,
      operator_message: `VIP caller ${numa} - Priority handling required`,
      returned_code: 'VIP'
    };
  }

  // Handle DTMF input if present (IVR menu selection)
  if (input_result) {
    console.log(`DTMF input received: ${input_result} from ${numa}`);
    return routeByDTMF(input_result, numa);
  }

  // Default routing for regular calls
  const defaultPhones = (Deno.env.get('DEFAULT_ROUTING_PHONES') || '').split(',').filter(Boolean);

  return {
    text: "Welcome! Please wait while we connect you to the next available representative.",
    phones: defaultPhones,
    operator_message: `Caller: ${numa}`,
    returned_code: 'DEFAULT'
  };
}

function routeByDTMF(dtmf: string, numa: string): CallGearICPResponse {
  // Route based on DTMF input (IVR menu selections)
  const dtmfRouting: Record<string, { phones: string; message: string; dept: string }> = {
    '1': {
      phones: Deno.env.get('SALES_PHONES') || '',
      message: 'Connecting you to our sales department.',
      dept: 'Sales'
    },
    '2': {
      phones: Deno.env.get('SUPPORT_PHONES') || '',
      message: 'Connecting you to technical support.',
      dept: 'Support'
    },
    '3': {
      phones: Deno.env.get('BILLING_PHONES') || '',
      message: 'Connecting you to billing.',
      dept: 'Billing'
    },
    '9': {
      phones: Deno.env.get('OPERATOR_PHONES') || '',
      message: 'Connecting you to an operator.',
      dept: 'Operator'
    }
  };

  const route = dtmfRouting[dtmf];

  if (route) {
    const phones = route.phones.split(',').filter(Boolean);
    return {
      text: route.message,
      phones: phones.length > 0 ? phones : (Deno.env.get('DEFAULT_ROUTING_PHONES') || '').split(',').filter(Boolean),
      operator_message: `Caller selected option ${dtmf} (${route.dept})`,
      returned_code: `DTMF_${dtmf}`
    };
  }

  // Invalid DTMF - route to default
  console.warn(`Invalid DTMF input: ${dtmf} from ${numa}`);
  return {
    text: "Invalid selection. Connecting you to our main line.",
    phones: (Deno.env.get('DEFAULT_ROUTING_PHONES') || '').split(',').filter(Boolean),
    operator_message: `Invalid DTMF: ${dtmf}`,
    returned_code: 'INVALID_DTMF'
  };
}
