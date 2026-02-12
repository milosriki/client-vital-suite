import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Loader2,
  CheckCircle,
  XCircle,
  Target,
  ThumbsUp,
  Eye,
  Clock,
} from "lucide-react";
import { PreparedAction, BusinessGoal } from "@/types/ceo";
import { getRiskBorder, getRiskColor, getActionIcon } from "@/lib/ceo-utils";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { UseMutationResult } from "@tanstack/react-query";

interface CEOActionCenterProps {
  pendingActions: PreparedAction[] | undefined;
  executedActions: PreparedAction[] | undefined;
  goals: BusinessGoal[] | undefined;
  loadingActions: boolean;
  onSelectAction: (action: PreparedAction) => void;
  approveAction: UseMutationResult<void, Error, string, unknown>;
}

export function CEOActionCenter({
  pendingActions,
  executedActions,
  goals,
  loadingActions,
  onSelectAction,
  approveAction,
}: CEOActionCenterProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
      {/* Pending Actions List */}
      <div className="lg:col-span-2 space-y-4">
        {loadingActions ? (
          <PageSkeleton variant="cards" count={3} />
        ) : pendingActions?.length === 0 ? (
          <Card className="bg-white/5 border-white/10 p-8">
            <div className="text-center">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
              <p className="text-white/60">No pending actions</p>
              <p className="text-sm text-white/40">
                AI is monitoring your business
              </p>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {pendingActions?.map((action) => (
              <Card
                key={action.id}
                className={`border-2 transition-all cursor-pointer hover:scale-[1.01] ${getRiskBorder(action.risk_level)}`}
                onClick={() => onSelectAction(action)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        {getActionIcon(action.action_type)}
                        <h3 className="font-semibold text-white">
                          {action.action_title}
                        </h3>
                        <Badge className={getRiskColor(action.risk_level)}>
                          {action.risk_level}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="text-cyan-400 border-cyan-400/50"
                        >
                          {Math.round(action.confidence * 100)}%
                        </Badge>
                        {action.status === "executing" && (
                          <Badge
                            variant="outline"
                            className="text-yellow-400 border-yellow-400/50 animate-pulse"
                          >
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            Deploying...
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-white/70 line-clamp-2">
                        {action.action_description}
                      </p>
                    </div>
                    <div className="flex gap-2 ml-4">
                      {action.status !== "executing" && (
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            approveAction.mutate(action.id);
                          }}
                          disabled={approveAction.isPending}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <ThumbsUp className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectAction(action);
                        }}
                        className="border-white/20 text-white/70 hover:bg-white/10"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Sidebar */}
      <div className="space-y-4">
        {/* Business Goals */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <Target className="w-5 h-5 text-cyan-400" />
              Business Goals
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {goals?.map((goal) => {
              const progress =
                ((goal.current_value - goal.baseline_value) /
                  (goal.target_value - goal.baseline_value)) *
                100;
              return (
                <div key={goal.id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-white/80">{goal.goal_name}</span>
                    <span className="text-cyan-400">
                      {Math.round(progress)}%
                    </span>
                  </div>
                  <Progress
                    value={Math.max(0, Math.min(100, progress))}
                    className="h-2"
                  />
                  <div className="flex justify-between text-xs text-white/50 mt-1">
                    <span>{goal.current_value.toLocaleString()}</span>
                    <span>→ {goal.target_value.toLocaleString()}</span>
                  </div>
                </div>
              );
            })}
            {(!goals || goals.length === 0) && (
              <p className="text-sm text-white/40 text-center py-4">
                No active goals set
              </p>
            )}
          </CardContent>
        </Card>

        {/* Recent Executions */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              Recent Executions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {executedActions?.slice(0, 5).map((action) => (
              <div
                key={action.id}
                onClick={() => onSelectAction(action)}
                className={`p-2 rounded-lg text-sm cursor-pointer hover:opacity-80 transition-opacity ${
                  action.status === "executed"
                    ? "bg-green-500/10 border border-green-500/20"
                    : "bg-red-500/10 border border-red-500/20"
                }`}
              >
                <div className="flex items-center gap-2">
                  {action.status === "executed" ? (
                    <CheckCircle className="w-3 h-3 text-green-400" />
                  ) : (
                    <XCircle className="w-3 h-3 text-red-400" />
                  )}
                  <span className="text-white/80 truncate">
                    {action.action_title}
                  </span>
                </div>
              </div>
            ))}
            {(!executedActions || executedActions.length === 0) && (
              <p className="text-sm text-white/40 text-center py-4">
                No recent executions
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
