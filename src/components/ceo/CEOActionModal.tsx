import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { PreparedAction } from "@/types/ceo";
import { getRiskColor, getActionIcon } from "@/lib/ceo-utils";
import { UseMutationResult } from "@tanstack/react-query";
import { useState } from "react";

interface CEOActionModalProps {
  selectedAction: PreparedAction;
  onClose: () => void;
  approveAction: UseMutationResult<void, Error, string, unknown>;
  rejectAction: UseMutationResult<
    void,
    Error,
    { actionId: string; reason: string },
    unknown
  >;
}

export function CEOActionModal({
  selectedAction,
  onClose,
  approveAction,
  rejectAction,
}: CEOActionModalProps) {
  const [rejectionReason, setRejectionReason] = useState("");

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 sm:p-6 z-50">
      <Card className="w-full max-w-3xl bg-slate-900 border-cyan-500/30 max-h-[90vh] overflow-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-wrap">
              {getActionIcon(selectedAction.action_type)}
              <CardTitle className="text-white">
                {selectedAction.action_title}
              </CardTitle>
              <Badge className={getRiskColor(selectedAction.risk_level)}>
                {selectedAction.risk_level}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-white/60 hover:text-white"
            >
              ✕
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="text-sm font-medium text-white/60 mb-1">
              Description
            </h4>
            <p className="text-white">{selectedAction.action_description}</p>
          </div>

          <div>
            <h4 className="text-sm font-medium text-white/60 mb-1">
              AI Reasoning
            </h4>
            <p className="text-cyan-400 italic">{selectedAction.reasoning}</p>
          </div>

          <div>
            <h4 className="text-sm font-medium text-white/60 mb-1">
              Expected Impact
            </h4>
            <p className="text-white">{selectedAction.expected_impact}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium text-white/60 mb-1">
                Confidence
              </h4>
              <Progress
                value={selectedAction.confidence * 100}
                className="h-2"
              />
              <p className="text-xs text-white/40 mt-1">
                {Math.round(selectedAction.confidence * 100)}%
              </p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-white/60 mb-1">
                Source Agent
              </h4>
              <p className="text-white">
                {selectedAction.source_agent || "AI CEO"}
              </p>
            </div>
          </div>

          {selectedAction.prepared_payload && (
            <div>
              <h4 className="text-sm font-medium text-white/60 mb-1">
                Prepared Payload
              </h4>
              <pre className="text-xs text-white/70 bg-black/40 p-3 rounded-lg overflow-auto max-h-40">
                {JSON.stringify(selectedAction.prepared_payload, null, 2)}
              </pre>
            </div>
          )}

          {selectedAction.status === "prepared" && (
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
                  onClick={() =>
                    rejectAction.mutate({
                      actionId: selectedAction.id,
                      reason: rejectionReason,
                    })
                  }
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
  );
}
