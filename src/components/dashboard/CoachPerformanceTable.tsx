import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TrendingUp, TrendingDown, Minus, ArrowUpDown, Brain, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';

interface CoachPerformanceTableProps {
  coaches: any[];
  isLoading: boolean;
}

export function CoachPerformanceTable({ coaches, isLoading }: CoachPerformanceTableProps) {
  const [sortField, setSortField] = useState<string>('avg_client_health');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedCoaches = [...coaches].sort((a, b) => {
    const aValue = a[sortField] || 0;
    const bValue = b[sortField] || 0;
    return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
  });

  const getTrendIcon = (trend: string | null) => {
    if (!trend) return <Minus className="h-4 w-4 text-muted-foreground" />;
    if (trend.includes('IMPROVING')) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (trend.includes('DECLINING')) return <TrendingDown className="h-4 w-4 text-destructive" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const handleAIPerformanceAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('ptd-agent', {
        body: {
          query: 'Analyze coach performance. Who needs support? Who\'s excelling? Provide specific recommendations for improvement.',
          action: 'coach_analysis',
          context: {
            coaches: coaches.map(c => ({
              name: c.coach_name,
              total_clients: c.total_clients,
              avg_health: c.avg_client_health,
              red: c.clients_red,
              yellow: c.clients_yellow,
              green: c.clients_green,
              purple: c.clients_purple,
              trend: c.health_trend
            }))
          }
        }
      });

      if (error) throw error;

      setAiAnalysis(data?.response || 'No analysis generated.');
      setShowAnalysis(true);

      toast({
        title: 'AI Analysis Complete',
        description: 'Review coach performance insights and recommendations.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to generate AI analysis. Make sure ptd-agent is deployed.',
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Coach Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">Loading coach data...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Coach Performance</CardTitle>
            <Button
              onClick={handleAIPerformanceAnalysis}
              disabled={isAnalyzing || coaches.length === 0}
              variant="outline"
              className="gap-2"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Brain className="h-4 w-4" />
                  AI Performance Analysis
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort('coach_name')}
                  className="flex items-center gap-1"
                >
                  Coach Name <ArrowUpDown className="h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort('total_clients')}
                  className="flex items-center gap-1"
                >
                  Total Clients <ArrowUpDown className="h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort('avg_client_health')}
                  className="flex items-center gap-1"
                >
                  Avg Health <ArrowUpDown className="h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead className="text-center">RED</TableHead>
              <TableHead className="text-center">YELLOW</TableHead>
              <TableHead className="text-center">GREEN</TableHead>
              <TableHead className="text-center">PURPLE</TableHead>
              <TableHead className="text-center">Trend</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedCoaches.map((coach) => (
              <TableRow key={coach.id}>
                <TableCell className="font-medium">{coach.coach_name}</TableCell>
                <TableCell>{coach.total_clients || 0}</TableCell>
                <TableCell>
                  <span className="font-semibold">
                    {coach.avg_client_health?.toFixed(1) || '0.0'}
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-destructive/20 text-destructive font-semibold">
                    {coach.clients_red || 0}
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-yellow-500/20 text-yellow-700 font-semibold">
                    {coach.clients_yellow || 0}
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-500/20 text-green-700 font-semibold">
                    {coach.clients_green || 0}
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-purple-500/20 text-purple-700 font-semibold">
                    {coach.clients_purple || 0}
                  </span>
                </TableCell>
                <TableCell className="text-center">{getTrendIcon(coach.health_trend)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    <Dialog open={showAnalysis} onOpenChange={setShowAnalysis}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            AI Coach Performance Analysis
          </DialogTitle>
        </DialogHeader>
        <div className="mt-4 space-y-4">
          <div className="prose prose-sm max-w-none">
            {aiAnalysis && (
              <div className="whitespace-pre-wrap text-sm">
                {aiAnalysis}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </>
  );
}
