import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  XCircle,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

interface LeadLossPoint {
  point: string;
  status: "broken" | "critical" | "missing" | "inactive" | "partial" | "good";
  description: string;
  leadsAffected: string;
  revenueImpact: string;
}

interface LeadLossAnalysisProps {
  points: LeadLossPoint[];
}

export const LeadLossAnalysis = ({ points }: LeadLossAnalysisProps) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "broken":
      case "critical":
        return <XCircle className="h-5 w-5 text-destructive" />;
      case "missing":
      case "inactive":
        return <AlertCircle className="h-5 w-5 text-warning" />;
      case "partial":
        return <AlertTriangle className="h-5 w-5 text-warning" />;
      default:
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lead Loss Points in Your Funnel</CardTitle>
        <CardDescription>
          Critical points where leads are getting lost
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {points.map((point, index) => (
            <div key={index} className="border rounded-lg p-4 space-y-2">
              <div className="flex items-start gap-3">
                {getStatusIcon(point.status)}
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{point.point}</h3>
                    <Badge
                      variant={
                        point.status === "broken" || point.status === "critical"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {point.status.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {point.description}
                  </p>
                  <div className="flex gap-4 text-sm">
                    <div>
                      <span className="font-medium">Leads Affected:</span>{" "}
                      {point.leadsAffected}
                    </div>
                    <div>
                      <span className="font-medium">Revenue Impact:</span>{" "}
                      {point.revenueImpact}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
