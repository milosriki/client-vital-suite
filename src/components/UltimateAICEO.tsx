"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
    Brain, Zap, AlertTriangle, CheckCircle, XCircle, Code,
    TrendingUp, Target, Clock, Rocket, Eye,
    ThumbsUp, ThumbsDown, Loader2, Lightbulb, BookOpen,
    DollarSign, Users, Activity, Shield, RefreshCw,
    BarChart3, AlertCircle, Wifi, WifiOff, Heart, TrendingDown
} from "lucide-react";
import { toast } from "sonner";

interface PreparedAction {
    id: string;
    action_type: string;
    action_title: string;
    action_description: string;
    reasoning: string;
    expected_impact: string;
    risk_level: string;
    confidence: number;
    prepared_payload: any;
    supporting_data: any;
    status: string;
    priority: number;
    source_agent: string;
    created_at: string;
    executed_at?: string;
    rejection_reason?: string;
}

interface BusinessGoal {
    id: string;
    goal_name: string;
    metric_name: string;
    baseline_value: number;
    current_value: number;
    target_value: number;
    deadline: string;
    status: string;
}

interface CalibrationExample {
    id: string;
    scenario_description: string;
    ai_recommendation: string;
    your_decision: string;
    was_ai_correct: boolean;
    created_at: string;
}

interface ProactiveInsight {
    id: string;
    insight_type: string;
    title: string;
    description: string;
    priority: string;
    created_at: string;
}

interface BIAnalysis {
    executive_summary?: string;
    system_status?: string;
    action_plan?: string[];
    data_freshness?: string;
}

export function UltimateAICEO() {
    const [command, setCommand] = useState("");
    const [selectedAction, setSelectedAction] = useState<PreparedAction | null>(null);
    const [rejectionReason, setRejectionReason] = useState("");
    const queryClient = useQueryClient();

    // ========================================
    // DATA FETCHING
    // ========================================

    const { data: pendingActions, isLoading: loadingActions } = useQuery({
        queryKey: ['pending-actions'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('prepared_actions' as any)
                .select('*')
                .in('status', ['prepared', 'executing'])
                .order('priority', { ascending: false });
            if (error) throw error;
            return (data || []) as unknown as PreparedAction[];
        },
        staleTime: Infinity // Real-time updates via subscriptions
    });

    const { data: executedActions } = useQuery({
        queryKey: ['executed-actions'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('prepared_actions' as any)
                .select('*')
                .in('status', ['executed', 'failed'])
                .order('executed_at', { ascending: false })
                .limit(10);
            if (error) throw error;
            return (data || []) as unknown as PreparedAction[];
        },
        staleTime: Infinity // Real-time updates via subscriptions
    });

    const { data: goals } = useQuery({
        queryKey: ['business-goals'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('business_goals' as any)
                .select('*')
                .eq('status', 'active');
            if (error) throw error;
            return (data || []) as unknown as BusinessGoal[];
        }
    });

    const { data: calibrationData } = useQuery({
        queryKey: ['business-calibration'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('business_calibration' as any)
                .select('*')
                .order('created_at', { ascending: false })
                .limit(20);
            if (error) throw error;
            return (data || []) as unknown as CalibrationExample[];
        }
    });

    const { data: insights } = useQuery({
        queryKey: ['proactive-insights'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('proactive_insights')
                .select('id, insight_type, priority, created_at')
                .order('created_at', { ascending: false })
                .limit(10);
            if (error) throw error;
            return (data || []).map((item: any) => ({
                ...item,
                title: item.insight_type || 'Insight',
                description: ''
            })) as ProactiveInsight[];
        },
        staleTime: Infinity // Real-time updates via subscriptions
    });

    // NEW: Business Intelligence Data
    const { data: biData, isLoading: loadingBI, refetch: refetchBI } = useQuery({
        queryKey: ['business-intelligence'],
        queryFn: async () => {
            const { data, error } = await supabase.functions.invoke('business-intelligence');
            if (error) throw error;
            return data as { success: boolean; analysis: BIAnalysis; dataFreshness: string; staleWarning: string | null };
        },
        staleTime: Infinity // Real-time updates via subscriptions
    });

    // NEW: Revenue Metrics
    const { data: revenueData } = useQuery({
        queryKey: ['ceo-revenue-metrics'],
        queryFn: async () => {
            const { data: deals, error } = await supabase
                .from('deals')
                .select('deal_value, status, close_date')
                .gte('close_date', new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString());
            
            if (error) throw error;
            
            const closedDeals = deals?.filter(d => d.status === 'closed') || [];
            const totalRevenue = closedDeals.reduce((sum, d) => sum + (d.deal_value || 0), 0);
            const avgDealValue = closedDeals.length > 0 ? totalRevenue / closedDeals.length : 0;
            
            return {
                totalRevenue,
                avgDealValue,
                dealsCount: closedDeals.length,
                pipelineValue: deals?.filter(d => d.status !== 'closed').reduce((sum, d) => sum + (d.deal_value || 0), 0) || 0
            };
        }
    });

    // NEW: Client Health
    const { data: clientHealth } = useQuery({
        queryKey: ['ceo-client-health'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('client_health_scores')
                .select('health_zone, health_score, churn_risk_score, package_value_aed');
            
            if (error) throw error;
            
            const zones = { green: 0, yellow: 0, red: 0, purple: 0 };
            let atRiskRevenue = 0;
            let totalScore = 0;
            
            data?.forEach(c => {
                const zone = (c.health_zone || 'yellow').toLowerCase();
                if (zone in zones) zones[zone as keyof typeof zones]++;
                if (zone === 'red' || zone === 'yellow') {
                    atRiskRevenue += c.package_value_aed || 0;
                }
                totalScore += c.health_score || 0;
            });
            
            return {
                ...zones,
                total: data?.length || 0,
                atRiskRevenue,
                avgHealth: data?.length ? Math.round(totalScore / data.length) : 0
            };
        }
    });

    // NEW: Integration Status
    const { data: integrationStatus } = useQuery({
        queryKey: ['ceo-integration-status'],
        queryFn: async () => {
            const { data: syncLogs } = await supabase
                .from('sync_logs')
                .select('platform, status, started_at')
                .order('started_at', { ascending: false })
                .limit(50);
            
            const { data: syncErrors } = await supabase
                .from('sync_errors')
                .select('source, error_type, resolved_at')
                .is('resolved_at', null);
            
            const platforms = ['hubspot', 'stripe', 'callgear', 'facebook'];
            const status: Record<string, { connected: boolean; lastSync: string | null; errors: number }> = {};
            
            platforms.forEach(p => {
                const logs = syncLogs?.filter((l: any) => l.platform === p) || [];
                const errors = syncErrors?.filter((e: any) => e.source === p) || [];
                const lastLog = logs[0] as any;
                
                status[p] = {
                    connected: logs.some((l: any) => l.status === 'success'),
                    lastSync: lastLog?.started_at || null,
                    errors: errors.length
                };
            });
            
            return status;
        },
        staleTime: Infinity // Real-time updates via subscriptions
    });

    // NEW: Churn Alerts
    const { data: churnAlerts } = useQuery({
        queryKey: ['ceo-churn-alerts'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('client_health_scores')
                .select('firstname, lastname, email, churn_risk_score, health_zone, package_value_aed')
                .or('health_zone.eq.red,churn_risk_score.gt.70')
                .order('churn_risk_score', { ascending: false })
                .limit(5);
            
            if (error) throw error;
            return data || [];
        }
    });

    // ========================================
    // MUTATIONS
    // ========================================

    const generateSolution = useMutation({
        mutationFn: async (userCommand: string) => {
            const { data, error } = await supabase.functions.invoke('ai-ceo-master', {
                body: { command: userCommand }
            });
            if (error) throw error;
            return data;
        },
        onSuccess: (data) => {
            toast.success("Solution generated!", {
                description: `${data.preview?.title} - Ready for approval`
            });
            queryClient.invalidateQueries({ queryKey: ['pending-actions'] });
            setCommand("");
        },
        onError: (error) => {
            toast.error("Generation failed", { description: error.message });
        }
    });

    const approveAction = useMutation({
        mutationFn: async (actionId: string) => {
            const { data, error } = await supabase.functions.invoke('ai-trigger-deploy', {
                body: { approval_id: actionId, approved: true, approved_by: 'CEO' }
            });
            if (error) throw error;
            return data;
        },
        onSuccess: (data) => {
            if (data.status === 'deploying') {
                toast.info("Deployment started!", {
                    description: "GitHub Actions triggered. Watch for updates..."
                });
            } else {
                toast.success("Action executed!");
            }
            queryClient.invalidateQueries({ queryKey: ['pending-actions'] });
            queryClient.invalidateQueries({ queryKey: ['executed-actions'] });
            setSelectedAction(null);
        },
        onError: (error) => {
            toast.error("Approval failed", { description: error.message });
        }
    });

    const rejectAction = useMutation({
        mutationFn: async ({ actionId, reason }: { actionId: string; reason: string }) => {
            const { data, error } = await supabase.functions.invoke('ai-trigger-deploy', {
                body: { approval_id: actionId, approved: false, rejection_reason: reason }
            });
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            toast.info("Action rejected", { description: "AI will learn from this decision" });
            queryClient.invalidateQueries({ queryKey: ['pending-actions'] });
            setSelectedAction(null);
            setRejectionReason("");
        }
    });

    const runMonitor = useMutation({
        mutationFn: async () => {
            const { data, error } = await supabase.functions.invoke('ptd-24x7-monitor');
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            toast.success("Monitor scan complete");
            queryClient.invalidateQueries({ queryKey: ['proactive-insights'] });
        }
    });

    // ========================================
    // COMPUTED VALUES
    // ========================================

    const stats = {
        total: pendingActions?.length || 0,
        critical: pendingActions?.filter(a => a.risk_level === 'critical').length || 0,
        high: pendingActions?.filter(a => a.risk_level === 'high').length || 0,
        autoApprovable: pendingActions?.filter(a =>
            a.risk_level === 'low' && a.confidence > 0.85
        ).length || 0
    };

    const getRiskColor = (risk: string) => {
        switch (risk) {
            case 'critical': return 'bg-red-500 text-white';
            case 'high': return 'bg-orange-500 text-white';
            case 'medium': return 'bg-yellow-500 text-black';
            default: return 'bg-green-500 text-white';
        }
    };

    const getRiskBorder = (risk: string) => {
        switch (risk) {
            case 'critical': return 'border-red-500/50 bg-red-500/10';
            case 'high': return 'border-orange-500/50 bg-orange-500/10';
            case 'medium': return 'border-yellow-500/50 bg-yellow-500/10';
            default: return 'border-green-500/50 bg-green-500/10';
        }
    };

    const getActionIcon = (type: string) => {
        switch (type) {
            case 'code_deploy': return <Code className="w-4 h-4" />;
            case 'intervention': return <AlertTriangle className="w-4 h-4" />;
            case 'analysis': return <TrendingUp className="w-4 h-4" />;
            default: return <Zap className="w-4 h-4" />;
        }
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-AE', {
            style: 'currency',
            currency: 'AED',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(value);
    };

    // ========================================
    // RENDER
    // ========================================

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 p-4 sm:p-6">
            <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">

                {/* Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3 sm:gap-4">
                        <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-500/25 shrink-0">
                            <Brain className="w-6 h-6 sm:w-10 sm:h-10 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white">ULTIMATE AI CEO</h1>
                            <p className="text-xs sm:text-sm text-cyan-400">Self-Coding • Multi-Model • Human-Controlled</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => runMonitor.mutate()}
                            disabled={runMonitor.isPending}
                            className="border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/20"
                        >
                            {runMonitor.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                            <span className="ml-2 hidden sm:inline">Run Monitor</span>
                        </Button>
                        <Badge variant="outline" className="text-emerald-400 border-emerald-400/50 text-xs sm:text-sm">
                            <div className="w-2 h-2 bg-emerald-400 rounded-full mr-2 animate-pulse" />
                            System Active
                        </Badge>
                    </div>
                </div>

                {/* Executive Summary Banner */}
                {biData?.analysis && (
                    <Card className="bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-indigo-500/10 border-cyan-500/30">
                        <CardContent className="p-4 sm:p-6">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-cyan-500/20 rounded-xl flex items-center justify-center shrink-0">
                                    <BarChart3 className="w-6 h-6 text-cyan-400" />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <h2 className="text-lg font-bold text-white">Executive Briefing</h2>
                                        <Badge variant={biData.dataFreshness === 'FRESH' ? 'default' : 'destructive'} className="text-xs">
                                            {biData.dataFreshness === 'FRESH' ? 'Live Data' : 'Stale Data'}
                                        </Badge>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => refetchBI()}
                                            className="ml-auto text-cyan-400 hover:text-cyan-300"
                                        >
                                            <RefreshCw className={`w-4 h-4 ${loadingBI ? 'animate-spin' : ''}`} />
                                        </Button>
                                    </div>
                                    <p className="text-white/80 text-sm leading-relaxed">
                                        {biData.analysis.executive_summary || "Analyzing business vitals..."}
                                    </p>
                                    {biData.staleWarning && (
                                        <p className="text-yellow-400 text-xs mt-2 flex items-center gap-1">
                                            <AlertCircle className="w-3 h-3" />
                                            {biData.staleWarning}
                                        </p>
                                    )}
                                    {biData.analysis.action_plan && biData.analysis.action_plan.length > 0 && (
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {biData.analysis.action_plan.slice(0, 3).map((action, i) => (
                                                <Badge key={i} variant="outline" className="text-cyan-400 border-cyan-400/30">
                                                    {action}
                                                </Badge>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Revenue & Business Metrics Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
                    {/* Revenue This Month */}
                    <Card className="bg-emerald-500/10 border-emerald-500/30 col-span-1">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <DollarSign className="w-4 h-4 text-emerald-400" />
                                <span className="text-xs text-white/60 uppercase">Revenue</span>
                            </div>
                            <p className="text-xl sm:text-2xl font-bold text-white">
                                {formatCurrency(revenueData?.totalRevenue || 0)}
                            </p>
                            <p className="text-xs text-emerald-400">This month</p>
                        </CardContent>
                    </Card>

                    {/* Active Clients */}
                    <Card className="bg-blue-500/10 border-blue-500/30 col-span-1">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Users className="w-4 h-4 text-blue-400" />
                                <span className="text-xs text-white/60 uppercase">Clients</span>
                            </div>
                            <p className="text-xl sm:text-2xl font-bold text-white">
                                {clientHealth?.total || 0}
                            </p>
                            <p className="text-xs text-blue-400">Active total</p>
                        </CardContent>
                    </Card>

                    {/* Avg Deal Value */}
                    <Card className="bg-purple-500/10 border-purple-500/30 col-span-1">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <TrendingUp className="w-4 h-4 text-purple-400" />
                                <span className="text-xs text-white/60 uppercase">Avg Deal</span>
                            </div>
                            <p className="text-xl sm:text-2xl font-bold text-white">
                                {formatCurrency(revenueData?.avgDealValue || 0)}
                            </p>
                            <p className="text-xs text-purple-400">{revenueData?.dealsCount || 0} deals</p>
                        </CardContent>
                    </Card>

                    {/* At-Risk Revenue */}
                    <Card className="bg-red-500/10 border-red-500/30 col-span-1">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle className="w-4 h-4 text-red-400" />
                                <span className="text-xs text-white/60 uppercase">At Risk</span>
                            </div>
                            <p className="text-xl sm:text-2xl font-bold text-white">
                                {formatCurrency(clientHealth?.atRiskRevenue || 0)}
                            </p>
                            <p className="text-xs text-red-400">{(clientHealth?.red || 0) + (clientHealth?.yellow || 0)} clients</p>
                        </CardContent>
                    </Card>

                    {/* Pending Actions */}
                    <Card className="bg-orange-500/10 border-orange-500/30 col-span-1">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Clock className="w-4 h-4 text-orange-400" />
                                <span className="text-xs text-white/60 uppercase">Pending</span>
                            </div>
                            <p className="text-xl sm:text-2xl font-bold text-white">{stats.total}</p>
                            <p className="text-xs text-orange-400">{stats.critical + stats.high} urgent</p>
                        </CardContent>
                    </Card>

                    {/* Active Goals */}
                    <Card className="bg-cyan-500/10 border-cyan-500/30 col-span-1">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Target className="w-4 h-4 text-cyan-400" />
                                <span className="text-xs text-white/60 uppercase">Goals</span>
                            </div>
                            <p className="text-xl sm:text-2xl font-bold text-white">{goals?.length || 0}</p>
                            <p className="text-xs text-cyan-400">Active targets</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Client Health & Integration Status Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Client Health Distribution */}
                    <Card className="bg-white/5 border-white/10">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg text-white flex items-center gap-2">
                                <Heart className="w-5 h-5 text-pink-400" />
                                Client Health Distribution
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-2 mb-4">
                                <div className="flex-1 h-4 bg-white/5 rounded-full overflow-hidden flex">
                                    {clientHealth && clientHealth.total > 0 && (
                                        <>
                                            <div
                                                className="h-full bg-green-500"
                                                style={{ width: `${(clientHealth.green / clientHealth.total) * 100}%` }}
                                            />
                                            <div
                                                className="h-full bg-yellow-500"
                                                style={{ width: `${(clientHealth.yellow / clientHealth.total) * 100}%` }}
                                            />
                                            <div
                                                className="h-full bg-red-500"
                                                style={{ width: `${(clientHealth.red / clientHealth.total) * 100}%` }}
                                            />
                                            <div
                                                className="h-full bg-purple-500"
                                                style={{ width: `${(clientHealth.purple / clientHealth.total) * 100}%` }}
                                            />
                                        </>
                                    )}
                                </div>
                                <span className="text-sm text-white/60">{clientHealth?.avgHealth || 0} avg</span>
                            </div>
                            <div className="grid grid-cols-4 gap-2 text-center">
                                <div className="p-2 bg-green-500/10 rounded-lg">
                                    <p className="text-lg font-bold text-green-400">{clientHealth?.green || 0}</p>
                                    <p className="text-xs text-white/40">Green</p>
                                </div>
                                <div className="p-2 bg-yellow-500/10 rounded-lg">
                                    <p className="text-lg font-bold text-yellow-400">{clientHealth?.yellow || 0}</p>
                                    <p className="text-xs text-white/40">Yellow</p>
                                </div>
                                <div className="p-2 bg-red-500/10 rounded-lg">
                                    <p className="text-lg font-bold text-red-400">{clientHealth?.red || 0}</p>
                                    <p className="text-xs text-white/40">Red</p>
                                </div>
                                <div className="p-2 bg-purple-500/10 rounded-lg">
                                    <p className="text-lg font-bold text-purple-400">{clientHealth?.purple || 0}</p>
                                    <p className="text-xs text-white/40">Purple</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Integration Status */}
                    <Card className="bg-white/5 border-white/10">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg text-white flex items-center gap-2">
                                <Shield className="w-5 h-5 text-cyan-400" />
                                Integration Status
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 gap-3">
                                {Object.entries(integrationStatus || {}).map(([platform, status]) => (
                                    <div
                                        key={platform}
                                        className={`p-3 rounded-lg border ${
                                            status.connected && status.errors === 0
                                                ? 'bg-green-500/10 border-green-500/30'
                                                : status.errors > 0
                                                    ? 'bg-red-500/10 border-red-500/30'
                                                    : 'bg-yellow-500/10 border-yellow-500/30'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-medium text-white capitalize">{platform}</span>
                                            {status.connected ? (
                                                <Wifi className="w-4 h-4 text-green-400" />
                                            ) : (
                                                <WifiOff className="w-4 h-4 text-red-400" />
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {status.errors > 0 && (
                                                <Badge variant="destructive" className="text-xs">
                                                    {status.errors} errors
                                                </Badge>
                                            )}
                                            {status.lastSync && (
                                                <span className="text-xs text-white/40">
                                                    {new Date(status.lastSync).toLocaleTimeString()}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Churn Alerts (if any) */}
                {churnAlerts && churnAlerts.length > 0 && (
                    <Card className="bg-red-500/5 border-red-500/30">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg text-white flex items-center gap-2">
                                <TrendingDown className="w-5 h-5 text-red-400" />
                                Churn Risk Alerts
                                <Badge variant="destructive" className="ml-2">{churnAlerts.length}</Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                                {churnAlerts.map((client: any, i) => (
                                    <div key={i} className="p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                                        <p className="text-sm font-medium text-white truncate">
                                            {client.firstname} {client.lastname}
                                        </p>
                                        <div className="flex items-center justify-between mt-1">
                                            <Badge variant="outline" className={`text-xs ${
                                                client.health_zone === 'red' ? 'text-red-400 border-red-400/50' : 'text-yellow-400 border-yellow-400/50'
                                            }`}>
                                                {client.health_zone}
                                            </Badge>
                                            <span className="text-xs text-red-400">{client.churn_risk_score}% risk</span>
                                        </div>
                                        <p className="text-xs text-white/40 mt-1">{formatCurrency(client.package_value_aed || 0)}</p>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Command Input */}
                <Card className="bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border-cyan-500/30">
                    <CardContent className="p-4 sm:p-6">
                        <h2 className="text-lg sm:text-xl font-bold text-white mb-4 flex items-center gap-2">
                            <Rocket className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
                            <span className="text-sm sm:text-base lg:text-xl">Request New Feature / Solution</span>
                        </h2>
                        <Textarea
                            value={command}
                            onChange={(e) => setCommand(e.target.value)}
                            placeholder='Examples:
• "Build a churn prediction dashboard with ML"
• "Create WhatsApp booking integration"
• "Fix the Stripe payment sync issue"
• "Add automated follow-up for stale leads"'
                            className="bg-white/5 border-white/20 text-white placeholder-white/40 min-h-[100px] mb-4 focus:border-cyan-500 text-sm sm:text-base"
                        />
                        <Button
                            onClick={() => generateSolution.mutate(command)}
                            disabled={!command.trim() || generateSolution.isPending}
                            className="w-full bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-700 hover:to-purple-700 h-10 sm:h-12 text-sm sm:text-lg"
                        >
                            {generateSolution.isPending ? (
                                <>
                                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                    Analyzing & Generating...
                                </>
                            ) : (
                                <>
                                    <Brain className="w-5 h-5 mr-2" />
                                    Generate Solution (Claude + Gemini)
                                </>
                            )}
                        </Button>
                    </CardContent>
                </Card>

                {/* Main Content Tabs */}
                <Tabs defaultValue="actions" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 bg-white/5 border-white/10">
                        <TabsTrigger value="actions" className="text-xs sm:text-sm">Pending Actions ({stats.total})</TabsTrigger>
                        <TabsTrigger value="insights" className="text-xs sm:text-sm">Proactive Insights</TabsTrigger>
                        <TabsTrigger value="memory" className="text-xs sm:text-sm">AI Memory & Learning</TabsTrigger>
                    </TabsList>

                    <TabsContent value="actions" className="mt-4 sm:mt-6">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                            {/* Pending Actions List */}
                            <div className="lg:col-span-2 space-y-4">
                                {loadingActions ? (
                                    <Card className="bg-white/5 border-white/10 p-8">
                                        <div className="flex items-center justify-center gap-3">
                                            <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                                            <span className="text-white/60">Loading actions...</span>
                                        </div>
                                    </Card>
                                ) : pendingActions?.length === 0 ? (
                                    <Card className="bg-white/5 border-white/10 p-8">
                                        <div className="text-center">
                                            <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                                            <p className="text-white/60">No pending actions</p>
                                            <p className="text-sm text-white/40">AI is monitoring your business</p>
                                        </div>
                                    </Card>
                                ) : (
                                    <div className="space-y-3">
                                        {pendingActions?.map(action => (
                                            <Card
                                                key={action.id}
                                                className={`border-2 transition-all cursor-pointer hover:scale-[1.01] ${getRiskBorder(action.risk_level)}`}
                                                onClick={() => setSelectedAction(action)}
                                            >
                                                <CardContent className="p-4">
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                                {getActionIcon(action.action_type)}
                                                                <h3 className="font-semibold text-white">{action.action_title}</h3>
                                                                <Badge className={getRiskColor(action.risk_level)}>
                                                                    {action.risk_level}
                                                                </Badge>
                                                                <Badge variant="outline" className="text-cyan-400 border-cyan-400/50">
                                                                    {Math.round(action.confidence * 100)}%
                                                                </Badge>
                                                                {action.status === 'executing' && (
                                                                    <Badge variant="outline" className="text-yellow-400 border-yellow-400/50 animate-pulse">
                                                                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                                                        Deploying...
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <p className="text-sm text-white/70 line-clamp-2">{action.action_description}</p>
                                                        </div>
                                                        <div className="flex gap-2 ml-4">
                                                            {action.status !== 'executing' && (
                                                                <Button
                                                                    size="sm"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        approveAction.mutate(action.id);
                                                                    }}
                                                                    disabled={approveAction.isPending}
                                                                    className="bg-green-600 hover:bg-green-700"
                                                                >
                                                                    <ThumbsUp className="w-4 h-4" />
                                                                </Button>
                                                            )}
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setSelectedAction(action);
                                                                }}
                                                                className="border-white/20 text-white/70 hover:bg-white/10"
                                                            >
                                                                <Eye className="w-4 h-4" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Sidebar */}
                            <div className="space-y-4">
                                {/* Business Goals */}
                                <Card className="bg-white/5 border-white/10">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-lg text-white flex items-center gap-2">
                                            <Target className="w-5 h-5 text-cyan-400" />
                                            Business Goals
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        {goals?.map(goal => {
                                            const progress = ((goal.current_value - goal.baseline_value) /
                                                (goal.target_value - goal.baseline_value)) * 100;
                                            return (
                                                <div key={goal.id}>
                                                    <div className="flex justify-between text-sm mb-1">
                                                        <span className="text-white/80">{goal.goal_name}</span>
                                                        <span className="text-cyan-400">{Math.round(progress)}%</span>
                                                    </div>
                                                    <Progress value={Math.max(0, Math.min(100, progress))} className="h-2" />
                                                    <div className="flex justify-between text-xs text-white/50 mt-1">
                                                        <span>{goal.current_value.toLocaleString()}</span>
                                                        <span>→ {goal.target_value.toLocaleString()}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {(!goals || goals.length === 0) && (
                                            <p className="text-sm text-white/40 text-center py-4">No active goals set</p>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* Recent Executions */}
                                <Card className="bg-white/5 border-white/10">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-lg text-white flex items-center gap-2">
                                            <CheckCircle className="w-5 h-5 text-green-400" />
                                            Recent Executions
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2">
                                        {executedActions?.slice(0, 5).map(action => (
                                            <div
                                                key={action.id}
                                                onClick={() => setSelectedAction(action)}
                                                className={`p-2 rounded-lg text-sm cursor-pointer hover:opacity-80 transition-opacity ${action.status === 'executed'
                                                    ? 'bg-green-500/10 border border-green-500/20'
                                                    : 'bg-red-500/10 border border-red-500/20'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    {action.status === 'executed'
                                                        ? <CheckCircle className="w-3 h-3 text-green-400" />
                                                        : <XCircle className="w-3 h-3 text-red-400" />
                                                    }
                                                    <span className="text-white/80 truncate">{action.action_title}</span>
                                                </div>
                                            </div>
                                        ))}
                                        {(!executedActions || executedActions.length === 0) && (
                                            <p className="text-sm text-white/40 text-center py-4">No recent executions</p>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="insights" className="mt-6">
                        <div className="grid grid-cols-1 gap-4">
                            {insights?.map(insight => (
                                <Card key={insight.id} className="bg-white/5 border-white/10">
                                    <CardContent className="p-4">
                                        <div className="flex items-start gap-4">
                                            <div className="w-10 h-10 bg-cyan-500/20 rounded-lg flex items-center justify-center shrink-0">
                                                <Lightbulb className="w-5 h-5 text-cyan-400" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="font-semibold text-white">{insight.title}</h3>
                                                    <Badge variant="outline" className="text-cyan-400 border-cyan-400/50">
                                                        {insight.insight_type}
                                                    </Badge>
                                                </div>
                                                <p className="text-sm text-white/70">{insight.description}</p>
                                                <div className="mt-3 flex gap-2">
                                                    <Button size="sm" variant="secondary" className="h-8" onClick={() => generateSolution.mutate(`Act on this insight: ${insight.title}`)}>
                                                        Generate Action Plan
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                            {(!insights || insights.length === 0) && (
                                <div className="text-center py-12 text-white/40">
                                    <Lightbulb className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                    <p>No proactive insights yet. Click "Run Monitor" to generate.</p>
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="memory" className="mt-6">
                        <div className="space-y-4">
                            <Card className="bg-white/5 border-white/10">
                                <CardHeader>
                                    <CardTitle className="text-white flex items-center gap-2">
                                        <BookOpen className="w-5 h-5 text-purple-400" />
                                        CEO Calibration Data (How AI Learns from You)
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        {calibrationData?.map(item => (
                                            <div key={item.id} className="p-4 rounded-lg bg-black/20 border border-white/5">
                                                <div className="flex justify-between items-start mb-2">
                                                    <h4 className="font-medium text-white">{item.scenario_description}</h4>
                                                    <Badge variant={item.was_ai_correct ? "default" : "destructive"}>
                                                        {item.was_ai_correct ? "AI Correct" : "AI Wrong"}
                                                    </Badge>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                                                    <div>
                                                        <p className="text-white/40 mb-1">AI Recommendation:</p>
                                                        <p className="text-white/80">{item.ai_recommendation}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-white/40 mb-1">CEO Decision:</p>
                                                        <p className="text-white/80">{item.your_decision}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {(!calibrationData || calibrationData.length === 0) && (
                                            <p className="text-center text-white/40 py-8">No calibration data yet. Approve or reject actions to teach the AI.</p>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>
                </Tabs>

                {/* Detail Modal */}
                {selectedAction && (
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 sm:p-6 z-50">
                        <Card className="w-full max-w-3xl bg-slate-900 border-cyan-500/30 max-h-[90vh] overflow-auto">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3 flex-wrap">
                                        {getActionIcon(selectedAction.action_type)}
                                        <CardTitle className="text-white">{selectedAction.action_title}</CardTitle>
                                        <Badge className={getRiskColor(selectedAction.risk_level)}>
                                            {selectedAction.risk_level}
                                        </Badge>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setSelectedAction(null)}
                                        className="text-white/60 hover:text-white"
                                    >
                                        ✕
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <h4 className="text-sm font-medium text-white/60 mb-1">Description</h4>
                                    <p className="text-white">{selectedAction.action_description}</p>
                                </div>

                                <div>
                                    <h4 className="text-sm font-medium text-white/60 mb-1">AI Reasoning</h4>
                                    <p className="text-cyan-400 italic">{selectedAction.reasoning}</p>
                                </div>

                                <div>
                                    <h4 className="text-sm font-medium text-white/60 mb-1">Expected Impact</h4>
                                    <p className="text-white">{selectedAction.expected_impact}</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <h4 className="text-sm font-medium text-white/60 mb-1">Confidence</h4>
                                        <Progress value={selectedAction.confidence * 100} className="h-2" />
                                        <p className="text-xs text-white/40 mt-1">{Math.round(selectedAction.confidence * 100)}%</p>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-medium text-white/60 mb-1">Source Agent</h4>
                                        <p className="text-white">{selectedAction.source_agent || 'AI CEO'}</p>
                                    </div>
                                </div>

                                {selectedAction.prepared_payload && (
                                    <div>
                                        <h4 className="text-sm font-medium text-white/60 mb-1">Prepared Payload</h4>
                                        <pre className="text-xs text-white/70 bg-black/40 p-3 rounded-lg overflow-auto max-h-40">
                                            {JSON.stringify(selectedAction.prepared_payload, null, 2)}
                                        </pre>
                                    </div>
                                )}

                                {selectedAction.status === 'prepared' && (
                                    <div className="pt-4 border-t border-white/10">
                                        <Textarea
                                            value={rejectionReason}
                                            onChange={(e) => setRejectionReason(e.target.value)}
                                            placeholder="Reason for rejection (optional but helps AI learn)"
                                            className="bg-white/5 border-white/20 text-white mb-4"
                                        />
                                        <div className="flex gap-3">
                                            <Button
                                                onClick={() => approveAction.mutate(selectedAction.id)}
                                                disabled={approveAction.isPending}
                                                className="flex-1 bg-green-600 hover:bg-green-700"
                                            >
                                                <ThumbsUp className="w-4 h-4 mr-2" />
                                                Approve & Execute
                                            </Button>
                                            <Button
                                                variant="outline"
                                                onClick={() => rejectAction.mutate({ actionId: selectedAction.id, reason: rejectionReason })}
                                                disabled={rejectAction.isPending}
                                                className="flex-1 border-red-500/50 text-red-400 hover:bg-red-500/20"
                                            >
                                                <ThumbsDown className="w-4 h-4 mr-2" />
                                                Reject
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </div>
    );
}
