import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getStripeClient, STRIPE_API_VERSION } from "../_shared/stripe.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { event_ids } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing required Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Use shared Stripe client with standardized API version
    const stripe = getStripeClient();
    console.log(`[ENRICH-WITH-STRIPE] Using Stripe API version: ${STRIPE_API_VERSION}`);

    console.log('Enriching events with Stripe data:', {
      count: event_ids?.length || 'all pending'
    });

    // Fetch events to enrich
    let query = supabase
      .from('capi_events_enriched')
      .select('*')
      .is('stripe_customer_id', null) // Only events not yet enriched
      .not('email', 'is', null);

    if (event_ids && event_ids.length > 0) {
      query = query.in('id', event_ids);
    } else {
      query = query.limit(100);
    }

    const { data: events, error: fetchError } = await query;

    if (fetchError) throw fetchError;

    console.log('Found events to enrich:', events?.length || 0);

    const enrichedEvents = [];

    for (const event of events || []) {
      try {
        // Find Stripe customer by email
        const customers = await stripe.customers.list({
          email: event.email,
          limit: 1
        });

        if (customers.data.length === 0) {
          console.log('No Stripe customer found for:', event.email);
          continue;
        }

        const customer = customers.data[0];
        const enrichment: any = {
          stripe_customer_id: customer.id,
        };

        // Get recent charges
        const charges = await stripe.charges.list({
          customer: customer.id,
          limit: 5
        });

        if (charges.data.length > 0) {
          const latestCharge = charges.data[0];
          enrichment.stripe_charge_id = latestCharge.id;
          enrichment.payment_method = latestCharge.payment_method_details?.type || null;

          // Update value if we have charge amount
          if (!event.value && latestCharge.amount) {
            enrichment.value = latestCharge.amount / 100; // Convert from cents
            enrichment.currency = latestCharge.currency.toUpperCase();
          }
        }

        // Get subscriptions
        const subscriptions = await stripe.subscriptions.list({
          customer: customer.id,
          limit: 1
        });

        if (subscriptions.data.length > 0) {
          const subscription = subscriptions.data[0];
          enrichment.subscription_id = subscription.id;
          enrichment.subscription_status = subscription.status;

          // For subscription events, set value to subscription amount
          if (event.event_name === 'Purchase' && subscription.items.data[0]) {
            const price = subscription.items.data[0].price;
            enrichment.value = (price.unit_amount || 0) / 100;
            enrichment.currency = price.currency.toUpperCase();
            enrichment.content_name = subscription.items.data[0].plan.nickname || 'Subscription';
          }
        }

        // Get invoices
        const invoices = await stripe.invoices.list({
          customer: customer.id,
          limit: 1
        });

        if (invoices.data.length > 0) {
          enrichment.stripe_invoice_id = invoices.data[0].id;
        }

        // Update event with enrichment
        const { error: updateError } = await supabase
          .from('capi_events_enriched')
          .update(enrichment)
          .eq('id', event.id);

        if (updateError) {
          console.error('Error updating event:', updateError);
        } else {
          enrichedEvents.push({ ...event, ...enrichment });
          console.log('Enriched event:', event.event_id);
        }
      } catch (err) {
        console.error('Error enriching event:', event.event_id, err);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        events_enriched: enrichedEvents.length,
        events: enrichedEvents.map(e => ({
          event_id: e.event_id,
          stripe_customer_id: e.stripe_customer_id,
          value: e.value
        }))
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in enrich-with-stripe:', error);
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
