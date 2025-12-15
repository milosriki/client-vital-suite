import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip 
} from "recharts";
import { 
  DollarSign, 
  TrendingUp, 
  AlertTriangle,
  Shield,
  Crown
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Client {
  health_zone?: string;
  package_value_aed?: number;
  firstname?: string;
  lastname?: string;
}

interface RevenueBreakdownProps {
  clients: Client[];
}

export function RevenueBreakdown({ clients }: RevenueBreakdownProps) {
  const breakdown = useMemo(() => {
    const zones = {
      PURPLE: { value: 0, count: 0, label: "VIP", color: "hsl(263, 70%, 50%)" },
      GREEN: { value: 0, count: 0, label: "Healthy", color: "hsl(160, 84%, 39%)" },
      YELLOW: { value: 0, count: 0, label: "Warning", color: "hsl(38, 92%, 50%)" },
      RED: { value: 0, count: 0, label: "Critical", color: "hsl(0, 84%, 60%)" },
    };

    clients.forEach((client) => {
      const zone = client.health_zone as keyof typeof zones;
      if (zones[zone]) {
        zones[zone].value += client.package_value_aed || 0;
        zones[zone].count += 1;
      }
    });

    const total = Object.values(zones).reduce((sum, z) => sum + z.value, 0);
    const atRisk = zones.YELLOW.value + zones.RED.value;
    const secure = zones.PURPLE.value + zones.GREEN.value;

    const chartData = Object.entries(zones)
      .filter(([_, data]) => data.value > 0)
      .map(([key, data]) => ({
        name: data.label,
        value: data.value,
        color: data.color,
        count: data.count,
      }));

    return { zones, total, atRisk, secure, chartData };
  }, [clients]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
    return value.toLocaleString();
  };

  const atRiskPercentage = breakdown.total > 0 
    ? Math.round((breakdown.atRisk / breakdown.total) * 100) 
    : 0;

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <DollarSign className="h-4 w-4 text-primary" />
          Revenue by Health Zone
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-success/10 border border-success/20">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="h-4 w-4 text-success" />
              <span className="text-xs text-success font-medium">Secure</span>
            </div>
            <p className="text-xl font-bold font-mono text-success">
              AED {formatCurrency(breakdown.secure)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              {100 - atRiskPercentage}% of total
            </p>
          </div>
          
          <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="text-xs text-destructive font-medium">At Risk</span>
            </div>
            <p className="text-xl font-bold font-mono text-destructive">
              AED {formatCurrency(breakdown.atRisk)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              {atRiskPercentage}% of total
            </p>
          </div>
        </div>

        {/* Pie Chart */}
        {breakdown.chartData.length > 0 && (
          <div className="h-[160px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={breakdown.chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {breakdown.chartData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload?.[0]) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-card border border-border rounded-lg p-2 shadow-lg">
                          <p className="font-medium text-sm">{data.name}</p>
                          <p className="text-xs text-muted-foreground">
                            AED {data.value.toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {data.count} clients
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Zone Breakdown */}
        <div className="space-y-2">
          {Object.entries(breakdown.zones).map(([key, data]) => {
            if (data.value === 0) return null;
            const percentage = breakdown.total > 0 
              ? Math.round((data.value / breakdown.total) * 100) 
              : 0;
            
            return (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-2.5 h-2.5 rounded-full" 
                      style={{ backgroundColor: data.color }} 
                    />
                    <span>{data.label}</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {data.count}
                    </Badge>
                  </div>
                  <span className="font-mono">AED {formatCurrency(data.value)}</span>
                </div>
                <Progress 
                  value={percentage} 
                  className="h-1.5"
                  style={{ 
                    "--progress-color": data.color 
                  } as React.CSSProperties}
                />
              </div>
            );
          })}
        </div>

        {/* Total */}
        <div className="pt-3 border-t border-border/50">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Total Portfolio</span>
            <span className="text-lg font-bold font-mono">
              AED {formatCurrency(breakdown.total)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}