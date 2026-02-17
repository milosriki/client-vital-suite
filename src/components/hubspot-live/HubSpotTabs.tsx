import { displayDuration } from "@/lib/callDuration";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { PageSkeleton } from "@/components/ui/page-skeleton";

interface HubSpotTabsProps {
  kpis: any;
  isLoading: boolean;
  allLeads: any[];
  callsData: any[];
  dealsData: any[];
  staffData: any[];
}

export const HubSpotTabs = ({
  kpis,
  isLoading,
  allLeads,
  callsData,
  dealsData,
  staffData,
}: HubSpotTabsProps) => {
  const getStatusBadgeVariant = (status: string) => {
    switch (status?.toLowerCase()) {
      case "closed":
      case "completed":
        return "default";
      case "appointment_set":
      case "pitch_given":
        return "secondary";
      case "new":
        return "outline";
      default:
        return "secondary";
    }
  };

  const getQualityColor = (quality: string) => {
    switch (quality?.toLowerCase()) {
      case "high":
      case "premium":
        return "text-green-500";
      case "medium":
        return "text-yellow-500";
      case "low":
        return "text-red-500";
      default:
        return "text-muted-foreground";
    }
  };

  const getStaffName = (id: string | null) => {
    if (!id || !staffData) return "Unassigned";
    const staff = staffData.find((s: any) => s.id === id);
    return staff?.name || "Unknown";
  };

  return (
    <Tabs defaultValue="leads">
      <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full">
        <TabsTrigger value="leads" className="text-xs sm:text-sm">
          📋 Leads ({kpis.totalLeads})
        </TabsTrigger>
        <TabsTrigger value="calls" className="text-xs sm:text-sm">
          📞 Calls ({kpis.totalCalls})
        </TabsTrigger>
        <TabsTrigger value="deals" className="text-xs sm:text-sm">
          💰 Deals ({kpis.totalDeals})
        </TabsTrigger>
        <TabsTrigger value="formulas" className="text-xs sm:text-sm">
          📊 Formulas
        </TabsTrigger>
      </TabsList>

      {/* Leads Tab */}
      <TabsContent value="leads">
        <Card>
          <CardHeader>
            <CardTitle>Leads from Database</CardTitle>
            <CardDescription>
              Combined leads + enhanced_leads • {allLeads.length} total
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <PageSkeleton variant="table" />
            ) : allLeads.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[120px]">Name</TableHead>
                      <TableHead className="min-w-[180px]">Email</TableHead>
                      <TableHead className="min-w-[120px]">Phone</TableHead>
                      <TableHead className="min-w-[100px]">Source</TableHead>
                      <TableHead className="min-w-[100px]">Status</TableHead>
                      <TableHead className="min-w-[80px]">Quality</TableHead>
                      <TableHead className="min-w-[120px]">Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allLeads.slice(0, 50).map((lead: any) => (
                      <TableRow key={lead.id}>
                        <TableCell className="font-medium">
                          {lead.display_name}
                        </TableCell>
                        <TableCell className="text-sm">
                          {lead.email || "-"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {lead.phone || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {lead.source || lead.source_type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(lead.status)}>
                            {lead.status || "new"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`font-medium ${getQualityColor(lead.lead_quality)}`}
                          >
                            {lead.lead_quality || "pending"}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm">
                          {lead.created_at
                            ? format(new Date(lead.created_at), "MMM dd, HH:mm")
                            : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <Alert>
                <AlertTitle>No Leads Found</AlertTitle>
                <AlertDescription>
                  No leads for the selected timeframe.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Calls Tab */}
      <TabsContent value="calls">
        <Card>
          <CardHeader>
            <CardTitle>Call Records</CardTitle>
            <CardDescription>
              From call_records table • {kpis.completedCalls} completed of{" "}
              {kpis.totalCalls}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <PageSkeleton variant="table" />
            ) : (callsData || []).length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[80px]">Time</TableHead>
                      <TableHead className="min-w-[100px]">Direction</TableHead>
                      <TableHead className="min-w-[120px]">Caller</TableHead>
                      <TableHead className="min-w-[100px]">Status</TableHead>
                      <TableHead className="min-w-[100px]">Duration</TableHead>
                      <TableHead className="min-w-[80px]">Score</TableHead>
                      <TableHead className="min-w-[100px]">
                        Appointment
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(callsData || []).map((call: any) => (
                      <TableRow key={call.id}>
                        <TableCell className="text-sm">
                          {call.created_at
                            ? format(new Date(call.created_at), "HH:mm")
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {call.call_direction || "inbound"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {call.caller_number}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              call.call_status === "completed"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {call.call_status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {call.duration_seconds
                            ? displayDuration(call.duration_seconds)
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <span
                            className={
                              call.call_score >= 70
                                ? "text-green-500"
                                : "text-muted-foreground"
                            }
                          >
                            {call.call_score || "-"}
                          </span>
                        </TableCell>
                        <TableCell>
                          {call.appointment_set ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <Alert>
                <AlertTitle>No Calls Found</AlertTitle>
                <AlertDescription>
                  No call records for the selected timeframe.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Deals Tab */}
      <TabsContent value="deals">
        <Card>
          <CardHeader>
            <CardTitle>Deals Pipeline</CardTitle>
            <CardDescription>
              From deals table • {kpis.closedDealValue.toLocaleString()} AED
              total value
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <PageSkeleton variant="table" />
            ) : (dealsData || []).length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[150px]">Deal</TableHead>
                      <TableHead className="min-w-[120px]">Value</TableHead>
                      <TableHead className="min-w-[120px]">
                        Cash Collected
                      </TableHead>
                      <TableHead className="min-w-[100px]">Status</TableHead>
                      <TableHead className="min-w-[120px]">Closer</TableHead>
                      <TableHead className="min-w-[120px]">Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(dealsData || []).map((deal: any) => (
                      <TableRow key={deal.id}>
                        <TableCell className="font-medium">
                          {deal.deal_name || `Deal ${deal.id.slice(0, 8)}`}
                        </TableCell>
                        <TableCell className="font-bold text-green-500">
                          {Number(deal.deal_value || 0).toLocaleString()} AED
                        </TableCell>
                        <TableCell>
                          {Number(deal.cash_collected || 0).toLocaleString()}{" "}
                          AED
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              deal.status === "closed" ? "default" : "secondary"
                            }
                          >
                            {deal.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{getStaffName(deal.closer_id)}</TableCell>
                        <TableCell className="text-sm">
                          {deal.created_at
                            ? format(new Date(deal.created_at), "MMM dd, yyyy")
                            : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <Alert>
                <AlertTitle>No Deals Found</AlertTitle>
                <AlertDescription>
                  No deals for the selected timeframe.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Formulas Tab */}
      <TabsContent value="formulas">
        <Card>
          <CardHeader>
            <CardTitle>KPI Formulas Reference</CardTitle>
            <CardDescription>How metrics are calculated</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg border bg-muted/50">
                <h4 className="font-semibold mb-2">Conversion Rate</h4>
                <code className="text-sm bg-background px-2 py-1 rounded">
                  (Closed Leads ÷ Total Leads) × 100
                </code>
                <p className="text-sm text-muted-foreground mt-2">
                  Current: {kpis.closedLeads} ÷ {kpis.totalLeads} ={" "}
                  <strong>{kpis.conversionRate}%</strong>
                </p>
              </div>

              <div className="p-4 rounded-lg border bg-muted/50">
                <h4 className="font-semibold mb-2">Connect Rate</h4>
                <code className="text-sm bg-background px-2 py-1 rounded">
                  (Completed Calls ÷ Total Calls) × 100
                </code>
                <p className="text-sm text-muted-foreground mt-2">
                  Current: {kpis.completedCalls} ÷ {kpis.totalCalls} ={" "}
                  <strong>{kpis.connectRate}%</strong>
                </p>
              </div>

              <div className="p-4 rounded-lg border bg-muted/50">
                <h4 className="font-semibold mb-2">Average Deal Value</h4>
                <code className="text-sm bg-background px-2 py-1 rounded">
                  Closed Deal Revenue ÷ Closed Deals Count
                </code>
                <p className="text-sm text-muted-foreground mt-2">
                  Current: {kpis.closedDealValue.toLocaleString()} ÷{" "}
                  {kpis.closedDeals} ={" "}
                  <strong>
                    {Number(kpis.avgDealValue).toLocaleString()} AED
                  </strong>
                </p>
              </div>

              <div className="p-4 rounded-lg border bg-muted/50">
                <h4 className="font-semibold mb-2">Revenue per Lead</h4>
                <code className="text-sm bg-background px-2 py-1 rounded">
                  Total Revenue ÷ Total Leads
                </code>
                <p className="text-sm text-muted-foreground mt-2">
                  Current: {kpis.closedDealValue.toLocaleString()} ÷{" "}
                  {kpis.totalLeads} ={" "}
                  <strong>
                    {Number(kpis.revenuePerLead).toLocaleString()} AED
                  </strong>
                </p>
              </div>

              <div className="p-4 rounded-lg border bg-muted/50">
                <h4 className="font-semibold mb-2">Appointment Rate</h4>
                <code className="text-sm bg-background px-2 py-1 rounded">
                  (Appointments Set ÷ Total Leads) × 100
                </code>
                <p className="text-sm text-muted-foreground mt-2">
                  Current: {kpis.appointmentSet} ÷ {kpis.totalLeads} ={" "}
                  <strong>{kpis.appointmentRate}%</strong>
                </p>
              </div>

              <div className="p-4 rounded-lg border bg-muted/50">
                <h4 className="font-semibold mb-2">Close Rate</h4>
                <code className="text-sm bg-background px-2 py-1 rounded">
                  (Closed Deals ÷ Total Deals) × 100
                </code>
                <p className="text-sm text-muted-foreground mt-2">
                  Current: {kpis.closedDeals} ÷ {kpis.totalDeals} ={" "}
                  <strong>{kpis.closeRate}%</strong>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
};
