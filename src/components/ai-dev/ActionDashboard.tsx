import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, Loader2, GitBranch, Bot, Zap } from "lucide-react";
import { ActionCard } from "./ActionCard";
import { PreparedAction } from "./hooks/useAIDevData";

interface ActionDashboardProps {
  pendingActions: PreparedAction[];
  executingActions: PreparedAction[];
  historyActions: PreparedAction[];
  actionsLoading: boolean;
  onPreview: (action: PreparedAction) => void;
  onApprove: (id: string) => void;
  isApproving: boolean;
}

export const ActionDashboard = ({
  pendingActions,
  executingActions,
  historyActions,
  actionsLoading,
  onPreview,
  onApprove,
  isApproving,
}: ActionDashboardProps) => {
  return (
    <Tabs defaultValue="pending" className="space-y-4">
      <TabsList className="bg-card/50 border border-border/50 p-1">
        <TabsTrigger
          value="pending"
          className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
        >
          <Clock className="h-4 w-4" />
          Pending ({pendingActions.length})
        </TabsTrigger>
        <TabsTrigger
          value="executing"
          className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
        >
          <Loader2 className="h-4 w-4" />
          Executing ({executingActions.length})
        </TabsTrigger>
        <TabsTrigger
          value="history"
          className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
        >
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
                onPreview={() => onPreview(action)}
                onApprove={() => onApprove(action.id)}
                isApproving={isApproving}
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
              <p className="text-muted-foreground">
                No actions currently executing
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {executingActions.map((action) => (
              <ActionCard
                key={action.id}
                action={action}
                onPreview={() => onPreview(action)}
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
                onPreview={() => onPreview(action)}
                isHistory
              />
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
};
