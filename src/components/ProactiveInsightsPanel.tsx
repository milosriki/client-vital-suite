import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Brain, 
  Phone, 
  AlertTriangle, 
  Clock, 
  ThumbsUp, 
  ThumbsDown,
  RefreshCw,
  Lightbulb,
  Target,
  Globe,
  Users,
  TrendingDown
} from "lucide-react";
import { toast } from "sonner";

interface Insight {
  id: string;
  insight_type: string;
  priority: string;
  status: string;
  recommended_action: string;
  call_script: string;
  best_call_time: string;
  reason: string;
  created_at: string;
}

interface FeedbackState {
  [key: string]: {
    type: 'helpful' | 'not_helpful' | 'partially_helpful' | null;
    notes: string;
    showForm: boolean;
  };
}

const priorityColors: Record<string, string> = {
  critical: 'bg-destructive text-destructive-foreground',
  high: 'bg-orange-500 text-white',
  medium: 'bg-yellow-500 text-black',
  low: 'bg-secondary text-secondary-foreground',
  info: 'bg-blue-500 text-white'
};

const insightIcons: Record<string, any> = {
  sla_breach_risk: AlertTriangle,
  high_value_lead: Target,
  international_routing: Globe,
  churn_risk: TrendingDown,
  missed_call_callback: Phone,
  working_hours_notice: Clock,
  coach_performance: Users
};

export default function ProactiveInsightsPanel() {
  const queryClient = useQueryClient();
  const [feedbackState, setFeedbackState] = useState<FeedbackState>({});
  const [isGenerating, setIsGenerating] = useState(false);

  // Fetch active insights
  const { data: insights, isLoading, refetch } = useQuery({
    queryKey: ['proactive-insights'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proactive_insights')
        .select('*')
        .eq('status', 'active')
        .order('priority', { ascending: true })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Insight[];
    },
    staleTime: Infinity // Realtime subscription handles updates
  });

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('insights-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'proactive_insights' }, () => {
        queryClient.invalidateQueries({ queryKey: ['proactive-insights'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Generate new insights
  const generateInsights = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('proactive-insights-generator');
      if (error) throw error;
      toast.success(`Generated ${data.insights_generated} insights`);
      refetch();
    } catch (error: any) {
      toast.error('Failed to generate insights: ' + error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  // Submit feedback mutation
  const submitFeedback = useMutation({
    mutationFn: async ({ insightId, feedbackType, notes, insight }: { 
      insightId: string; 
      feedbackType: string; 
      notes: string;
      insight: Insight;
    }) => {
      const { error } = await supabase
        .from('ai_feedback_learning')
        .insert({
          insight_id: insightId,
          feedback_type: feedbackType,
          insight_type: insight.insight_type,
          original_recommendation: insight.recommended_action,
          corrected_recommendation: notes || null,
          feedback_notes: notes,
          context_data: {
            priority: insight.priority,
            reason: insight.reason,
            call_script: insight.call_script
          }
        });
      if (error) throw error;

      // Mark insight as completed
      await supabase
        .from('proactive_insights')
        .update({ 
          status: 'completed',
          outcome: feedbackType,
          completed_at: new Date().toISOString()
        })
        .eq('id', insightId);
    },
    onSuccess: () => {
      toast.success('Feedback saved - AI will learn from this!');
      refetch();
    },
    onError: (error: any) => {
      toast.error('Failed to save feedback: ' + error.message);
    }
  });

  const handleFeedback = (insightId: string, type: 'helpful' | 'not_helpful' | 'partially_helpful') => {
    setFeedbackState(prev => ({
      ...prev,
      [insightId]: {
        ...prev[insightId],
        type,
        showForm: type !== 'helpful'
      }
    }));

    // If helpful, submit immediately
    if (type === 'helpful') {
      const insight = insights?.find(i => i.id === insightId);
      if (insight) {
        submitFeedback.mutate({ insightId, feedbackType: type, notes: '', insight });
      }
    }
  };

  const submitFeedbackWithNotes = (insightId: string) => {
    const state = feedbackState[insightId];
    const insight = insights?.find(i => i.id === insightId);
    if (state?.type && insight) {
      submitFeedback.mutate({ 
        insightId, 
        feedbackType: state.type, 
        notes: state.notes,
        insight
      });
      setFeedbackState(prev => ({
        ...prev,
        [insightId]: { type: null, notes: '', showForm: false }
      }));
    }
  };

  const getPriorityOrder = (priority: string) => {
    const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    return order[priority] ?? 5;
  };

  const sortedInsights = insights?.sort((a, b) => 
    getPriorityOrder(a.priority) - getPriorityOrder(b.priority)
  );

  return (
    <Card className="border-primary/20">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          Proactive AI Insights
          <Badge variant="outline" className="ml-2">
            Self-Learning
          </Badge>
        </CardTitle>
        <Button 
          size="sm" 
          variant="outline"
          onClick={generateInsights}
          disabled={isGenerating}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
          {isGenerating ? 'Generating...' : 'Refresh'}
        </Button>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          {isLoading ? (
            <div className="text-muted-foreground text-center py-8">Loading insights...</div>
          ) : !sortedInsights?.length ? (
            <div className="text-center py-8">
              <Lightbulb className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No active insights</p>
              <Button variant="link" onClick={generateInsights} className="mt-2">
                Generate insights from your data
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedInsights.map((insight) => {
                const IconComponent = insightIcons[insight.insight_type] || Lightbulb;
                const state = feedbackState[insight.id];
                
                return (
                  <Card key={insight.id} className="border-l-4" style={{ borderLeftColor: `var(--${insight.priority === 'critical' ? 'destructive' : 'primary'})` }}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1">
                          <IconComponent className="h-5 w-5 mt-0.5 text-muted-foreground" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge className={priorityColors[insight.priority] || 'bg-secondary'}>
                                {insight.priority.toUpperCase()}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {insight.insight_type.replace(/_/g, ' ')}
                              </span>
                            </div>
                            <p className="font-medium text-sm">{insight.recommended_action}</p>
                            {insight.reason && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {insight.reason}
                              </p>
                            )}
                            {insight.best_call_time && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                                <Clock className="h-3 w-3" />
                                Best time: {insight.best_call_time}
                              </div>
                            )}
                            {insight.call_script && (
                              <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
                                <strong>Script:</strong> {insight.call_script}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Feedback section */}
                      <div className="mt-3 pt-3 border-t border-border/50">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                          Was this helpful?
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant={state?.type === 'helpful' ? 'default' : 'outline'}
                            onClick={() => handleFeedback(insight.id, 'helpful')}
                            disabled={submitFeedback.isPending}
                          >
                            <ThumbsUp className="h-4 w-4 mr-1" />
                            Yes
                          </Button>
                          <Button 
                            size="sm" 
                            variant={state?.type === 'partially_helpful' ? 'default' : 'outline'}
                            onClick={() => handleFeedback(insight.id, 'partially_helpful')}
                            disabled={submitFeedback.isPending}
                          >
                            Partially
                          </Button>
                          <Button 
                            size="sm" 
                            variant={state?.type === 'not_helpful' ? 'default' : 'outline'}
                            onClick={() => handleFeedback(insight.id, 'not_helpful')}
                            disabled={submitFeedback.isPending}
                          >
                            <ThumbsDown className="h-4 w-4 mr-1" />
                            No
                          </Button>
                        </div>
                        
                        {state?.showForm && (
                          <div className="mt-3 space-y-2">
                            <Textarea
                              placeholder="What would make this insight better? Your feedback helps the AI learn..."
                              value={state.notes}
                              onChange={(e) => setFeedbackState(prev => ({
                                ...prev,
                                [insight.id]: { ...prev[insight.id], notes: e.target.value }
                              }))}
                              className="text-sm"
                              rows={2}
                            />
                            <Button 
                              size="sm" 
                              onClick={() => submitFeedbackWithNotes(insight.id)}
                              disabled={submitFeedback.isPending}
                            >
                              Submit Feedback
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
