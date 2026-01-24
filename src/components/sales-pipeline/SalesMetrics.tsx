import { Card, CardContent } from "@/components/ui/card";
import {
  Users,
  UserCheck,
  Phone,
  CheckCircle,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { subDays } from "date-fns";

interface SalesMetricsProps {
  funnelData: any;
  contacts: any[];
  callRecords: any;
  dealsData: any;
  allLeads: any[];
  paymentHistory: any[];
  conversionRate: string;
}

export const SalesMetrics = ({
  funnelData,
  contacts,
  callRecords,
  dealsData,
  allLeads,
  paymentHistory,
  conversionRate,
}: SalesMetricsProps) => {
  return (
    <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
      <Card className="bg-gradient-to-br from-card to-card/80 border-border/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Leads
            </span>
            <Users className="h-4 w-4 text-primary" />
          </div>
          <div className="text-2xl font-bold">{funnelData?.total || 0}</div>
          <p className="text-xs text-muted-foreground">In pipeline</p>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-card to-card/80 border-border/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Contacts
            </span>
            <UserCheck className="h-4 w-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold">{contacts?.length || 0}</div>
          <p className="text-xs text-muted-foreground">Total synced</p>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-card to-card/80 border-border/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Calls
            </span>
            <Phone className="h-4 w-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold">{callRecords?.total || 0}</div>
          <p className="text-xs text-muted-foreground">
            {callRecords?.statusCounts?.answered || 0} answered
          </p>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-card to-card/80 border-border/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Closed
            </span>
            <CheckCircle className="h-4 w-4 text-green-400" />
          </div>
          <div className="text-2xl font-bold">
            {dealsData?.closedCount || 0}
          </div>
          <p className="text-xs text-muted-foreground">
            {conversionRate}% rate
          </p>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-green-500/10 to-card border-green-500/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-green-400 uppercase tracking-wide">
              Revenue
            </span>
            <DollarSign className="h-4 w-4 text-green-400" />
          </div>
          <div className="text-xl font-bold text-green-400">
            {(dealsData?.totalValue || 0).toLocaleString("en-AE", {
              style: "currency",
              currency: "AED",
              maximumFractionDigits: 0,
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            {(dealsData?.totalCollected || 0).toLocaleString("en-AE", {
              style: "currency",
              currency: "AED",
              maximumFractionDigits: 0,
            })}{" "}
            collected
          </p>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-card to-card/80 border-border/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Avg Deal
            </span>
            <TrendingUp className="h-4 w-4 text-blue-400" />
          </div>
          <div className="text-xl font-bold">
            {(dealsData?.avgDealValue || 0).toLocaleString("en-AE", {
              style: "currency",
              currency: "AED",
              maximumFractionDigits: 0,
            })}
          </div>
          <p className="text-xs text-muted-foreground">Per deal</p>
        </CardContent>
      </Card>

      {/* Stale Deals Alert */}
      <Card className="bg-gradient-to-br from-red-500/10 to-card border-red-500/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-red-400 uppercase tracking-wide">
              Stale Deals
            </span>
            <AlertTriangle className="h-4 w-4 text-red-400" />
          </div>
          <div className="text-2xl font-bold text-red-400">
            {
              allLeads.filter(
                (l) =>
                  l.funnel_stage !== "CLOSED_WON" &&
                  new Date(l.updated_at || l.created_at) <
                    subDays(new Date(), 2),
              ).length
            }
          </div>
          <p className="text-xs text-muted-foreground">Forgotten (2d+)</p>
        </CardContent>
      </Card>

      {/* Renewal Revenue at Risk */}
      <Card className="bg-gradient-to-br from-amber-500/10 to-card border-amber-500/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-amber-400 uppercase tracking-wide">
              Next Renewal
            </span>
            <Clock className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold text-amber-400">
            {
              paymentHistory?.filter(
                (p: any) => (p.sessions_remaining || 0) < 3,
              ).length
            }{" "}
            Clients
          </div>
          <p className="text-xs text-muted-foreground">Ready to renew</p>
        </CardContent>
      </Card>
    </div>
  );
};
