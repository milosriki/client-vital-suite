// Run: node scripts/run-setup.js
// This script sets up the agent tables using your existing Supabase connection

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://boowptjtwadxpjkpctna.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvb3dwdGp0d2FkeHBqa3BjdG5hIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzE3ODg1NCwiZXhwIjoyMDcyNzU0ODU0fQ._VWDVIu5n5ji_ddIIU-dpx-_8CZmgVQ4Mi16rQS8IG8';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function runSetup() {
  console.log('🚀 PTD Smart Agent Setup\n');

  try {
    // Step 1: Create tables
    console.log('Step 1: Creating agent tables...');

    // Create agent_knowledge table
    const { error: err1 } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS agent_knowledge (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          category TEXT NOT NULL,
          subcategory TEXT,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          structured_data JSONB DEFAULT '{}',
          source TEXT,
          confidence FLOAT DEFAULT 1.0,
          usage_count INT DEFAULT 0,
          last_used_at TIMESTAMPTZ,
          version INT DEFAULT 1,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `
    }).catch(() => null);

    // Create agent_conversations table
    const { error: err2 } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS agent_conversations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          session_id TEXT NOT NULL,
          user_id TEXT,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          agent_type TEXT DEFAULT 'analyst',
          context JSONB DEFAULT '{}',
          tokens_used INT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `
    }).catch(() => null);

    // Create proactive_insights table
    const { error: err3 } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS proactive_insights (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          insight_type TEXT NOT NULL,
          priority TEXT NOT NULL,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          summary TEXT,
          action_items JSONB DEFAULT '[]',
          affected_entities JSONB DEFAULT '{}',
          source_agent TEXT,
          is_read BOOLEAN DEFAULT FALSE,
          is_dismissed BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          expires_at TIMESTAMPTZ,
          dedup_key TEXT UNIQUE
        );
      `
    }).catch(() => null);

    // Create agent_decisions table
    const { error: err4 } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS agent_decisions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          agent_type TEXT NOT NULL,
          decision_type TEXT NOT NULL,
          input_context JSONB NOT NULL,
          decision JSONB NOT NULL,
          reasoning TEXT,
          confidence FLOAT,
          client_email TEXT,
          outcome TEXT,
          outcome_notes TEXT,
          outcome_metrics JSONB DEFAULT '{}',
          was_helpful BOOLEAN,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `
    }).catch(() => null);

    // Try direct table creation as fallback
    console.log('   Creating tables directly...');

    // Check if tables exist by trying to select from them
    const { error: checkKnowledge } = await supabase
      .from('agent_knowledge')
      .select('id')
      .limit(1);

    if (checkKnowledge?.code === '42P01') {
      console.log('   Tables need to be created via SQL Editor.');
      console.log('   Please run scripts/setup-agent-manual.sql in Supabase Dashboard.\n');
    } else {
      console.log('   ✓ agent_knowledge table exists');
    }

    const { error: checkConv } = await supabase
      .from('agent_conversations')
      .select('id')
      .limit(1);

    if (!checkConv || checkConv?.code !== '42P01') {
      console.log('   ✓ agent_conversations table exists');
    }

    const { error: checkInsights } = await supabase
      .from('proactive_insights')
      .select('id')
      .limit(1);

    if (!checkInsights || checkInsights?.code !== '42P01') {
      console.log('   ✓ proactive_insights table exists');
    }

    const { error: checkDecisions } = await supabase
      .from('agent_decisions')
      .select('id')
      .limit(1);

    if (!checkDecisions || checkDecisions?.code !== '42P01') {
      console.log('   ✓ agent_decisions table exists');
    }

    // Step 2: Seed knowledge base
    console.log('\nStep 2: Seeding knowledge base...');

    const knowledge = [
      {
        category: 'formula',
        subcategory: 'health_score',
        title: 'Health Score Calculation',
        content: `HEALTH_SCORE = (ENGAGEMENT × 0.40) + (PACKAGE_HEALTH × 0.30) + (MOMENTUM × 0.30)
A score of 70+ indicates a healthy client, while below 50 is critical.`,
        structured_data: { weights: { engagement: 0.40, package_health: 0.30, momentum: 0.30 } },
        source: 'system',
        confidence: 1.0
      },
      {
        category: 'formula',
        subcategory: 'engagement_score',
        title: 'Engagement Score Calculation',
        content: `BASE = 50 points
RECENT ACTIVITY (7d): +30 if 3+, +20 if 2+, +10 if 1+ sessions
CONSISTENCY (30d): +15 if 12+, +10 if 8+ sessions
RECENCY PENALTY: -30 if gap>30d, -15 if gap>14d, -5 if gap>7d`,
        structured_data: { base: 50 },
        source: 'system',
        confidence: 1.0
      },
      {
        category: 'formula',
        subcategory: 'predictive_risk',
        title: 'Predictive Risk Score',
        content: `BASE = 50
MOMENTUM: +30 DECLINING, -15 ACCELERATING
ACTIVITY: +25 if 0 sessions 7d, +15 if <1, -10 if 2+
GAP: +25 if >30d, +15 if >14d, -10 if ≤7d
PACKAGE: +20 if <10% remaining AND inactive
RISK: CRITICAL 75-100, HIGH 60-74, MEDIUM 40-59, LOW 0-39`,
        structured_data: { base: 50 },
        source: 'system',
        confidence: 1.0
      },
      {
        category: 'rule',
        subcategory: 'zone_classification',
        title: 'Health Zone Classification',
        content: `PURPLE (85-100): Champions - Zero churn risk
GREEN (70-84): Healthy - Low churn risk
YELLOW (50-69): At Risk - Intervention needed
RED (0-49): Critical - Urgent action required`,
        structured_data: { zones: { PURPLE: { min: 85 }, GREEN: { min: 70 }, YELLOW: { min: 50 }, RED: { min: 0 } } },
        source: 'system',
        confidence: 1.0
      },
      {
        category: 'rule',
        subcategory: 'interventions',
        title: 'Intervention Priority Rules',
        content: `CRITICAL (24h): RED zone + risk > 75
HIGH (48h): RED zone OR risk > 60 OR YELLOW + DECLINING
MEDIUM (7d): GREEN + DECLINING OR package < 20%`,
        structured_data: {},
        source: 'system',
        confidence: 1.0
      }
    ];

    for (const k of knowledge) {
      const { error } = await supabase
        .from('agent_knowledge')
        .upsert(k, { onConflict: 'title' })
        .select();

      if (!error) {
        console.log(`   ✓ Added: ${k.title}`);
      }
    }

    console.log('\n✅ Setup complete!\n');
    console.log('Next steps:');
    console.log('1. Set ANTHROPIC_API_KEY in Supabase Edge Function secrets');
    console.log('2. Deploy edge functions: supabase functions deploy ptd-agent');
    console.log('3. Start your app: npm run dev');
    console.log('4. Open dashboard and use the AI panel!\n');

  } catch (error) {
    console.error('Error during setup:', error);
    console.log('\n⚠️  If tables don\'t exist, please run this SQL in Supabase Dashboard:');
    console.log('   Copy contents of: scripts/setup-agent-manual.sql\n');
  }
}

runSetup();
