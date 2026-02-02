import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { HubSpotSyncManager } from "../_shared/hubspot-sync-manager.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Dialogflow Request Types
interface DialogflowRequest {
  responseId: string;
  session: string;
  queryResult: {
    queryText: string;
    parameters: Record<string, any>;
    allRequiredParamsPresent: boolean;
    fulfillmentText: string;
    fulfillmentMessages: any[];
    outputContexts: any[];
    intent: {
      name: string;
      displayName: string;
    };
    intentDetectionConfidence: number;
    languageCode: string;
  };
  originalDetectIntentRequest?: {
    source: string;
    payload?: {
      data?: {
        From?: string; // WhatsApp Phone Number (e.g. "14155238886")
        ProfileName?: string;
      };
      // AiSensy specific payload structure might vary, generic fallback
      sender?: {
        phone?: string;
        name?: string;
      }
    };
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Initialize HubSpot Manager
    const HUBSPOT_ACCESS_TOKEN = Deno.env.get('HUBSPOT_ACCESS_TOKEN');
    const hubspotManager = HUBSPOT_ACCESS_TOKEN ? new HubSpotSyncManager(supabase, HUBSPOT_ACCESS_TOKEN) : null;

    const request: DialogflowRequest = await req.json();
    const intentName = request.queryResult.intent.displayName;
    const parameters = request.queryResult.parameters;
    
    // 1. Identify User (WhatsApp Phone)
    let userPhone = request.originalDetectIntentRequest?.payload?.data?.From || 
                    request.originalDetectIntentRequest?.payload?.sender?.phone;
                    
    // Clean phone number
    if (userPhone) {
      userPhone = userPhone.replace('whatsapp:', '').replace('+', '');
    }

    const userName = request.originalDetectIntentRequest?.payload?.data?.ProfileName || 
                     request.originalDetectIntentRequest?.payload?.sender?.name || 
                     'WhatsApp User';

    console.log(`[Dialogflow] Intent: ${intentName}, User: ${userPhone} (${userName})`);

    // 2. AUTO-SYNC: Ensure user exists in CRM (HubSpot + Supabase)
    if (userPhone && hubspotManager) {
        // Run in background to not block the bot response too long
        // But for "Book Appointment" we might want to wait to attach the meeting
        await syncUserToCRM(supabase, hubspotManager, userPhone, userName);
    }

    let responseText = "I didn't understand that.";

    // 3. Handle Intents
    switch (intentName) {
      case 'Check Availability':
        responseText = await checkAvailability(supabase, parameters);
        break;

      case 'Book Appointment':
        responseText = await bookAppointment(supabase, hubspotManager, userPhone, userName, parameters);
        break;

      case 'Welcome Intent':
        responseText = `Hi ${userName}! I can help you book an appointment. When would you like to come in?`;
        break;
        
      case 'Transfer to Agent':
        // Special response to signal AiSensy to stop bot?
        // Usually handled by "Human Handoff" settings in AiSensy, but we can return a text.
        responseText = "Connecting you to a human agent now...";
        await notifyHumanAgent(supabase, userPhone, "User requested human agent via Dialogflow");
        break;

      default:
        responseText = request.queryResult.fulfillmentText || "I'm not sure how to help with that.";
    }

    // 4. Return Dialogflow Response
    return new Response(JSON.stringify({
      fulfillmentText: responseText
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Dialogflow] Error:', error);
    return new Response(JSON.stringify({
      fulfillmentText: "Sorry, I encountered an error while processing your request."
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// --- HELPER FUNCTIONS ---

async function syncUserToCRM(supabase: any, hubspotManager: any, phone: string, name: string) {
    // 1. Check/Create in Supabase
    const { data: existing } = await supabase
        .from('contacts')
        .select('id, hubspot_id')
        .eq('phone', phone)
        .single();

    if (!existing) {
        console.log(`[Dialogflow] New lead detected: ${phone}`);
        
        // Create in Supabase
        const { data: newContact, error } = await supabase.from('contacts').insert({
            phone: phone,
            first_name: name.split(' ')[0],
            last_name: name.split(' ').slice(1).join(' ') || '',
            source: 'whatsapp_bot',
            status: 'new'
        }).select().single();

        if (error) {
            console.error('Error creating contact:', error);
            return;
        }

        // Sync to HubSpot
        try {
            // Check if exists in HubSpot first
            const search = await hubspotManager.fetchHubSpot('contacts', {
                filterGroups: [{ filters: [{ propertyName: 'phone', operator: 'CONTAINS_TOKEN', value: phone }] }],
                limit: 1
            });

            if (search.results.length === 0) {
                // Create in HubSpot
                const hubspotContact = await hubspotManager.executeJob({
                    operation: 'create',
                    objectType: 'contact',
                    data: {
                        properties: {
                            firstname: name.split(' ')[0],
                            lastname: name.split(' ').slice(1).join(' ') || '',
                            phone: phone,
                            lifecyclestage: 'lead',
                            hs_lead_status: 'NEW'
                        }
                    }
                });
                
                // Update Supabase with HubSpot ID
                await supabase.from('contacts').update({ hubspot_id: hubspotContact.id }).eq('id', newContact.id);
                console.log(`[Dialogflow] Created HubSpot contact: ${hubspotContact.id}`);
            }
        } catch (hsError) {
            console.error('HubSpot Sync Error:', hsError);
        }
    }
}

async function checkAvailability(supabase: any, params: any): Promise<string> {
    const dateStr = params.date; // ISO string from Dialogflow
    const timeStr = params.time; // ISO string

    if (!dateStr || !timeStr) return "Please provide both a date and time.";

    const startTime = new Date(dateStr);
    // Merge time into date if needed, usually Dialogflow sends full ISO strings
    // Simple logic: Check if any appointment overlaps
    
    // Round to nearest hour for simplicity in this demo
    const checkStart = new Date(dateStr); 
    // Note: Parsing Dialogflow dates can be tricky, assuming standard ISO for now
    
    const { count } = await supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('start_time', checkStart.toISOString()) // Exact match for demo
        .eq('status', 'scheduled');

    if (count && count > 0) {
        return "Sorry, that time is already booked. Please choose another time.";
    }

    return "Yes, that time is available! Would you like to book it?";
}

async function bookAppointment(supabase: any, hubspotManager: any, phone: string, name: string, params: any): Promise<string> {
    const dateStr = params.date;
    const timeStr = params.time;
    
    if (!dateStr || !timeStr) return "I need a date and time to book the appointment.";
    
    // 1. Get Contact ID
    const { data: contact } = await supabase.from('contacts').select('id, hubspot_id').eq('phone', phone).single();
    if (!contact) return "I couldn't find your contact details. Please start over.";

    // 2. Create Appointment in Supabase
    const startTime = new Date(dateStr);
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour duration default

    const { error } = await supabase.from('appointments').insert({
        contact_id: contact.id,
        title: `Appointment with ${name}`,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        status: 'scheduled'
    });

    if (error) {
        console.error('Booking error:', error);
        return "I had trouble booking that slot. It might have just been taken.";
    }

    // 3. Sync Meeting to HubSpot
    if (hubspotManager && contact.hubspot_id) {
        try {
            await hubspotManager.executeJob({
                operation: 'create',
                objectType: 'engagement', // Meeting is an engagement
                data: {
                    engagement: {
                        active: true,
                        ownerId: null, // Assign to default or bot owner
                        type: "MEETING",
                        timestamp: Date.now()
                    },
                    associations: {
                        contactIds: [parseInt(contact.hubspot_id)],
                        companyIds: [],
                        dealIds: [],
                        ownerIds: []
                    },
                    metadata: {
                        "body": "Booked via WhatsApp Bot",
                        "startTime": startTime.getTime(),
                        "endTime": endTime.getTime(),
                        "title": `WhatsApp Appointment: ${name}`
                    }
                }
            });
        } catch (hsError) {
            console.error('HubSpot Meeting Sync Error:', hsError);
        }
    }

    return `Confirmed! Your appointment is set for ${startTime.toLocaleString()}.`;
}

async function notifyHumanAgent(supabase: any, phone: string, message: string) {
    // Insert into a notification table or trigger an alert
    await supabase.from('security_alerts').insert({
        alert_type: 'HUMAN_HANDOFF',
        severity: 'medium',
        message: `${message} - Phone: ${phone}`,
        created_at: new Date().toISOString()
    });
}
