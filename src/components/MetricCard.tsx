import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  iconColor: string;
  iconBg: string;
}

export const MetricCard = ({ title, value, icon: Icon, trend, iconColor, iconBg }: MetricCardProps) => {
  return (
    <Card className="card-hover">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm text-muted-foreground mb-1">{title}</p>
            <p className="text-3xl font-semibold">{value}</p>
            {trend && (
              <div className="flex items-center mt-2">
                <span className={`text-sm ${trend.isPositive ? 'text-green-500' : 'text-red-500'}`}>
                  {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
                </span>
                <span className="text-xs text-muted-foreground ml-2">vs last period</span>
              </div>
            )}
          </div>
          <div className={`p-4 rounded-lg ${iconBg}`}>
            <Icon className={`h-6 w-6 ${iconColor}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
