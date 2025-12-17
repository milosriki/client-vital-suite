import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const CALLGEAR_API_KEY = Deno.env.get('CALLGEAR_API_KEY');
        if (!CALLGEAR_API_KEY) {
            throw new Error('CALLGEAR_API_KEY not set');
        }

        const { date_from, date_to, limit = 100 } = await req.json().catch(() => ({}));

        // Default to last 30 days if no date range provided
        const toDate = date_to || new Date().toISOString().split('T')[0];
        const fromDate = date_from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        console.log(`Fetching CallGear data from ${fromDate} to ${toDate}`);

        // CallGear Data API - CORRECT endpoint
        // Data API: https://dataapi.callgear.com/v2.0 (JSON-RPC)
        // Call API: https://callapi.callgear.com/v4.0 (REST - for call management)
        const response = await fetch('https://dataapi.callgear.com/v2.0', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                jsonrpc: "2.0",
                method: "get.calls_report",
                params: {
                    access_token: CALLGEAR_API_KEY,
                    date_from: `${fromDate} 00:00:00`,
                    date_till: `${toDate} 23:59:59`,
                    limit: limit,
                    // Request specific fields for call data
                    fields: ["id", "start_time", "finish_time", "talk_duration", "total_duration", 
                             "contact_phone_number", "virtual_phone_number", "employees", 
                             "finish_reason", "direction", "is_lost", "call_records"]
                },
                id: 1
            })
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`CallGear API error: ${response.status} ${text}`);
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(`CallGear API error: ${JSON.stringify(data.error)}`);
        }

        // Process and return data
        return new Response(JSON.stringify({
            success: true,
            data: data.result || [],
            count: data.result?.length || 0
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error:', error);
        return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
