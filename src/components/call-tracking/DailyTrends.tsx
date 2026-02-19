import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportToCSV } from "@/lib/csv-export";

interface DailyData {
  date: string;
  total: number;
  answered: number;
  answeredRate: number;
}

interface Props {
  data: DailyData[];
  isLoading: boolean;
}

export function DailyTrends({ data, isLoading }: Props) {
  const maxCalls = Math.max(...data.map(d => d.total), 1);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5 text-emerald-500" />
            Daily Call Trends
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="cursor-pointer"
            onClick={() => exportToCSV(data, "daily-trends")}
          >
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-48 animate-pulse bg-muted rounded" />
        ) : data.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No data available</p>
        ) : (
          <div className="space-y-1">
            {/* Chart area */}
            <div className="flex items-end gap-[2px] h-48">
              {data.map((day) => {
                const height = (day.total / maxCalls) * 100;
                const answeredHeight = (day.answered / maxCalls) * 100;
                return (
                  <div
                    key={day.date}
                    className="flex-1 flex flex-col justify-end relative group cursor-pointer"
                    title={`${day.date}: ${day.total} calls, ${day.answeredRate.toFixed(0)}% answered`}
                  >
                    {/* Missed portion */}
                    <div
                      className="w-full bg-red-500/30 rounded-t-sm transition-all"
                      style={{ height: `${height - answeredHeight}%` }}
                    />
                    {/* Answered portion */}
                    <div
                      className="w-full bg-emerald-500 rounded-t-sm transition-all"
                      style={{ height: `${answeredHeight}%` }}
                    />
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                      <div className="bg-popover border rounded-lg shadow-lg p-2 text-xs whitespace-nowrap">
                        <p className="font-medium">{day.date}</p>
                        <p>{day.total} calls</p>
                        <p className="text-emerald-500">{day.answeredRate.toFixed(0)}% answered</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Answer rate line indicator */}
            <div className="flex gap-[2px]">
              {data.map((day) => (
                <div key={day.date} className="flex-1 flex justify-center">
                  <div
                    className="w-2 h-2 rounded-full bg-yellow-400"
                    style={{ opacity: day.answeredRate / 100 }}
                    title={`${day.answeredRate.toFixed(0)}%`}
                  />
                </div>
              ))}
            </div>
            {/* Legend */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2">
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-emerald-500 rounded-sm" /> Answered</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-500/30 rounded-sm" /> Missed</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-yellow-400 rounded-full" /> Answer Rate</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
