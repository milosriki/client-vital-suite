import { useNavigate } from "react-router-dom";
import {
  Brain,
  AlertTriangle,
  Target,
  Globe,
  TrendingDown,
  Phone,
  Clock,
  Users,
  Lightbulb,
  X,
  BellOff,
  Zap,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useProactiveInsights,
  type ProactiveInsight,
} from "@/hooks/useProactiveInsights";

// --- Priority config ---
const priorityConfig: Record<
  string,
  { label: string; bg: string; text: string; border: string }
> = {
  critical: {
    label: "HIGH",
    bg: "bg-red-500/15",
    text: "text-red-400",
    border: "border-red-500/30",
  },
  high: {
    label: "HIGH",
    bg: "bg-red-500/15",
    text: "text-red-400",
    border: "border-red-500/30",
  },
  medium: {
    label: "MED",
    bg: "bg-amber-500/15",
    text: "text-amber-400",
    border: "border-amber-500/30",
  },
  low: {
    label: "LOW",
    bg: "bg-emerald-500/15",
    text: "text-emerald-400",
    border: "border-emerald-500/30",
  },
  info: {
    label: "INFO",
    bg: "bg-blue-500/15",
    text: "text-blue-400",
    border: "border-blue-500/30",
  },
};

const insightIcons: Record<string, React.ElementType> = {
  sla_breach_risk: AlertTriangle,
  high_value_lead: Target,
  international_routing: Globe,
  churn_risk: TrendingDown,
  missed_call_callback: Phone,
  working_hours_notice: Clock,
  coach_performance: Users,
};

function getPriorityBadge(priority: string | null) {
  const config = priorityConfig[priority || "info"] || priorityConfig.info;
  return (
    <Badge
      variant="outline"
      className={`${config.bg} ${config.text} ${config.border} text-[10px] px-1.5 py-0`}
    >
      {config.label}
    </Badge>
  );
}

function InsightRow({
  insight,
  onDismiss,
  onSnooze,
  onAct,
  onNavigate,
}: {
  insight: ProactiveInsight;
  onDismiss: (id: string) => void;
  onSnooze: (id: string) => void;
  onAct: (id: string) => void;
  onNavigate: (path: string) => void;
}) {
  const Icon = insightIcons[insight.insight_type] || Lightbulb;
  const title =
    insight.title ||
    insight.insight_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const actionText = insight.recommended_action || insight.description || "";
  const hasContact = !!insight.contact_id;
  const hasLead = !!insight.lead_id;

  return (
    <div className="flex items-start gap-3 py-3 border-b border-[#1F2937] last:border-b-0 group">
      {/* Icon */}
      <div className="mt-0.5 shrink-0">
        <Icon className="w-4 h-4 text-slate-400" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          {getPriorityBadge(insight.priority)}
          <span className="text-sm font-medium text-white truncate">{title}</span>
        </div>
        {actionText && (
          <p className="text-xs text-slate-400 line-clamp-2">{actionText}</p>
        )}
        {/* Link to contact/lead if present */}
        {(hasContact || hasLead) && (
          <button
            onClick={() => {
              if (hasContact) {
                onNavigate(`/enterprise/client-xray?id=${insight.contact_id}`);
              } else if (hasLead) {
                onNavigate(`/command-center`);
              }
            }}
            className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline mt-0.5"
          >
            <ExternalLink className="w-3 h-3" />
            {hasContact ? "View Contact" : "View Lead"}
          </button>
        )}
      </div>

      {/* Quick actions */}
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10"
          onClick={() => onAct(insight.id)}
          title="Mark as actioned"
        >
          <Zap className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-slate-500 hover:text-amber-400 hover:bg-amber-500/10"
          onClick={() => onSnooze(insight.id)}
          title="Snooze"
        >
          <BellOff className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-slate-500 hover:text-red-400 hover:bg-red-500/10"
          onClick={() => onDismiss(insight.id)}
          title="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function ProactiveInsightsSection() {
  const navigate = useNavigate();
  const { insights, isLoading, dismiss, snooze, act } = useProactiveInsights(6);

  if (isLoading) {
    return <Skeleton className="h-64 bg-slate-800/50" />;
  }

  if (insights.length === 0) {
    return null;
  }

  // Sort: critical/high first
  const priorityOrder: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    info: 4,
  };
  const sorted = [...insights].sort(
    (a, b) =>
      (priorityOrder[a.priority || "info"] ?? 5) -
      (priorityOrder[b.priority || "info"] ?? 5)
  );

  return (
    <Card className="bg-[#0A0A0A] border-[#1F2937]">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Brain className="w-5 h-5 text-violet-400" />
            Proactive Insights
            <Badge
              variant="outline"
              className="bg-violet-500/15 text-violet-400 border-violet-500/30 text-[10px] ml-1"
            >
              {insights.length}
            </Badge>
          </CardTitle>
          <Button
            variant="link"
            className="p-0 h-auto text-primary text-xs"
            onClick={() => navigate("/business-intelligence")}
          >
            View All
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="divide-y-0">
          {sorted.map((insight) => (
            <InsightRow
              key={insight.id}
              insight={insight}
              onDismiss={dismiss}
              onSnooze={snooze}
              onAct={act}
              onNavigate={(path) => navigate(path)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
