import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get all closed-lost deals
    const { data: lostDeals, error: dealsError } = await supabase
      .from('deals')
      .select('*')
      .in('stage', ['closedlost', 'closed_lost', 'lost'])
      .order('close_date', { ascending: false });

    if (dealsError) throw dealsError;

    if (!lostDeals || lostDeals.length === 0) {
      return new Response(JSON.stringify({ message: 'No lost deals found', inserted: 0 }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Get contacts for these deals
    const contactIds = [...new Set(lostDeals.map(d => d.contact_id).filter(Boolean))];
    const { data: contacts } = await supabase
      .from('contacts')
      .select('hubspot_contact_id, email, assigned_coach')
      .in('hubspot_contact_id', contactIds);

    const contactMap = new Map((contacts || []).map(c => [c.hubspot_contact_id, c]));

    // Map deals to loss_analysis entries matching actual schema
    const entries = lostDeals.map(deal => {
      const contact = contactMap.get(deal.contact_id);
      return {
        contact_email: contact?.email || null,
        hubspot_contact_id: deal.contact_id || null,
        deal_id: deal.hubspot_deal_id || deal.id,
        last_stage_reached: deal.stage_label || deal.stage || 'Unknown',
        fb_ad_id: null,
        campaign_name: null,
        lead_source: null,
        primary_loss_reason: 'Not specified',
        coach_name: contact?.assigned_coach || deal.owner_name || null,
        assessment_held: false,
        analyzed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
    });

    const { error: insertError } = await supabase
      .from('loss_analysis')
      .upsert(entries, { onConflict: 'deal_id', ignoreDuplicates: true });

    if (insertError) throw insertError;

    return new Response(JSON.stringify({ 
      message: `Populated loss_analysis with ${entries.length} entries`,
      inserted: entries.length 
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});
