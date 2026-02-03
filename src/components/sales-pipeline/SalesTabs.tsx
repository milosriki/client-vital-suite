import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Target,
  ExternalLink,
  PhoneCall,
  PhoneMissed,
  FileText,
  Phone,
  Play,
} from "lucide-react";
import { format } from "date-fns";
import { STATUS_CONFIG, CALL_STATUS_CONFIG } from "./constants";

interface SalesTabsProps {
  funnelData: any;
  enhancedLeads: any[];
  contacts: any[];
  dealsData: any;
  callRecords: any;
  appointments: any;
  allLeads: any[];
}

export const SalesTabs = ({
  funnelData,
  enhancedLeads,
  contacts,
  dealsData,
  callRecords,
  appointments,
  allLeads,
}: SalesTabsProps) => {
  return (
    <Tabs defaultValue="leads" className="space-y-4">
      <TabsList className="grid grid-cols-6 w-full max-w-3xl">
        <TabsTrigger value="leads">
          Leads ({funnelData?.total || 0})
        </TabsTrigger>
        <TabsTrigger value="enhanced">
          Ad Leads ({enhancedLeads?.length || 0})
        </TabsTrigger>
        <TabsTrigger value="contacts">
          Contacts ({contacts?.length || 0})
        </TabsTrigger>
        <TabsTrigger value="deals">
          Deals ({dealsData?.deals?.length || 0})
        </TabsTrigger>
        <TabsTrigger value="calls">
          Calls ({callRecords?.total || 0})
        </TabsTrigger>
        <TabsTrigger value="appointments">Appointments</TabsTrigger>
      </TabsList>

      {/* Leads Tab */}
      <TabsContent value="leads">
        <Card>
          <CardHeader>
            <CardTitle>All Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Source/Campaign</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Reach Status</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(funnelData?.leads || []).slice(0, 50).map((lead: any) => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">
                        {lead.first_name || lead.firstname}{" "}
                        {lead.last_name || lead.lastname}
                      </TableCell>
                      <TableCell>{lead.email}</TableCell>
                      <TableCell>{lead.phone}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant="outline" className="w-fit">
                            {lead.source || "Unknown"}
                          </Badge>
                          {lead.latest_traffic_source && (
                            <span className="text-[10px] text-muted-foreground truncate max-w-[150px]">
                              {lead.latest_traffic_source}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium">
                          {lead.owner_name || "Unassigned"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {allLeads.find((l) => l.email === lead.email)
                            ?.call_attempt_count > 0 ||
                          callRecords?.calls?.some((c: any) =>
                            c.caller_number?.includes(
                              lead.phone?.replace(/\D/g, ""),
                            ),
                          ) ? (
                            <Badge
                              variant="secondary"
                              className="bg-green-100 text-green-700 border-green-200"
                            >
                              <PhoneCall className="h-3 w-3 mr-1" />
                              Reached
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-amber-600 border-amber-200 bg-amber-50"
                            >
                              <PhoneMissed className="h-3 w-3 mr-1" />
                              Not Reached
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            STATUS_CONFIG[
                              lead.status as keyof typeof STATUS_CONFIG
                            ]?.color || "bg-gray-500"
                          }
                        >
                          {STATUS_CONFIG[
                            lead.status as keyof typeof STATUS_CONFIG
                          ]?.label || lead.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(lead.created_at), "MMM d, HH:mm")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {!funnelData?.leads?.length && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No leads found
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Enhanced Leads with Ad Data Tab */}
      <TabsContent value="enhanced">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Facebook Ad Leads
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Ad</TableHead>
                    <TableHead>Quality</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enhancedLeads?.slice(0, 50).map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">
                        {lead.first_name} {lead.last_name}
                      </TableCell>
                      <TableCell>{lead.email}</TableCell>
                      <TableCell>{lead.phone}</TableCell>
                      <TableCell>
                        {lead.campaign_id ? (
                          <a
                            href={`https://www.facebook.com/adsmanager/manage/campaigns?act=&selected_campaign_ids=${lead.campaign_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-1"
                          >
                            {lead.campaign_name ||
                              (lead.campaign_id || "").slice(0, 10)}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {lead.ad_id ? (
                          <a
                            href={`https://www.facebook.com/adsmanager/manage/ads?act=&selected_ad_ids=${lead.ad_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-1"
                          >
                            {lead.ad_name || (lead.ad_id || "").slice(0, 10)}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {lead.lead_quality && (
                          <Badge
                            variant={
                              lead.lead_quality === "high"
                                ? "default"
                                : lead.lead_quality === "medium"
                                  ? "secondary"
                                  : "outline"
                            }
                          >
                            {lead.lead_quality}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {lead.created_at &&
                          format(new Date(lead.created_at), "MMM d, HH:mm")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {!enhancedLeads?.length && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No enhanced leads with ad data found
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Contacts Tab */}
      <TabsContent value="contacts">
        <Card>
          <CardHeader>
            <CardTitle>All Contacts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Total Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts?.slice(0, 50).map((contact) => (
                    <TableRow key={contact.id}>
                      <TableCell className="font-medium">
                        {contact.first_name} {contact.last_name}
                      </TableCell>
                      <TableCell>{contact.email}</TableCell>
                      <TableCell>{contact.phone}</TableCell>
                      <TableCell>{contact.city || "Dubai"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {contact.lifecycle_stage || "lead"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            contact.status === "active"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {contact.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {(contact.total_value || 0).toLocaleString("en-AE", {
                          style: "currency",
                          currency: "AED",
                          maximumFractionDigits: 0,
                        })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {!contacts?.length && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No contacts found
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Deals Tab */}
      <TabsContent value="deals">
        <Card>
          <CardHeader>
            <CardTitle>All Deals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Deal Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Pipeline</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead className="text-right">Collected</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dealsData?.deals?.map((deal: any) => (
                    <TableRow key={deal.id}>
                      <TableCell className="font-medium">
                        {deal.deal_name ||
                          `Deal ${(deal.id || "").slice(0, 8)}`}
                      </TableCell>
                      <TableCell>{deal.deal_type || "-"}</TableCell>
                      <TableCell>{deal.pipeline || "-"}</TableCell>
                      <TableCell>{deal.stage || "-"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            deal.status === "closed" ? "default" : "secondary"
                          }
                        >
                          {deal.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {deal.deal_value?.toLocaleString("en-AE", {
                          style: "currency",
                          currency: "AED",
                          maximumFractionDigits: 0,
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        {(deal.cash_collected || 0).toLocaleString("en-AE", {
                          style: "currency",
                          currency: "AED",
                          maximumFractionDigits: 0,
                        })}
                      </TableCell>
                      <TableCell>
                        {format(new Date(deal.created_at!), "MMM d, yyyy")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {!dealsData?.deals?.length && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No deals found
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Calls Tab */}
      <TabsContent value="calls">
        <Card>
          <CardHeader>
            <CardTitle>All Call Records</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Caller/Name</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Source/Campaign</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Outcome</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Quality</TableHead>
                    <TableHead>Transcript</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {callRecords?.calls?.map((call: any) => {
                    const statusConfig =
                      CALL_STATUS_CONFIG[call.call_status] ||
                      CALL_STATUS_CONFIG.initiated;
                    const matchedLead = allLeads.find(
                      (l) =>
                        l.phone?.includes(
                          call.caller_number?.replace(/\D/g, ""),
                        ) ||
                        call.caller_number?.includes(
                          l.phone?.replace(/\D/g, ""),
                        ),
                    );

                    return (
                      <TableRow key={call.id}>
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <span>
                              {matchedLead
                                ? `${matchedLead.first_name} ${matchedLead.last_name}`
                                : call.caller_number}
                            </span>
                            {matchedLead && (
                              <span className="text-[10px] text-muted-foreground">
                                {call.caller_number}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-medium">
                            {matchedLead?.owner ||
                              call.agent_name ||
                              "Unassigned"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant="outline" className="w-fit">
                              {matchedLead?.lead_source || "direct"}
                            </Badge>
                            {matchedLead?.campaign && (
                              <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                                {matchedLead.campaign}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={statusConfig.color}>
                            {statusConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell>{call.call_outcome || "-"}</TableCell>
                        <TableCell>
                          {call.duration_seconds
                            ? `${Math.floor(call.duration_seconds / 60)}m ${call.duration_seconds % 60}s`
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {call.lead_quality && (
                            <Badge
                              variant={
                                call.lead_quality === "high"
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              {call.lead_quality}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {call.transcription || call.recording_url ? (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                >
                                  <FileText className="h-4 w-4 text-primary" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                                <DialogHeader>
                                  <DialogTitle className="flex items-center gap-2">
                                    <Phone className="h-5 w-5" />
                                    Call Details - {call.caller_number}
                                  </DialogTitle>
                                  <DialogDescription>
                                    {call.duration_seconds
                                      ? `Duration: ${Math.floor(call.duration_seconds / 60)}m ${call.duration_seconds % 60}s`
                                      : ""}
                                    {call.created_at
                                      ? ` • ${format(new Date(call.created_at), "MMM d, yyyy HH:mm")}`
                                      : ""}
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                  {call.recording_url && (
                                    <div className="space-y-2">
                                      <h4 className="font-medium flex items-center gap-2">
                                        <Play className="h-4 w-4" /> Recording
                                      </h4>
                                      <audio controls className="w-full">
                                        <source
                                          src={call.recording_url}
                                          type="audio/mpeg"
                                        />
                                        Your browser does not support audio
                                        playback.
                                      </audio>
                                    </div>
                                  )}
                                  {call.transcription && (
                                    <div className="space-y-2">
                                      <h4 className="font-medium flex items-center gap-2">
                                        <FileText className="h-4 w-4" />{" "}
                                        Transcript
                                      </h4>
                                      <div className="bg-muted p-4 rounded-lg text-sm whitespace-pre-wrap">
                                        {call.transcription}
                                      </div>
                                    </div>
                                  )}
                                  {call.call_outcome && (
                                    <div className="space-y-2">
                                      <h4 className="font-medium">Outcome</h4>
                                      <Badge>{call.call_outcome}</Badge>
                                    </div>
                                  )}
                                </div>
                              </DialogContent>
                            </Dialog>
                          ) : (
                            <span className="text-muted-foreground text-xs">
                              -
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {call.created_at &&
                            format(new Date(call.created_at), "MMM d, HH:mm")}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {!callRecords?.calls?.length && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No call records found
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Appointments Tab */}
      <TabsContent value="appointments">
        <Card>
          <CardHeader>
            <CardTitle>All Appointments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Scheduled At</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {appointments?.appointments?.map((apt: any) => (
                    <TableRow key={apt.id}>
                      <TableCell className="font-medium">
                        {format(
                          new Date(apt.scheduled_at),
                          "MMM d, yyyy HH:mm",
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            apt.status === "completed"
                              ? "default"
                              : apt.status === "cancelled"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {apt.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {apt.notes || "-"}
                      </TableCell>
                      <TableCell>
                        {apt.created_at &&
                          format(new Date(apt.created_at), "MMM d, HH:mm")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {!appointments?.appointments?.length && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No appointments found
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
};
