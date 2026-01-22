import { Client } from "@hubspot/api-client";
import fs from "fs/promises";
import path from "path";

const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;

if (!HUBSPOT_API_KEY) {
  console.error("Please set HUBSPOT_API_KEY environment variable");
  process.exit(1);
}

const hubspotClient = new Client({ accessToken: HUBSPOT_API_KEY });

async function loadTargets() {
  const data = await fs.readFile(path.join(process.cwd(), "scripts/target_customers.json"), "utf-8");
  return JSON.parse(data);
}

const PROPERTIES = [
  "firstname", "lastname", "email", "phone", "jobtitle", "company", "city", "country",
  "hs_analytics_source", 
  "hs_analytics_source_data_1", 
  "hs_analytics_source_data_2",
  "utm_campaign", "utm_source", "utm_medium", "utm_content",
  "hs_analytics_first_url",
  "createdate", "lifecyclestage"
];

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function deepDiveCustomer(email: string) {
  try {
    // 1. Search Contact
    const searchResponse = await hubspotClient.crm.contacts.searchApi.doSearch({
      filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: email }] }],
      properties: PROPERTIES,
      limit: 1
    });

    if (searchResponse.results.length === 0) return null;

    const contact = searchResponse.results[0];
    const contactId = contact.id;
    const props = contact.properties;

    // 2. Fetch Deals (Search instead of Association API to avoid errors/rate limits)
    await sleep(200); // Rate limit guard
    const dealsSearch = await hubspotClient.crm.deals.searchApi.doSearch({
      filterGroups: [{ filters: [{ propertyName: "associations.contact", operator: "EQ", value: contactId }] }],
      properties: ["dealname", "amount", "dealstage", "closedate"],
      limit: 5
    }).catch(e => {
        // console.error(`Deal search failed for ${email}`, e.message); 
        return { results: [] };
    });

    // 3. Fetch Notes
    await sleep(200); // Rate limit guard
    // Note: Notes search might not support association filtering directly in all portals/versions.
    // If this fails, we just return empty notes.
    // The "Devin" logs showed searching CRM objects type NOTE with filterGroup. We try the same.
    // If standard search fails, we skip.
    let notes = [];
    try {
        const notesSearch = await hubspotClient.crm.objects.notes.searchApi.doSearch({
        filterGroups: [{ filters: [{ propertyName: "associations.contact", operator: "EQ", value: contactId }] }],
        properties: ["hs_note_body", "hs_timestamp"],
        limit: 3
        });
        notes = notesSearch.results;
    } catch (e) {
        // console.error("Notes search failed", e.message);
    }

    return {
      contact: props,
      deals: dealsSearch.results.map(d => d.properties),
      notes: notes.map(n => n.properties)
    };

  } catch (error) {
    console.error(`Error processing ${email}:`, error.message);
    return null;
  }
}

async function generateReport() {
  const emails = await loadTargets();
  let markdown = "# 🕵️‍♂️ Deep Dive Customer Audit\n\n";
  
  console.log(`Processing ${emails.length} customers sequentially to respect rate limits...`);

  for (const email of emails) {
    console.log(`Analyzing: ${email}...`);
    const result = await deepDiveCustomer(email);
    
    if (result) {
      const { contact, deals, notes } = result;
      
      markdown += `## 👤 ${contact.firstname} ${contact.lastname} (${contact.email})\n`;
      markdown += `**Job:** ${contact.jobtitle || 'N/A'} | **Company:** ${contact.company || 'N/A'}\n`;
      markdown += `**Location:** ${contact.city || 'N/A'}, ${contact.country || 'N/A'}\n\n`;
      
      markdown += `### 🎯 Marketing & Attribution\n`;
      markdown += `- **Source:** ${contact.hs_analytics_source}\n`;
      markdown += `- **Campaign:** ${contact.utm_campaign || contact.hs_analytics_source_data_2 || 'N/A'}\n`;
      markdown += `- **Medium:** ${contact.utm_medium || 'N/A'}\n`;
      markdown += `- **Ad Content:** ${contact.utm_content || contact.hs_analytics_source_data_1 || 'N/A'}\n`;
      markdown += `- **First URL:** \`${contact.hs_analytics_first_url || 'N/A'}\`\n\n`;

      if (deals.length > 0) {
        markdown += `### 💰 Deals (${deals.length})\n`;
        deals.forEach(d => {
          markdown += `- **${d.dealname}**: ${d.amount || 0} (Stage: ${d.dealstage}, Closed: ${d.closedate || 'Open'})\n`;
        });
        markdown += `\n`;
      }

      if (notes.length > 0) {
        markdown += `### 📝 Recent Notes (Top 3)\n`;
        notes.forEach(n => {
          const cleanNote = n.hs_note_body?.replace(/<[^>]*>/g, '').slice(0, 200).replace(/\n/g, ' ') || 'Empty';
          markdown += `- [${n.hs_timestamp}] ${cleanNote}...\n`;
        });
        markdown += `\n`;
      }
      markdown += `---\n\n`;
    } else {
        // Optional: log missing contacts to report
        // markdown += `## ❌ ${email} - Not found in HubSpot\n\n---\n\n`;
    }
    
    await sleep(500); // 0.5s delay between customers
  }

  await fs.writeFile("CUSTOMER_DEEP_DIVE_REPORT.md", markdown);
  console.log("\n✅ Report generated: CUSTOMER_DEEP_DIVE_REPORT.md");
}

generateReport();
