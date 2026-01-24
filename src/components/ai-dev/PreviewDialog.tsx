import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bot,
  Zap,
  FileCode,
  Code,
  Database,
  X,
  Rocket,
  Loader2,
} from "lucide-react";
import { PreparedAction } from "./hooks/useAIDevData";

interface PreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedAction: PreparedAction | null;
  onApprove: (id: string) => void;
  isApproving: boolean;
  onRejectOpen: () => void;
}

interface RejectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rejectReason: string;
  setRejectReason: (value: string) => void;
  onReject: () => void;
  isRejecting: boolean;
}

export const PreviewDialog = ({
  open,
  onOpenChange,
  selectedAction,
  onApprove,
  isApproving,
  onRejectOpen,
}: PreviewDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {selectedAction?.action_type === "code_deploy" && (
              <FileCode className="h-5 w-5 text-primary" />
            )}
            {selectedAction?.action_type === "database" && (
              <Database className="h-5 w-5 text-warning" />
            )}
            {selectedAction?.action_type === "analysis" && (
              <Bot className="h-5 w-5 text-success" />
            )}
            <div>
              <DialogTitle>{selectedAction?.action_title}</DialogTitle>
              <DialogDescription>
                {selectedAction?.action_description}
              </DialogDescription>
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
            {selectedAction?.prepared_payload?.files &&
              selectedAction.prepared_payload.files.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <FileCode className="h-4 w-4 text-primary" />
                    Files ({selectedAction.prepared_payload.files.length})
                  </h4>
                  {selectedAction.prepared_payload.files.map((file, idx) => (
                    <div key={idx} className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Code className="h-4 w-4 text-muted-foreground" />
                        <code className="text-xs bg-muted px-2 py-0.5 rounded">
                          {file.path}
                        </code>
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
          {selectedAction?.status === "pending" && (
            <>
              <Button
                variant="outline"
                onClick={onRejectOpen}
                className="gap-2"
              >
                <X className="h-4 w-4" />
                Reject
              </Button>
              <Button
                onClick={() => selectedAction && onApprove(selectedAction.id)}
                disabled={isApproving}
                className="gap-2 bg-gradient-to-r from-primary to-purple-600 shadow-glow-sm"
              >
                {isApproving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Rocket className="h-4 w-4" />
                )}
                Approve & Deploy
              </Button>
            </>
          )}
          {selectedAction?.status !== "pending" && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const RejectDialog = ({
  open,
  onOpenChange,
  rejectReason,
  setRejectReason,
  onReject,
  isRejecting,
}: RejectDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject Action</DialogTitle>
          <DialogDescription>
            Please provide a reason for rejection. This helps the AI learn and
            improve.
          </DialogDescription>
        </DialogHeader>
        <Input
          placeholder="Reason for rejection..."
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onReject}
            disabled={isRejecting || !rejectReason.trim()}
          >
            {isRejecting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Reject
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
