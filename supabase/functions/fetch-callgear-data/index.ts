import { withTracing, structuredLog, getCorrelationId } from "../_shared/observability.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Map CallGear finish_reason to call_status
function mapCallStatus(finishReason: string, isLost: boolean): string {
    if (isLost) return 'missed';

    switch (finishReason?.toLowerCase()) {
        case 'answered':
        case 'completed':
            return 'completed';
        case 'no_answer':
        case 'busy':
        case 'cancel':
            return 'missed';
        case 'failed':
            return 'failed';
        default:
            return 'unknown';
    }
}

// Map CallGear finish_reason to call_outcome
function mapCallOutcome(finishReason: string, isLost: boolean): string {
    if (isLost) return 'no_answer';

    switch (finishReason?.toLowerCase()) {
        case 'answered':
        case 'completed':
            return 'answered';
        case 'no_answer':
            return 'no_answer';
        case 'busy':
            return 'busy';
        case 'cancel':
            return 'cancelled';
        case 'failed':
            return 'failed';
        default:
            return finishReason || 'unknown';
    }
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        // Initialize Supabase client
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error('Missing Supabase credentials');
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const CALLGEAR_API_KEY = Deno.env.get('CALLGEAR_API_KEY');
        if (!CALLGEAR_API_KEY) {
            throw new Error('CALLGEAR_API_KEY not set');
        }

        const { date_from, date_to, limit = 1000 } = await req.json().catch(() => ({}));

        // Default to last 30 days if no date range provided
        const toDate = date_to || new Date().toISOString().split('T')[0];
        const fromDate = date_from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        console.log(`Fetching CallGear data from ${fromDate} to ${toDate}`);

        // CallGear Data API - CORRECT endpoint
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const response = await fetch('https://dataapi.callgear.com/v2.0', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            signal: controller.signal,
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

        // Employee Mapping Configuration
        const OWNER_MAPPING: Record<string, string> = {
            "Yehia": "78722672",
            "James": "80616467",
            "Mazen": "82655976",
            "Matthew": "452974662",
            "Tea": "48899890",
            "Milos": "48877837"
        };

        const getHubSpotOwnerId = (employees: any): string | null => {
            if (!employees) return null;
            
            // Handle array of employees (CallGear usually returns array)
            const employeeList = Array.isArray(employees) ? employees : [employees];
            
            for (const emp of employeeList) {
                // Check for name property or string
                const name = typeof emp === 'string' ? emp : (emp.name || emp.full_name || emp.employee_name);
                
                if (!name) continue;

                // Check for exact or partial match
                for (const [key, id] of Object.entries(OWNER_MAPPING)) {
                    if (name.toLowerCase().includes(key.toLowerCase())) {
                        return id;
                    }
                }
            }
            return null;
        };

        const calls = data.result?.calls || [];
        console.log(`Received ${calls.length} calls from CallGear`);

        // Map CallGear data to call_records schema and upsert
        const mappedCalls = calls.map((call: any) => {
            const isLost = call.is_lost === true || call.is_lost === 1;
            const talkDuration = call.talk_duration || 0;
            const totalDuration = call.total_duration || talkDuration;
            const ownerId = getHubSpotOwnerId(call.employees);

            return {
                provider_call_id: call.id?.toString() || null,
                call_status: mapCallStatus(call.finish_reason, isLost),
                call_direction: call.direction === 'in' ? 'inbound' : 'outbound',
                call_outcome: mapCallOutcome(call.finish_reason, isLost),
                caller_number: call.contact_phone_number || 'unknown',
                started_at: call.start_time || null,
                ended_at: call.finish_time || null,
                duration_seconds: totalDuration,
                recording_url: call.call_records?.[0]?.file || null,
                caller_city: call.city || null,
                caller_country: call.country || null,
                caller_state: call.region || null,
                hubspot_owner_id: ownerId, // Mapped Owner ID
                // Additional metadata
                transcription_status: call.call_records?.[0] ? 'available' : null,
            };
        });

        // Upsert calls into database (update if provider_call_id exists, insert if new)
        let insertedCount = 0;
        let updatedCount = 0;
        const errors: any[] = [];

        for (const call of mappedCalls) {
            if (!call.provider_call_id) {
                errors.push({ call, error: 'Missing provider_call_id' });
                continue;
            }

            // Check if call already exists
            const { data: existing } = await supabase
                .from('call_records')
                .select('id')
                .eq('provider_call_id', call.provider_call_id)
                .single();

            if (existing) {
                // Update existing record
                const { error } = await supabase
                    .from('call_records')
                    .update({
                        ...call,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('provider_call_id', call.provider_call_id);

                if (error) {
                    errors.push({ call, error: error.message });
                } else {
                    updatedCount++;
                }
            } else {
                // Insert new record
                const { error } = await supabase
                    .from('call_records')
                    .insert(call);

                if (error) {
                    errors.push({ call, error: error.message });
                } else {
                    insertedCount++;
                }
            }
        }

        console.log(`Processed ${mappedCalls.length} calls: ${insertedCount} inserted, ${updatedCount} updated, ${errors.length} errors`);

        // Return summary
        return new Response(JSON.stringify({
            success: true,
            summary: {
                total_fetched: calls.length,
                inserted: insertedCount,
                updated: updatedCount,
                errors: errors.length,
            },
            errors: errors.length > 0 ? errors : undefined,
            date_range: {
                from: fromDate,
                to: toDate,
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
