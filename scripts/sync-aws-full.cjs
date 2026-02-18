#!/usr/bin/env node
/**
 * PTD FITNESS — FULL AWS RDS → Supabase Historical Sync
 * 
 * Syncs ALL historical data: past+present clients, all coaches, full year sessions.
 * Runs from YOUR machine (IP 81.95.56.17 whitelisted on AWS RDS).
 * 
 * Usage:
 *   node scripts/sync-aws-full.cjs
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/sync-aws-full.cjs
 * 
 * Tables written: clients_full, coaches_full, training_sessions_full
 * Run setup-full-sync-tables edge function first to create tables.
 */

const { Client: PGClient } = require('pg');

const RDS_CONFIG = {
  host: 'ptd-prod-replica-1.c5626gic29ju.me-central-1.rds.amazonaws.com',
  port: 5432,
  user: '4revops',
  password: 'vakiphetH1qospuS',
  database: 'ptd',
  ssl: { rejectUnauthorized: false },
  statement_timeout: 120000,
};

const SUPABASE_URL = 'https://ztjndilxurtsfqdsvfds.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0am5kaWx4dXJ0c2ZxZHN2ZmRzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDEyMDYwNywiZXhwIjoyMDY5Njk2NjA3fQ.1YKDkcl8EQ6eRG1y_-LaIfd03tEJffYNCVEyTrUuNCY';

const BATCH_SIZE = 500;

async function supabaseRequest(method, path, body, headers = {}) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase ${method} ${path} failed: ${res.status} ${err}`);
  }
  return res;
}

async function batchUpsert(table, rows, onConflict, label) {
  if (!rows.length) { console.log(`  ${label}: 0 rows, skipping`); return; }
  
  // Delete existing data (full refresh) — use a filter that matches all rows
  try {
    await supabaseRequest('DELETE', `/rest/v1/${table}?synced_at=not.is.null`);
  } catch(e) {
    console.log(`  (Delete fallback for ${table})`);
    try { await supabaseRequest('DELETE', `/rest/v1/${table}?id=not.is.null`); } catch(e2) {}
  }
  
  let synced = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    await supabaseRequest('POST', `/rest/v1/${table}`, chunk, {
      'Prefer': `resolution=merge-duplicates`,
    });
    synced += chunk.length;
    console.log(`  ${label}... ${synced}/${rows.length}`);
  }
  console.log(`  ✅ ${label}: ${synced} rows synced`);
}

async function main() {
  const startTime = Date.now();
  console.log(`\n🔄 PTD FULL HISTORICAL SYNC — ${new Date().toISOString()}`);
  console.log('='.repeat(60));

  const rds = new PGClient(RDS_CONFIG);
  await rds.connect();
  console.log('✅ Connected to AWS RDS\n');

  // ========================================
  // 1. ALL CLIENTS (past + present) with packages as JSONB
  // ========================================
  console.log('📋 Step 1/4: Fetching ALL clients...');
  const clientsRaw = await rds.query(`
    SELECT m.id_client, m.email, m.first_name, m.last_name, m.phone_number as phone,
      m.date_created as registration_date, m.country, m.city,
      p.remainingsessions, p.packsize, p.name_packet as pack_name,
      p.settlement_date_utc as start_date, p.expiry_date_utc as end_date
    FROM enhancesch.vw_client_master m
    LEFT JOIN enhancesch.vw_client_packages p ON m.id_client = p.id_client
  `);
  console.log(`  Raw rows (clients × packages): ${clientsRaw.rows.length}`);

  // Aggregate packages per client
  const clientMap = new Map();
  for (const r of clientsRaw.rows) {
    const cid = String(r.id_client);
    if (!clientMap.has(cid)) {
      clientMap.set(cid, {
        client_id: cid,
        email: r.email,
        first_name: r.first_name,
        last_name: r.last_name,
        phone: r.phone,
        status: r.remainingsessions > 0 ? 'active' : 'inactive',
        registration_date: r.registration_date,
        last_login: null,
        packages: [],
      });
    }
    if (r.pack_name) {
      clientMap.get(cid).packages.push({
        pack_name: r.pack_name,
        pack_size: r.packsize,
        remaining: r.remainingsessions,
        start_date: r.start_date,
        end_date: r.end_date,
        coach_name: null, // coach comes from scheduler, not packages view
      });
    }
  }
  console.log(`  Unique clients: ${clientMap.size}`);

  // Fetch engagement signals
  console.log('  Fetching engagement signals...');
  const engagement = await rds.query(`
    SELECT m.id_client, m.email,
      (SELECT MAX(training_date_utc) FROM enhancesch.vw_schedulers s 
       WHERE s.id_client = m.id_client AND s.status IN ('Completed','Attended')) as last_completed_session,
      (SELECT COUNT(*) FROM enhancesch.vw_schedulers s 
       WHERE s.id_client = m.id_client AND s.training_date_utc > NOW() - INTERVAL '365 days') as sessions_365d,
      (SELECT COUNT(*) FROM enhancesch.vw_schedulers s 
       WHERE s.id_client = m.id_client AND s.status = 'Cancelled-Client is not Charged' 
       AND s.training_date_utc > NOW() - INTERVAL '90 days') as cancellations_90d
    FROM enhancesch.vw_client_master m
    WHERE EXISTS (SELECT 1 FROM enhancesch.vw_client_packages p WHERE p.id_client = m.id_client)
  `);
  console.log(`  Engagement data for ${engagement.rows.length} clients`);

  // Merge engagement into clients
  const engMap = new Map();
  for (const e of engagement.rows) {
    engMap.set(String(e.id_client), e);
  }

  const clientRows = [];
  for (const [cid, c] of clientMap) {
    const eng = engMap.get(cid);
    clientRows.push({
      client_id: c.client_id,
      email: c.email,
      first_name: c.first_name,
      last_name: c.last_name,
      phone: c.phone,
      status: c.status,
      registration_date: c.registration_date,
      last_login: c.last_login,
      packages: JSON.stringify(c.packages),
      total_sessions_365d: eng ? parseInt(eng.sessions_365d) || 0 : 0,
      last_completed_session: eng ? eng.last_completed_session : null,
      cancellations_90d: eng ? parseInt(eng.cancellations_90d) || 0 : 0,
      synced_at: new Date().toISOString(),
    });
  }

  // ========================================
  // 2. ALL COACHES
  // ========================================
  console.log('\n👤 Step 2/4: Fetching ALL coaches...');
  // vw_client_packages doesn't have coach_name — coaches come from vw_schedulers (trainer_name)
  // Get active clients per coach from recent sessions instead
  const coachPkg = await rds.query(`
    SELECT trainer_name as coach_name,
      COUNT(DISTINCT id_client) as client_count,
      0 as total_remaining,
      COUNT(*) as package_count
    FROM enhancesch.vw_schedulers
    WHERE training_date_utc > NOW() - INTERVAL '90 days'
    GROUP BY trainer_name
  `);

  const coachSessions = await rds.query(`
    SELECT DISTINCT trainer_name, 
      COUNT(*) as session_count,
      COUNT(DISTINCT id_client) as unique_clients,
      MAX(training_date_utc) as last_session
    FROM enhancesch.vw_schedulers
    WHERE training_date_utc > NOW() - INTERVAL '1 year'
    GROUP BY trainer_name
  `);

  // Merge coach data from both sources
  const coachMap = new Map();
  for (const r of coachPkg.rows) {
    if (!r.coach_name) continue;
    coachMap.set(r.coach_name, {
      coach_name: r.coach_name,
      active_clients: parseInt(r.client_count) || 0,
      total_remaining_sessions: parseInt(r.total_remaining) || 0,
    });
  }
  for (const r of coachSessions.rows) {
    if (!r.trainer_name) continue;
    const existing = coachMap.get(r.trainer_name) || { coach_name: r.trainer_name, active_clients: 0, total_remaining_sessions: 0 };
    existing.total_clients_ever = parseInt(r.unique_clients) || 0;
    existing.total_sessions_year = parseInt(r.session_count) || 0;
    existing.last_session_date = r.last_session;
    coachMap.set(r.trainer_name, existing);
  }

  const coachRows = Array.from(coachMap.values()).map(c => ({
    ...c,
    synced_at: new Date().toISOString(),
  }));
  console.log(`  Found ${coachRows.length} coaches`);

  // ========================================
  // 3. ALL SESSIONS (full year)
  // ========================================
  console.log('\n🏋️ Step 3/4: Fetching ALL sessions (365 days)...');
  const sessions = await rds.query(`
    SELECT s.id_client, m.email as client_email, 
      m.first_name, m.last_name,
      s.trainer_name as coach_name, 
      s.training_date_utc as training_date,
      s.status, s.session_type
    FROM enhancesch.vw_schedulers s
    JOIN enhancesch.vw_client_master m ON s.id_client = m.id_client
    WHERE s.training_date_utc > NOW() - INTERVAL '365 days'
    ORDER BY s.training_date_utc DESC
  `);
  console.log(`  Found ${sessions.rows.length} sessions`);

  // Dedup sessions by (client_id, training_date, coach_name)
  const seenSessions = new Set();
  const dedupedSessions = sessions.rows.filter(r => {
    const key = `${r.id_client}|${r.training_date}|${r.coach_name}`;
    if (seenSessions.has(key)) return false;
    seenSessions.add(key);
    return true;
  });
  console.log(`  After dedup: ${dedupedSessions.length} unique sessions`);

  const sessionRows = dedupedSessions.map(r => ({
    client_id: String(r.id_client),
    client_email: r.client_email,
    client_name: [r.first_name, r.last_name].filter(Boolean).join(' ') || null,
    coach_name: r.coach_name,
    training_date: r.training_date,
    status: r.status,
    session_type: r.session_type,
    location: null,
    synced_at: new Date().toISOString(),
  }));

  // ========================================
  // 4. SYNC TO SUPABASE
  // ========================================
  console.log('\n🔄 Step 4/4: Syncing to Supabase...');
  
  await batchUpsert('clients_full', clientRows, 'client_id', 'Syncing clients');
  await batchUpsert('coaches_full', coachRows, 'coach_name', 'Syncing coaches');
  await batchUpsert('training_sessions_full', sessionRows, 'client_id,training_date,coach_name', 'Syncing sessions');

  await rds.end();

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n' + '='.repeat(60));
  console.log(`✅ FULL SYNC COMPLETE in ${elapsed}s`);
  console.log(`   Clients: ${clientRows.length}`);
  console.log(`   Coaches: ${coachRows.length}`);
  console.log(`   Sessions: ${sessionRows.length}`);
  console.log('='.repeat(60));
}

main().catch(e => { console.error('❌ FATAL:', e.message); process.exit(1); });
