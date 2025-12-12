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
    ThumbsUp, ThumbsDown, Loader2, Lightbulb, BookOpen
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
                .eq('status', 'prepared')
                .order('priority', { ascending: false });
            if (error) throw error;
            return (data || []) as unknown as PreparedAction[];
        },
        refetchInterval: 15000
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
        refetchInterval: 30000
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
            // Map to add missing fields from existing columns
            return (data || []).map((item: any) => ({
                ...item,
                title: item.insight_type || 'Insight',
                description: ''
            })) as ProactiveInsight[];
        },
        refetchInterval: 60000
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

    // ========================================
    // RENDER
    // ========================================

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 p-6">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-500/25">
                            <Brain className="w-10 h-10 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-white">ULTIMATE AI CEO</h1>
                            <p className="text-cyan-400">Self-Coding • Multi-Model • Human-Controlled</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <Badge variant="outline" className="text-emerald-400 border-emerald-400/50">
                            <div className="w-2 h-2 bg-emerald-400 rounded-full mr-2 animate-pulse" />
                            System Active
                        </Badge>
                    </div>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-4 gap-4">
                    <Card className="bg-white/5 border-white/10">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                                    <Clock className="w-6 h-6 text-purple-400" />
                                </div>
                                <div>
                                    <p className="text-3xl font-bold text-white">{stats.total}</p>
                                    <p className="text-sm text-white/60">Pending Actions</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-white/5 border-white/10">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center">
                                    <AlertTriangle className="w-6 h-6 text-red-400" />
                                </div>
                                <div>
                                    <p className="text-3xl font-bold text-white">{stats.critical + stats.high}</p>
                                    <p className="text-sm text-white/60">Urgent</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-white/5 border-white/10">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                                    <Zap className="w-6 h-6 text-green-400" />
                                </div>
                                <div>
                                    <p className="text-3xl font-bold text-white">{stats.autoApprovable}</p>
                                    <p className="text-sm text-white/60">Auto-Approvable</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-white/5 border-white/10">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-cyan-500/20 rounded-xl flex items-center justify-center">
                                    <Target className="w-6 h-6 text-cyan-400" />
                                </div>
                                <div>
                                    <p className="text-3xl font-bold text-white">{goals?.length || 0}</p>
                                    <p className="text-sm text-white/60">Active Goals</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Command Input */}
                <Card className="bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border-cyan-500/30">
                    <CardContent className="p-6">
                        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            <Rocket className="w-5 h-5 text-cyan-400" />
                            Request New Feature / Solution
                        </h2>
                        <Textarea
                            value={command}
                            onChange={(e) => setCommand(e.target.value)}
                            placeholder='Examples:
• "Build a churn prediction dashboard with ML"
• "Create WhatsApp booking integration"
• "Fix the Stripe payment sync issue"
• "Add automated follow-up for stale leads"'
                            className="bg-white/5 border-white/20 text-white placeholder-white/40 min-h-[120px] mb-4 focus:border-cyan-500"
                        />
                        <Button
                            onClick={() => generateSolution.mutate(command)}
                            disabled={!command.trim() || generateSolution.isPending}
                            className="w-full bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-700 hover:to-purple-700 h-12 text-lg"
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
                        <TabsTrigger value="actions">Pending Actions ({stats.total})</TabsTrigger>
                        <TabsTrigger value="insights">Proactive Insights</TabsTrigger>
                        <TabsTrigger value="memory">AI Memory & Learning</TabsTrigger>
                    </TabsList>

                    <TabsContent value="actions" className="mt-6">
                        <div className="grid grid-cols-3 gap-6">
                            {/* Pending Actions List */}
                            <div className="col-span-2 space-y-4">
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
                                                            <div className="flex items-center gap-2 mb-2">
                                                                {getActionIcon(action.action_type)}
                                                                <h3 className="font-semibold text-white">{action.action_title}</h3>
                                                                <Badge className={getRiskColor(action.risk_level)}>
                                                                    {action.risk_level}
                                                                </Badge>
                                                                <Badge variant="outline" className="text-cyan-400 border-cyan-400/50">
                                                                    {Math.round(action.confidence * 100)}%
                                                                </Badge>
                                                                {action.action_type === 'code_deploy' && (
                                                                    <Badge variant="outline" className="text-purple-400 border-purple-400/50">
                                                                        <Code className="w-3 h-3 mr-1" />
                                                                        {action.prepared_payload?.files?.length || 0} files
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <p className="text-sm text-white/70 line-clamp-2">{action.action_description}</p>
                                                            <p className="text-xs text-cyan-400/70 mt-2 italic">{action.reasoning}</p>
                                                        </div>
                                                        <div className="flex gap-2 ml-4">
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
                                                className={`p-2 rounded-lg text-sm ${action.status === 'executed'
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
                                            <div>
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
                                    <p>No proactive insights yet. The scanner runs every 15 minutes.</p>
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
                                                <div className="grid grid-cols-2 gap-4 text-sm">
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
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-6 z-50">
                        <Card className="w-full max-w-3xl bg-slate-900 border-cyan-500/30 max-h-[90vh] overflow-auto">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
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
                                    <p className="text-green-400">{selectedAction.expected_impact}</p>
                                </div>

                                {selectedAction.action_type === 'code_deploy' && selectedAction.prepared_payload?.files && (
                                    <div>
                                        <h4 className="text-sm font-medium text-white/60 mb-2">Files to Deploy</h4>
                                        <div className="space-y-2 max-h-60 overflow-auto">
                                            {selectedAction.prepared_payload.files.map((file: any, i: number) => (
                                                <div key={i} className="bg-black/50 rounded-lg p-3">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Code className="w-4 h-4 text-purple-400" />
                                                        <span className="text-sm text-white/80">{file.path}</span>
                                                    </div>
                                                    <pre className="text-xs text-white/60 overflow-x-auto max-h-32">
                                                        {file.content?.substring(0, 500)}
                                                        {file.content?.length > 500 && '...'}
                                                    </pre>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="pt-4 border-t border-white/10">
                                    <h4 className="text-sm font-medium text-white/60 mb-2">Rejection Reason (if rejecting)</h4>
                                    <Textarea
                                        value={rejectionReason}
                                        onChange={(e) => setRejectionReason(e.target.value)}
                                        placeholder="Tell the AI why you're rejecting this (helps it learn)..."
                                        className="bg-white/5 border-white/20 text-white placeholder-white/40 min-h-[80px]"
                                    />
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <Button
                                        onClick={() => approveAction.mutate(selectedAction.id)}
                                        disabled={approveAction.isPending}
                                        className="flex-1 bg-green-600 hover:bg-green-700 h-12"
                                    >
                                        {approveAction.isPending ? (
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                        ) : (
                                            <>
                                                <ThumbsUp className="w-5 h-5 mr-2" />
                                                Approve & Deploy
                                            </>
                                        )}
                                    </Button>
                                    <Button
                                        onClick={() => rejectAction.mutate({
                                            actionId: selectedAction.id,
                                            reason: rejectionReason
                                        })}
                                        disabled={rejectAction.isPending}
                                        variant="outline"
                                        className="flex-1 border-red-500/50 text-red-400 hover:bg-red-500/10 h-12"
                                    >
                                        {rejectAction.isPending ? (
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                        ) : (
                                            <>
                                                <ThumbsDown className="w-5 h-5 mr-2" />
                                                Reject (AI Learns)
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </div>
    );
}
