import { Card, CardContent } from "@/components/ui/card";
import { XRayTooltip } from "@/components/ui/x-ray-tooltip";
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
      <XRayTooltip
        title="Total Leads"
        insights={[
          { label: "Source", value: "HubSpot Contacts" },
          { label: "Synced Via", value: "hubspot-webhook" },
        ]}
        summary="All contacts currently in the sales pipeline regardless of stage."
      >
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
      </XRayTooltip>

      <XRayTooltip
        title="Contacts"
        insights={[
          { label: "Source", value: "Supabase contacts table" },
          { label: "Includes", value: "All lifecycle stages" },
        ]}
        summary="Total contacts synced from HubSpot. Includes leads, MQLs, SQLs, and customers."
      >
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
      </XRayTooltip>

      <XRayTooltip
        title="Call Activity"
        insights={[
          { label: "Total Calls", value: (callRecords?.total || 0).toString() },
          {
            label: "Answered",
            value: (callRecords?.statusCounts?.answered || 0).toString(),
            color: "text-emerald-400",
          },
          {
            label: "Answer Rate",
            value: callRecords?.total
              ? `${(((callRecords?.statusCounts?.answered || 0) / callRecords.total) * 100).toFixed(0)}%`
              : "N/A",
          },
        ]}
        summary="Call records from HubSpot showing outreach attempts and answer rates."
      >
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
      </XRayTooltip>

      <XRayTooltip
        title="Closed Deals"
        insights={[
          {
            label: "Closed Won",
            value: (dealsData?.closedCount || 0).toString(),
            color: "text-emerald-400",
          },
          { label: "Total Leads", value: (funnelData?.total || 0).toString() },
          { label: "Conversion", value: `${conversionRate}%` },
        ]}
        summary="Deals with stage CLOSED_WON. Conversion rate = Closed Won ÷ Total Leads."
      >
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
      </XRayTooltip>

      <XRayTooltip
        title="Pipeline Revenue"
        insights={[
          {
            label: "Total Value",
            value: (dealsData?.totalValue || 0).toLocaleString("en-AE", {
              style: "currency",
              currency: "AED",
              maximumFractionDigits: 0,
            }),
            color: "text-emerald-400",
          },
          {
            label: "Collected",
            value: (dealsData?.totalCollected || 0).toLocaleString("en-AE", {
              style: "currency",
              currency: "AED",
              maximumFractionDigits: 0,
            }),
          },
          {
            label: "Collection Rate",
            value: dealsData?.totalValue
              ? `${(((dealsData?.totalCollected || 0) / dealsData.totalValue) * 100).toFixed(0)}%`
              : "N/A",
          },
        ]}
        summary="Total deal value from CLOSED_WON deals. 'Collected' = confirmed payments via Stripe."
      >
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
      </XRayTooltip>

      <XRayTooltip
        title="Average Deal Value"
        insights={[
          {
            label: "Total Revenue",
            value: (dealsData?.totalValue || 0).toLocaleString("en-AE", {
              style: "currency",
              currency: "AED",
              maximumFractionDigits: 0,
            }),
          },
          {
            label: "Closed Deals",
            value: (dealsData?.closedCount || 0).toString(),
          },
          { label: "Formula", value: "Revenue ÷ Deals" },
        ]}
        summary="Average value per closed deal. Higher = better deal quality or upselling."
      >
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
      </XRayTooltip>

      {/* Stale Deals Alert */}
      <XRayTooltip
        title="Stale Deals"
        insights={[
          {
            label: "Threshold",
            value: "> 2 days no activity",
            color: "text-rose-400",
          },
          { label: "Excluded", value: "CLOSED_WON deals" },
        ]}
        summary="Deals not in CLOSED_WON that haven't been updated in 2+ days. These need immediate follow-up."
      >
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
      </XRayTooltip>

      {/* Renewal Revenue at Risk */}
      <XRayTooltip
        title="Renewal Alert"
        insights={[
          {
            label: "Threshold",
            value: "< 3 sessions remaining",
            color: "text-amber-400",
          },
          { label: "Source", value: "Payment history" },
        ]}
        summary="Clients with fewer than 3 sessions remaining on their package. Prime upsell/renewal opportunity."
      >
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
      </XRayTooltip>
    </div>
  );
};
