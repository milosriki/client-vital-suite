// TikTok → HubSpot Lead Sync — HYBRID (Native + CSV Backfill)
// PTD FITNESS | App ID: 7610715896306204673
//
// HOW IT WORKS:
//   1. NATIVE CHECK  — fast: checks latest lead on every form via /page/lead/get/
//                     if a new lead (lead_id not seen before) → sync immediately
//   2. CSV BACKFILL  — runs once a day: downloads full CSV for all leads in case
//                     native API missed any (handles historical data)
//
// MISTAKES FIXED vs old approach:
//   ✅ Native JSON API avoids CSV parsing fragility for new leads
//   ✅ lead_id tracking — skips already-processed leads on repeat runs
//   ✅ phone_number field correct (was 'Phone number' in CSV, now exact key)
//   ✅ No more redundant re-processing of 90+ leads every run
//   ✅ Global name-dedup fixes Calendly/Typeform duplicates
//
// RUN:       node tiktok-integration/sync.js
// RE-AUTH:   https://business-api.tiktok.com/portal/auth?app_id=7610715896306204673&state=ptd_lead_sync&redirect_uri=https%3A%2F%2Fwww.personaltrainersdubai.com

import { readFileSync, writeFileSync } from 'fs';

const ACCESS_TOKEN  = 'REDACTED_ROTATE_THIS_KEY';
const ADVERTISER_ID = '7103482684956999682';
const HUBSPOT_KEY   = 'REDACTED_ROTATE_THIS_KEY';

// Persist processed lead IDs so we don't re-process on every run
const SEEN_FILE = '/tmp/tiktok_seen_leads.json';
function loadSeen() {
  try { return new Set(JSON.parse(readFileSync(SEEN_FILE, 'utf8'))); }
  catch { return new Set(); }
}
function saveSeen(seen) {
  writeFileSync(SEEN_FILE, JSON.stringify([...seen]));
}

// ─── PHONE NORMALIZER ─────────────────────────────────────────────────────────
function normalizePhone(raw) {
  if (!raw) return '';
  return raw.replace(/\s+/g, '').replace(/[^\d+]/g, '');
}

// ─── CSV PARSER (RFC 4180 — handles commas inside quoted fields) ───────────────
function parseCSVLine(line) {
  const fields = [];
  let i = 0, field = '', inQuotes = false;
  while (i < line.length) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { field += '"'; i += 2; continue; }
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      fields.push(field); field = '';
    } else {
      field += ch;
    }
    i++;
  }
  fields.push(field);
  return fields;
}
function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map(l => {
    const vals = parseCSVLine(l);
    const obj = {};
    headers.forEach((h, i) => { obj[h.trim()] = (vals[i] || '').trim(); });
    return obj;
  }).filter(r => Object.values(r).some(v => v));
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

// ─── NATIVE: get LATEST lead on a page (fast check) ──────────────────────────
async function getLatestNativeLead(pageId) {
  const r = await fetch(
    `https://business-api.tiktok.com/open_api/v1.3/page/lead/get/?advertiser_id=${ADVERTISER_ID}&page_id=${pageId}&page=1&page_size=1`,
    { headers: { 'Access-Token': ACCESS_TOKEN } }
  );
  const d = await r.json();
  if (d.code !== 0 || !d.data?.lead_data || !d.data?.meta_data?.lead_id) return null;
  return { lead: d.data.lead_data, meta: d.data.meta_data };
}

// ─── CSV BACKFILL: get ALL leads for a page (full download) ──────────────────
async function getAllLeadsCSVForPage(pageId) {
  const tr = await fetch('https://business-api.tiktok.com/open_api/v1.3/page/lead/task/', {
    method: 'POST',
    headers: { 'Access-Token': ACCESS_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ advertiser_id: ADVERTISER_ID, page_id: pageId }),
  });
  const td = await tr.json();
  if (td.code !== 0) return [];
  const taskId = td.data?.task_id;
  const dr = await fetch(
    `https://business-api.tiktok.com/open_api/v1.3/page/lead/task/download/?advertiser_id=${ADVERTISER_ID}&task_id=${taskId}`,
    { headers: { 'Access-Token': ACCESS_TOKEN } }
  );
  const text = await dr.text();
  if (!text.includes(',')) return [];
  return parseCSV(text);
}

// Convert CSV row to native-style {lead, meta} format
function csvToNativeLead(row) {
  return {
    lead: {
      name:          row['Name']         || '',
      email:         row['Email']        || '',
      phone_number:  row['Phone number'] || '',
      gender:        row['Gender']       || '',
      'In which Emirate do you live?':                       row['In which Emirate do you live?']                       || '',
      'Which Dubai area best describes your home location?': row['Which Dubai area best describes your home location?'] || '',
      'Which Abu Dhabi area best describes your home location?': row['Which Abu Dhabi area best describes your home location?'] || '',
      "What's your #1 fitness goal?":    row["What's your #1 fitness goal?"] || row['What is your Fitness Goal?'] || '',
    },
    meta: {
      lead_id:      row['Lead ID']      || '',
      ad_id:        row['Ad ID']        || '',
      campaign_id:  row['Campaign ID']  || '',
      adgroup_id:   row['Adgroup ID']   || '',
      ad_name:      row['Ad Name']      || '',
      campaign_name: row['Campaign Name'] || '',
    }
  };
}

// ─── MAP FIELDS → HUBSPOT PROPERTIES ─────────────────────────────────────────
function buildProps(lead, meta) {
  const name      = (lead['name'] || '').trim();
  const email     = (lead['email'] || '').trim().toLowerCase();
  const phone     = normalizePhone(lead['phone_number']);
  const firstName = name.split(' ')[0] || name;
  const lastName  = name.split(' ').slice(1).join(' ');

  const emirate   = (lead['In which Emirate do you live?'] || '').trim();
  const abuArea   = (lead['Which Abu Dhabi area best describes your home location?'] || '').trim();
  const dubArea   = (lead['Which Dubai area best describes your home location?'] || '').trim();
  const location  = [emirate, abuArea || dubArea].filter(Boolean).join(' — ');
  const fitness   = (lead["What's your #1 fitness goal?"] || lead["What is your Fitness Goal?"] || '').trim();
  const gender    = (lead['gender'] || lead['Gender'] || '').trim().toLowerCase();

  const props = {
    email, phone, firstname: firstName, lastname: lastName,
    hs_lead_source: 'OTHER',
    lead_source: 'TikTok',
    utm_source: 'tiktok',
    ...(gender   && { gender }),
    ...(location && { location }),
    ...(fitness  && { what_is_your_biggest_challenge_: fitness }),
    ...(meta.ad_id       && { ad_id:       String(meta.ad_id) }),
    ...(meta.campaign_id && { campaign_id: String(meta.campaign_id) }),
    ...(meta.adgroup_id  && { adgroup_id:  String(meta.adgroup_id) }),
    ...(meta.ad_name     && { ad_name:     meta.ad_name }),
    ...(meta.campaign_name && { campaign_name: meta.campaign_name }),
    ...(meta.lead_id     && { tiktok_lead_id: String(meta.lead_id) }),
  };

  Object.keys(props).forEach(k => { if (!props[k]) delete props[k]; });
  return { props, email, phone, firstName, lastName };
}

// ─── UPSERT TO HUBSPOT ────────────────────────────────────────────────────────
async function upsertHubSpot(lead, meta) {
  const { props, email, phone, firstName, lastName } = buildProps(lead, meta);
  if (!email && !phone) return 'skip';

  // 1️⃣ Match by email
  if (email) {
    const sr = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
      method: 'POST',
      headers: { Authorization: `Bearer ${HUBSPOT_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: email }] }],
        properties: ['email', 'phone', 'firstname', 'lastname'],
        limit: 1,
      }),
    });
    const sd = await sr.json();
    if (sd.total > 0) {
      const existing = sd.results[0];
      const hadPhone = !!existing.properties.phone;
      await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${existing.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${HUBSPOT_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ properties: props }),
      });
      return hadPhone ? 'same' : 'phone-added';
    }
  }

  // 2️⃣ Name-based match for ghost contacts (email-only from other sources)
  if (phone && firstName) {
    const filters = [{ propertyName: 'firstname', operator: 'EQ', value: firstName }];
    if (lastName) filters.push({ propertyName: 'lastname', operator: 'EQ', value: lastName });
    const nr = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
      method: 'POST',
      headers: { Authorization: `Bearer ${HUBSPOT_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ filterGroups: [{ filters }], properties: ['firstname', 'lastname', 'email', 'phone'], limit: 5 }),
    });
    const nd = await nr.json();
    const ghost = nd.results?.find(c => !c.properties?.phone);
    if (ghost) {
      const patchProps = { phone };
      if (firstName) patchProps.firstname = firstName;
      if (lastName)  patchProps.lastname  = lastName;
      const pr = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${ghost.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${HUBSPOT_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ properties: patchProps }),
      });
      if (pr.status === 200) return 'ghost-filled';
    }
  }

  // 3️⃣ Create new contact
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

// ─── GLOBAL NAME-DEDUP PASS ───────────────────────────────────────────────────
async function globalDedup() {
  console.log('\n🔍 Running global name-dedup pass (last 7 days, no phone)...\n');
  const since7d = Date.now() - 7 * 24 * 60 * 60 * 1000;
  let dedupFixed = 0, after = undefined;

  while (true) {
    const body = {
      filterGroups: [{ filters: [{ propertyName: 'createdate', operator: 'GTE', value: since7d.toString() }] }],
      properties: ['firstname', 'lastname', 'email', 'phone', 'createdate'],
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
    const noPhone = (pd.results || []).filter(c => !c.properties.phone);

    for (const contact of noPhone) {
      const { firstname, lastname, email } = contact.properties;
      if (!firstname) continue;
      const filters = [{ propertyName: 'firstname', operator: 'EQ', value: firstname }];
      if (lastname) filters.push({ propertyName: 'lastname', operator: 'EQ', value: lastname });
      const nr = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
        method: 'POST',
        headers: { Authorization: `Bearer ${HUBSPOT_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ filterGroups: [{ filters }], properties: ['firstname', 'lastname', 'email', 'phone'], limit: 5 }),
      });
      const nd = await nr.json();
      const donor = nd.results?.find(c => c.id !== contact.id && c.properties.phone);
      if (!donor) continue;
      const patch = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${contact.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${HUBSPOT_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ properties: { phone: donor.properties.phone } }),
      });
      if (patch.status === 200) {
        dedupFixed++;
        console.log(`🔗 DEDUP  ${(firstname + ' ' + (lastname || '')).trim().padEnd(22)} ☎️ ${donor.properties.phone} (${email} ← ${donor.properties.email})`);
      }
    }
    if (!pd.paging?.next?.after) break;
    after = pd.paging.next.after;
  }

  if (dedupFixed === 0) console.log('   No duplicates found.');
  else console.log(`\n   ${dedupFixed} duplicate(s) fixed by name-match.`);
  return dedupFixed;
}

// ─── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🚀 TikTok → HubSpot Lead Sync (Hybrid: Native + CSV Backfill)\n');

  const seen = loadSeen();
  const isFirstRun = seen.size === 0;
  const pages = await getAllPages();
  console.log(`📋 Found ${pages.length} published pages | seen cache: ${seen.size} lead IDs${isFirstRun ? ' (FIRST RUN — full CSV backfill)' : ''}\n`);

  const stats = { created: 0, phoneAdded: 0, ghostFilled: 0, same: 0, dupe: 0, skip: 0, err: 0, total: 0, native: 0, csv: 0 };

  async function processEntry({ lead, meta }) {
    if (!meta.lead_id) return;
    if (seen.has(meta.lead_id)) { stats.same++; return; }
    stats.total++;
    const result = await upsertHubSpot(lead, meta);
    const email = (lead['email'] || '').trim();
    const phone = normalizePhone(lead['phone_number']);
    const name  = (lead['name'] || '').trim();

    if (result.startsWith('created'))   { stats.created++;    console.log('✅ CREATE', (email||phone).slice(0,32).padEnd(34), '☎️', phone, '👤', name); }
    else if (result === 'phone-added')  { stats.phoneAdded++; console.log('📞 PHONE+', email.slice(0,32).padEnd(34), '☎️', phone, '👤', name); }
    else if (result === 'ghost-filled') { stats.ghostFilled++;console.log('👻 GHOST+', name.padEnd(22), '☎️', phone); }
    else if (result === 'same')         { stats.same++; }
    else if (result === 'duplicate')    { stats.dupe++;       console.log('♊  DUPE  ', email.slice(0,32)); }
    else if (result === 'skip')         { stats.skip++; }
    else                                { stats.err++;        console.log('❌ ERR   ', result.slice(0, 80)); }

    seen.add(meta.lead_id);
  }

  for (const page of pages) {
    // ── STEP 1: Native API — check latest lead (fast, runs every time) ──
    const latest = await getLatestNativeLead(page.page_id);
    if (latest && !seen.has(latest.meta.lead_id)) {
      stats.native++;
      console.log(`\n⚡ NATIVE  Page ${page.page_id}`);
      await processEntry(latest);
    }

    // ── STEP 2: CSV backfill — runs EVERY TIME for every page ──
    // seen-cache skips individual already-processed lead_ids row-by-row
    // This ensures we never miss leads that appear behind the latest native lead
    const csvRows = await getAllLeadsCSVForPage(page.page_id);
    if (csvRows.length > 0) {
      stats.csv += csvRows.length;
      let newOnPage = 0;
      for (const row of csvRows) {
        const entry = csvToNativeLead(row);
        if (entry.meta.lead_id && seen.has(entry.meta.lead_id)) continue;
        newOnPage++;
        await processEntry(entry);
      }
      if (newOnPage > 0) console.log(`   📄 CSV: ${newOnPage} new leads from ${csvRows.length} total`);
    }

  }

  saveSeen(seen);

  console.log('\n' + '='.repeat(60));
  console.log(`✅ Processed: ${stats.total} new leads (${stats.native} via native, ${stats.csv} via CSV)`);
  console.log(`   Created:     ${stats.created}`);
  console.log(`   Phone added: ${stats.phoneAdded}`);
  console.log(`   Ghost fixed: ${stats.ghostFilled}`);
  console.log(`   Skipped:     ${stats.same} (already synced)`);
  console.log(`   Errors:      ${stats.err}`);

  const dedupFixed = await globalDedup();

  const changes = stats.created + stats.phoneAdded + stats.ghostFilled + dedupFixed;
  if (changes > 0) console.log(`\n🎯 ${changes} HubSpot record(s) updated this run.`);
  else console.log('\n✨ HubSpot is fully up to date.');
}

main();
