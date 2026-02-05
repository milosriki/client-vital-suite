import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { verifyAuth } from "../_shared/auth-middleware.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    try { verifyAuth(req); } catch(e) { return new Response("Unauthorized", {status: 401}); } // Security Hardening
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { sheet_data, type } = await req.json();
    
    if (!sheet_data || !Array.isArray(sheet_data)) {
      throw new Error("Invalid data format");
    }

    // 1. CEO Log: Audit Trail
    await supabase.from('excel_sync_logs').insert({
      raw_data: sheet_data,
      status: 'synced',
      type: type || 'client_audit',
      synced_at: new Date().toISOString()
    });

    if (type === 'coaches') {
      for (const coach of sheet_data) {
        await supabase.from('staff').upsert({
          name: coach.name || coach["Name"],
          role: 'coach',
          email: coach.email || coach["Email"] || null,
          status: coach.status || coach["Status"] || 'active',
          updated_at: new Date().toISOString()
        }, { onConflict: 'name' });
      }
    } else {
      // 2. CEO Activity Audit: VALIDATION MODE
      for (const entry of sheet_data) {
        // Handle flexible headers from various sheet versions
        const clientName = entry.client_name || entry["Milan M"] || entry["Client Name"];
        const salesRep = entry.sales_rep || entry["SALES REP"] || entry["Sales Rep"];
        const assignedCoach = entry.assigned_coach || entry["SALES MANAGER"] || entry["Assigned Coach"];
        const status = entry.status || entry["STATUS"] || entry["Current Status"];

        if (!clientName) continue;

        // Find existing system status for discrepancy detection
        const { data: profile } = await supabase
          .from('customer_profiles')
          .select('stripe_status, hubspot_status')
          .ilike('full_name', clientName)
          .single();

        const systemStatus = profile?.stripe_status || profile?.hubspot_status || 'NOT_IN_SYSTEM';
        const isDiscrepancy = status && systemStatus !== 'NOT_IN_SYSTEM' && 
                              status.toLowerCase().trim() !== systemStatus.toLowerCase();

        // Log the audit event
        await supabase.from('management_activity_audit').insert({
          client_name: clientName,
          recorded_status: status,
          system_status: systemStatus,
          assigned_coach: assignedCoach,
          sales_rep: salesRep,
          discrepancy_detected: isDiscrepancy,
          last_sync: new Date().toISOString()
        });

        // Update the profile with latest manual assignments (Milan M's truth)
        await supabase.from('customer_profiles').upsert({
          full_name: clientName,
          assigned_coach: assignedCoach,
          sales_rep: salesRep,
          last_manual_sync: new Date().toISOString()
        }, { onConflict: 'full_name' });
      }
    }

    return new Response(JSON.stringify({ success: true, message: "Audit data processed successfully." }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});