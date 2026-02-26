import { useMemo, useState } from "react";
import { subDays, startOfDay, endOfDay, format, differenceInDays } from "date-fns";
import { Phone, Users, Timer, PhoneCall, Clock, TrendingUp, BarChart3, Shuffle, AlertTriangle, ArrowRightLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDedupedQuery } from "@/hooks/useDedupedQuery";
import { MetricCard } from "@/components/dashboard/cards/MetricCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { toast } from "sonner";

const normalizePhone = (phone: string | null | undefined) =>
  phone ? phone.replace(/\D/g, "") : "";

const formatDuration = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
};

const formatMinutes = (minutes: number) => {
  if (!Number.isFinite(minutes) || minutes <= 0) return "0m";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours}h ${mins}m`;
};

type CallRecord = {
  id: string;
  caller_number: string | null;
  owner_name?: string | null;
  call_status?: string | null;
  call_outcome?: string | null;
  duration_seconds?: number | null;
  created_at?: string | null;
  started_at?: string | null;
};

type Contact = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  created_at?: string | null;
};

type SpeedToLeadEntry = {
  id: string;
  name: string;
  phone: string | null | undefined;
  createdAt: Date;
  firstCallAt: Date;
  speedMinutes: number;
};

type SetterDetail = {
  name: string;
  total: number;
  connected: number;
  totalDuration: number;
  avgDuration: number;
  connectionRate: number;
};

type DelegationAnalytics = {
  setter_id: string | null;
  setter_name: string | null;
  received_delegations: number | null;
  leads_lost: number | null;
  net_leads: number | null;
  auto_received: number | null;
  manual_received: number | null;
  reassignments_received: number | null;
  unique_contacts_lost: number | null;
  unique_contacts_received: number | null;
};

type HotPotatoLead = {
  contact_id: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  total_delegations: number | null;
  unique_owners: number | null;
  owner_names: string[] | null;
  auto_delegations: number | null;
  manual_delegations: number | null;
  bulk_delegations: number | null;
  first_assignment: string | null;
  last_assignment: string | null;
  lifecycle_stage: string | null;
  deal_stage: string | null;
  deal_amount: number | null;
  attributed_channel: string | null;
  hubspot_contact_id: string | null;
  ownership_span: unknown;
};

const isConnectedCall = (
  callStatus: string | null | undefined,
  callOutcome: string | null | undefined,
) => {
  const status = (callStatus || "").toLowerCase();
  const outcome = (callOutcome || "").toLowerCase();
  return status === "completed" || status === "answered" || outcome === "answered";
};

const getCallTimestamp = (call: { created_at?: string | null; started_at?: string | null }) => {
  const raw = call.created_at || call.started_at;
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getSetterName = (call: { owner_name?: string | null }) =>
  call.owner_name || "Unknown";

export default function SetterCommandCenter() {
  const [activeTab, setActiveTab] = useState("calls");
  const [selectedSetter, setSelectedSetter] = useState<SetterDetail | null>(null);
  const [selectedLead, setSelectedLead] = useState<SpeedToLeadEntry | null>(null);

  const now = new Date();
  const startOfToday = startOfDay(now);
  const endOfToday = endOfDay(now);
  const startOfRange = startOfDay(subDays(now, 30));

  const { data: callRecords = [], isLoading: loadingCalls } = useDedupedQuery<CallRecord[]>({
    queryKey: ["setter-command-center", "call-records", startOfRange.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_records")
        .select("id, caller_number, owner_name, call_status, call_outcome, duration_seconds, created_at, started_at")
        .gte("created_at", startOfRange.toISOString())
        .lte("created_at", endOfToday.toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as CallRecord[];
    },
  });

  const { data: contacts = [], isLoading: loadingContacts } = useDedupedQuery<Contact[]>({
    queryKey: ["setter-command-center", "contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, phone, created_at")
        .not("phone", "is", null);

      if (error) throw error;
      return data || [];
    },
  });

  // ── Delegation Tracking Queries ──

  const { data: delegationAnalytics = [], isLoading: loadingDelegations } = useDedupedQuery<DelegationAnalytics[]>({
    queryKey: ["setter-command-center", "delegation-analytics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("view_delegation_analytics")
        .select("setter_id, setter_name, received_delegations, leads_lost, net_leads, auto_received, manual_received, reassignments_received, unique_contacts_lost, unique_contacts_received")
        .order("received_delegations", { ascending: false });

      if (error) throw error;
      return (data || []) as DelegationAnalytics[];
    },
    enabled: activeTab === "delegations",
  });

  const { data: hotPotatoLeads = [], isLoading: loadingHotPotato } = useDedupedQuery<HotPotatoLead[]>({
    queryKey: ["setter-command-center", "hot-potato-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("view_hot_potato_leads")
        .select("contact_id, contact_name, email, phone, total_delegations, unique_owners, owner_names, auto_delegations, manual_delegations, bulk_delegations, first_assignment, last_assignment, lifecycle_stage, deal_stage, deal_amount, attributed_channel, hubspot_contact_id, ownership_span")
        .gte("total_delegations", 3)
        .order("total_delegations", { ascending: false });

      if (error) throw error;
      return (data || []) as HotPotatoLead[];
    },
    enabled: activeTab === "delegations",
  });

  const isLoading = loadingCalls || loadingContacts;

  const todayCalls = useMemo(() => {
    return callRecords.filter((call) => {
      const timestamp = getCallTimestamp(call);
      if (!timestamp) return false;
      return timestamp >= startOfToday && timestamp <= endOfToday;
    });
  }, [callRecords, startOfToday, endOfToday]);

  const totalCallsToday = todayCalls.length;
  const connectedCallsToday = todayCalls.filter((call) =>
    isConnectedCall(call.call_status, call.call_outcome),
  ).length;
  const avgCallDurationSeconds = todayCalls.length
    ? todayCalls.reduce((sum, call) => sum + (call.duration_seconds || 0), 0) /
      todayCalls.length
    : 0;

  const setterCountToday = useMemo(() => {
    const names = new Set<string>();
    todayCalls.forEach((call) => {
      names.add(getSetterName(call));
    });
    return names.size || 1;
  }, [todayCalls]);

  const callsPerSetter = totalCallsToday ? totalCallsToday / setterCountToday : 0;
  const connectionRateToday = totalCallsToday
    ? (connectedCallsToday / totalCallsToday) * 100
    : 0;

  const leaderboard = useMemo(() => {
    const bySetter = new Map<
      string,
      { name: string; total: number; connected: number; totalDuration: number }
    >();

    callRecords.forEach((call) => {
      const name = getSetterName(call);
      const entry = bySetter.get(name) || {
        name,
        total: 0,
        connected: 0,
        totalDuration: 0,
      };
      entry.total += 1;
      if (isConnectedCall(call.call_status, call.call_outcome)) {
        entry.connected += 1;
      }
      entry.totalDuration += call.duration_seconds || 0;
      bySetter.set(name, entry);
    });

    return Array.from(bySetter.values())
      .map((entry) => ({
        ...entry,
        avgDuration: entry.total ? entry.totalDuration / entry.total : 0,
        connectionRate: entry.total ? (entry.connected / entry.total) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [callRecords]);

  // Compute today's calls per setter for detail dialog
  const todayCallsBySetter = useMemo(() => {
    const map = new Map<string, number>();
    todayCalls.forEach((call) => {
      const name = getSetterName(call);
      map.set(name, (map.get(name) || 0) + 1);
    });
    return map;
  }, [todayCalls]);

  const speedToLead = useMemo(() => {
    const earliestCallByPhone = new Map<string, Date>();

    callRecords.forEach((call) => {
      const phone = normalizePhone(call.caller_number);
      if (!phone) return;
      const callTime = getCallTimestamp(call);
      if (!callTime) return;
      const existing = earliestCallByPhone.get(phone);
      if (!existing || callTime < existing) {
        earliestCallByPhone.set(phone, callTime);
      }
    });

    return contacts
      .map((contact) => {
        const phone = normalizePhone(contact.phone);
        if (!phone) return null;
        const earliestCall = earliestCallByPhone.get(phone);
        if (!earliestCall) return null;
        const createdAt = contact.created_at ? new Date(contact.created_at) : null;
        if (!createdAt || Number.isNaN(createdAt.getTime())) return null;
        const diffMinutes = Math.max(
          0,
          (earliestCall.getTime() - createdAt.getTime()) / 60000,
        );
        return {
          id: contact.id,
          name: `${contact.first_name || ""} ${contact.last_name || ""}`.trim() || "Unknown",
          phone: contact.phone,
          createdAt,
          firstCallAt: earliestCall,
          speedMinutes: diffMinutes,
        };
      })
      .filter((entry): entry is SpeedToLeadEntry => Boolean(entry))
      .sort((a, b) => a.speedMinutes - b.speedMinutes);
  }, [callRecords, contacts]);

  // ── Delegation Metrics ──

  const delegationMetrics = useMemo(() => {
    const totalDelegations = delegationAnalytics.reduce(
      (sum, row) => sum + (row.received_delegations || 0),
      0,
    );
    const totalSetters = delegationAnalytics.length;
    const avgDelegationsPerSetter = totalSetters
      ? totalDelegations / totalSetters
      : 0;
    const hotPotatoCount = hotPotatoLeads.length;
    const totalLeadsLost = delegationAnalytics.reduce(
      (sum, row) => sum + (row.leads_lost || 0),
      0,
    );
    return { totalDelegations, avgDelegationsPerSetter, hotPotatoCount, totalLeadsLost };
  }, [delegationAnalytics, hotPotatoLeads]);

  if (isLoading) {
    return <PageSkeleton variant="dashboard" />;
  }

  const handleSetterClick = (setter: SetterDetail) => {
    setSelectedSetter(setter);
    toast.info(`Viewing details for ${setter.name}`);
  };

  const handleLeadClick = (lead: SpeedToLeadEntry) => {
    setSelectedLead(lead);
    toast.info(`Viewing speed-to-lead for ${lead.name}`);
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Setter Command Center</h1>
        <p className="text-muted-foreground">
          Live call KPIs, setter leaderboard, speed-to-lead, and delegation tracking.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="calls">Call Activity</TabsTrigger>
          <TabsTrigger value="delegations">Delegation Tracking</TabsTrigger>
        </TabsList>

        {/* ── Call Activity Tab ── */}
        <TabsContent value="calls" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Total Calls Today"
              value={totalCallsToday}
              icon={Phone}
            />
            <MetricCard
              label="Avg Call Duration"
              value={formatDuration(avgCallDurationSeconds)}
              icon={Timer}
            />
            <MetricCard
              label="Connection Rate"
              value={`${(connectionRateToday ?? 0).toFixed(1)}%`}
              icon={PhoneCall}
            />
            <MetricCard
              label="Calls Per Setter"
              value={(callsPerSetter ?? 0).toFixed(1)}
              icon={Users}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Setter Leaderboard (Last 30 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Setter</TableHead>
                    <TableHead>Total Calls</TableHead>
                    <TableHead>Connected</TableHead>
                    <TableHead>Avg Duration</TableHead>
                    <TableHead>Connection Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaderboard.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center py-8 text-muted-foreground"
                      >
                        No call data available for the last 30 days.
                      </TableCell>
                    </TableRow>
                  ) : (
                    leaderboard.map((setter) => (
                      <TableRow
                        key={setter.name}
                        className="cursor-pointer transition-colors duration-200 hover:bg-muted/30"
                        onClick={() => handleSetterClick(setter)}
                      >
                        <TableCell className="font-medium">
                          {setter.name}
                        </TableCell>
                        <TableCell>{setter.total}</TableCell>
                        <TableCell>{setter.connected}</TableCell>
                        <TableCell>{formatDuration(setter.avgDuration)}</TableCell>
                        <TableCell>
                          <Badge variant={setter.connectionRate >= 50 ? "default" : setter.connectionRate >= 30 ? "secondary" : "destructive"} className="text-xs">
                            {(setter.connectionRate ?? 0).toFixed(1)}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Speed-to-Lead</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Lead Created</TableHead>
                    <TableHead>First Call</TableHead>
                    <TableHead>Speed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {speedToLead.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center py-8 text-muted-foreground"
                      >
                        No matching leads found for recent calls.
                      </TableCell>
                    </TableRow>
                  ) : (
                    speedToLead.map((entry) => (
                      <TableRow
                        key={entry.id}
                        className="cursor-pointer transition-colors duration-200 hover:bg-muted/30"
                        onClick={() => handleLeadClick(entry)}
                      >
                        <TableCell className="font-medium">
                          {entry.name}
                        </TableCell>
                        <TableCell>{entry.phone}</TableCell>
                        <TableCell>
                          {format(entry.createdAt, "MMM d, yyyy p")}
                        </TableCell>
                        <TableCell>
                          {format(entry.firstCallAt, "MMM d, yyyy p")}
                        </TableCell>
                        <TableCell>
                          <Badge variant={entry.speedMinutes <= 5 ? "default" : entry.speedMinutes <= 30 ? "secondary" : "destructive"} className="text-xs">
                            {formatMinutes(entry.speedMinutes)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Delegation Tracking Tab ── */}
        <TabsContent value="delegations" className="space-y-6">
          {loadingDelegations || loadingHotPotato ? (
            <PageSkeleton variant="dashboard" />
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  label="Total Delegations"
                  value={delegationMetrics.totalDelegations}
                  icon={ArrowRightLeft}
                />
                <MetricCard
                  label="Avg Per Setter"
                  value={(delegationMetrics.avgDelegationsPerSetter ?? 0).toFixed(1)}
                  icon={Users}
                />
                <MetricCard
                  label="Hot Potato Leads"
                  value={delegationMetrics.hotPotatoCount}
                  icon={AlertTriangle}
                />
                <MetricCard
                  label="Total Leads Lost"
                  value={delegationMetrics.totalLeadsLost}
                  icon={Shuffle}
                />
              </div>

              {/* Delegation Analytics by Setter */}
              <Card>
                <CardHeader>
                  <CardTitle>Delegation Analytics by Setter</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Setter</TableHead>
                        <TableHead>Received</TableHead>
                        <TableHead>Lost</TableHead>
                        <TableHead>Net</TableHead>
                        <TableHead>Auto</TableHead>
                        <TableHead>Manual</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {delegationAnalytics.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="text-center py-8 text-muted-foreground"
                          >
                            No delegation data available.
                          </TableCell>
                        </TableRow>
                      ) : (
                        delegationAnalytics.map((row) => (
                          <TableRow key={row.setter_id || row.setter_name}>
                            <TableCell className="font-medium">
                              {row.setter_name || "Unknown"}
                            </TableCell>
                            <TableCell>{row.received_delegations ?? 0}</TableCell>
                            <TableCell>{row.leads_lost ?? 0}</TableCell>
                            <TableCell>
                              <Badge
                                variant={(row.net_leads ?? 0) >= 0 ? "default" : "destructive"}
                                className="text-xs"
                              >
                                {(row.net_leads ?? 0) >= 0 ? "+" : ""}
                                {row.net_leads ?? 0}
                              </Badge>
                            </TableCell>
                            <TableCell>{row.auto_received ?? 0}</TableCell>
                            <TableCell>{row.manual_received ?? 0}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Hot Potato Leads */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                    Hot Potato Leads (3+ Reassignments)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Lead Name</TableHead>
                        <TableHead>Times Reassigned</TableHead>
                        <TableHead>Current Owner</TableHead>
                        <TableHead>Days Since Creation</TableHead>
                        <TableHead>Stage</TableHead>
                        <TableHead>Deal Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {hotPotatoLeads.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="text-center py-8 text-muted-foreground"
                          >
                            No hot potato leads found. Good news — leads are being handled properly.
                          </TableCell>
                        </TableRow>
                      ) : (
                        hotPotatoLeads.map((lead) => {
                          const daysSinceCreation = lead.first_assignment
                            ? differenceInDays(now, new Date(lead.first_assignment))
                            : null;
                          const currentOwner =
                            lead.owner_names && lead.owner_names.length > 0
                              ? lead.owner_names[lead.owner_names.length - 1]
                              : "Unassigned";

                          return (
                            <TableRow key={lead.contact_id}>
                              <TableCell className="font-medium">
                                {lead.contact_name || "Unknown"}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    (lead.total_delegations ?? 0) >= 5
                                      ? "destructive"
                                      : "secondary"
                                  }
                                  className="text-xs"
                                >
                                  {lead.total_delegations ?? 0}x
                                </Badge>
                              </TableCell>
                              <TableCell>{currentOwner}</TableCell>
                              <TableCell>
                                {daysSinceCreation !== null ? (
                                  <Badge
                                    variant={
                                      daysSinceCreation > 30
                                        ? "destructive"
                                        : daysSinceCreation > 14
                                          ? "secondary"
                                          : "default"
                                    }
                                    className="text-xs"
                                  >
                                    {daysSinceCreation}d
                                  </Badge>
                                ) : (
                                  "—"
                                )}
                              </TableCell>
                              <TableCell>
                                {lead.deal_stage || lead.lifecycle_stage || "—"}
                              </TableCell>
                              <TableCell>
                                {lead.deal_amount
                                  ? `AED ${lead.deal_amount.toLocaleString()}`
                                  : "—"}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Setter Detail Dialog */}
      <Dialog open={!!selectedSetter} onOpenChange={(open) => !open && setSelectedSetter(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              {selectedSetter?.name} — Performance
            </DialogTitle>
          </DialogHeader>
          {selectedSetter && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <Phone className="h-3.5 w-3.5" /> Calls Today
                  </div>
                  <p className="text-2xl font-bold">{todayCallsBySetter.get(selectedSetter.name) || 0}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <Phone className="h-3.5 w-3.5" /> Total Calls (30d)
                  </div>
                  <p className="text-2xl font-bold">{selectedSetter.total}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <TrendingUp className="h-3.5 w-3.5" /> Connection Rate
                  </div>
                  <p className={`text-2xl font-bold ${(selectedSetter.connectionRate ?? 0) >= 50 ? "text-emerald-500" : (selectedSetter.connectionRate ?? 0) >= 30 ? "text-yellow-500" : "text-red-500"}`}>
                    {(selectedSetter.connectionRate ?? 0).toFixed(1)}%
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <Clock className="h-3.5 w-3.5" /> Avg Call Duration
                  </div>
                  <p className="text-2xl font-bold">{formatDuration(selectedSetter.avgDuration)}</p>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                  <PhoneCall className="h-3.5 w-3.5" /> Connected Calls
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-lg font-bold">{selectedSetter.connected} / {selectedSetter.total}</p>
                  <Badge variant={(selectedSetter.connectionRate ?? 0) >= 50 ? "default" : "secondary"}>
                    {(selectedSetter.connectionRate ?? 0).toFixed(1)}%
                  </Badge>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                  <Timer className="h-3.5 w-3.5" /> Total Talk Time (30d)
                </div>
                <p className="text-lg font-bold">{formatMinutes(selectedSetter.totalDuration / 60)}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Speed-to-Lead Detail Dialog */}
      <Dialog open={!!selectedLead} onOpenChange={(open) => !open && setSelectedLead(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Timer className="h-5 w-5 text-primary" />
              {selectedLead?.name} — Speed to Lead
            </DialogTitle>
          </DialogHeader>
          {selectedLead && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">Lead Created</p>
                  <p className="font-medium">{format(selectedLead.createdAt, "MMM d, yyyy p")}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">First Call</p>
                  <p className="font-medium">{format(selectedLead.firstCallAt, "MMM d, yyyy p")}</p>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground mb-1">Response Time</p>
                <p className={`text-2xl font-bold ${selectedLead.speedMinutes <= 5 ? "text-emerald-500" : selectedLead.speedMinutes <= 30 ? "text-yellow-500" : "text-red-500"}`}>
                  {formatMinutes(selectedLead.speedMinutes)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedLead.speedMinutes <= 5 ? "⚡ Excellent — within 5 minutes" : selectedLead.speedMinutes <= 30 ? "⚠️ Acceptable — aim for under 5 min" : "🔴 Too slow — leads go cold after 30 min"}
                </p>
              </div>
              {selectedLead.phone && (
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">Phone</p>
                  <p className="font-mono">{selectedLead.phone}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
