import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { RefreshCw, TrendingUp, Clock, DollarSign } from 'lucide-react';
import { useState } from 'react';
import { useDedupedQuery } from "@/hooks/useDedupedQuery";

export function PipelineHealth() {
  const [selectedPipeline, setSelectedPipeline] = useState<string>('all');

  // Fetch pipelines
  const { data: pipelinesData, isLoading: pipelinesLoading, refetch: refetchPipelines } = useDedupedQuery({
    queryKey: ['hubspot-pipelines-health'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('hubspot-live-query', {
        body: { query: 'pipelines' }
      });
      if (error) throw error;
      return data;
    },
    staleTime: 300000, // Cache for 5 minutes
  });

  // Fetch deals to count per stage
  const { data: dealsData } = useDedupedQuery({
    queryKey: ['hubspot-deals-for-pipelines'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('hubspot-live-query', {
        body: { query: 'latest_deals', limit: 1000 }
      });
      if (error) throw error;
      return data;
    },
    staleTime: 300000,
  });

  // Calculate pipeline stats
  const pipelineStats = (pipelinesData?.pipelines || []).map((pipeline: any) => {
    const pipelineDeals = (dealsData?.deals || []).filter((d: any) =>
      d.pipeline === pipeline.id || d.pipeline === pipeline.label
    );

    const stageCounts = pipeline.stages.map((stage: any) => {
      const stageDeals = pipelineDeals.filter((d: any) =>
        d.stage === stage.id || d.stage === stage.label
      );
      const stageValue = stageDeals.reduce((sum: number, d: any) => sum + (d.amount || 0), 0);

      return {
        ...stage,
        dealCount: stageDeals.length,
        dealValue: stageValue,
      };
    });

    const totalDeals = pipelineDeals.length;
    const totalValue = pipelineDeals.reduce((sum: number, d: any) => sum + (d.amount || 0), 0);

    return {
      ...pipeline,
      stages: stageCounts,
      totalDeals,
      totalValue,
    };
  });

  const filteredPipelines = selectedPipeline === 'all'
    ? pipelineStats
    : pipelineStats.filter((p: any) => p.id === selectedPipeline || p.label === selectedPipeline);

  if (pipelinesLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pipeline Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Pipeline Health
            </CardTitle>
            <CardDescription>
              {pipelineStats.length} active pipelines
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetchPipelines()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Pipeline Filter */}
        {pipelineStats.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={selectedPipeline === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedPipeline('all')}
            >
              All Pipelines
            </Button>
            {pipelineStats.map((pipeline: any) => (
              <Button
                key={pipeline.id}
                variant={selectedPipeline === pipeline.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedPipeline(pipeline.id)}
              >
                {pipeline.label}
              </Button>
            ))}
          </div>
        )}

        {/* Pipeline Visualizations */}
        {filteredPipelines.map((pipeline: any) => (
          <div key={pipeline.id} className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg">{pipeline.label}</h3>
                <p className="text-sm text-muted-foreground">
                  {pipeline.totalDeals} deals • {pipeline.totalValue.toLocaleString()} AED total value
                </p>
              </div>
            </div>

            {/* Stage Flow Visualization */}
            <div className="space-y-2">
              {pipeline.stages.map((stage: any, idx: number) => {
                const maxDeals = Math.max(...pipeline.stages.map((s: any) => s.dealCount), 1);
                const percentage = (stage.dealCount / maxDeals) * 100;

                return (
                  <div key={stage.id} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{stage.label}</span>
                        <Badge variant="outline">{stage.dealCount} deals</Badge>
                        {stage.dealValue > 0 && (
                          <span className="text-green-600 dark:text-green-400 font-semibold">
                            {stage.dealValue.toLocaleString()} AED
                          </span>
                        )}
                        {stage.probability && (
                          <span className="text-xs text-muted-foreground">
                            {stage.probability}% prob
                          </span>
                        )}
                      </div>
                    </div>
                    <Progress value={percentage} className="h-2" />
                  </div>
                );
              })}
            </div>

            {/* Stage Details Table */}
            <div className="border rounded-lg">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Stage</th>
                    <th className="text-right p-2">Deals</th>
                    <th className="text-right p-2">Value</th>
                    <th className="text-right p-2">Avg Deal</th>
                  </tr>
                </thead>
                <tbody>
                  {pipeline.stages.map((stage: any) => (
                    <tr key={stage.id} className="border-b hover:bg-muted/50">
                      <td className="p-2 font-medium">{stage.label}</td>
                      <td className="p-2 text-right">{stage.dealCount}</td>
                      <td className="p-2 text-right font-semibold">
                        {stage.dealValue.toLocaleString()} AED
                      </td>
                      <td className="p-2 text-right text-muted-foreground">
                        {stage.dealCount > 0
                          ? (stage.dealValue / stage.dealCount).toLocaleString()
                          : '0'} AED
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {filteredPipelines.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No pipelines found
          </div>
        )}
      </CardContent>
    </Card>
  );
}

