import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  Loader2,
  CheckCircle,
  X,
  FileCode,
  Database,
  Bot,
  Code,
  Shield,
  AlertTriangle,
  Eye,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PreparedAction } from "./hooks/useAIDevData";

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

interface ActionCardProps {
  action: PreparedAction;
  onPreview: () => void;
  onApprove?: () => void;
  isApproving?: boolean;
  showProgress?: boolean;
  isHistory?: boolean;
}

export const ActionCard = ({
  action,
  onPreview,
  onApprove,
  isApproving = false,
  showProgress = false,
  isHistory = false,
}: ActionCardProps) => {
  const StatusIcon =
    statusIcons[action.status as keyof typeof statusIcons] || Clock;
  const filesCount = action.prepared_payload?.files?.length || 0;
  const hasSQL = !!action.prepared_payload?.sql;

  return (
    <Card
      className={cn(
        "premium-card group",
        action.status === "executing" && "border-primary/30 animate-pulse",
        action.status === "executed" && "border-success/30",
        action.status === "rejected" && "border-destructive/30 opacity-60",
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div
            className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
              action.action_type === "code_deploy" && "bg-primary/20",
              action.action_type === "database" && "bg-warning/20",
              action.action_type === "analysis" && "bg-success/20",
              action.action_type === "documentation" && "bg-muted",
            )}
          >
            {action.action_type === "code_deploy" && (
              <FileCode className="h-5 w-5 text-primary" />
            )}
            {action.action_type === "database" && (
              <Database className="h-5 w-5 text-warning" />
            )}
            {action.action_type === "analysis" && (
              <Bot className="h-5 w-5 text-success" />
            )}
            {action.action_type === "documentation" && (
              <Code className="h-5 w-5 text-muted-foreground" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold truncate">
                  {action.action_title}
                </h3>
                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                  {action.action_description}
                </p>
              </div>

              {/* Risk Badge */}
              <Badge
                variant="outline"
                className={cn(
                  "shrink-0",
                  riskColors[action.risk_level as keyof typeof riskColors],
                )}
              >
                <Shield className="h-3 w-3 mr-1" />
                {action.risk_level.toUpperCase()}
              </Badge>
            </div>

            {/* Meta info */}
            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <StatusIcon
                  className={cn(
                    "h-3 w-3",
                    action.status === "executing" && "animate-spin",
                  )}
                />
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
            <Button
              variant="ghost"
              size="sm"
              onClick={onPreview}
              className="gap-1"
            >
              <Eye className="h-4 w-4" />
              Preview
            </Button>
            {action.status === "pending" && onApprove && (
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
};
