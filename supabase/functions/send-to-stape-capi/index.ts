import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { eventData, mode = 'test' } = await req.json();
    
    const STAPE_CAPIG_API_KEY = Deno.env.get('STAPE_CAPIG_API_KEY');
    const STAPE_URL = 'https://ap.stape.info';
    const CAPIG_IDENTIFIER = 'ecxdsmmg';
    
    if (!STAPE_CAPIG_API_KEY) {
      throw new Error('STAPE_CAPIG_API_KEY not configured');
    }

    console.log('Sending event to Stape CAPI:', {
      mode,
      event_name: eventData.event_name,
      email: eventData.user_data?.email
    });

    // Prepare the event payload for Stape CAPI
    const payload: any = {
      event_name: eventData.event_name || 'Purchase',
      event_time: Math.floor(Date.now() / 1000),
      action_source: 'website',
      event_source_url: 'https://ptdfitness.com',
      user_data: {
        em: eventData.user_data?.email || null,
        ph: eventData.user_data?.phone || null,
        fn: eventData.user_data?.first_name || null,
        ln: eventData.user_data?.last_name || null,
        external_id: eventData.user_data?.external_id || null,
        fbp: eventData.user_data?.fbp || null,
        fbc: eventData.user_data?.fbc || null,
      },
      custom_data: {
        currency: eventData.custom_data?.currency || 'AED',
        value: eventData.custom_data?.value || 0,
        content_name: eventData.custom_data?.content_name || null,
      }
    };

    // Add test_event_code if in test mode
    if (mode === 'test' && eventData.test_event_code) {
      payload.test_event_code = eventData.test_event_code;
    }

    // Send to Stape CAPI
    const stapeResponse = await fetch(`${STAPE_URL}/stape-api/${CAPIG_IDENTIFIER}/v1/event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${STAPE_CAPIG_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const responseData = await stapeResponse.json();
    
    console.log('Stape CAPI response:', {
      status: stapeResponse.status,
      data: responseData
    });

    if (!stapeResponse.ok) {
      throw new Error(`Stape CAPI error: ${JSON.stringify(responseData)}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        mode,
        event_id: responseData.event_id || `evt_${Date.now()}`,
        response: responseData
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in send-to-stape-capi:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
