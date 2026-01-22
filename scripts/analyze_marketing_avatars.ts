import { Client } from "@hubspot/api-client";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;

if (!HUBSPOT_API_KEY) {
  console.error("Please set HUBSPOT_API_KEY environment variable");
  process.exit(1);
}

const hubspotClient = new Client({ accessToken: HUBSPOT_API_KEY });

const TARGET_EMAILS = JSON.parse(fs.readFileSync(path.resolve(__dirname, "target_customers.json"), "utf-8"));

const CONTACT_PROPERTIES = [
  "firstname", "lastname", "email", "phone", "mobilephone",
  "jobtitle", "company", "lifecyclestage",
  "hs_analytics_source", 
  "hs_analytics_source_data_1", 
  "hs_analytics_source_data_2",
  "hs_latest_source_data_1",
  "hs_latest_source_data_2",
  "hs_latest_source",
  "utm_campaign", "utm_source", "utm_medium", "utm_content", "utm_term",
  "hs_analytics_first_url",
  "hs_analytics_first_referrer",
  "first_conversion_event_name",
  "first_conversion_date",
  "recent_conversion_event_name",
  "recent_conversion_date",
  "num_conversion_events",
  "createdate", 
  "first_deal_created_date",
  "hs_lifecyclestage_customer_date",
  "num_associated_deals", 
  "notes_last_updated",
  "hs_analytics_first_touch_converting_campaign",
  "hs_analytics_last_touch_converting_campaign",
  "hs_facebook_click_id",
  "fbclid",
  "hs_google_click_id"
];

async function analyzeMarketingAvatars() {
  console.log(`🔍 Starting Deep Dive on ${TARGET_EMAILS.length} customers...\n`);
  
  let markdownReport = "# 🕵️ CUSTOMER DEEP DIVE REPORT\n\n";
  markdownReport += `Generated: ${new Date().toLocaleString()}\n\n`;

  for (const email of TARGET_EMAILS) {
    console.log(`Analyzing: ${email}...`);
    try {
      // 1. Search Contact
      const searchResponse = await hubspotClient.crm.contacts.searchApi.doSearch({
        filterGroups: [{
          filters: [{ propertyName: "email", operator: "EQ", value: email }]
        }],
        properties: CONTACT_PROPERTIES,
        limit: 1
      });

      if (searchResponse.results.length > 0) {
        const contact = searchResponse.results[0];
        const props = contact.properties;
        const contactId = contact.id;

        markdownReport += `## 👤 ${props.firstname} ${props.lastname} (${email})\n\n`;
        markdownReport += `**ID:** ${contactId} | **Phone:** ${props.phone || props.mobilephone || 'N/A'} | **Created:** ${props.createdate}\n`;
        markdownReport += `**Job:** ${props.jobtitle || 'N/A'} at ${props.company || 'N/A'}\n`;
        markdownReport += `**Lifecycle:** ${props.lifecyclestage} (Customer since: ${props.hs_lifecyclestage_customer_date || 'N/A'})\n\n`;

        // 2. Marketing Attribution
        markdownReport += `### 🎯 Marketing & Attribution\n`;
        markdownReport += `- **Source:** ${props.hs_analytics_source}\n`;
        markdownReport += `- **Platform:** ${props.hs_analytics_source_data_1 || 'N/A'}\n`;
        markdownReport += `- **Campaign (Source Data 2):** ${props.hs_analytics_source_data_2 || 'N/A'}\n`;
        markdownReport += `- **UTM Campaign:** ${props.utm_campaign || 'N/A'}\n`;
        markdownReport += `- **UTM Medium:** ${props.utm_medium || 'N/A'}\n`;
        markdownReport += `- **Ad Content:** ${props.utm_content || 'N/A'}\n`;
        markdownReport += `- **First URL:** \`${props.hs_analytics_first_url || 'N/A'}\`\n`;
        markdownReport += `- **First Conversion:** ${props.first_conversion_event_name || 'N/A'} (${props.first_conversion_date || ''})\n`;
        markdownReport += `- **Recent Conversion:** ${props.recent_conversion_event_name || 'N/A'} (${props.recent_conversion_date || ''})\n`;
        
        // Advanced Attribution
        if (props.hs_facebook_click_id || props.fbclid || props.hs_google_click_id) {
             markdownReport += `- **Click IDs:** FB: ${props.hs_facebook_click_id || props.fbclid || 'N/A'}, Google: ${props.hs_google_click_id || 'N/A'}\n`;
        }

        // Extract Ad IDs from URL if possible
        if (props.hs_analytics_first_url) {
            try {
                const urlObj = new URL(props.hs_analytics_first_url);
                const hsa_cam = urlObj.searchParams.get("hsa_cam");
                const hsa_ad = urlObj.searchParams.get("hsa_ad");
                if (hsa_cam || hsa_ad) {
                    markdownReport += `- **Extracted IDs:** Campaign: ${hsa_cam}, Ad: ${hsa_ad}\n`;
                }
            } catch (e) {
                // Ignore URL parse errors
            }
        }
        markdownReport += `\n`;

        // 3. Fetch Associated Notes (Engagements)
        try {
            const notesSearch = await hubspotClient.crm.objects.notes.searchApi.doSearch({
                filterGroups: [{
                    filters: [{ propertyName: "associations.contact", operator: "EQ", value: contactId }]
                }],
                properties: ["hs_note_body", "hs_timestamp"],
                limit: 3,
                sorts: [{ propertyName: "hs_timestamp", direction: "DESCENDING" }]
            });
            
            if (notesSearch.results.length > 0) {
                markdownReport += `### 📝 Recent Notes\n`;
                notesSearch.results.forEach(note => {
                    const body = note.properties.hs_note_body || "";
                    const cleanBody = body.replace(/<[^>]*>?/gm, '').slice(0, 200).trim();
                    markdownReport += `- **${new Date(note.properties.hs_timestamp).toLocaleDateString()}:** ${cleanBody}...\n`;
                });
                markdownReport += `\n`;
            }
        } catch (e) {
             // console.error("   Note search failed", e.message);
        }

        // 4. Fetch Associated Deals
        try {
             const dealsSearch = await hubspotClient.crm.deals.searchApi.doSearch({
                filterGroups: [{
                    filters: [{ propertyName: "associations.contact", operator: "EQ", value: contactId }]
                }],
                properties: ["dealname", "amount", "dealstage", "closedate"],
                limit: 5,
                sorts: [{ propertyName: "closedate", direction: "DESCENDING" }]
            });

            if (dealsSearch.results.length > 0) {
                markdownReport += `### 💰 Deal History\n`;
                dealsSearch.results.forEach(deal => {
                    markdownReport += `- **${deal.properties.dealname}**: ${deal.properties.amount || 0} (Stage: ${deal.properties.dealstage}, Closed: ${deal.properties.closedate || 'Open'})\n`;
                });
                markdownReport += `\n`;
            }
        } catch (e) {
            // console.error("   Deal search failed", e.message);
        }

        markdownReport += `\n---\n\n`;

      } else {
        console.log(`❌ Not found: ${email}`);
        markdownReport += `## ❌ ${email} - Not Found in HubSpot\n\n---\n\n`;
      }
    } catch (error) {
      console.error(`Error fetching ${email}:`, error.message);
      // Wait a bit if rate limited
      if (error.code === 429) {
          console.log("Rate limited, waiting 2s...");
          await new Promise(r => setTimeout(r, 2000));
      }
      markdownReport += `## ⚠️ ${email} - Error fetching data\n\n---\n\n`;
    }
    
    // Add small delay to avoid rate limits
    await new Promise(r => setTimeout(r, 200));
  }

  fs.writeFileSync("CUSTOMER_DEEP_DIVE_REPORT_2.md", markdownReport);
  console.log("\n✅ Report generated: CUSTOMER_DEEP_DIVE_REPORT_2.md");
}

analyzeMarketingAvatars();
