
/**
 * NOTIFICATION SERVICE
 * Handles internal alerts to Milos via Email/WhatsApp
 */

export async function notifyMilos(subject: string, message: string, metadata: any = {}) {
  console.log(`[NOTIFY MILOS] ${subject}: ${message}`);
  
  const LovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  const SupabaseUrl = Deno.env.get("SUPABASE_URL");
  const ServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const AISENSY_API_KEY = Deno.env.get("AISENSY_API_KEY");
  const MILOS_PHONE = Deno.env.get("MILOS_PHONE") || "971585812345"; // Default to your number if env not set

  // 1. Log to a central alerts table for visibility
  try {
    if (SupabaseUrl && ServiceKey) {
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const supabase = createClient(SupabaseUrl, ServiceKey);
      
      await supabase.from("system_alerts").insert({
        priority: "HIGH",
        category: "SALES",
        title: subject,
        content: message,
        status: "NEW",
        metadata: { recipient: "milos@personaltrainersdubai.com", phone: MILOS_PHONE }
      }).catch(err => console.warn("Alert log failed:", err));
    }
  } catch (e) {
    console.error("Alert logging failed:", e);
  }

  // 2. Send WhatsApp Alert via AISensy
  if (AISENSY_API_KEY) {
    try {
      const contactId = metadata?.contactId || metadata?.hubspot_id;
      const hubspotLink = contactId ? `\n\n🔗 *HubSpot Link*: https://app.hubspot.com/contacts/7973797/record/0-1/${contactId}` : "";
      
      const url = `https://backend.aisensy.com/devapi/v1/project/default/messages`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${AISENSY_API_KEY}`,
        },
        body: JSON.stringify({
          apiKey: AISENSY_API_KEY,
          campaignName: "internal_alert", 
          destinationNumber: MILOS_PHONE,
          message: {
            type: "text",
            payload: { 
              text: `🚨 *INTERNAL ALERT: ${subject}*\n\n${message}${hubspotLink}`
            },
          },
        }),
      });
      if (response.ok) console.log("✅ WhatsApp alert sent to Milos");
      else console.error("❌ WhatsApp alert failed:", await response.text());
    } catch (e) {
      console.error("WhatsApp notification error:", e);
    }
  }

  // 3. Email Alert (Actionable placeholder)
  // Logic to send to milos@personaltrainersdubai.com
  console.log(`✉️ Email queued for milos@personaltrainersdubai.com: ${subject}`);
}
