import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingDown } from "lucide-react";
import { ChurnAlert } from "@/types/ceo";
import { formatCurrency } from "@/lib/ceo-utils";

interface CEOChurnAlertsProps {
  churnAlerts: ChurnAlert[] | undefined;
}

export function CEOChurnAlerts({ churnAlerts }: CEOChurnAlertsProps) {
  if (!churnAlerts || churnAlerts.length === 0) return null;

  return (
    <Card className="bg-red-500/5 border-red-500/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg text-white flex items-center gap-2">
          <TrendingDown className="w-5 h-5 text-red-400" />
          Churn Risk Alerts
          <Badge variant="destructive" className="ml-2">
            {churnAlerts.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {churnAlerts.map((client, i) => (
            <div
              key={i}
              className="p-3 bg-red-500/10 rounded-lg border border-red-500/20"
            >
              <p className="text-sm font-medium text-white truncate">
                {client.firstname} {client.lastname}
              </p>
              <div className="flex items-center justify-between mt-1">
                <Badge
                  variant="outline"
                  className={`text-xs ${
                    client.health_zone === "red"
                      ? "text-red-400 border-red-400/50"
                      : "text-yellow-400 border-yellow-400/50"
                  }`}
                >
                  {client.health_zone}
                </Badge>
                <span className="text-xs text-red-400">
                  {client.churn_risk_score}% risk
                </span>
              </div>
              <p className="text-xs text-white/40 mt-1">
                {formatCurrency(client.package_value_aed || 0)}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
