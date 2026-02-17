import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Cpu, RefreshCw, Sparkles } from "lucide-react";

// Components & Hooks
import {
  useAIDevData,
  PreparedAction,
} from "@/components/ai-dev/hooks/useAIDevData";
import { CommandInterface } from "@/components/ai-dev/CommandInterface";
import { ActionDashboard } from "@/components/ai-dev/ActionDashboard";
import { PreviewDialog, RejectDialog } from "@/components/ai-dev/PreviewDialog";

export default function AIDevConsole() {
  const {
    command,
    setCommand,
    selectedAction,
    setSelectedAction,
    previewOpen,
    setPreviewOpen,
    rejectReason,
    setRejectReason,
    rejectDialogOpen,
    setRejectDialogOpen,
    actionsLoading,
    refetch,
    executeCommand,
    approveAction,
    rejectAction,
    pendingActions,
    executingActions,
    historyActions,
  } = useAIDevData();

  const openPreview = (action: PreparedAction) => {
    setSelectedAction(action);
    setPreviewOpen(true);
  };

  const handleReject = () => {
    if (selectedAction) {
      rejectAction.mutate({
        actionId: selectedAction.id,
        reason: rejectReason,
      });
    }
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
              <h1 className="text-2xl font-bold gradient-text-primary">
                AI Dev Console
              </h1>
              <p className="text-sm text-muted-foreground">
                Self-Developing AI Command Center
              </p>
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
        <CommandInterface
          command={command}
          setCommand={setCommand}
          executeCommand={executeCommand}
        />

        {/* Action Dashboard */}
        <ActionDashboard
          pendingActions={pendingActions}
          executingActions={executingActions}
          historyActions={historyActions}
          actionsLoading={actionsLoading}
          onPreview={openPreview}
          onApprove={(id) => approveAction.mutate(id)}
          isApproving={approveAction.isPending}
        />
      </div>

      {/* Preview Dialog */}
      <PreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        selectedAction={selectedAction}
        onApprove={(id) => approveAction.mutate(id)}
        isApproving={approveAction.isPending}
        onRejectOpen={() => setRejectDialogOpen(true)}
      />

      {/* Reject Dialog */}
      <RejectDialog
        open={rejectDialogOpen}
        onOpenChange={setRejectDialogOpen}
        rejectReason={rejectReason}
        setRejectReason={setRejectReason}
        onReject={handleReject}
        isRejecting={rejectAction.isPending}
      />
    </div>
  );
}
