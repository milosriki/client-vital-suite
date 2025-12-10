import { supabase } from "@/integrations/supabase/client";

// Background learning from app data changes
export async function autoLearnFromApp() {
  try {
    const { data: recentChanges } = await supabase
      .from('client_health_scores')
      .select('email, health_score, health_zone, calculated_at')
      .gte('calculated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(50);

    if (!recentChanges?.length) return;

    const learningData = recentChanges.map(record => 
      `Client ${record.email}: Health ${record.health_score} (${record.health_zone})`
    ).join('\n');

    await supabase.from('agent_context').upsert({
      key: `auto_learn_${new Date().toISOString().split('T')[0]}`,
      value: { type: 'daily_snapshot', data: learningData, learned_at: new Date().toISOString() },
      agent_type: 'auto_learning',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
    });

    console.log('✅ Auto-learned from app data');
  } catch (error) {
    console.error('Auto-learn failed:', error);
  }
}

// Start background learning (call once on app init)
let learningInterval: ReturnType<typeof setInterval> | null = null;

export function startBackgroundLearning() {
  if (learningInterval) return;
  
  // Learn immediately, then every hour
  autoLearnFromApp();
  learningInterval = setInterval(autoLearnFromApp, 60 * 60 * 1000);
}

export function stopBackgroundLearning() {
  if (learningInterval) {
    clearInterval(learningInterval);
    learningInterval = null;
  }
}
