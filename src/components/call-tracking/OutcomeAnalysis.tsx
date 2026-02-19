import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PieChart, Download } from "lucide-react";
import { exportToCSV } from "@/lib/csv-export";

export interface OutcomeData {
  outcome: string;
  count: number;
  percentage: number;
  dealsLinked: number;
}

interface Props {
  data: OutcomeData[];
  isLoading: boolean;
}

const COLORS = [
  "bg-emerald-500", "bg-blue-500", "bg-purple-500", "bg-orange-500",
  "bg-pink-500", "bg-cyan-500", "bg-yellow-500", "bg-red-500",
  "bg-indigo-500", "bg-teal-500",
];

export function OutcomeAnalysis({ data, isLoading }: Props) {
  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <PieChart className="h-5 w-5 text-purple-500" />
            Outcome Analysis
          </CardTitle>
          <Button variant="ghost" size="sm" className="cursor-pointer" onClick={() => exportToCSV(data, "outcome-analysis")}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-48 animate-pulse bg-muted rounded" />
        ) : data.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No outcome data available</p>
        ) : (
          <div className="space-y-4">
            {/* Stacked bar */}
            <div className="flex h-8 rounded-lg overflow-hidden">
              {data.map((d, i) => (
                <div
                  key={d.outcome}
                  className={`${COLORS[i % COLORS.length]} cursor-pointer transition-all hover:opacity-80`}
                  style={{ width: `${d.percentage}%` }}
                  title={`${d.outcome}: ${d.count} (${d.percentage.toFixed(1)}%)`}
                />
              ))}
            </div>

            {/* Breakdown list */}
            <div className="space-y-2">
              {data.map((d, i) => (
                <div key={d.outcome} className="flex items-center gap-3 cursor-pointer hover:bg-muted/30 rounded-lg p-2 transition-colors">
                  <div className={`w-3 h-3 rounded-full ${COLORS[i % COLORS.length]}`} />
                  <span className="flex-1 font-medium text-sm">{d.outcome || "Unknown"}</span>
                  <span className="text-sm text-muted-foreground">{d.count} calls</span>
                  <span className="text-sm font-medium w-16 text-right">{d.percentage.toFixed(1)}%</span>
                  {d.dealsLinked > 0 && (
                    <span className="text-xs bg-green-500/10 text-green-500 rounded-full px-2 py-0.5">
                      {d.dealsLinked} deals
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="text-xs text-muted-foreground pt-2 border-t">
              {total} total calls across {data.length} outcomes
              {data.some(d => d.dealsLinked > 0) && (
                <> · {data.reduce((s, d) => s + d.dealsLinked, 0)} deals linked</>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
