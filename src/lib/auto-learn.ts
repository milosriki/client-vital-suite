import { supabase } from "@/integrations/supabase/client";

// Background learning from app data changes
export async function autoLearnFromApp() {
  try {
    // Fetch health scores
    const { data: healthData } = await supabase
      .from('client_health_scores')
      .select('email, health_score, health_zone, calculated_at')
      .gte('calculated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(50);

    // Fetch AnyTrack/attribution events
    const { data: trackingData } = await supabase
      .from('attribution_events')
      .select('event_name, source, medium, campaign, value, event_time')
      .gte('event_time', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(100);

    // Fetch recent conversions
    const { data: conversionData } = await supabase
      .from('events')
      .select('event_name, source, custom, event_time')
      .gte('event_time', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(100);

    // Build comprehensive learning data
    const learningParts: string[] = [];

    if (healthData?.length) {
      learningParts.push('## Health Scores\n' + healthData.map(r => 
        `- ${r.email}: ${r.health_score} (${r.health_zone})`
      ).join('\n'));
    }

    if (trackingData?.length) {
      const bySource = trackingData.reduce((acc: Record<string, number>, e) => {
        acc[e.source || 'unknown'] = (acc[e.source || 'unknown'] || 0) + 1;
        return acc;
      }, {});
      learningParts.push('## Attribution Events\n' + 
        `Total: ${trackingData.length} events\n` +
        Object.entries(bySource).map(([s, c]) => `- ${s}: ${c} events`).join('\n'));
    }

    if (conversionData?.length) {
      const byEvent = conversionData.reduce((acc: Record<string, number>, e) => {
        acc[e.event_name] = (acc[e.event_name] || 0) + 1;
        return acc;
      }, {});
      learningParts.push('## Conversions\n' + 
        Object.entries(byEvent).map(([e, c]) => `- ${e}: ${c}`).join('\n'));
    }

    if (!learningParts.length) return;

    await supabase.from('agent_context').upsert({
      key: `auto_learn_${new Date().toISOString().split('T')[0]}`,
      value: { 
        type: 'daily_snapshot', 
        data: learningParts.join('\n\n'),
        sources: ['health_scores', 'anytrack', 'conversions'],
        learned_at: new Date().toISOString() 
      },
      agent_type: 'auto_learning',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    });

    console.log('✅ Auto-learned from health, AnyTrack & conversion data');
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
