import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { 
  Bot, Code, Rocket, Shield, Play, Eye, Check, X, 
  Loader2, Terminal, FileCode, Database, Clock,
  Zap, AlertTriangle, CheckCircle, RefreshCw,
  Sparkles, Command, Cpu, GitBranch
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDedupedQuery } from "@/hooks/useDedupedQuery";

interface PreparedAction {
  id: string;
  action_type: string;
  action_title: string;
  action_description: string;
  reasoning: string;
  expected_impact: string;
  risk_level: string;
  confidence: number;
  prepared_payload: {
    files?: Array<{ path: string; content: string }>;
    sql?: string;
    analysis?: string;
  };
  status: string;
  priority: number;
  source_agent: string;
  created_at: string;
  executed_at: string | null;
  rejection_reason: string | null;
}

const quickCommands = [
  { label: "Check Health Scores", command: "Analyze the current health score distribution and identify any calculation issues" },
  { label: "Analyze Churn Risk", command: "Review clients at risk of churn and suggest intervention strategies" },
  { label: "Coach Performance", command: "Generate a coach performance summary with AI recommendations" },
  { label: "Create Component", command: "Create a new React component for displaying" },
  { label: "Add Database Table", command: "Design a new Supabase table for" },
  { label: "Optimize Query", command: "Review and optimize the database queries in" },
];

const riskColors = {
  low: "bg-success/20 text-success border-success/30",
  medium: "bg-warning/20 text-warning border-warning/30",
  high: "bg-destructive/20 text-destructive border-destructive/30",
};

const statusIcons = {
  pending: Clock,
  executing: Loader2,
  executed: CheckCircle,
  rejected: X,
};

export default function AIDevConsole() {
  const [command, setCommand] = useState("");
  const [selectedAction, setSelectedAction] = useState<PreparedAction | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  // Fetch all actions
  const { data: actions, isLoading: actionsLoading, refetch } = useDedupedQuery({
    queryKey: ['prepared-actions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prepared_actions')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as PreparedAction[];
    },
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });

  // Execute command mutation
  const executeCommand = useMutation({
    mutationFn: async (cmd: string) => {
      const { data, error } = await supabase.functions.invoke('ptd-self-developer', {
        body: { command: cmd }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Command processed", {
        description: data.message || "Action prepared for review"
      });
      setCommand("");
      queryClient.invalidateQueries({ queryKey: ['prepared-actions'] });
    },
    onError: (error: Error) => {
      toast.error("Command failed", {
        description: error.message
      });
    }
  });

  // Approve action mutation
  const approveAction = useMutation({
    mutationFn: async (actionId: string) => {
      const { data, error } = await supabase.functions.invoke('ai-trigger-deploy', {
        body: { 
          approval_id: actionId, 
          approved: true,
          approved_by: 'admin'
        }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Action approved", {
        description: data.message || "Deployment triggered"
      });
      setPreviewOpen(false);
      queryClient.invalidateQueries({ queryKey: ['prepared-actions'] });
    },
    onError: (error: Error) => {
      toast.error("Approval failed", {
        description: error.message
      });
    }
  });

  // Reject action mutation
  const rejectAction = useMutation({
    mutationFn: async ({ actionId, reason }: { actionId: string; reason: string }) => {
      const { data, error } = await supabase.functions.invoke('ai-trigger-deploy', {
        body: { 
          approval_id: actionId, 
          approved: false,
          rejection_reason: reason
        }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Action rejected", {
        description: "Feedback recorded for AI learning"
      });
      setRejectDialogOpen(false);
      setRejectReason("");
      setPreviewOpen(false);
      queryClient.invalidateQueries({ queryKey: ['prepared-actions'] });
    },
    onError: (error: Error) => {
      toast.error("Rejection failed", {
        description: error.message
      });
    }
  });

  const pendingActions = actions?.filter(a => a.status === 'pending') || [];
  const executingActions = actions?.filter(a => a.status === 'executing') || [];
  const historyActions = actions?.filter(a => ['executed', 'rejected'].includes(a.status)) || [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (command.trim()) {
      executeCommand.mutate(command);
    }
  };

  const handleQuickCommand = (cmd: string) => {
    setCommand(cmd);
  };

  const openPreview = (action: PreparedAction) => {
    setSelectedAction(action);
    setPreviewOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/50 bg-card/30 backdrop-blur-xl sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary via-primary/80 to-purple-600 flex items-center justify-center shadow-glow">
              <Cpu className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold gradient-text-primary">AI Dev Console</h1>
              <p className="text-sm text-muted-foreground">Self-Developing AI Command Center</p>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Badge variant="outline" className="gap-1 px-3 py-1">
                <Sparkles className="h-3 w-3" />
                {pendingActions.length} Pending
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Command Interface */}
        <Card className="premium-card border-primary/20">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Terminal className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Command Center</CardTitle>
                <CardDescription>Give instructions in natural language</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <Textarea
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder="e.g., 'Create a new page called CoachAnalytics that displays coach performance metrics with charts'"
                  className="min-h-[100px] resize-none bg-background/50 border-border/50 font-mono text-sm pr-24"
                />
                <Button 
                  type="submit" 
                  className="absolute bottom-3 right-3 gap-2 shadow-glow-sm"
                  disabled={executeCommand.isPending || !command.trim()}
                >
                  {executeCommand.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Rocket className="h-4 w-4" />
                  )}
                  Execute
                </Button>
              </div>

              {/* Quick Commands */}
              <div className="flex flex-wrap gap-2">
                {quickCommands.map((qc) => (
                  <Button
                    key={qc.label}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs gap-1 hover:bg-primary/10 hover:border-primary/30"
                    onClick={() => handleQuickCommand(qc.command)}
                  >
                    <Command className="h-3 w-3" />
                    {qc.label}
                  </Button>
                ))}
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Action Dashboard */}
        <Tabs defaultValue="pending" className="space-y-4">
          <TabsList className="bg-card/50 border border-border/50 p-1">
            <TabsTrigger value="pending" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Clock className="h-4 w-4" />
              Pending ({pendingActions.length})
            </TabsTrigger>
            <TabsTrigger value="executing" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Loader2 className="h-4 w-4" />
              Executing ({executingActions.length})
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <GitBranch className="h-4 w-4" />
              History ({historyActions.length})
            </TabsTrigger>
          </TabsList>

          {/* Pending Actions */}
          <TabsContent value="pending" className="space-y-4">
            {actionsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : pendingActions.length === 0 ? (
              <Card className="premium-card">
                <CardContent className="py-12 text-center">
                  <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No pending actions</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">
                    Use the command center above to create new actions
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {pendingActions.map((action) => (
                  <ActionCard 
                    key={action.id} 
                    action={action} 
                    onPreview={() => openPreview(action)}
                    onApprove={() => approveAction.mutate(action.id)}
                    isApproving={approveAction.isPending}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Executing Actions */}
          <TabsContent value="executing" className="space-y-4">
            {executingActions.length === 0 ? (
              <Card className="premium-card">
                <CardContent className="py-12 text-center">
                  <Zap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No actions currently executing</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {executingActions.map((action) => (
                  <ActionCard 
                    key={action.id} 
                    action={action} 
                    onPreview={() => openPreview(action)}
                    showProgress
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* History */}
          <TabsContent value="history" className="space-y-4">
            {historyActions.length === 0 ? (
              <Card className="premium-card">
                <CardContent className="py-12 text-center">
                  <GitBranch className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No action history yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {historyActions.map((action) => (
                  <ActionCard 
                    key={action.id} 
                    action={action} 
                    onPreview={() => openPreview(action)}
                    isHistory
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <div className="flex items-center gap-3">
              {selectedAction?.action_type === 'code_deploy' && <FileCode className="h-5 w-5 text-primary" />}
              {selectedAction?.action_type === 'database' && <Database className="h-5 w-5 text-warning" />}
              {selectedAction?.action_type === 'analysis' && <Bot className="h-5 w-5 text-success" />}
              <div>
                <DialogTitle>{selectedAction?.action_title}</DialogTitle>
                <DialogDescription>{selectedAction?.action_description}</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1 max-h-[60vh]">
            <div className="space-y-6 p-1">
              {/* Reasoning */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Bot className="h-4 w-4 text-primary" />
                  AI Reasoning
                </h4>
                <div className="p-4 rounded-lg bg-muted/30 border border-border/50 text-sm">
                  {selectedAction?.reasoning}
                </div>
              </div>

              {/* Expected Impact */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Zap className="h-4 w-4 text-warning" />
                  Expected Impact
                </h4>
                <div className="p-4 rounded-lg bg-muted/30 border border-border/50 text-sm">
                  {selectedAction?.expected_impact}
                </div>
              </div>

              {/* File Changes */}
              {selectedAction?.prepared_payload?.files && selectedAction.prepared_payload.files.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <FileCode className="h-4 w-4 text-primary" />
                    Files ({selectedAction.prepared_payload.files.length})
                  </h4>
                  {selectedAction.prepared_payload.files.map((file, idx) => (
                    <div key={idx} className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Code className="h-4 w-4 text-muted-foreground" />
                        <code className="text-xs bg-muted px-2 py-0.5 rounded">{file.path}</code>
                      </div>
                      <pre className="p-4 rounded-lg bg-zinc-950 border border-border/50 text-xs overflow-x-auto font-mono text-green-400 max-h-[300px]">
                        {file.content}
                      </pre>
                    </div>
                  ))}
                </div>
              )}

              {/* SQL Migration */}
              {selectedAction?.prepared_payload?.sql && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Database className="h-4 w-4 text-warning" />
                    SQL Migration
                  </h4>
                  <pre className="p-4 rounded-lg bg-zinc-950 border border-border/50 text-xs overflow-x-auto font-mono text-yellow-400 max-h-[300px]">
                    {selectedAction.prepared_payload.sql}
                  </pre>
                </div>
              )}

              {/* Analysis */}
              {selectedAction?.prepared_payload?.analysis && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Bot className="h-4 w-4 text-success" />
                    Analysis
                  </h4>
                  <div className="p-4 rounded-lg bg-muted/30 border border-border/50 text-sm whitespace-pre-wrap">
                    {selectedAction.prepared_payload.analysis}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="flex gap-2 pt-4 border-t border-border/50">
            {selectedAction?.status === 'pending' && (
              <>
                <Button
                  variant="outline"
                  onClick={() => setRejectDialogOpen(true)}
                  className="gap-2"
                >
                  <X className="h-4 w-4" />
                  Reject
                </Button>
                <Button
                  onClick={() => selectedAction && approveAction.mutate(selectedAction.id)}
                  disabled={approveAction.isPending}
                  className="gap-2 bg-gradient-to-r from-primary to-purple-600 shadow-glow-sm"
                >
                  {approveAction.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Rocket className="h-4 w-4" />
                  )}
                  Approve & Deploy
                </Button>
              </>
            )}
            {selectedAction?.status !== 'pending' && (
              <Button variant="outline" onClick={() => setPreviewOpen(false)}>
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Action</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejection. This helps the AI learn and improve.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Reason for rejection..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedAction && rejectAction.mutate({ 
                actionId: selectedAction.id, 
                reason: rejectReason 
              })}
              disabled={rejectAction.isPending || !rejectReason.trim()}
            >
              {rejectAction.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Action Card Component
function ActionCard({ 
  action, 
  onPreview, 
  onApprove,
  isApproving = false,
  showProgress = false,
  isHistory = false
}: { 
  action: PreparedAction; 
  onPreview: () => void;
  onApprove?: () => void;
  isApproving?: boolean;
  showProgress?: boolean;
  isHistory?: boolean;
}) {
  const StatusIcon = statusIcons[action.status as keyof typeof statusIcons] || Clock;
  const filesCount = action.prepared_payload?.files?.length || 0;
  const hasSQL = !!action.prepared_payload?.sql;

  return (
    <Card className={cn(
      "premium-card group",
      action.status === 'executing' && "border-primary/30 animate-pulse",
      action.status === 'executed' && "border-success/30",
      action.status === 'rejected' && "border-destructive/30 opacity-60"
    )}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
            action.action_type === 'code_deploy' && "bg-primary/20",
            action.action_type === 'database' && "bg-warning/20",
            action.action_type === 'analysis' && "bg-success/20",
            action.action_type === 'documentation' && "bg-muted"
          )}>
            {action.action_type === 'code_deploy' && <FileCode className="h-5 w-5 text-primary" />}
            {action.action_type === 'database' && <Database className="h-5 w-5 text-warning" />}
            {action.action_type === 'analysis' && <Bot className="h-5 w-5 text-success" />}
            {action.action_type === 'documentation' && <Code className="h-5 w-5 text-muted-foreground" />}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold truncate">{action.action_title}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                  {action.action_description}
                </p>
              </div>
              
              {/* Risk Badge */}
              <Badge 
                variant="outline" 
                className={cn("shrink-0", riskColors[action.risk_level as keyof typeof riskColors])}
              >
                <Shield className="h-3 w-3 mr-1" />
                {action.risk_level.toUpperCase()}
              </Badge>
            </div>

            {/* Meta info */}
            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <StatusIcon className={cn(
                  "h-3 w-3",
                  action.status === 'executing' && "animate-spin"
                )} />
                {action.status}
              </span>
              <span>Confidence: {Math.round(action.confidence * 100)}%</span>
              {filesCount > 0 && (
                <span className="flex items-center gap-1">
                  <FileCode className="h-3 w-3" />
                  {filesCount} files
                </span>
              )}
              {hasSQL && (
                <span className="flex items-center gap-1">
                  <Database className="h-3 w-3" />
                  SQL
                </span>
              )}
              <span className="ml-auto">
                {new Date(action.created_at).toLocaleString()}
              </span>
            </div>

            {/* Progress bar for executing */}
            {showProgress && (
              <div className="mt-3">
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary animate-pulse w-2/3 rounded-full" />
                </div>
              </div>
            )}

            {/* Rejection reason */}
            {action.rejection_reason && (
              <div className="mt-3 p-2 rounded bg-destructive/10 text-xs text-destructive flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{action.rejection_reason}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" size="sm" onClick={onPreview} className="gap-1">
              <Eye className="h-4 w-4" />
              Preview
            </Button>
            {action.status === 'pending' && onApprove && (
              <Button 
                size="sm" 
                onClick={onApprove}
                disabled={isApproving}
                className="gap-1 bg-gradient-to-r from-primary to-purple-600"
              >
                {isApproving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Approve
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}