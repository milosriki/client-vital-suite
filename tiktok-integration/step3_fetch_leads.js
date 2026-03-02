// STEP 3: Fetch native leads from TikTok Lead Gen forms and push them to HubSpot (with phone numbers)
// Run AFTER completing step2 and adding tokens to .env

require('dotenv').config({ path: '../.env' });

const ACCESS_TOKEN  = process.env.TIKTOK_ACCESS_TOKEN;
const ADVERTISER_ID = process.env.TIKTOK_ADVERTISER_ID;
const HUBSPOT_KEY   = process.env.HUBSPOT_API_KEY;

if (!ACCESS_TOKEN || !ADVERTISER_ID || !HUBSPOT_KEY) {
  console.error('❌ Missing env vars. Add TIKTOK_ACCESS_TOKEN, TIKTOK_ADVERTISER_ID, HUBSPOT_API_KEY to .env');
  process.exit(1);
}

// ─── STEP A: Get Lead Gen Forms ───────────────────────────────────────────────
async function getLeadForms() {
  const url = `https://business-api.tiktok.com/open_api/v1.3/lms/form/list/?advertiser_id=${ADVERTISER_ID}&page_size=100&page=1`;
  const res = await fetch(url, {
    headers: { 'Access-Token': ACCESS_TOKEN }
  });
  const data = await res.json();

  if (data.code !== 0) {
    throw new Error('Failed to get lead forms: ' + data.message);
  }

  return data.data?.forms || [];
}

// ─── STEP B: Get Leads For a Form ─────────────────────────────────────────────
async function getLeadsForForm(formId) {
  const url = `https://business-api.tiktok.com/open_api/v1.3/lms/form/leads/?advertiser_id=${ADVERTISER_ID}&form_id=${formId}&page_size=100&page=1`;
  const res = await fetch(url, {
    headers: { 'Access-Token': ACCESS_TOKEN }
  });
  const data = await res.json();

  if (data.code !== 0) {
    console.warn(`⚠️  Skipping form ${formId}: ${data.message}`);
    return [];
  }

  return data.data?.leads || [];
}

// ─── STEP C: Parse Lead Fields (name, email, phone, etc.) ─────────────────────
function parseLead(lead) {
  const fields = {};
  for (const f of (lead.question_answers || [])) {
    const key = (f.field_name || '').toLowerCase().replace(/\s+/g, '_');
    fields[key] = f.answer;
  }
  return {
    id:         lead.lead_id || lead.id,
    created_at: lead.create_time,
    first_name: fields.first_name || fields.name?.split(' ')[0] || '',
    last_name:  fields.last_name  || fields.name?.split(' ').slice(1).join(' ') || '',
    email:      fields.email       || fields.email_address || '',
    phone:      fields.phone       || fields.phone_number  || fields.mobile_number || '',
    raw:        fields,
  };
}

// ─── STEP D: Upsert Contact in HubSpot ────────────────────────────────────────
async function upsertHubSpotContact(lead) {
  const identifier = lead.email || lead.phone;
  if (!identifier) {
    console.log(`  ⚠️  Skipping lead ${lead.id} — no email or phone`);
    return;
  }

  const properties = {
    firstname:    lead.first_name,
    lastname:     lead.last_name,
    email:        lead.email,
    phone:        lead.phone,
    hs_lead_source: 'OTHER',
    // Custom property — marks this as a TikTok lead
    lead_source:  'TikTok',
    utm_source:   'tiktok',
    tiktok_lead_id: String(lead.id),
  };

  // Remove empty values to avoid overwriting existing data
  Object.keys(properties).forEach(k => { if (!properties[k]) delete properties[k]; });

  // Try to find by email first
  if (lead.email) {
    const searchRes = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${HUBSPOT_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: lead.email }] }],
        properties: ['email', 'phone', 'hs_object_id'],
        limit: 1,
      }),
    });
    const searchData = await searchRes.json();

    if (searchData.total > 0) {
      // Contact exists — PATCH to update phone number
      const contactId = searchData.results[0].id;
      const patchRes = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${HUBSPOT_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ properties }),
      });
      const patchData = await patchRes.json();
      if (patchRes.ok) {
        console.log(`  ✅ Updated existing contact: ${lead.email} — phone: ${lead.phone}`);
      } else {
        console.error(`  ❌ Failed to update ${lead.email}:`, patchData.message);
      }
      return;
    }
  }

  // Create new contact
  const createRes = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${HUBSPOT_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ properties }),
  });
  const createData = await createRes.json();
  if (createRes.ok) {
    console.log(`  ✅ Created contact: ${lead.email || lead.phone} — phone: ${lead.phone}`);
  } else {
    console.error(`  ❌ Failed to create contact:`, createData.message, JSON.stringify(properties));
  }
}

// ─── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🚀 TikTok → HubSpot Lead Sync\n');

  const forms = await getLeadForms();
  console.log(`📋 Found ${forms.length} lead forms\n`);

  let totalLeads = 0;
  let synced = 0;

  for (const form of forms) {
    console.log(`\n🔎 Form: "${form.name}" (ID: ${form.form_id || form.id})`);
    const leads = await getLeadsForForm(form.form_id || form.id);
    console.log(`   Leads: ${leads.length}`);
    totalLeads += leads.length;

    for (const rawLead of leads) {
      const lead = parseLead(rawLead);
      console.log(`  → Processing: ${lead.email || lead.phone || lead.id}`);
      await upsertHubSpotContact(lead);
      synced++;
    }
  }

  console.log(`\n🎉 Done! Processed ${synced} / ${totalLeads} leads → HubSpot\n`);
}

main();
