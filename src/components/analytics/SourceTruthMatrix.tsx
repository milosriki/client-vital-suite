import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  MinusCircle,
  ShieldCheck,
} from "lucide-react";

import type { SourceDiscrepancy } from "@/hooks/useDeepIntelligence";

interface SourceTruthMatrixProps {
  data: SourceDiscrepancy[];
}

const VERDICT_CONFIG = {
  ALIGNED: {
    icon: CheckCircle,
    label: "Aligned",
    bg: "bg-emerald-500/15",
    border: "border-emerald-500/30",
    text: "text-emerald-400",
    badgeVariant: "truth" as const,
  },
  DRIFTING: {
    icon: AlertTriangle,
    label: "Drifting",
    bg: "bg-amber-500/15",
    border: "border-amber-500/30",
    text: "text-amber-400",
    badgeVariant: "discrepancy" as const,
  },
  BROKEN: {
    icon: XCircle,
    label: "Broken",
    bg: "bg-red-500/15",
    border: "border-red-500/30",
    text: "text-red-400",
    badgeVariant: "ghost" as const,
  },
  NO_DATA: {
    icon: MinusCircle,
    label: "No Data",
    bg: "bg-slate-500/15",
    border: "border-slate-500/30",
    text: "text-slate-400",
    badgeVariant: "outline" as const,
  },
};

function getGapColor(gap: number): string {
  const absGap = Math.abs(gap);
  if (absGap < 10) return "text-emerald-400";
  if (absGap <= 25) return "text-amber-400";
  return "text-red-400";
}

function getGapBg(gap: number): string {
  const absGap = Math.abs(gap);
  if (absGap < 10) return "bg-emerald-500/10";
  if (absGap <= 25) return "bg-amber-500/10";
  return "bg-red-500/10";
}

type Verdict = "ALIGNED" | "DRIFTING" | "BROKEN" | "NO_DATA";

function toVerdict(v: string): Verdict {
  if (v === "ALIGNED" || v === "DRIFTING" || v === "BROKEN") return v;
  return "NO_DATA";
}

function VerdictCell({ verdict }: { verdict: string }) {
  const config = VERDICT_CONFIG[toVerdict(verdict)];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border",
        config.bg,
        config.border,
        config.text,
      )}
    >
      <Icon className="w-3 h-3" />
      {config.label.toUpperCase()}
    </div>
  );
}

function GapCell({ gap }: { gap: number }) {
  return (
    <div
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded font-mono text-xs",
        getGapColor(gap),
        getGapBg(gap),
      )}
    >
      {gap > 0 ? "+" : ""}
      {(gap ?? 0).toFixed(1)}%
    </div>
  );
}

function computeOverallVerdict(data: SourceDiscrepancy[]): Verdict {
  const withData = data.filter((d) => toVerdict(d.trust_verdict) !== "NO_DATA");
  if (withData.length === 0) return "NO_DATA";

  const brokenCount = withData.filter((d) => toVerdict(d.trust_verdict) === "BROKEN").length;
  const driftingCount = withData.filter((d) => toVerdict(d.trust_verdict) === "DRIFTING").length;

  if (brokenCount / withData.length > 0.3) return "BROKEN";
  if ((brokenCount + driftingCount) / withData.length > 0.5) return "DRIFTING";
  return "ALIGNED";
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  } catch {
    return dateStr;
  }
}

export function SourceTruthMatrix({ data }: SourceTruthMatrixProps) {
  if (!data?.length) {
    return (
      <div className="text-center py-12 text-slate-400">
        <ShieldCheck className="w-8 h-8 mx-auto mb-3 opacity-30" />
        <p>Source alignment data not yet available. Data populates automatically from daily sync.</p>
      </div>
    );
  }

  const overallVerdict = computeOverallVerdict(data);
  const overallConfig = VERDICT_CONFIG[toVerdict(String(overallVerdict))];

  const withData = data.filter((d) => d.trust_verdict !== "NO_DATA");
  const avgFb = withData.length > 0 ? withData.reduce((s, d) => s + Number(d.fb_reported_leads || 0), 0) / withData.length : 0;
  const avgAnytrack = withData.length > 0 ? withData.reduce((s, d) => s + Number(d.anytrack_leads || 0), 0) / withData.length : 0;
  const avgHubspot = withData.length > 0 ? withData.reduce((s, d) => s + Number(d.supabase_contacts || 0), 0) / withData.length : 0;
  const avgGap = withData.length > 0 ? withData.reduce((s, d) => s + Number(d.max_discrepancy_pct || 0), 0) / withData.length : 0;

  return (
    <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-slate-300" />
          <h3 className="text-sm font-semibold text-slate-100 tracking-wide uppercase">
            Source Alignment Matrix
          </h3>
        </div>
        <Badge variant={overallConfig.badgeVariant}>
          {overallVerdict}
        </Badge>
      </div>

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow className="border-white/10 hover:bg-transparent">
            <TableHead className="text-slate-400 text-[11px] uppercase tracking-wider">Date</TableHead>
            <TableHead className="text-slate-400 text-[11px] uppercase tracking-wider">Campaign</TableHead>
            <TableHead className="text-slate-400 text-[11px] uppercase tracking-wider text-right">FB Leads</TableHead>
            <TableHead className="text-slate-400 text-[11px] uppercase tracking-wider text-right">AnyTrack</TableHead>
            <TableHead className="text-slate-400 text-[11px] uppercase tracking-wider text-right">Supabase</TableHead>
            <TableHead className="text-slate-400 text-[11px] uppercase tracking-wider text-center">Max Gap</TableHead>
            <TableHead className="text-slate-400 text-[11px] uppercase tracking-wider text-center">Verdict</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, i) => (
            <TableRow key={`${row.report_date}-${i}`} className="border-white/5 hover:bg-white/5">
              <TableCell className="text-slate-300 text-xs font-mono">{formatDate(row.report_date)}</TableCell>
              <TableCell className="text-slate-300 text-xs truncate max-w-[140px]">{row.campaign_name || "—"}</TableCell>
              <TableCell className="text-slate-200 text-xs font-mono text-right">{Number(row.fb_reported_leads || 0).toLocaleString()}</TableCell>
              <TableCell className="text-slate-200 text-xs font-mono text-right">{Number(row.anytrack_leads || 0).toLocaleString()}</TableCell>
              <TableCell className="text-slate-200 text-xs font-mono text-right">{Number(row.supabase_contacts || 0).toLocaleString()}</TableCell>
              <TableCell className="text-center">
                <GapCell gap={Number(row.max_discrepancy_pct || 0)} />
              </TableCell>
              <TableCell className="text-center">
                <VerdictCell verdict={row.trust_verdict} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter className="border-white/10 bg-white/5">
          <TableRow className="hover:bg-white/5">
            <TableCell className="text-slate-300 text-xs font-bold uppercase tracking-wider">Avg</TableCell>
            <TableCell className="text-slate-300 text-xs">—</TableCell>
            <TableCell className="text-slate-200 text-xs font-mono font-bold text-right">{(avgFb ?? 0).toFixed(0)}</TableCell>
            <TableCell className="text-slate-200 text-xs font-mono font-bold text-right">{(avgAnytrack ?? 0).toFixed(0)}</TableCell>
            <TableCell className="text-slate-200 text-xs font-mono font-bold text-right">{(avgHubspot ?? 0).toFixed(0)}</TableCell>
            <TableCell className="text-center">
              <GapCell gap={avgGap ?? 0} />
            </TableCell>
            <TableCell className="text-center">
              <VerdictCell verdict={overallVerdict} />
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}
