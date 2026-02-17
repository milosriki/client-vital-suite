import { Card, CardContent } from "@/components/ui/card";
import { Brain } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";

interface PredictiveForecastingProps {
  forecastData: any[];
  gapToTarget: number;
}

export const PredictiveForecasting = ({
  forecastData,
  gapToTarget,
}: PredictiveForecastingProps) => {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-amber-400" />
          <h2 className="text-lg font-semibold text-zinc-200">
            Predictive Forecasting
          </h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-zinc-400">Gap to Q1 Target</p>
            <p
              className={`text-lg font-bold font-mono ${gapToTarget > 0 ? "text-red-400" : "text-emerald-400"}`}
            >
              {gapToTarget > 0
                ? `-AED ${gapToTarget.toLocaleString()}`
                : `+AED ${Math.abs(gapToTarget).toLocaleString()}`}
            </p>
          </div>
        </div>
      </div>

      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardContent className="p-6">
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={forecastData}>
              <defs>
                <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="commitGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient
                  id="bestCaseGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="month" stroke="#71717a" />
              <YAxis
                stroke="#71717a"
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#18181b",
                  border: "1px solid #27272a",
                  borderRadius: "8px",
                }}
                formatter={(value: number) => [
                  `AED ${value?.toLocaleString() || 0}`,
                  "",
                ]}
              />
              <Legend />
              <ReferenceLine
                y={100000}
                stroke="#f59e0b"
                strokeDasharray="5 5"
                label="Target"
              />
              <Area
                type="monotone"
                dataKey="actual"
                stroke="#f59e0b"
                fill="url(#actualGradient)"
                name="Actual"
              />
              <Area
                type="monotone"
                dataKey="bestCase"
                stroke="#3b82f6"
                fill="url(#bestCaseGradient)"
                name="Best Case"
                strokeDasharray="5 5"
              />
              <Area
                type="monotone"
                dataKey="likely"
                stroke="#8b5cf6"
                fill="none"
                name="Likely"
                strokeDasharray="3 3"
              />
              <Area
                type="monotone"
                dataKey="commit"
                stroke="#10b981"
                fill="url(#commitGradient)"
                name="Commit"
              />
            </AreaChart>
          </ResponsiveContainer>

          <div className="flex justify-center gap-8 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-zinc-300">Commit (90%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-purple-500" />
              <span className="text-zinc-300">Likely (60%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-zinc-300">Best Case (30%)</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
