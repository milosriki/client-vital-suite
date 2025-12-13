import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// SHA-256 hashing for PII
async function hashSHA256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Normalize UAE phone numbers
function normalizePhoneUAE(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('00971')) return digits.slice(2);
  if (digits.startsWith('971')) return digits;
  if (digits.startsWith('0')) return '971' + digits.slice(1);
  if (digits.startsWith('5')) return '971' + digits;
  return digits;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { batch_id, limit = 200, mode = 'test' } = await req.json();
    
    const STAPE_CAPIG_API_KEY = Deno.env.get('STAPE_CAPIG_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!STAPE_CAPIG_API_KEY || !supabaseUrl || !supabaseKey) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const STAPE_URL = 'https://ap.stape.info';
    const CAPIG_IDENTIFIER = 'ecxdsmmg';

    console.log('Processing CAPI batch:', { batch_id, limit, mode });

    // Create or get batch job
    let batchJob;
    if (batch_id) {
      const { data } = await supabase
        .from('batch_jobs')
        .select('*')
        .eq('id', batch_id)
        .single();
      batchJob = data;
    } else {
      const { data, error } = await supabase
        .from('batch_jobs')
        .insert({
          batch_name: `auto_batch_${new Date().toISOString()}`,
          scheduled_time: new Date().toISOString(),
          status: 'running',
          mode: mode
        })
        .select()
        .single();
      
      if (error) throw error;
      batchJob = data;
    }

    // Fetch pending events
    const { data: events, error: fetchError } = await supabase
      .from('capi_events_enriched')
      .select('*')
      .eq('send_status', 'pending')
      .eq('mode', mode)
      .limit(limit);

    if (fetchError) throw fetchError;

    console.log('Found events to send:', events?.length || 0);

    let sentCount = 0;
    let failedCount = 0;
    const errors: any[] = [];

    // Process events in batches of 200 (Meta's limit)
    for (const event of events || []) {
      try {
        // Prepare user_data with hashing
        const userData: any = {
          // Hash PII fields
          em: event.email ? await hashSHA256(event.email) : null,
          ph: event.phone ? await hashSHA256(normalizePhoneUAE(event.phone) || '') : null,
          fn: event.first_name ? await hashSHA256(event.first_name) : null,
          ln: event.last_name ? await hashSHA256(event.last_name) : null,
          ct: event.city ? await hashSHA256(event.city) : null,
          st: event.state ? await hashSHA256(event.state) : null,
          zp: event.zip_code ? await hashSHA256(event.zip_code) : null,
          country: event.country ? await hashSHA256(event.country) : null,
          external_id: event.external_id,
          // NEVER hash fbp/fbc
          fbp: event.fbp,
          fbc: event.fbc,
        };

        // Remove null values
        Object.keys(userData).forEach(key => {
          if (userData[key] === null || userData[key] === undefined) {
            delete userData[key];
          }
        });

        // Prepare event payload
        const payload: any = {
          event_name: event.event_name,
          event_time: Math.floor(new Date(event.event_time).getTime() / 1000),
          event_source_url: event.event_source_url || 'https://www.personaltrainersdubai.com',
          action_source: event.action_source || 'website',
          user_data: userData,
          custom_data: {
            currency: event.currency || 'AED',
            value: event.value || 0,
          },
        };

        if (event.content_name) payload.custom_data.content_name = event.content_name;
        if (event.content_category) payload.custom_data.content_category = event.content_category;
        if (event.content_ids) payload.custom_data.content_ids = event.content_ids;
        if (event.num_items) payload.custom_data.num_items = event.num_items;

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

        if (stapeResponse.ok) {
          // Update event as sent
          const { error: updateError } = await supabase
            .from('capi_events_enriched')
            .update({
              send_status: 'sent',
              sent_at: new Date().toISOString(),
              meta_event_id: responseData.event_id || null,
              meta_response: responseData,
            })
            .eq('id', event.id);

          if (updateError) {
            console.error(`Failed to update event ${event.id}:`, updateError);
          }

          sentCount++;
          console.log('Sent event:', event.event_id);
        } else {
          throw new Error(`Stape API error: ${JSON.stringify(responseData)}`);
        }
      } catch (err) {
        console.error('Error sending event:', event.event_id, err);
        failedCount++;
        errors.push({
          event_id: event.event_id,
          error: err instanceof Error ? err.message : 'Unknown error'
        });

        // Update event as failed
        const { error: updateError } = await supabase
          .from('capi_events_enriched')
          .update({
            send_status: 'failed',
            send_attempts: (event.send_attempts || 0) + 1,
          })
          .eq('id', event.id);

        if (updateError) {
          console.error(`Failed to update event ${event.id}:`, updateError);
        }
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Update batch job
    await supabase
      .from('batch_jobs')
      .update({
        status: failedCount === 0 ? 'completed' : 'completed_with_errors',
        execution_time: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        events_count: events?.length || 0,
        events_sent: sentCount,
        events_failed: failedCount,
        error_log: errors.length > 0 ? errors : null,
      })
      .eq('id', batchJob.id);

    console.log('Batch processing complete:', {
      total: events?.length || 0,
      sent: sentCount,
      failed: failedCount
    });

    return new Response(
      JSON.stringify({
        success: true,
        batch_id: batchJob.id,
        events_processed: events?.length || 0,
        events_sent: sentCount,
        events_failed: failedCount,
        errors: errors
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in process-capi-batch:', error);
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
