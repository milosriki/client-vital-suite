import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Grid3X3, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportToCSV } from "@/lib/csv-export";

interface Props {
  /** 7x24 matrix: heatmap[dayOfWeek][hour] = count */
  data: number[][];
  isLoading: boolean;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function HourlyHeatmap({ data, isLoading }: Props) {
  const maxVal = Math.max(...data.flat(), 1);

  const getColor = (val: number) => {
    if (val === 0) return "bg-muted/30";
    const intensity = val / maxVal;
    if (intensity > 0.75) return "bg-emerald-500";
    if (intensity > 0.5) return "bg-emerald-400/80";
    if (intensity > 0.25) return "bg-emerald-300/60";
    return "bg-emerald-200/40";
  };

  // Find best and worst
  let bestDay = 0, bestHour = 0, worstDay = 0, worstHour = 0;
  let bestVal = 0, worstVal = Infinity;
  data.forEach((row, d) => row.forEach((val, h) => {
    if (val > bestVal) { bestVal = val; bestDay = d; bestHour = h; }
    if (val < worstVal && val > 0) { worstVal = val; worstDay = d; worstHour = h; }
  }));

  const csvData = data.flatMap((row, d) =>
    row.map((val, h) => ({ day: DAYS[d], hour: h, calls: val }))
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Grid3X3 className="h-5 w-5 text-purple-500" />
            Hourly Call Heatmap
          </CardTitle>
          <Button variant="ghost" size="sm" className="cursor-pointer" onClick={() => exportToCSV(csvData, "hourly-heatmap")}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-48 animate-pulse bg-muted rounded" />
        ) : (
          <div className="space-y-3">
            <div className="overflow-x-auto">
              <div className="min-w-[600px]">
                {/* Hour labels */}
                <div className="flex gap-[2px] ml-10 mb-1">
                  {HOURS.map(h => (
                    <div key={h} className="flex-1 text-[10px] text-muted-foreground text-center">
                      {h % 3 === 0 ? `${h}` : ""}
                    </div>
                  ))}
                </div>
                {/* Grid */}
                {DAYS.map((day, d) => (
                  <div key={day} className="flex items-center gap-[2px] mb-[2px]">
                    <span className="w-10 text-xs text-muted-foreground text-right pr-2">{day}</span>
                    {HOURS.map(h => (
                      <div
                        key={h}
                        className={`flex-1 h-7 rounded-sm ${getColor(data[d][h])} cursor-pointer transition-all hover:ring-1 hover:ring-foreground/30`}
                        title={`${day} ${h}:00 — ${data[d][h]} calls`}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
            {/* Insights */}
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span>🔥 Peak: <span className="text-foreground font-medium">{DAYS[bestDay]} {bestHour}:00</span> ({bestVal} calls)</span>
              {worstVal < Infinity && (
                <span>❄️ Lowest: <span className="text-foreground font-medium">{DAYS[worstDay]} {worstHour}:00</span> ({worstVal} calls)</span>
              )}
            </div>
            {/* Legend */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Less</span>
              <div className="w-4 h-4 rounded-sm bg-muted/30" />
              <div className="w-4 h-4 rounded-sm bg-emerald-200/40" />
              <div className="w-4 h-4 rounded-sm bg-emerald-300/60" />
              <div className="w-4 h-4 rounded-sm bg-emerald-400/80" />
              <div className="w-4 h-4 rounded-sm bg-emerald-500" />
              <span>More</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
