import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Users,
  Target,
  Phone,
  DollarSign,
  Calendar,
  CheckCircle,
  BarChart3,
  Zap,
} from "lucide-react";

interface HubSpotKPIsProps {
  kpis: any;
}

export const HubSpotKPIs = ({ kpis }: HubSpotKPIsProps) => {
  return (
    <>
      {/* Primary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.totalLeads}</div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="text-green-500">
                {kpis.highQualityLeads} high quality
              </span>
              <span>•</span>
              <span>{kpis.newLeads} new</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Conversion Rate
            </CardTitle>
            <Target className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.conversionRate}%</div>
            <div className="text-xs text-muted-foreground">
              Formula: (Closed ÷ Total Leads) × 100
            </div>
            <Progress
              value={parseFloat(kpis.conversionRate)}
              className="h-1 mt-2"
            />
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
            <Phone className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.totalCalls}</div>
            <div className="text-xs text-muted-foreground">
              {kpis.connectRate}% connect rate •{" "}
              {Math.floor(kpis.avgDuration / 60)}m avg
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {kpis.closedDealValue.toLocaleString()} AED
            </div>
            <div className="text-xs text-muted-foreground">
              {kpis.cashCollected.toLocaleString()} AED collected
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">
                  Appointment Rate
                </p>
                <p className="text-xl font-bold">{kpis.appointmentRate}%</p>
              </div>
              <Calendar className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {kpis.appointmentSet} appointments set
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Close Rate</p>
                <p className="text-xl font-bold">{kpis.closeRate}%</p>
              </div>
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {kpis.closedDeals} of {kpis.totalDeals} deals
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Avg Deal Value</p>
                <p className="text-xl font-bold">
                  {Number(kpis.avgDealValue).toLocaleString()} AED
                </p>
              </div>
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Revenue ÷ Closed Deals
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">
                  Revenue per Lead
                </p>
                <p className="text-xl font-bold">
                  {Number(kpis.revenuePerLead).toLocaleString()} AED
                </p>
              </div>
              <Zap className="h-5 w-5 text-amber-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total Revenue ÷ Total Leads
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
};
