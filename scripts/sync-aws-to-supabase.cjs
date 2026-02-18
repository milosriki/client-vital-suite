#!/usr/bin/env node
/**
 * PTD FITNESS — AWS RDS → Supabase Sync
 * 
 * Runs from YOUR machine (IP 81.95.56.17 whitelisted on AWS RDS).
 * Pulls session data, packages, client info from AWS and pushes to Supabase.
 * 
 * Usage:
 *   node scripts/sync-aws-to-supabase.js              # Full sync
 *   node scripts/sync-aws-to-supabase.js --quick       # Last 7 days only
 *   node scripts/sync-aws-to-supabase.js --report      # Just print the report, no sync
 * 
 * Schedule: Run once daily via cron, or manually when you need fresh data.
 *   crontab: 0 7 * * * cd /Users/milosvukovic/client-vital-suite && node scripts/sync-aws-to-supabase.js >> /tmp/ptd-sync.log 2>&1
 */

const { Client: PGClient } = require('pg');

const RDS_CONFIG = {
  host: 'ptd-prod-replica-1.c5626gic29ju.me-central-1.rds.amazonaws.com',
  port: 5432,
  user: '4revops',
  password: 'vakiphetH1qospuS',
  database: 'ptd',
  ssl: { rejectUnauthorized: false },
  statement_timeout: 60000,
};

const SUPABASE_URL = 'https://ztjndilxurtsfqdsvfds.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0am5kaWx4dXJ0c2ZxZHN2ZmRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxMjA2MDcsImV4cCI6MjA2OTY5NjYwN30.e665i3sdaMOBcD_OLzA6xjnTLQZ-BpiQ6GlgYkV15Lo';

const args = process.argv.slice(2);
const QUICK_MODE = args.includes('--quick');
const REPORT_ONLY = args.includes('--report');

async function supabaseUpsert(table, rows, onConflict) {
  if (!rows.length) return { count: 0 };
  const key = SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY;
  
  // Batch in chunks of 500
  let total = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Prefer': `resolution=merge-duplicates${onConflict ? `,on_conflict=${onConflict}` : ''}`,
      },
      body: JSON.stringify(chunk),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Supabase upsert ${table} failed: ${res.status} ${err}`);
    }
    total += chunk.length;
  }
  return { count: total };
}

async function main() {
  const startTime = Date.now();
  console.log(`\n🔄 PTD Sync ${new Date().toISOString()} ${QUICK_MODE ? '(QUICK)' : '(FULL)'} ${REPORT_ONLY ? '(REPORT ONLY)' : ''}`);
  
  const rds = new PGClient(RDS_CONFIG);
  await rds.connect();
  console.log('✅ Connected to AWS RDS');

  // ========================================
  // 1. SESSIONS (last 90 days or 7 days for quick)
  // ========================================
  const sessionDays = QUICK_MODE ? 7 : 90;
  console.log(`\n📋 Fetching sessions (last ${sessionDays} days)...`);
  const sessions = await rds.query(`
    SELECT 
      s.session_id as rds_id,
      s.id_client::text as client_id,
      s.client_name,
      s.id_personal::text as coach_id,
      s.trainer_name as coach_name,
      s.training_date_utc as training_date,
      s.status,
      s.session_type,
      -- Enriched from powerbi view
      pb.email as client_email,
      pb.training_time_utc as time_slot,
      pb.pack_or_discount_code as package_code,
      pb.instancecountry as location
    FROM enhancesch.vw_schedulers s
    LEFT JOIN enhancesch.vw_powerbi_schedulers pb 
      ON pb.identification_number = s.session_id
    WHERE s.training_date_utc >= CURRENT_DATE - INTERVAL '${sessionDays} days'
    ORDER BY s.training_date_utc DESC
  `);
  console.log(`  Found: ${sessions.rows.length} sessions`);

  // ========================================
  // 2. CLIENT PACKAGES (all active)
  // ========================================
  console.log('\n📦 Fetching client packages...');
  const packages = await rds.query(`
    WITH last_session AS (
      SELECT id_client, trainer_name, training_date_utc,
        ROW_NUMBER() OVER (PARTITION BY id_client ORDER BY training_date_utc DESC) as rn
      FROM enhancesch.vw_schedulers WHERE status = 'Completed'
    ),
    weekly_rate AS (
      SELECT id_client, ROUND(COUNT(*)::numeric / 4, 1) as per_week
      FROM enhancesch.vw_schedulers 
      WHERE training_date_utc >= CURRENT_DATE - 28 AND status = 'Completed'
      GROUP BY id_client
    ),
    future_booked AS (
      SELECT id_client, COUNT(*) as booked_count, MIN(training_date_utc) as next_session
      FROM enhancesch.vw_schedulers
      WHERE training_date_utc > NOW() AND status IN ('Confirmed','Active')
      GROUP BY id_client
    )
    SELECT 
      p.id_cupom::text as package_id,
      p.id_client::text as client_id,
      m.full_name as client_name,
      m.email as client_email,
      m.phone_number as client_phone,
      p.name_packet as package_name,
      p.packsize as pack_size,
      p.remainingsessions as remaining_sessions,
      ROUND(p.amounttotal::numeric) as package_value,
      p.expiry_date_utc as expiry_date,
      p.settlement_date_utc as purchase_date,
      ls.trainer_name as last_coach,
      ls.training_date_utc as last_session_date,
      COALESCE(wr.per_week, 0) as sessions_per_week,
      COALESCE(fb.booked_count, 0) as future_booked,
      fb.next_session as next_session_date,
      CASE 
        WHEN p.remainingsessions = 1 THEN 'CRITICAL'
        WHEN p.remainingsessions <= 3 THEN 'HIGH'
        WHEN p.remainingsessions <= 5 THEN 'MEDIUM'
        WHEN p.remainingsessions <= 10 THEN 'WATCH'
        ELSE 'SAFE'
      END as depletion_priority,
      CASE 
        WHEN COALESCE(wr.per_week, 0) > 0 THEN
          ROUND(p.remainingsessions / (wr.per_week / 7.0))
        ELSE NULL
      END as days_until_depleted
    FROM enhancesch.vw_client_packages p
    JOIN enhancesch.vw_client_master m ON p.id_client = m.id_client
    LEFT JOIN last_session ls ON ls.id_client = p.id_client AND ls.rn = 1
    LEFT JOIN weekly_rate wr ON wr.id_client = p.id_client
    LEFT JOIN future_booked fb ON fb.id_client = p.id_client
    WHERE p.remainingsessions > 0
      AND (p.expiry_date_utc IS NULL OR p.expiry_date_utc >= CURRENT_DATE)
    ORDER BY p.remainingsessions ASC, p.amounttotal DESC
  `);
  console.log(`  Found: ${packages.rows.length} packages`);

  // ========================================
  // 3. COACH PERFORMANCE (last 30 days)
  // ========================================
  console.log('\n👤 Fetching coach performance...');
  const coaches = await rds.query(`
    WITH daily AS (
      SELECT trainer_name, training_date_utc::date as d, 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'Completed') as completed,
        COUNT(*) FILTER (WHERE status LIKE 'Cancelled%') as cancelled,
        COUNT(DISTINCT id_client) as unique_clients
      FROM enhancesch.vw_schedulers
      WHERE training_date_utc >= CURRENT_DATE - 30
        AND trainer_name IS NOT NULL AND trainer_name != ''
      GROUP BY trainer_name, training_date_utc::date
    ),
    client_retention AS (
      SELECT trainer_name,
        COUNT(DISTINCT id_client) as total_clients,
        COUNT(DISTINCT id_client) FILTER (
          WHERE id_client IN (
            SELECT id_client FROM enhancesch.vw_schedulers 
            WHERE status = 'Completed' AND training_date_utc >= CURRENT_DATE - 14
          )
        ) as active_last_14d
      FROM enhancesch.vw_schedulers
      WHERE status = 'Completed' AND training_date_utc >= CURRENT_DATE - 90
      GROUP BY trainer_name
    )
    SELECT 
      d.trainer_name as coach_name,
      ROUND(AVG(d.completed), 1) as avg_sessions_per_day,
      MAX(d.completed) as max_sessions_day,
      COUNT(DISTINCT d.d) as active_days,
      SUM(d.completed) as total_completed,
      SUM(d.cancelled) as total_cancelled,
      ROUND(SUM(d.completed)::numeric / NULLIF(SUM(d.total), 0) * 100, 1) as completion_rate,
      ROUND(AVG(d.unique_clients), 1) as avg_clients_per_day,
      cr.total_clients as clients_90d,
      cr.active_last_14d,
      ROUND(cr.active_last_14d::numeric / NULLIF(cr.total_clients, 0) * 100, 1) as retention_14d_pct
    FROM daily d
    LEFT JOIN client_retention cr ON cr.trainer_name = d.trainer_name
    GROUP BY d.trainer_name, cr.total_clients, cr.active_last_14d
    ORDER BY avg_sessions_per_day DESC
  `);
  console.log(`  Found: ${coaches.rows.length} coaches`);

  // ========================================
  // 4. DAILY SUMMARY (for KPI dashboard)
  // ========================================
  console.log('\n📊 Fetching daily summary...');
  const daily = await rds.query(`
    SELECT 
      training_date_utc::date as date,
      COUNT(*) as total_sessions,
      COUNT(*) FILTER (WHERE status = 'Completed') as completed,
      COUNT(*) FILTER (WHERE status LIKE 'Cancelled%') as cancelled,
      COUNT(*) FILTER (WHERE status = 'Confirmed') as confirmed,
      COUNT(DISTINCT id_client) as unique_clients,
      COUNT(DISTINCT CASE WHEN status = 'Completed' THEN id_personal END) as active_coaches
    FROM enhancesch.vw_schedulers
    WHERE training_date_utc >= CURRENT_DATE - 90
    GROUP BY training_date_utc::date
    ORDER BY date DESC
  `);
  console.log(`  Found: ${daily.rows.length} days`);

  // ========================================
  // 5. FREQUENCY ANALYSIS
  // ========================================
  console.log('\n📈 Fetching frequency trends...');
  const frequency = await rds.query(`
    WITH recent AS (
      SELECT id_client, COUNT(*) as sessions
      FROM enhancesch.vw_schedulers
      WHERE status = 'Completed' AND training_date_utc >= CURRENT_DATE - 28
      GROUP BY id_client
    ),
    prior AS (
      SELECT id_client, COUNT(*) as sessions
      FROM enhancesch.vw_schedulers
      WHERE status = 'Completed' AND training_date_utc BETWEEN CURRENT_DATE - 56 AND CURRENT_DATE - 28
      GROUP BY id_client
    )
    SELECT 
      m.full_name as client_name, m.email, m.phone_number,
      COALESCE(r.sessions, 0) as recent_4w,
      COALESCE(p.sessions, 0) as prior_4w,
      COALESCE(r.sessions, 0) - COALESCE(p.sessions, 0) as change,
      CASE 
        WHEN COALESCE(r.sessions,0) > COALESCE(p.sessions,0) + 2 THEN 'INCREASING'
        WHEN COALESCE(r.sessions,0) < COALESCE(p.sessions,0) - 2 THEN 'DECREASING'
        ELSE 'STABLE'
      END as trend,
      (SELECT trainer_name FROM enhancesch.vw_schedulers s 
       WHERE s.id_client = COALESCE(r.id_client, p.id_client) AND s.status = 'Completed'
       ORDER BY training_date_utc DESC LIMIT 1) as coach
    FROM recent r
    FULL JOIN prior p USING (id_client)
    JOIN enhancesch.vw_client_master m ON m.id_client = COALESCE(r.id_client, p.id_client)
    WHERE ABS(COALESCE(r.sessions,0) - COALESCE(p.sessions,0)) > 2
    ORDER BY change ASC
  `);
  console.log(`  Found: ${frequency.rows.length} clients with significant change`);

  // ========================================
  // PRINT ACTIONABLE REPORT
  // ========================================
  console.log('\n' + '='.repeat(80));
  console.log('📊 PTD FITNESS — DAILY INTELLIGENCE REPORT');
  console.log('='.repeat(80));

  // Today
  const todayData = daily.rows.find(r => r.date.toISOString().split('T')[0] === new Date().toISOString().split('T')[0]);
  if (todayData) {
    console.log(`\n🏋️ TODAY: ${todayData.completed} completed | ${todayData.confirmed} upcoming | ${todayData.cancelled} cancelled | ${todayData.unique_clients} clients | ${todayData.active_coaches} coaches`);
  }

  // Critical packages
  // Only count active clients: non-expired packages + trained in last 60 days
  const isActive = (r) => r.last_session_date && (new Date() - new Date(r.last_session_date)) / 86400000 < 60;
  const critical = packages.rows.filter(r => r.depletion_priority === 'CRITICAL' && isActive(r));
  const high = packages.rows.filter(r => r.depletion_priority === 'HIGH' && isActive(r));
  // Deduplicate by client name (some clients have multiple packages)
  const dedup = (arr) => {
    const seen = new Set();
    return arr.filter(r => { const k = r.client_name; if (seen.has(k)) return false; seen.add(k); return true; });
  };
  const criticalUnique = dedup(critical);
  const highUnique = dedup(high);
  
  console.log(`\n🔴 PACKAGE ALERTS (non-expired, trained last 60d, deduplicated):`);
  console.log(`  CRITICAL (1 left): ${criticalUnique.length} clients`);
  console.log(`  HIGH (2-3 left): ${highUnique.length} clients`);
  
  for (const p of criticalUnique.slice(0, 15)) {
    const futureStr = p.future_booked > 0 ? `${p.future_booked} booked` : '⚠️ NONE BOOKED';
    console.log(`  🔴 ${p.client_name} | ${p.client_phone || '-'} | ${p.remaining_sessions} left of ${p.pack_size} | Coach: ${p.last_coach} | ${p.sessions_per_week}x/wk | Future: ${futureStr}`);
  }

  // Declining clients
  const declining = frequency.rows.filter(r => r.trend === 'DECREASING');
  console.log(`\n📉 DECLINING FREQUENCY: ${declining.length} clients`);
  for (const d of declining.slice(0, 10)) {
    console.log(`  ↓ ${d.client_name} | ${d.phone_number || '-'} | Was ${d.prior_4w} → Now ${d.recent_4w} sessions/4wk (${d.change}) | Coach: ${d.coach}`);
  }

  // Top coaches
  console.log(`\n🏆 COACH LEADERBOARD (30d):`);
  for (const co of coaches.rows.slice(0, 10)) {
    console.log(`  ${co.coach_name.padEnd(25)} ${co.avg_sessions_per_day}/day | ${co.total_completed} completed | ${co.completion_rate}% rate | ${co.clients_90d || '?'} clients | ${co.retention_14d_pct || '?'}% retention`);
  }

  // Clients with future bookings
  const withBookings = packages.rows.filter(r => r.future_booked > 0);
  console.log(`\n📅 FUTURE BOOKINGS: ${withBookings.length} clients have sessions booked ahead`);

  console.log(`\n⏱️ Sync completed in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
  console.log('='.repeat(80));

  // ========================================
  // SYNC TO SUPABASE (if not report-only)
  // ========================================
  if (!REPORT_ONLY) {
    console.log('\n🔄 Syncing to Supabase...');
    
    // We'll sync to a single denormalized table for max dashboard speed
    // Table: aws_ops_snapshot (upserted daily)
    const snapshot = {
      snapshot_date: new Date().toISOString().split('T')[0],
      generated_at: new Date().toISOString(),
      
      // Summary
      sessions_today: todayData ? todayData.completed : 0,
      sessions_confirmed_today: todayData ? todayData.confirmed : 0,
      active_clients_30d: packages.rows.filter(r => r.sessions_per_week > 0).length,
      total_packages_active: packages.rows.filter(r => r.remaining_sessions > 0).length,
      
      // Alerts
      packages_critical: critical.length,
      packages_high: high.length,
      packages_medium: packages.rows.filter(r => r.depletion_priority === 'MEDIUM').length,
      
      // Frequency
      clients_increasing: frequency.rows.filter(r => r.trend === 'INCREASING').length,
      clients_decreasing: declining.length,
      clients_stable: frequency.rows.filter(r => r.trend === 'STABLE').length,
      
      // Raw data as JSONB
      coach_leaderboard: JSON.stringify(coaches.rows),
      critical_packages: JSON.stringify(critical),
      high_packages: JSON.stringify(high),
      declining_clients: JSON.stringify(declining),
      daily_sessions: JSON.stringify(daily.rows.slice(0, 30)),
      frequency_trends: JSON.stringify(frequency.rows),
    };

    try {
      const key = SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY;
      const res = await fetch(`${SUPABASE_URL}/rest/v1/aws_ops_snapshot`, {
        method: 'POST',
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates,on_conflict=snapshot_date',
        },
        body: JSON.stringify(snapshot),
      });
      if (res.ok) {
        console.log('✅ Snapshot synced to Supabase (aws_ops_snapshot)');
      } else {
        const err = await res.text();
        console.log('⚠️ Supabase sync error (table may not exist yet): ' + err.substring(0, 200));
        console.log('   Run the migration first, or use --report mode');
      }
    } catch (e) {
      console.log('⚠️ Supabase sync failed: ' + e.message);
    }
  }

  await rds.end();
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
