// ═══════════════════════════════════════════════════════════
// useMetaAds — React Hook for Meta Ads AI Integration
// ═══════════════════════════════════════════════════════════

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  queryMetaAds,
  streamMetaAds,
  fetchCampaigns,
  fetchAlerts,
  fetchBudgetRecommendations,
  fetchAudienceBreakdown,
  fetchTopCreatives,
  fetchCrossValidation,
} from '@/lib/metaAdsApi';
import { tokenTracker, estimateCost, selectModel, selectToolProfile } from '@/lib/tokenOptimizer';
import type {
  TaskType,
  ToolProfile,
  CampaignData,
  PerformanceAlert,
  BudgetRecommendation,
  AudienceBreakdown,
  CrossValidationMetrics,
  UsageStats,
} from '@/types/metaAds';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  usage?: UsageStats;
  cost?: number;
  model?: string;
  taskType?: TaskType;
  toolCalls?: Array<{ name: string; input: Record<string, unknown> }>;
}

export interface DashboardData {
  campaigns: CampaignData[];
  alerts: PerformanceAlert[];
  budgetRecs: BudgetRecommendation[];
  audience: AudienceBreakdown;
  topCreatives: Array<Record<string, unknown>>;
  crossValidation: CrossValidationMetrics | null;
  lastUpdated: Date | null;
  isLoading: boolean;
  error: string | null;
}

export interface TokenStats {
  todayQueries: number;
  todayInputTokens: number;
  todayOutputTokens: number;
  todayCost: number;
  remainingBudget: number;
  dailyBudget: number;
  isOverBudget: boolean;
  last7Days: Array<{ date: string; cost: number; queries: number }>;
  byModel: Record<string, { cost: number; queries: number }>;
}

export function useMetaAds(options: {
  dailyBudget?: number;
  defaultAccountId?: string;
} = {}) {
  const { dailyBudget = 10, defaultAccountId } = options;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const [dashboard, setDashboard] = useState<DashboardData>({
    campaigns: [],
    alerts: [],
    budgetRecs: [],
    audience: { by_age: [], by_gender: [], by_placement: [] },
    topCreatives: [],
    crossValidation: null,
    lastUpdated: null,
    isLoading: false,
    error: null,
  });

  const [tokenStats, setTokenStats] = useState<TokenStats>({
    todayQueries: 0,
    todayInputTokens: 0,
    todayOutputTokens: 0,
    todayCost: 0,
    remainingBudget: dailyBudget,
    dailyBudget,
    isOverBudget: false,
    last7Days: [],
    byModel: {},
  });

  useEffect(() => {
    tokenTracker.setDailyBudget(dailyBudget);
    refreshTokenStats();
  }, [dailyBudget]);

  const refreshTokenStats = useCallback(() => {
    const stats = tokenTracker.getStats();
    setTokenStats({
      todayQueries: stats.today.queries,
      todayInputTokens: stats.today.inputTokens,
      todayOutputTokens: stats.today.outputTokens,
      todayCost: stats.today.totalCost,
      remainingBudget: stats.today.remainingBudget,
      dailyBudget: stats.dailyBudget,
      isOverBudget: tokenTracker.isOverBudget(),
      last7Days: stats.last7Days,
      byModel: stats.byModel,
    });
  }, []);

  const genId = () => `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const sendMessage = useCallback(async (
    prompt: string,
    taskType: TaskType = 'chat',
    toolProfile?: ToolProfile
  ) => {
    if (isStreaming) return;
    if (tokenTracker.isOverBudget()) {
      setMessages(prev => [...prev, {
        id: genId(),
        role: 'system',
        content: `Daily budget of $${dailyBudget} exceeded. Spent: $${tokenTracker.getTodaySpend().toFixed(4)}`,
        timestamp: new Date(),
      }]);
      return;
    }

    const userMsg: ChatMessage = {
      id: genId(), role: 'user', content: prompt, timestamp: new Date(), taskType,
    };
    const assistantId = genId();
    const assistantMsg: ChatMessage = {
      id: assistantId, role: 'assistant', content: '', timestamp: new Date(),
      isStreaming: true, taskType, model: selectModel(taskType), toolCalls: [],
    };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);
    setStreamText('');

    const profile = toolProfile || selectToolProfile(taskType);
    const history = messages.filter(m => m.role !== 'system').slice(-10).map(m => ({ role: m.role, content: m.content }));

    const controller = await streamMetaAds(
      prompt,
      {
        onText: (text) => {
          setStreamText(prev => prev + text);
          setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: m.content + text } : m));
        },
        onToolCall: (toolName, input) => {
          setMessages(prev => prev.map(m =>
            m.id === assistantId ? { ...m, toolCalls: [...(m.toolCalls || []), { name: toolName, input }] } : m
          ));
        },
        onComplete: (data) => {
          const model = selectModel(taskType);
          let cost = 0;
          if (data.usage) {
            const tracked = tokenTracker.track(data.usage, model, taskType, prompt);
            cost = tracked.totalCost;
          }
          setMessages(prev => prev.map(m =>
            m.id === assistantId
              ? { ...m, isStreaming: false, content: data.fullText || m.content, usage: data.usage, cost, model }
              : m
          ));
          setIsStreaming(false);
          setStreamText('');
          refreshTokenStats();
        },
        onError: (error) => {
          setMessages(prev => prev.map(m =>
            m.id === assistantId ? { ...m, isStreaming: false, content: `Error: ${error}` } : m
          ));
          setIsStreaming(false);
          setStreamText('');
        },
      },
      { taskType, toolProfile: profile, messages: [...history, { role: 'user', content: prompt }] }
    );

    abortRef.current = controller;
  }, [messages, isStreaming, dailyBudget, refreshTokenStats]);

  const query = useCallback(async (
    prompt: string,
    taskType: TaskType = 'data_fetch',
    toolProfile?: ToolProfile
  ) => {
    const result = await queryMetaAds(prompt, { taskType, toolProfile: toolProfile || selectToolProfile(taskType) });
    refreshTokenStats();
    return result;
  }, [refreshTokenStats]);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
    setStreamText('');
    setMessages(prev => prev.map(m => m.isStreaming ? { ...m, isStreaming: false } : m));
  }, []);

  const clearChat = useCallback(() => {
    setMessages([]);
    setStreamText('');
  }, []);

  const loadDashboard = useCallback(async (
    timeRange: string = 'last_30d',
    sections: Array<'campaigns' | 'alerts' | 'budget' | 'audience' | 'creatives' | 'crossValidation'> = ['campaigns', 'alerts']
  ) => {
    setDashboard(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const results = await Promise.allSettled([
        sections.includes('campaigns') ? fetchCampaigns(timeRange, defaultAccountId) : Promise.resolve(null),
        sections.includes('alerts') ? fetchAlerts(defaultAccountId) : Promise.resolve(null),
        sections.includes('budget') ? fetchBudgetRecommendations(defaultAccountId) : Promise.resolve(null),
        sections.includes('audience') ? fetchAudienceBreakdown(defaultAccountId) : Promise.resolve(null),
        sections.includes('creatives') ? fetchTopCreatives(defaultAccountId, timeRange) : Promise.resolve(null),
        sections.includes('crossValidation') ? fetchCrossValidation() : Promise.resolve(null),
      ]);

      setDashboard(prev => ({
        campaigns: results[0].status === 'fulfilled' && results[0].value ? results[0].value : prev.campaigns,
        alerts: results[1].status === 'fulfilled' && results[1].value ? results[1].value : prev.alerts,
        budgetRecs: results[2].status === 'fulfilled' && results[2].value ? results[2].value : prev.budgetRecs,
        audience: results[3].status === 'fulfilled' && results[3].value ? results[3].value : prev.audience,
        topCreatives: results[4].status === 'fulfilled' && results[4].value ? results[4].value : prev.topCreatives,
        crossValidation: results[5].status === 'fulfilled' && results[5].value ? results[5].value as CrossValidationMetrics : prev.crossValidation,
        lastUpdated: new Date(),
        isLoading: false,
        error: null,
      }));
      refreshTokenStats();
    } catch (error: unknown) {
      setDashboard(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Dashboard load failed',
      }));
    }
  }, [defaultAccountId, refreshTokenStats]);

  const loadCampaigns = useCallback(async (timeRange = 'last_30d') => {
    const data = await fetchCampaigns(timeRange, defaultAccountId);
    setDashboard(prev => ({ ...prev, campaigns: data, lastUpdated: new Date() }));
    refreshTokenStats();
    return data;
  }, [defaultAccountId, refreshTokenStats]);

  const loadAlerts = useCallback(async () => {
    const data = await fetchAlerts(defaultAccountId);
    setDashboard(prev => ({ ...prev, alerts: data, lastUpdated: new Date() }));
    refreshTokenStats();
    return data;
  }, [defaultAccountId, refreshTokenStats]);

  const loadBudgetRecs = useCallback(async () => {
    const data = await fetchBudgetRecommendations(defaultAccountId);
    setDashboard(prev => ({ ...prev, budgetRecs: data, lastUpdated: new Date() }));
    refreshTokenStats();
    return data;
  }, [defaultAccountId, refreshTokenStats]);

  const loadCrossValidation = useCallback(async () => {
    const data = await fetchCrossValidation();
    setDashboard(prev => ({ ...prev, crossValidation: data, lastUpdated: new Date() }));
    return data;
  }, []);

  const getEstimate = useCallback((prompt: string, taskType: TaskType = 'chat') => {
    const profile = selectToolProfile(taskType);
    return estimateCost(prompt.length, taskType, profile);
  }, []);

  return {
    messages, isStreaming, streamText, sendMessage, stopStreaming, clearChat,
    query,
    dashboard, loadDashboard, loadCampaigns, loadAlerts, loadBudgetRecs, loadCrossValidation,
    tokenStats, refreshTokenStats, getEstimate,
  };
}
