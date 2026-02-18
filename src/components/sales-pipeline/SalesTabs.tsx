import { displayDuration } from "@/lib/callDuration";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
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
  RotateCcw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { STATUS_CONFIG, CALL_STATUS_CONFIG } from "./constants";
import { DealsKanban } from "./DealsKanban";

interface FunnelLead {
  id: string;
  first_name?: string | null;
  firstname?: string | null;
  last_name?: string | null;
  lastname?: string | null;
  email?: string | null;
  phone?: string | null;
  source?: string | null;
  latest_traffic_source?: string | null;
  owner_name?: string | null;
  status?: string | null;
  created_at: string;
}

interface FunnelData {
  leads: FunnelLead[];
  statusCounts: Record<string, number>;
  sourceCounts: Record<string, number>;
  total: number;
}

interface EnhancedLead {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  campaign_id?: string | null;
  campaign_name?: string | null;
  ad_id?: string | null;
  ad_name?: string | null;
  lead_quality?: string | null;
  created_at?: string | null;
}

interface Contact {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  lifecycle_stage?: string | null;
  status?: string | null;
  total_value?: number | null;
}

interface DealRecord {
  id: string;
  deal_name?: string | null;
  stage?: string | null;
  status?: string | null;
  deal_value?: number | null;
  cash_collected?: number | null;
  created_at?: string | null;
}

interface DealsData {
  deals: DealRecord[];
  closedCount: number;
  totalValue: number;
  totalCollected: number;
  avgDealValue: number;
}

interface CallRecord {
  id: string;
  caller_number?: string | null;
  agent_name?: string | null;
  call_status?: string | null;
  call_outcome?: string | null;
  duration_seconds?: number | null;
  lead_quality?: string | null;
  transcription?: string | null;
  recording_url?: string | null;
  created_at?: string | null;
}

interface CallRecordsData {
  calls: CallRecord[];
  statusCounts: Record<string, number>;
  total: number;
}

interface Appointment {
  id: string;
  scheduled_at: string;
  status?: string | null;
  notes?: string | null;
  created_at?: string | null;
}

interface AppointmentsData {
  appointments: Appointment[];
  scheduled: number;
  completed: number;
}

interface AllLead {
  email?: string | null;
  phone?: string | null;
  call_attempt_count?: number | null;
  first_name?: string | null;
  last_name?: string | null;
  owner?: string | null;
  lead_source?: string | null;
  campaign?: string | null;
}

interface SalesTabsProps {
  funnelData: FunnelData | undefined;
  enhancedLeads: EnhancedLead[];
  contacts: Contact[];
  dealsData: DealsData | undefined;
  callRecords: CallRecordsData | undefined;
  appointments: AppointmentsData | undefined;
  allLeads: AllLead[];
  onDealClick?: (deal: DealRecord) => void;
}

export const SalesTabs = ({
  funnelData,
  enhancedLeads,
  contacts,
  dealsData,
  callRecords,
  appointments,
  allLeads,
  onDealClick,
}: SalesTabsProps) => {
  return (
    <Tabs defaultValue="leads" className="space-y-4">
      <TabsList className="grid grid-cols-7 w-full max-w-4xl">
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
        <TabsTrigger value="followup" className="text-orange-400">
          <RotateCcw className="h-4 w-4 mr-1" />
          Follow Up
        </TabsTrigger>
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
                  {(funnelData?.leads || []).slice(0, 50).map((lead: FunnelLead) => (
                    <TableRow key={lead.id} className="cursor-pointer hover:bg-muted/30 transition-colors duration-150">
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
                          callRecords?.calls?.some((c: CallRecord) =>
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
                    <TableRow key={lead.id} className="cursor-pointer hover:bg-muted/30 transition-colors duration-150">
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
                    <TableRow key={contact.id} className="cursor-pointer hover:bg-muted/30 transition-colors duration-150">
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
        <DealsKanban deals={dealsData?.deals || []} onDealClick={onDealClick} />
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
                  {callRecords?.calls?.map((call: CallRecord) => {
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
                      <TableRow key={call.id} className="cursor-pointer hover:bg-muted/30 transition-colors duration-150">
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
                            ? displayDuration(call.duration_seconds)
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
                                      ? `Duration: ${displayDuration(call.duration_seconds)}`
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
                  {appointments?.appointments?.map((apt: Appointment) => (
                    <TableRow key={apt.id} className="cursor-pointer hover:bg-muted/30 transition-colors duration-150">
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
      <TabsContent value="followup">
        <FollowUpTab />
      </TabsContent>
    </Tabs>
  );
};

// --- Follow Up Tab (lost deals for re-engagement) ---
function FollowUpTab() {
  const { data: followups, isLoading } = useQuery({
    queryKey: ['lost-deal-followups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('view_lost_deal_followups' as any)
        .select('*')
        .in('followup_priority', ['HOT', 'WARM', 'COOL'])
        .order('days_since_lost', { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const priorityColor: Record<string, string> = {
    HOT: 'bg-red-500 text-white',
    WARM: 'bg-orange-500 text-white',
    COOL: 'bg-blue-500 text-white',
  };

  if (isLoading) return <Card className="p-8 text-center text-muted-foreground">Loading lost deals...</Card>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RotateCcw className="h-5 w-5 text-orange-400" />
          Lost Deal Follow-Ups ({followups?.length || 0})
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Deals lost in the last 90 days with contact info — sorted by urgency
        </p>
      </CardHeader>
      <CardContent>
        {!followups?.length ? (
          <p className="text-center text-muted-foreground py-8">No lost deals with contact info in the last 90 days</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Priority</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Deal</TableHead>
                <TableHead>Days Ago</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Last Call</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {followups.map((f: any) => (
                <TableRow key={f.deal_id} className="cursor-pointer hover:bg-muted/30 transition-colors duration-150">
                  <TableCell>
                    <Badge className={priorityColor[f.followup_priority] || 'bg-gray-500'}>
                      {f.followup_priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">
                        {[f.contact_first_name, f.contact_last_name].filter(Boolean).join(' ') || '—'}
                      </p>
                      {f.contact_email && (
                        <p className="text-xs text-muted-foreground">{f.contact_email}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm">{f.deal_name}</TableCell>
                  <TableCell>
                    <span className={f.days_since_lost <= 14 ? 'text-red-400 font-semibold' : ''}>
                      {f.days_since_lost}d
                    </span>
                  </TableCell>
                  <TableCell>
                    {f.contact_phone ? (
                      <a href={`tel:${f.contact_phone.replace(/\s/g, '')}`} className="text-cyan-400 hover:underline flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {f.contact_phone}
                      </a>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {f.last_call_date ? format(new Date(f.last_call_date), 'MMM d') : 'Never'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
