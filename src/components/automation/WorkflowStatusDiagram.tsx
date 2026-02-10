import { CheckCircle2, AlertCircle, PauseCircle, Play, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';

interface Workflow {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'error';
  executionsToday?: number;
  successRate?: number;
  lastRun?: string;
  errorCount?: number;
}

interface WorkflowStatusDiagramProps {
  workflows: Workflow[];
  onToggle?: (id: string, active: boolean) => void;
  isLoading?: boolean;
}

const statusConfig = {
  active: {
    icon: CheckCircle2,
    color: 'text-success',
    bgColor: 'bg-success/10',
    borderColor: 'border-success/30',
    badge: 'Active',
    badgeVariant: 'default' as const,
  },
  paused: {
    icon: PauseCircle,
    color: 'text-warning',
    bgColor: 'bg-warning/10',
    borderColor: 'border-warning/30',
    badge: 'Paused',
    badgeVariant: 'secondary' as const,
  },
  error: {
    icon: AlertCircle,
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
    borderColor: 'border-destructive/30',
    badge: 'Error',
    badgeVariant: 'destructive' as const,
  },
};

export function WorkflowStatusDiagram({
  workflows,
  onToggle,
  isLoading,
}: WorkflowStatusDiagramProps) {
  if (isLoading && !data) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-8 bg-muted/30 rounded w-3/4 mb-4" />
              <div className="h-4 bg-muted/30 rounded w-1/2 mb-2" />
              <div className="h-4 bg-muted/30 rounded w-2/3" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!workflows?.length) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Play className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Workflows Configured</h3>
          <p className="text-muted-foreground text-sm max-w-sm">
            Set up automated workflows to streamline your operations
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center gap-6 p-4 bg-card/50 rounded-lg border border-border/50">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-success" />
          <span className="text-sm text-muted-foreground">
            Active: {workflows.filter((w) => w.status === 'active').length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-warning" />
          <span className="text-sm text-muted-foreground">
            Paused: {workflows.filter((w) => w.status === 'paused').length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-destructive" />
          <span className="text-sm text-muted-foreground">
            Errors: {workflows.filter((w) => w.status === 'error').length}
          </span>
        </div>
      </div>

      {/* Workflow cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {workflows.map((workflow) => {
          const config = statusConfig[workflow.status];
          const Icon = config.icon;

          return (
            <Card
              key={workflow.id}
              className={cn(
                'transition-all duration-200 hover:-translate-y-0.5',
                config.borderColor,
                'border-l-4'
              )}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn('p-2 rounded-lg', config.bgColor)}>
                      <Icon className={cn('h-5 w-5', config.color)} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground">{workflow.name}</h4>
                      <Badge variant={config.badgeVariant} className="mt-1 text-xs">
                        {config.badge}
                        {workflow.status === 'error' && workflow.errorCount && (
                          <span className="ml-1">({workflow.errorCount})</span>
                        )}
                      </Badge>
                    </div>
                  </div>
                  {onToggle && (
                    <Switch
                      checked={workflow.status === 'active'}
                      onCheckedChange={(checked) => onToggle(workflow.id, checked)}
                    />
                  )}
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Executions Today</span>
                    <span className="font-mono font-medium">
                      {workflow.executionsToday || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Success Rate</span>
                    <span
                      className={cn(
                        'font-mono font-medium',
                        (workflow.successRate || 0) >= 90
                          ? 'text-success'
                          : (workflow.successRate || 0) >= 70
                          ? 'text-warning'
                          : 'text-destructive'
                      )}
                    >
                      {workflow.successRate || 0}%
                    </span>
                  </div>
                  {workflow.lastRun && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Last Run</span>
                      <span className="text-xs text-muted-foreground">
                        {workflow.lastRun}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
