// TikTok → HubSpot Lead Sync
// PTD FITNESS | App ID: 7610715896306204673
//
// RUN: node tiktok-integration/sync.js
//
// TO RE-AUTHORIZE: https://business-api.tiktok.com/portal/auth?app_id=7610715896306204673&state=ptd_lead_sync&redirect_uri=https%3A%2F%2Fwww.personaltrainersdubai.com

const ACCESS_TOKEN  = process.env.TIKTOK_ACCESS_TOKEN || '';
const ADVERTISER_ID = '7103482684956999682';
const HUBSPOT_KEY   = process.env.HUBSPOT_API_KEY || '';

// ─── CSV PARSER (RFC 4180 — handles commas inside quoted fields) ───────────────
function parseCSVLine(line) {
  const fields = [];
  let i = 0, field = '';
  while (i < line.length) {
    if (line[i] === '"') {
      i++;
      while (i < line.length) {
        if (line[i] === '"' && line[i+1] === '"') { field += '"'; i += 2; }
        else if (line[i] === '"') { i++; break; }
        else { field += line[i++]; }
      }
      if (line[i] === ',') i++;
    } else {
      while (i < line.length && line[i] !== ',') field += line[i++];
      if (line[i] === ',') i++;
    }
    fields.push(field.trim());
    field = '';
  }
  return fields;
}

function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1)
    .filter(l => l.trim())
    .map(l => {
      const vals = parseCSVLine(l);
      const row = {};
      headers.forEach((h, i) => { row[h] = vals[i] || ''; });
      return row;
    });
}

// ─── PHONE NORMALIZATION ───────────────────────────────────────────────────────
function normalizePhone(raw) {
  if (!raw) return '';
  return raw.replace(/\s+/g, '').replace(/[^\d+]/g, '');
}

// ─── GET ALL PUBLISHED PAGES ───────────────────────────────────────────────────
async function getAllPages() {
  const all = [];
  for (let p = 1; p <= 10; p++) {
    const r = await fetch(
      `https://business-api.tiktok.com/open_api/v1.3/page/get/?advertiser_id=${ADVERTISER_ID}&page=${p}&page_size=50`,
      { headers: { 'Access-Token': ACCESS_TOKEN } }
    );
    const d = await r.json();
    if (!d.data?.list?.length) break;
    all.push(...d.data.list.filter(pg => pg.status === 'PUBLISHED'));
    if (d.data.page_info && p >= d.data.page_info.total_page) break;
  }
  return all;
}

// ─── CREATE DOWNLOAD TASK AND GET CSV ─────────────────────────────────────────
async function getLeadsCSVForPage(pageId) {
  // Create task
  const tr = await fetch('https://business-api.tiktok.com/open_api/v1.3/page/lead/task/', {
    method: 'POST',
    headers: { 'Access-Token': ACCESS_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ advertiser_id: ADVERTISER_ID, page_id: pageId }),
  });
  const td = await tr.json();
  if (td.code !== 0) { console.log(`  Task create failed for page ${pageId}:`, td.message); return []; }
  
  const taskId = td.data?.task_id;
  // Download immediately (task is synchronous for small volumes)
  const dr = await fetch(
    `https://business-api.tiktok.com/open_api/v1.3/page/lead/task/download/?advertiser_id=${ADVERTISER_ID}&task_id=${taskId}`,
    { headers: { 'Access-Token': ACCESS_TOKEN } }
  );
  const text = await dr.text();
  if (!text.includes(',')) return [];
  return parseCSV(text);
}

// ─── MAP TIKTOK CSV FIELDS → HUBSPOT PROPERTIES ───────────────────────────────
function buildHubSpotProps(lead) {
  const name  = (lead['Name'] || '').trim();
  const email = (lead['Email'] || '').trim().toLowerCase();
  const phone = normalizePhone(lead['Phone number']);

  const firstName = name.split(' ')[0] || '';
  const lastName  = name.split(' ').slice(1).join(' ') || '';

  // Location: combine emirate + area into HubSpot "location" field
  const emirate  = (lead['In which Emirate do you live?'] || '').trim();
  const abuArea  = (lead['Which Abu Dhabi area best describes your home location?'] || '').trim();
  const dubaiArea= (lead['Which Dubai area best describes your home location?'] || '').trim();
  const area     = abuArea || dubaiArea;
  const location = area ? `${emirate}${emirate && area ? ' – ' : ''}${area}` : emirate;

  const props = {};
  if (firstName) props.firstname = firstName;
  if (lastName)  props.lastname  = lastName;
  if (email)     props.email     = email;
  if (phone)     props.phone     = phone;

  // TikTok ad attribution — stored in existing HubSpot custom properties
  if (lead['ad_id'])        props.ad_id       = lead['ad_id'];
  if (lead['campaign_id'])  props.campaign_id  = lead['campaign_id'];

  // Demographics & goals — for appointment setter context
  const gender = (lead['Gender'] || '').trim();
  if (gender)   props.gender = gender;
  if (location) props.location = location;

  const goal = (lead["What's your #1 fitness goal?"] || '').trim();
  if (goal)     props.what_is_your_biggest_challenge_ = goal;

  return { props, email, phone, name, firstName, lastName };
}

// ─── UPSERT CONTACT IN HUBSPOT ────────────────────────────────────────────────
async function upsertHubSpot(lead) {
  const { props, email, phone, firstName } = buildHubSpotProps(lead);

  if (!email && !phone) return 'skip';

  // 1️⃣ Match by email (catches email-only ghost contacts from same source)
  if (email) {
    const sr = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
      method: 'POST',
      headers: { Authorization: `Bearer ${HUBSPOT_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: email }] }], properties: ['email','phone'], limit: 1 }),
    });
    const sd = await sr.json();
    if (sd.total > 0) {
      const cid = sd.results[0].id;
      const was = sd.results[0].properties?.phone;
      const pr = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${cid}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${HUBSPOT_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ properties: props }),
      });
      if (pr.status === 200) return was ? (was === phone ? 'same' : 'fixed') : 'phone-added';
      return 'patch-err:' + pr.status;
    }
  }

  // 2️⃣ Name-based fallback — catches ghost contacts with a different email
  if (firstName) {
    const filters = [{ propertyName: 'firstname', operator: 'EQ', value: firstName }];
    const lastName = props.lastname;
    if (lastName) filters.push({ propertyName: 'lastname', operator: 'EQ', value: lastName });
    const nr = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
      method: 'POST',
      headers: { Authorization: `Bearer ${HUBSPOT_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ filterGroups: [{ filters }], properties: ['firstname','lastname','email','phone'], limit: 5 }),
    });
    const nd = await nr.json();
    // Find matches that have NO phone (ghost contacts)
    const ghost = nd.results?.find(c => !c.properties?.phone);
    if (ghost) {
      // Don't overwrite their existing email — just add phone + name
      const patchProps = { phone };
      if (firstName) patchProps.firstname = firstName;
      if (lastName)  patchProps.lastname  = lastName;
      const pr = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${ghost.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${HUBSPOT_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ properties: patchProps }),
      });
      if (pr.status === 200) return 'ghost-filled';
      return 'ghost-patch-err:' + pr.status;
    }
  }

  // 3️⃣ Truly new — create the contact
  const cr = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${HUBSPOT_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ properties: props }),
  });
  const cd = await cr.json();
  if (cr.status === 201) return 'created:' + cd.id;
  if (cr.status === 409) return 'duplicate';
  return 'err:' + cr.status;
}

// ─── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🚀 TikTok → HubSpot Lead Sync\n');
  
  const pages = await getAllPages();
  console.log(`📋 Found ${pages.length} published pages\n`);

  const stats = { created: 0, phoneAdded: 0, fixed: 0, ghostFilled: 0, same: 0, dupe: 0, skip: 0, err: 0, totalLeads: 0 };

  for (const page of pages) {
    const leads = await getLeadsCSVForPage(page.page_id);
    if (!leads.length) continue;
    console.log(`\n📋 Page ${page.page_id} — ${leads.length} leads`);
    stats.totalLeads += leads.length;

    for (const lead of leads) {
      const result = await upsertHubSpot(lead);
      const email = lead['Email']?.toLowerCase() || '';
      const phone = normalizePhone(lead['Phone number']);
      const name  = lead['Name'] || '';

      if (result.startsWith('created'))    { stats.created++;    console.log('✅ CREATE', (email||phone).slice(0,32).padEnd(34), '☎️', phone, '👤', name); }
      else if (result === 'phone-added')   { stats.phoneAdded++; console.log('📞 PHONE+', email.slice(0,32).padEnd(34), '☎️', phone, '👤', name); }
      else if (result === 'ghost-filled')  { stats.ghostFilled++;console.log('👻 GHOST+', name.padEnd(22), '☎️', phone, '(was email-only)'); }
      else if (result === 'fixed')         { stats.fixed++;      console.log('🔧 FIXED ', email.slice(0,32).padEnd(34), '☎️', phone); }
      else if (result === 'same')          { stats.same++;       console.log('▶️  SAME  ', email.slice(0,32).padEnd(34), '☎️', phone); }
      else if (result === 'duplicate')     { stats.dupe++;       console.log('♊  DUPE  ', email.slice(0,32)); }
      else if (result === 'skip')          { stats.skip++; }
      else                                 { stats.err++;        console.log('❌ ERR   ', result.slice(0,80)); }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✅ Total leads: ${stats.totalLeads}`);
  console.log(`   Created:     ${stats.created}`);
  console.log(`   Phone added: ${stats.phoneAdded}`);
  console.log(`   Ghost fixed: ${stats.ghostFilled}`);
  console.log(`   Fixed:       ${stats.fixed}`);
  console.log(`   Unchanged:   ${stats.same}`);
  console.log(`   Duplicates:  ${stats.dupe}`);
  console.log(`   Errors:      ${stats.err}`);

  // ─── GLOBAL DEDUP PASS ────────────────────────────────────────────────────────
  // Find ALL HubSpot contacts with no phone, created in last 7 days
  // Match by name to an existing contact that HAS a phone → patch the duplicate
  console.log('\n🔍 Running global name-dedup pass (last 7 days, no phone)...\n');
  const since7d = Date.now() - 7 * 24 * 60 * 60 * 1000;
  let dedupFixed = 0, after = undefined;

  while (true) {
    const body = {
      filterGroups: [{ filters: [
        { propertyName: 'createdate', operator: 'GTE', value: since7d.toString() },
      ]}],
      properties: ['firstname','lastname','email','phone','createdate'],
      sorts: [{ propertyName: 'createdate', direction: 'DESCENDING' }],
      limit: 100,
    };
    if (after) body.after = after;

    const pr = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
      method: 'POST',
      headers: { Authorization: `Bearer ${HUBSPOT_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const pd = await pr.json();
    const noPhoneContacts = (pd.results || []).filter(c => !c.properties.phone);

    for (const contact of noPhoneContacts) {
      const { firstname, lastname, email } = contact.properties;
      if (!firstname) continue;

      // Search for matching contact with same name that HAS a phone
      const filters = [{ propertyName: 'firstname', operator: 'EQ', value: firstname }];
      if (lastname) filters.push({ propertyName: 'lastname', operator: 'EQ', value: lastname });

      const nr = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
        method: 'POST',
        headers: { Authorization: `Bearer ${HUBSPOT_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ filterGroups: [{ filters }], properties: ['firstname','lastname','email','phone'], limit: 5 }),
      });
      const nd = await nr.json();
      const donor = nd.results?.find(c => c.id !== contact.id && c.properties.phone);
      if (!donor) continue;

      // Patch the no-phone contact with phone from the existing record
      const patch = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${contact.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${HUBSPOT_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ properties: { phone: donor.properties.phone } }),
      });
      if (patch.status === 200) {
        dedupFixed++;
        console.log(`🔗 DEDUP  ${(firstname+' '+lastname).trim().padEnd(22)} ☎️ ${donor.properties.phone} (${email} ← ${donor.properties.email})`);
      }
    }

    if (!pd.paging?.next?.after) break;
    after = pd.paging.next.after;
  }

  if (dedupFixed === 0) console.log('   No duplicates found.');
  else console.log(`\n   ${dedupFixed} duplicate(s) fixed by name-match.`);
}

main();

