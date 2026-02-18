import { useMemo, useState } from "react";
import { subDays, startOfDay, endOfDay, format } from "date-fns";
import { Phone, Users, Timer, PhoneCall, Clock, TrendingUp, BarChart3 } from "lucide-react";
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
  caller_name?: string | null;
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

const getSetterName = (call: { caller_name?: string | null; owner_name?: string | null }) =>
  call.caller_name || call.owner_name || "Unknown";

export default function SetterCommandCenter() {
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
        .select("*")
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
          Live call KPIs, setter leaderboard, and speed-to-lead visibility.
        </p>
      </div>

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
          value={`${connectionRateToday.toFixed(1)}%`}
          icon={PhoneCall}
        />
        <MetricCard
          label="Calls Per Setter"
          value={callsPerSetter.toFixed(1)}
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
                        {setter.connectionRate.toFixed(1)}%
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
                  <p className={`text-2xl font-bold ${selectedSetter.connectionRate >= 50 ? "text-emerald-500" : selectedSetter.connectionRate >= 30 ? "text-yellow-500" : "text-red-500"}`}>
                    {selectedSetter.connectionRate.toFixed(1)}%
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
                  <Badge variant={selectedSetter.connectionRate >= 50 ? "default" : "secondary"}>
                    {selectedSetter.connectionRate.toFixed(1)}%
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
