// ═══════════════════════════════════════════════════════════
// META ADS API CLIENT — Streaming + Non-Streaming
// Calls Supabase Edge Function (meta-ads-proxy)
// ═══════════════════════════════════════════════════════════

import { supabase } from '@/integrations/supabase/client';
import type {
  MetaAdsResponse,
  UsageStats,
  TaskType,
  ToolProfile,
  CampaignData,
  AdSetData,
  AdData,
  PerformanceAlert,
  BudgetRecommendation,
  AudienceBreakdown,
  CrossValidationMetrics,
  CreateCampaignParams,
  EntityMapping,
} from '@/types/metaAds';
import { selectModel, selectToolProfile, tokenTracker, needsMcpTools } from '@/lib/tokenOptimizer';

// ─── Configuration ────────────────────────────────────────
const SUPABASE_URL = 'https://ztjndilxurtsfqdsvfds.supabase.co';
const EDGE_FUNCTION = 'meta-ads-proxy';

function getBaseUrl(): string {
  return `${SUPABASE_URL}/functions/v1/${EDGE_FUNCTION}`;
}

async function getHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token || ''}`,
    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
  };
}

// ═══════════════════════════════════════════════════════════
// NON-STREAMING REQUEST
// ═══════════════════════════════════════════════════════════
export async function queryMetaAds(
  prompt: string,
  options: {
    taskType?: TaskType;
    toolProfile?: ToolProfile;
    maxTokens?: number;
    model?: string;
    system?: string;
  } = {}
): Promise<MetaAdsResponse> {
  const taskType = options.taskType || 'chat';
  const toolProfile = options.toolProfile || selectToolProfile(taskType);
  const model = options.model || selectModel(taskType);
  const useMcp = needsMcpTools(taskType);

  if (tokenTracker.isOverBudget()) {
    throw new Error('Daily token budget exceeded. Increase budget in settings or wait until tomorrow.');
  }

  const headers = await getHeaders();
  const response = await fetch(getBaseUrl(), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      prompt,
      stream: false,
      taskType,
      toolProfile,
      maxTokens: options.maxTokens || 4096,
      model,
      system: options.system,
      useMcp,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`API Error ${response.status}: ${errorBody}`);
  }

  const data: MetaAdsResponse = await response.json();
  if (data.usage) {
    tokenTracker.track(data.usage, model, taskType, prompt);
  }
  return data;
}

// ═══════════════════════════════════════════════════════════
// STREAMING REQUEST (SSE)
// ═══════════════════════════════════════════════════════════
export async function streamMetaAds(
  prompt: string,
  callbacks: {
    onText: (text: string) => void;
    onToolCall?: (toolName: string, input: Record<string, unknown>) => void;
    onToolResult?: (result: unknown) => void;
    onComplete: (data: { usage?: UsageStats; stopReason?: string; fullText: string }) => void;
    onError: (error: string) => void;
  },
  options: {
    taskType?: TaskType;
    toolProfile?: ToolProfile;
    messages?: Array<{ role: string; content: string }>;
    system?: string;
  } = {}
): Promise<AbortController> {
  const controller = new AbortController();
  const taskType = options.taskType || 'chat';
  const toolProfile = options.toolProfile || selectToolProfile(taskType);
  const model = selectModel(taskType);
  const useMcp = needsMcpTools(taskType);

  if (tokenTracker.isOverBudget()) {
    callbacks.onError('Daily token budget exceeded.');
    return controller;
  }

  try {
    const headers = await getHeaders();
    const response = await fetch(getBaseUrl(), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        prompt,
        stream: true,
        taskType,
        toolProfile,
        messages: options.messages || [{ role: 'user', content: prompt }],
        system: options.system,
        useMcp,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      callbacks.onError(`Stream error ${response.status}: ${errorText}`);
      return controller;
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';

    const processLine = (line: string) => {
      if (!line.startsWith('data: ')) return;
      const data = line.slice(6).trim();
      if (data === '[DONE]') return;

      try {
        const event = JSON.parse(data);
        switch (event.type) {
          case 'content_block_delta':
            if (event.delta?.type === 'text_delta') {
              const text = event.delta.text;
              fullText += text;
              callbacks.onText(text);
            }
            break;
          case 'content_block_start':
            if (event.content_block?.type === 'mcp_tool_use') {
              callbacks.onToolCall?.(event.content_block.name, event.content_block.input || {});
            }
            break;
          case 'message_delta':
            if (event.usage) {
              tokenTracker.track(event.usage, model, taskType, prompt);
            }
            break;
          case 'message_stop':
            callbacks.onComplete({ usage: event.usage, stopReason: event.stop_reason, fullText });
            break;
          case 'error':
            callbacks.onError(event.error?.message || 'Unknown stream error');
            break;
        }
      } catch {
        // Skip malformed events
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        if (buffer.trim()) buffer.split('\n').forEach(processLine);
        callbacks.onComplete({ fullText, stopReason: 'end_turn' });
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      lines.forEach(processLine);
    }
  } catch (error: unknown) {
    if (error instanceof Error && error.name !== 'AbortError') {
      callbacks.onError(error.message);
    }
  }

  return controller;
}

// ═══════════════════════════════════════════════════════════
// PRE-BUILT DASHBOARD QUERIES
// ═══════════════════════════════════════════════════════════

export async function fetchCampaigns(
  timeRange: string = 'last_30d',
  accountId?: string
): Promise<CampaignData[]> {
  const prompt = accountId
    ? `Account ${accountId}, ${timeRange}. Return JSON array: [{campaign_id,campaign_name,status,objective,spend,impressions,clicks,conversions,ctr,cpc,cpm,roas,cpa}]. Numbers only.`
    : `All accounts, ${timeRange}. Return JSON array: [{campaign_id,campaign_name,status,objective,spend,impressions,clicks,conversions,ctr,cpc,cpm,roas,cpa}]. Numbers only.`;

  const result = await queryMetaAds(prompt, { taskType: 'data_fetch', toolProfile: 'dashboard', maxTokens: 2048 });
  return parseJsonFromText<CampaignData[]>(result.text, []);
}

export async function fetchAlerts(accountId?: string): Promise<PerformanceAlert[]> {
  const prompt = `${accountId ? `Account ${accountId}, ` : ''}Last 7 days. Return JSON alerts: [{campaign_id,campaign_name,alert_type,severity,metric,value,threshold,recommendation}].`;
  const result = await queryMetaAds(prompt, { taskType: 'performance_alerts', toolProfile: 'dashboard', maxTokens: 2048 });
  return parseJsonFromText<PerformanceAlert[]>(result.text, []);
}

export async function fetchBudgetRecommendations(accountId?: string): Promise<BudgetRecommendation[]> {
  const prompt = `${accountId ? `Account ${accountId}, ` : ''}Last 30 days. Analyze all active campaigns. Return JSON: [{campaign_id,campaign_name,current_daily_budget,recommended_daily_budget,reason,expected_roas_change}].`;
  const result = await queryMetaAds(prompt, { taskType: 'budget_optimization', toolProfile: 'management', maxTokens: 2048 });
  return parseJsonFromText<BudgetRecommendation[]>(result.text, []);
}

export async function fetchAudienceBreakdown(accountId?: string): Promise<AudienceBreakdown> {
  const prompt = `${accountId ? `Account ${accountId}, ` : ''}Last 30 days. Break down by age, gender, placement. Return JSON: {by_age:[{range,spend,conversions,cpa}],by_gender:[{gender,spend,conversions,cpa}],by_placement:[{placement,spend,conversions,cpa}]}.`;
  const result = await queryMetaAds(prompt, { taskType: 'audience_insights', toolProfile: 'dashboard', maxTokens: 2048 });
  return parseJsonFromText<AudienceBreakdown>(result.text, { by_age: [], by_gender: [], by_placement: [] });
}

export async function fetchTopCreatives(
  accountId?: string,
  timeRange: string = 'last_14d',
  limit: number = 10
): Promise<Array<Record<string, unknown>>> {
  const prompt = `${accountId ? `Account ${accountId}, ` : ''}${timeRange}. Top ${limit} ads by conversions. Return JSON: [{ad_id,ad_name,adset_name,campaign_name,spend,conversions,cpa,ctr,roas}].`;
  const result = await queryMetaAds(prompt, { taskType: 'creative_analysis', toolProfile: 'creative', maxTokens: 2048 });
  return parseJsonFromText<Array<Record<string, unknown>>>(result.text, []);
}

// ═══════════════════════════════════════════════════════════
// CROSS-VALIDATION (Meta vs HubSpot/Stripe)
// ═══════════════════════════════════════════════════════════
export async function fetchCrossValidation(): Promise<CrossValidationMetrics> {
  const headers = await getHeaders();
  const response = await fetch(getBaseUrl(), {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'cross_validate' }),
  });
  if (!response.ok) throw new Error(`Cross-validation failed: ${response.status}`);
  return response.json();
}

// ═══════════════════════════════════════════════════════════
// CAMPAIGN MANAGEMENT
// ═══════════════════════════════════════════════════════════

export async function updateCampaignStatus(
  campaignId: string,
  status: 'ACTIVE' | 'PAUSED'
): Promise<MetaAdsResponse> {
  return queryMetaAds(
    `Update campaign ${campaignId} status to ${status}. Confirm the change.`,
    { taskType: 'data_fetch', toolProfile: 'management', maxTokens: 1024 }
  );
}

export async function updateBudget(
  campaignId: string,
  newBudget: number
): Promise<MetaAdsResponse> {
  return queryMetaAds(
    `Update campaign ${campaignId} daily budget to ${newBudget} AED. Confirm the change.`,
    { taskType: 'budget_optimization', toolProfile: 'management', maxTokens: 1024 }
  );
}

export async function createCampaign(params: CreateCampaignParams): Promise<MetaAdsResponse> {
  const accountId = params.account_id || 'act_349832333681399';
  return queryMetaAds(
    `Create a new campaign on account ${accountId}: name="${params.name}", objective="${params.objective}", daily_budget=${params.daily_budget} AED, status=${params.status || 'PAUSED'}. Confirm creation.`,
    { taskType: 'data_fetch', toolProfile: 'management', maxTokens: 1024 }
  );
}

// ─── JSON Parser (handles markdown code blocks) ───────────
function parseJsonFromText<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text);
  } catch {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\[[\s\S]*\])/) || text.match(/(\{[\s\S]*\})/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1].trim());
      } catch {
        return fallback;
      }
    }
    return fallback;
  }
}

// ═══════════════════════════════════════════════════════════
// DRILL-DOWN QUERIES
// ═══════════════════════════════════════════════════════════

export async function fetchAdSets(
  campaignId: string,
  timeRange: string = 'last_30d'
): Promise<AdSetData[]> {
  const prompt = `Campaign ${campaignId}, ${timeRange}. Return JSON array of ad sets: [{adset_id,adset_name,campaign_id,campaign_name,status,spend,impressions,clicks,conversions,cpa,roas,ctr,daily_budget,reach,frequency,link_clicks,landing_page_views,lead_form_submissions,messaging_conversations,quality_ranking,engagement_rate_ranking,conversion_rate_ranking}]. Numbers only.`;
  const result = await queryMetaAds(prompt, { taskType: 'data_fetch', toolProfile: 'dashboard', maxTokens: 2048 });
  return parseJsonFromText<AdSetData[]>(result.text, []);
}

export async function fetchAds(
  adSetId: string,
  timeRange: string = 'last_30d'
): Promise<AdData[]> {
  const prompt = `Ad set ${adSetId}, ${timeRange}. Return JSON array of ads: [{ad_id,ad_name,adset_id,adset_name,campaign_name,spend,impressions,clicks,conversions,ctr,cpa,roas}]. Numbers only.`;
  const result = await queryMetaAds(prompt, { taskType: 'data_fetch', toolProfile: 'dashboard', maxTokens: 2048 });
  return parseJsonFromText<AdData[]>(result.text, []);
}

export async function fetchEntities(): Promise<EntityMapping[]> {
  const headers = await getHeaders();
  const response = await fetch(getBaseUrl(), {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'get_entities' }),
  });
  if (!response.ok) {
    return [];
  }
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

export async function fetchCrossValidationRange(
  periodStart: string,
  periodEnd: string
): Promise<CrossValidationMetrics> {
  const headers = await getHeaders();
  const response = await fetch(getBaseUrl(), {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'cross_validate', period_start: periodStart, period_end: periodEnd }),
  });
  if (!response.ok) throw new Error(`Cross-validation failed: ${response.status}`);
  return response.json();
}

// ─── Export for backward compat with old chat function ────
export async function chat(
  message: string,
  history: Array<{ role: string; content: string }> = [],
): Promise<string> {
  const result = await queryMetaAds(message, { taskType: 'chat' });
  return result.text;
}
