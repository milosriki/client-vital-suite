import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  RefreshCw, MapPin, Clock, Navigation, AlertTriangle, Loader2,
  Battery, TrendingUp, Route, Users, Download, Timer, Brain,
  MessageSquarePlus, CheckCircle2, XCircle, ChevronDown, ChevronUp,
  Zap, Target, Car, Activity, StickyNote, Send, Filter,
  ShieldCheck, ShieldAlert, ShieldX, TrendingDown, BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import { useDedupedQuery } from "@/hooks/useDedupedQuery";
import { format, subDays, differenceInMinutes, parseISO } from "date-fns";

// ── Types ──
interface Device {
  tinymdm_device_id: string;
  device_name: string;
  coach_name: string;
  battery_level: number | null;
  is_online: boolean;
  os_version: string | null;
  manufacturer: string | null;
  last_sync_at: string | null;
  last_lat: number | null;
  last_lng: number | null;
  last_address: string | null;
  last_location_at: string | null;
  user_id: string | null;
}

interface LocationEvent {
  id: string;
  device_id: string;
  recorded_at: string;
  lat: number;
  lng: number;
  address: string | null;
}

interface CoachVisit {
  id: string;
  device_id: string;
  coach_name: string | null;
  location_name: string;
  latitude: number;
  longitude: number;
  arrival_time: string;
  departure_time: string;
  dwell_minutes: number;
  is_ptd_location: boolean;
  created_at: string;
}

interface Note {
  id: string;
  entity_type: string;
  entity_name: string;
  entity_id: string | null;
  note: string;
  note_type: string;
  created_by: string;
  created_at: string;
  is_resolved: boolean;
}

interface CoachGpsPattern {
  coach_name: string;
  analysis_date: string;
  total_sessions: number;
  gps_verified: number;
  gps_mismatch: number;
  no_gps: number;
  ghost_session_count: number;
  late_arrival_count: number;
  early_departure_count: number;
  avg_arrival_offset_min: number;
  avg_dwell_vs_scheduled_min: number;
  verification_rate: number;
  pattern_score: number;
  risk_level: string; // normal | review | critical
  anomalies: Record<string, unknown>[];
}

interface IntelligenceData {
  summary: {
    date_range: string;
    coaches_analyzed: number;
    total_days_analyzed: number;
    avg_utilization: number;
    total_insights: number;
    total_predictions: number;
    critical_alerts: string[];
  };
  analytics: {
    coach_name: string;
    device_id: string;
    date: string;
    total_gps_points: number;
    first_ping: string;
    last_ping: string;
    active_hours: number;
    dwell_clusters: { centroidLat: number; centroidLng: number; address: string; startTime: string; endTime: string; durationMin: number; pointCount: number }[];
    total_dwell_min: number;
    total_travel_min: number;
    total_idle_min: number;
    sessions_scheduled: number;
    sessions_completed: number;
    sessions_cancelled: number;
    utilization_pct: number;
    travel_km: number;
    insights: string[];
    predictions: string[];
  }[];
}

// ── Helpers ──
function getBatteryColor(level: number | null) {
  if (!level) return "text-muted-foreground";
  if (level > 60) return "text-green-500";
  if (level > 30) return "text-yellow-500";
  return "text-red-500";
}

function formatDubaiTime(utcStr: string) {
  const d = new Date(utcStr);
  const dubai = new Date(d.getTime() + 4 * 60 * 60 * 1000);
  return format(dubai, "h:mm a");
}

function formatDubaiDateTime(utcStr: string) {
  const d = new Date(utcStr);
  const dubai = new Date(d.getTime() + 4 * 60 * 60 * 1000);
  return format(dubai, "MMM d, h:mm a");
}

function shortAddress(addr: string | null) {
  if (!addr) return "—";
  const parts = addr.split(" - ");
  return parts.length > 1 ? `${parts[0].slice(0, 30)} · ${parts[1].slice(0, 25)}` : addr.slice(0, 55);
}

function getUtilColor(pct: number) {
  if (pct >= 75) return "text-green-600";
  if (pct >= 50) return "text-yellow-600";
  return "text-red-600";
}

function getNoteTypeColor(type: string) {
  switch (type) {
    case "concern": return "destructive";
    case "positive": return "default";
    case "action_item": return "secondary";
    case "follow_up": return "outline";
    default: return "secondary";
  }
}

// ── Map Component (Leaflet) ──
function LocationMap({ events, selectedCoach, deviceNameMap }: {
  events: LocationEvent[];
  selectedCoach: string | null;
  deviceNameMap: Map<string, string>;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const layerGroup = useRef<any>(null);
  const heatLayer = useRef<any>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const loadLeaflet = async () => {
      if (!(window as any).L) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
        await new Promise<void>((r) => {
          const s = document.createElement("script");
          s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
          s.onload = () => r();
          document.head.appendChild(s);
        });
        await new Promise<void>((r) => {
          const s = document.createElement("script");
          s.src = "https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js";
          s.onload = () => r();
          document.head.appendChild(s);
        });
      }
      const L = (window as any).L;
      if (!mapRef.current || mapInstance.current) return;
      mapInstance.current = L.map(mapRef.current).setView([25.2048, 55.2708], 12);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
      }).addTo(mapInstance.current);
      layerGroup.current = L.layerGroup().addTo(mapInstance.current);
    };
    loadLeaflet();
    return () => {
      if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null; }
    };
  }, []);

  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapInstance.current || !layerGroup.current) return;
    layerGroup.current.clearLayers();
    if (heatLayer.current) { mapInstance.current.removeLayer(heatLayer.current); heatLayer.current = null; }

    const filtered = selectedCoach ? events.filter((e) => e.device_id === selectedCoach) : events;
    if (filtered.length === 0) return;

    const latest = new Map<string, LocationEvent>();
    for (const evt of filtered) {
      const ex = latest.get(evt.device_id);
      if (!ex || new Date(evt.recorded_at) > new Date(ex.recorded_at)) latest.set(evt.device_id, evt);
    }

    const colors = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316", "#84cc16", "#14b8a6"];
    let ci = 0;
    for (const [devId, evt] of latest) {
      const color = colors[ci++ % colors.length];
      const name = deviceNameMap.get(devId) || devId;
      L.circleMarker([evt.lat, evt.lng], {
        radius: 10, fillColor: color, color: "#fff", weight: 2, opacity: 1, fillOpacity: 0.9,
      }).bindPopup(`<b>${name}</b><br>${formatDubaiTime(evt.recorded_at)}<br>${shortAddress(evt.address)}`).addTo(layerGroup.current);

      const trail = filtered.filter(e => e.device_id === devId).sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
      if (trail.length > 1) {
        const latlngs = trail.map(e => [e.lat, e.lng]);
        L.polyline(latlngs, { color, weight: 2, opacity: 0.4, dashArray: "5,5" }).addTo(layerGroup.current);
      }
    }

    const heatData = filtered.map((e) => [e.lat, e.lng, 0.5]);
    heatLayer.current = (L as any).heatLayer(heatData, {
      radius: 25, blur: 15, maxZoom: 17,
      gradient: { 0.4: "blue", 0.6: "cyan", 0.7: "lime", 0.8: "yellow", 1: "red" },
    }).addTo(mapInstance.current);

    const bounds = L.latLngBounds(filtered.map((e) => [e.lat, e.lng]));
    mapInstance.current.fitBounds(bounds, { padding: [30, 30] });
  }, [events, selectedCoach, deviceNameMap]);

  return <div ref={mapRef} className="h-[400px] md:h-[550px] w-full rounded-lg" />;
}

// ── Pattern Detection ──
function detectPatterns(events: LocationEvent[], devices: Device[]) {
  const nameMap = new Map(devices.map(d => [d.tinymdm_device_id, d.coach_name]));
  const byCoach = new Map<string, LocationEvent[]>();
  for (const e of events) {
    const name = nameMap.get(e.device_id) || e.device_id;
    if (!byCoach.has(name)) byCoach.set(name, []);
    byCoach.get(name)!.push(e);
  }

  const patterns: { type: string; severity: "high" | "medium" | "low"; coach: string; detail: string }[] = [];

  for (const [coach, pts] of byCoach) {
    if (coach.startsWith("SM-")) continue;
    const sorted = [...pts].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));

    for (let i = 1; i < sorted.length; i++) {
      const gap = differenceInMinutes(parseISO(sorted[i].recorded_at), parseISO(sorted[i - 1].recorded_at));
      if (gap > 120) {
        patterns.push({
          type: "idle_gap",
          severity: gap > 240 ? "high" : "medium",
          coach,
          detail: `${Math.round(gap / 60)}h gap on ${format(parseISO(sorted[i - 1].recorded_at), "MMM d")} (${formatDubaiTime(sorted[i - 1].recorded_at)} → ${formatDubaiTime(sorted[i].recorded_at)})`,
        });
      }
    }

    const addrCount = new Map<string, number>();
    for (const e of pts) {
      if (e.address) {
        const key = e.address.split(" - ")[0].slice(0, 30);
        addrCount.set(key, (addrCount.get(key) || 0) + 1);
      }
    }
    const topAddr = [...addrCount.entries()].sort((a, b) => b[1] - a[1])[0];
    if (topAddr && topAddr[1] > pts.length * 0.6) {
      patterns.push({
        type: "low_movement",
        severity: topAddr[1] > pts.length * 0.8 ? "high" : "medium",
        coach,
        detail: `${Math.round(topAddr[1] / pts.length * 100)}% of time at "${topAddr[0]}" — possibly not visiting clients`,
      });
    }

    const days = new Map<string, number>();
    for (const e of pts) {
      const day = e.recorded_at.slice(0, 10);
      days.set(day, (days.get(day) || 0) + 1);
    }
    for (const [day, count] of days) {
      if (count < 5) {
        patterns.push({
          type: "low_activity",
          severity: count < 3 ? "high" : "low",
          coach,
          detail: `Only ${count} GPS points on ${day} — device may be off or coach inactive`,
        });
      }
    }
  }

  return patterns.sort((a, b) => {
    const sev = { high: 0, medium: 1, low: 2 };
    return sev[a.severity] - sev[b.severity];
  });
}

// ── Coach Report Builder ──
function buildCoachReport(events: LocationEvent[], devices: Device[]) {
  const nameMap = new Map(devices.map(d => [d.tinymdm_device_id, d.coach_name]));
  const byCoach = new Map<string, LocationEvent[]>();
  for (const e of events) {
    const name = nameMap.get(e.device_id) || e.device_id;
    if (name.startsWith("SM-")) continue;
    if (!byCoach.has(name)) byCoach.set(name, []);
    byCoach.get(name)!.push(e);
  }

  return [...byCoach.entries()].map(([coach, pts]) => {
    const sorted = [...pts].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
    const days = new Set(pts.map(e => e.recorded_at.slice(0, 10)));
    const addresses = pts.filter(e => e.address).map(e => e.address!);
    const uniqueStops = new Set(addresses.map(a => a.split(" - ")[0].slice(0, 30)));

    const areaCount = new Map<string, number>();
    for (const a of addresses) {
      const parts = a.split(" - ");
      const area = (parts[1] || parts[0]).trim().slice(0, 30);
      areaCount.set(area, (areaCount.get(area) || 0) + 1);
    }
    const topAreas = [...areaCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

    const firstUTC = sorted[0]?.recorded_at;
    const lastUTC = sorted[sorted.length - 1]?.recorded_at;

    let transitions = 0;
    let prevAddr = "";
    for (const e of sorted) {
      const addr = (e.address || "").split(" - ")[0].slice(0, 30);
      if (addr && addr !== prevAddr) { transitions++; prevAddr = addr; }
    }

    return {
      coach,
      totalPoints: pts.length,
      activeDays: days.size,
      uniqueStops: uniqueStops.size,
      topAreas,
      firstSeen: firstUTC ? formatDubaiTime(firstUTC) : "—",
      lastSeen: lastUTC ? formatDubaiTime(lastUTC) : "—",
      transitions,
      device: devices.find(d => d.coach_name === coach),
    };
  }).sort((a, b) => b.totalPoints - a.totalPoints);
}

// ── Hotspot Builder ──
function buildHotspots(events: LocationEvent[], devices: Device[]) {
  const nameMap = new Map(devices.map(d => [d.tinymdm_device_id, d.coach_name]));
  const areaData = new Map<string, { count: number; coaches: Set<string> }>();
  for (const e of events) {
    if (!e.address) continue;
    const parts = e.address.split(" - ");
    const area = (parts[1] || parts[0]).trim();
    if (!areaData.has(area)) areaData.set(area, { count: 0, coaches: new Set() });
    const d = areaData.get(area)!;
    d.count++;
    d.coaches.add(nameMap.get(e.device_id) || "Unknown");
  }
  return [...areaData.entries()]
    .map(([area, d]) => ({ area, count: d.count, coaches: [...d.coaches].filter(c => !c.startsWith("SM-")).sort() }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
}

// ── CSV Exports ──
function exportCSV(report: ReturnType<typeof buildCoachReport>) {
  const header = "Coach,Points,Days,Stops,Top Area 1,Top Area 2,First Seen,Last Seen\n";
  const rows = report.map(r =>
    `"${r.coach}",${r.totalPoints},${r.activeDays},${r.uniqueStops},"${r.topAreas[0]?.[0] || ""}","${r.topAreas[1]?.[0] || ""}","${r.firstSeen}","${r.lastSeen}"`
  ).join("\n");
  const blob = new Blob([header + rows], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `coach-locations-${format(new Date(), "yyyy-MM-dd")}.csv`; a.click();
}

// ── Notes Component ──
function NotesPanel({ coachName }: { coachName?: string }) {
  const [newNote, setNewNote] = useState("");
  const [noteType, setNoteType] = useState("general");
  const [entityType, setEntityType] = useState<"coach" | "client">("coach");
  const [entityName, setEntityName] = useState(coachName || "");
  const [submitting, setSubmitting] = useState(false);
  const [filterCoach, setFilterCoach] = useState(coachName || "");

  const { data: notes, refetch: refetchNotes } = useDedupedQuery({
    queryKey: ["coach-notes", filterCoach],
    queryFn: async () => {
      let q = supabase
        .from("coach_client_notes")
        .select("id, entity_type, entity_name, entity_id, note, note_type, created_by, created_at, is_resolved")
        .order("created_at", { ascending: false })
        .limit(100);
      if (filterCoach) {
        q = q.ilike("entity_name", `%${filterCoach}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as Note[];
    },
  });

  useEffect(() => {
    if (coachName) {
      setEntityName(coachName);
      setFilterCoach(coachName);
    }
  }, [coachName]);

  const handleSubmit = async () => {
    if (!newNote.trim() || !entityName.trim()) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("coach_client_notes").insert({
        entity_type: entityType,
        entity_name: entityName.trim(),
        note: newNote.trim(),
        note_type: noteType,
        created_by: "team_leader",
      });
      if (error) throw error;
      setNewNote("");
      toast.success("Note added");
      refetchNotes();
    } catch (err) {
      toast.error("Failed to add note: " + (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleResolved = async (noteId: string, currentVal: boolean) => {
    const { error } = await supabase
      .from("coach_client_notes")
      .update({ is_resolved: !currentVal, resolved_at: !currentVal ? new Date().toISOString() : null })
      .eq("id", noteId);
    if (error) { toast.error("Update failed"); return; }
    refetchNotes();
  };

  return (
    <div className="space-y-4">
      {/* Add note form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageSquarePlus className="h-4 w-4" />
            Add Note
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <Select value={entityType} onValueChange={(v) => setEntityType(v as "coach" | "client")}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="coach">Coach</SelectItem>
                <SelectItem value="client">Client</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Name..."
              value={entityName}
              onChange={(e) => setEntityName(e.target.value)}
              className="flex-1 min-w-[150px]"
            />
            <Select value={noteType} onValueChange={setNoteType}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="general">📝 General</SelectItem>
                <SelectItem value="concern">⚠️ Concern</SelectItem>
                <SelectItem value="positive">✅ Positive</SelectItem>
                <SelectItem value="action_item">🎯 Action Item</SelectItem>
                <SelectItem value="follow_up">📞 Follow Up</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Textarea
            placeholder="Add a note... (e.g., 'Coach said client Rula will return next month')"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            rows={2}
          />
          <Button
            onClick={handleSubmit}
            disabled={submitting || !newNote.trim() || !entityName.trim()}
            size="sm"
          >
            <Send className="h-4 w-4 mr-1" />
            {submitting ? "Saving..." : "Add Note"}
          </Button>
        </CardContent>
      </Card>

      {/* Filter */}
      <div className="flex gap-2 items-center">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Filter by name..."
          value={filterCoach}
          onChange={(e) => setFilterCoach(e.target.value)}
          className="max-w-[250px]"
        />
        {filterCoach && (
          <Button variant="ghost" size="sm" onClick={() => setFilterCoach("")}>
            Clear
          </Button>
        )}
        <Badge variant="outline">{(notes || []).length} notes</Badge>
      </div>

      {/* Notes list */}
      <div className="space-y-2 max-h-[500px] overflow-y-auto">
        {(notes || []).length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No notes yet. Add the first one above.</p>
        ) : (
          (notes || []).map((n) => (
            <Card key={n.id} className={`${n.is_resolved ? "opacity-60" : ""} transition-all`}>
              <CardContent className="py-3 px-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge variant={getNoteTypeColor(n.note_type)} className="text-xs">
                        {n.note_type === "concern" ? "⚠️" : n.note_type === "positive" ? "✅" : n.note_type === "action_item" ? "🎯" : n.note_type === "follow_up" ? "📞" : "📝"} {n.note_type}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {n.entity_type === "coach" ? "🏋️" : "👤"} {n.entity_name}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDubaiDateTime(n.created_at)}
                      </span>
                    </div>
                    <p className={`text-sm ${n.is_resolved ? "line-through" : ""}`}>{n.note}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleResolved(n.id, n.is_resolved)}
                    className="shrink-0"
                  >
                    {n.is_resolved ? (
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

// ── GPS Pattern Panel ──
function GpsPatternPanel({
  patterns,
  loading,
  onRunAnalyzer,
  running,
}: {
  patterns: CoachGpsPattern[];
  loading: boolean;
  onRunAnalyzer: () => void;
  running: boolean;
}) {
  const [expandedCoach, setExpandedCoach] = useState<string | null>(null);

  function getRiskBadge(risk: string) {
    if (risk === "critical") return <Badge variant="destructive" className="text-xs"><ShieldX className="h-3 w-3 mr-1" />Critical</Badge>;
    if (risk === "review")   return <Badge className="text-xs bg-yellow-500 hover:bg-yellow-600"><ShieldAlert className="h-3 w-3 mr-1" />Review</Badge>;
    return <Badge variant="secondary" className="text-xs"><ShieldCheck className="h-3 w-3 mr-1" />Normal</Badge>;
  }

  function getScoreColor(score: number) {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  }

  const critical = patterns.filter(p => p.risk_level === "critical");
  const review   = patterns.filter(p => p.risk_level === "review");
  const normal   = patterns.filter(p => p.risk_level === "normal");
  const avgScore = patterns.length > 0 ? Math.round(patterns.reduce((s, p) => s + p.pattern_score, 0) / patterns.length) : 0;
  const totalGhosts = patterns.reduce((s, p) => s + p.ghost_session_count, 0);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex gap-2 items-center flex-wrap">
        <Button onClick={onRunAnalyzer} disabled={running} size="sm">
          <BarChart3 className={`h-4 w-4 mr-1 ${running ? "animate-spin" : ""}`} />
          {running ? "Analyzing..." : "Run GPS Pattern Analysis"}
        </Button>
        {patterns.length > 0 && (
          <span className="text-xs text-muted-foreground">
            Last analysis: {patterns[0]?.analysis_date}
          </span>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Avg Trust Score</p>
            <p className={`text-2xl font-bold ${getScoreColor(avgScore)}`}>{avgScore}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">🚨 Critical</p>
            <p className="text-2xl font-bold text-red-600">{critical.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">⚠️ Under Review</p>
            <p className="text-2xl font-bold text-yellow-600">{review.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">✅ Normal</p>
            <p className="text-2xl font-bold text-green-600">{normal.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">👻 Ghost Sessions</p>
            <p className="text-2xl font-bold text-red-600">{totalGhosts}</p>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
      ) : patterns.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-40" />
            <p className="text-muted-foreground">No pattern data yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Click "Run GPS Pattern Analysis" to analyze 30 days of coach behavior.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> Coach Trust Leaderboard (30-Day GPS Pattern Score)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Coach</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead className="text-right hidden md:table-cell">Verify%</TableHead>
                    <TableHead className="text-right hidden md:table-cell">Sessions</TableHead>
                    <TableHead className="text-right hidden md:table-cell">👻</TableHead>
                    <TableHead className="text-right hidden lg:table-cell">Late</TableHead>
                    <TableHead className="text-right hidden lg:table-cell">Early Out</TableHead>
                    <TableHead className="hidden lg:table-cell">Avg Arrival</TableHead>
                    <TableHead className="w-[40px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...patterns].sort((a, b) => a.pattern_score - b.pattern_score).map((p) => (
                    <>
                      <TableRow
                        key={p.coach_name}
                        className="cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() => setExpandedCoach(expandedCoach === p.coach_name ? null : p.coach_name)}
                      >
                        <TableCell className="font-medium text-xs md:text-sm">{p.coach_name}</TableCell>
                        <TableCell className={`text-right font-bold font-mono ${getScoreColor(p.pattern_score)}`}>
                          {p.pattern_score}
                        </TableCell>
                        <TableCell>{getRiskBadge(p.risk_level)}</TableCell>
                        <TableCell className={`text-right font-mono hidden md:table-cell ${p.verification_rate < 60 ? "text-red-600" : p.verification_rate < 80 ? "text-yellow-600" : "text-green-600"}`}>
                          {p.verification_rate}%
                        </TableCell>
                        <TableCell className="text-right hidden md:table-cell">
                          <span className="text-green-600">{p.gps_verified}</span>
                          <span className="text-muted-foreground">/{p.total_sessions}</span>
                        </TableCell>
                        <TableCell className={`text-right hidden md:table-cell font-mono ${p.ghost_session_count > 0 ? "text-red-600 font-bold" : "text-muted-foreground"}`}>
                          {p.ghost_session_count}
                        </TableCell>
                        <TableCell className={`text-right hidden lg:table-cell font-mono ${p.late_arrival_count > 2 ? "text-yellow-600" : ""}`}>
                          {p.late_arrival_count}
                        </TableCell>
                        <TableCell className={`text-right hidden lg:table-cell font-mono ${p.early_departure_count > 2 ? "text-yellow-600" : ""}`}>
                          {p.early_departure_count}
                        </TableCell>
                        <TableCell className={`hidden lg:table-cell font-mono text-xs ${p.avg_arrival_offset_min > 10 ? "text-red-600" : p.avg_arrival_offset_min < -5 ? "text-green-600" : ""}`}>
                          {p.avg_arrival_offset_min > 0 ? "+" : ""}{p.avg_arrival_offset_min}m
                        </TableCell>
                        <TableCell>
                          {expandedCoach === p.coach_name ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </TableCell>
                      </TableRow>
                      {expandedCoach === p.coach_name && (
                        <TableRow key={`${p.coach_name}-detail`}>
                          <TableCell colSpan={10} className="bg-muted/20 p-4">
                            <div className="space-y-3">
                              {/* Mobile stats */}
                              <div className="grid grid-cols-4 gap-2 md:hidden text-center text-xs">
                                <div><p className="text-muted-foreground">Verify</p><p className="font-mono">{p.verification_rate}%</p></div>
                                <div><p className="text-muted-foreground">Sessions</p><p className="font-mono">{p.gps_verified}/{p.total_sessions}</p></div>
                                <div><p className="text-muted-foreground">👻 Ghost</p><p className={`font-mono font-bold ${p.ghost_session_count > 0 ? "text-red-600" : ""}`}>{p.ghost_session_count}</p></div>
                                <div><p className="text-muted-foreground">Arrival</p><p className="font-mono">{p.avg_arrival_offset_min > 0 ? "+" : ""}{p.avg_arrival_offset_min}m</p></div>
                              </div>
                              {/* Anomalies */}
                              {p.anomalies.length > 0 && (
                                <div className="space-y-1">
                                  <p className="text-xs font-semibold mb-2">Detected Anomalies & Predictions</p>
                                  <div className="max-h-[200px] overflow-y-auto space-y-1">
                                    {p.anomalies.map((a, i) => {
                                      const isPred = (a as Record<string, unknown>).is_prediction;
                                      const aType = (a as Record<string, unknown>).type as string;
                                      const detail = (a as Record<string, unknown>).detail as string;
                                      const icon = isPred ? "🔮" : aType === "ghost_session" ? "👻" : aType === "late_arrival" ? "⏰" : aType === "early_departure" ? "🏃" : aType === "location_mismatch" ? "📍" : "⚡";
                                      return (
                                        <p key={i} className={`text-xs ml-2 ${isPred ? "text-blue-700" : aType === "ghost_session" ? "text-red-700" : "text-yellow-700"}`}>
                                          {icon} <span className="font-mono">[{aType}]</span> {detail}
                                        </p>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Intelligence Panel ──
function IntelligencePanel({ dateRange, selectedCoachName }: { dateRange: number; selectedCoachName: string | null }) {
  const [intel, setIntel] = useState<IntelligenceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedCoach, setExpandedCoach] = useState<string | null>(null);

  const fetchIntel = useCallback(async () => {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token ?? "";
      const body: Record<string, unknown> = {
        date: new Date().toISOString().split("T")[0],
        days_back: dateRange,
      };
      if (selectedCoachName) body.coach_name = selectedCoachName;

      const res = await fetch(
        "https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/coach-intelligence-engine",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        }
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setIntel(data);
    } catch (err) {
      toast.error("Intelligence fetch failed: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [dateRange, selectedCoachName]);

  useEffect(() => {
    fetchIntel();
  }, [fetchIntel]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin mr-2" />
        <span>Analyzing coach intelligence...</span>
      </div>
    );
  }

  if (!intel) return null;

  // Aggregate by coach
  const coachAgg = new Map<string, {
    days: number; util: number[]; km: number[]; sched: number; done: number;
    cancel: number; insights: string[]; predictions: string[];
    dwellMin: number; travelMin: number; idleMin: number;
  }>();

  for (const day of intel.analytics) {
    if (!coachAgg.has(day.coach_name)) {
      coachAgg.set(day.coach_name, {
        days: 0, util: [], km: [], sched: 0, done: 0, cancel: 0,
        insights: [], predictions: [], dwellMin: 0, travelMin: 0, idleMin: 0,
      });
    }
    const c = coachAgg.get(day.coach_name)!;
    c.days++;
    c.util.push(day.utilization_pct);
    c.km.push(day.travel_km);
    c.sched += day.sessions_scheduled;
    c.done += day.sessions_completed;
    c.cancel += day.sessions_cancelled;
    c.insights.push(...day.insights);
    c.predictions.push(...day.predictions);
    c.dwellMin += day.total_dwell_min;
    c.travelMin += day.total_travel_min;
    c.idleMin += day.total_idle_min;
  }

  const coaches = [...coachAgg.entries()]
    .map(([name, c]) => ({
      name,
      ...c,
      avgUtil: c.util.length > 0 ? Math.round(c.util.reduce((s, v) => s + v, 0) / c.util.length) : 0,
      avgKm: c.km.length > 0 ? Math.round(c.km.reduce((s, v) => s + v, 0) / c.km.length) : 0,
      completionRate: c.sched > 0 ? Math.round((c.done / c.sched) * 100) : 0,
    }))
    .sort((a, b) => a.avgUtil - b.avgUtil);

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Coaches Analyzed</p>
            <p className="text-2xl font-bold">{intel.summary.coaches_analyzed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Avg Utilization</p>
            <p className={`text-2xl font-bold ${getUtilColor(intel.summary.avg_utilization)}`}>
              {intel.summary.avg_utilization}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Days Analyzed</p>
            <p className="text-2xl font-bold">{intel.summary.total_days_analyzed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Insights</p>
            <p className="text-2xl font-bold text-yellow-600">{intel.summary.total_insights}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Critical Alerts</p>
            <p className="text-2xl font-bold text-red-600">{intel.summary.critical_alerts.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Critical alerts */}
      {intel.summary.critical_alerts.length > 0 && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-red-700 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Critical Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-[200px] overflow-y-auto">
              {[...new Set(intel.summary.critical_alerts)].map((alert, i) => (
                <p key={i} className="text-xs text-red-700">{alert}</p>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Coach-by-coach breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Brain className="h-4 w-4" /> Coach Intelligence Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Coach</TableHead>
                  <TableHead className="text-right">Util %</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Km/Day</TableHead>
                  <TableHead className="text-right">Sessions</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Completion</TableHead>
                  <TableHead className="text-right hidden lg:table-cell">Dwell</TableHead>
                  <TableHead className="text-right hidden lg:table-cell">Idle</TableHead>
                  <TableHead className="w-[40px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coaches.map((c) => (
                  <>
                    <TableRow
                      key={c.name}
                      className="cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => setExpandedCoach(expandedCoach === c.name ? null : c.name)}
                    >
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className={`text-right font-mono ${getUtilColor(c.avgUtil)}`}>
                        {c.avgUtil}%
                      </TableCell>
                      <TableCell className="text-right font-mono hidden md:table-cell">
                        {c.avgKm}km
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-green-600">{c.done}</span>
                        <span className="text-muted-foreground">/{c.sched}</span>
                        {c.cancel > 0 && <span className="text-red-500 ml-1">(-{c.cancel})</span>}
                      </TableCell>
                      <TableCell className={`text-right font-mono hidden md:table-cell ${c.completionRate < 70 ? "text-red-600" : "text-green-600"}`}>
                        {c.completionRate}%
                      </TableCell>
                      <TableCell className="text-right text-xs hidden lg:table-cell">
                        {Math.round(c.dwellMin / 60)}h
                      </TableCell>
                      <TableCell className="text-right text-xs hidden lg:table-cell">
                        {Math.round(c.idleMin / 60)}h
                      </TableCell>
                      <TableCell>
                        {expandedCoach === c.name ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </TableCell>
                    </TableRow>
                    {expandedCoach === c.name && (
                      <TableRow key={`${c.name}-detail`}>
                        <TableCell colSpan={8} className="bg-muted/20 p-4">
                          <div className="space-y-3">
                            {/* Mobile-visible stats */}
                            <div className="grid grid-cols-3 gap-2 md:hidden">
                              <div className="text-center">
                                <p className="text-xs text-muted-foreground">Km/Day</p>
                                <p className="font-mono">{c.avgKm}km</p>
                              </div>
                              <div className="text-center">
                                <p className="text-xs text-muted-foreground">Completion</p>
                                <p className="font-mono">{c.completionRate}%</p>
                              </div>
                              <div className="text-center">
                                <p className="text-xs text-muted-foreground">Idle</p>
                                <p className="font-mono">{Math.round(c.idleMin / 60)}h</p>
                              </div>
                            </div>
                            {c.insights.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-yellow-700 mb-1">⚡ Insights</p>
                                {[...new Set(c.insights)].map((ins, i) => (
                                  <p key={i} className="text-xs text-yellow-700 ml-4">• {ins}</p>
                                ))}
                              </div>
                            )}
                            {c.predictions.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-blue-700 mb-1">🔮 Predictions</p>
                                {[...new Set(c.predictions)].map((pred, i) => (
                                  <p key={i} className="text-xs text-blue-700 ml-4">• {pred}</p>
                                ))}
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main Page ──
export default function CoachLocations() {
  const [dateRange, setDateRange] = useState(3);
  const [selectedCoach, setSelectedCoach] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const since = useMemo(() => subDays(new Date(), dateRange).toISOString(), [dateRange]);

  const { data: devices, isLoading: devicesLoading, refetch: refetchDevices } = useDedupedQuery({
    queryKey: ["mdm-devices"],
    queryFn: async () => {
      const { data, error } = await supabase.from("mdm_devices").select("tinymdm_device_id,device_name,coach_name,battery_level,is_online,os_version,manufacturer,last_sync_at,last_lat,last_lng,last_address,last_location_at,user_id");
      if (error) throw error;
      return (data || []) as Device[];
    },
  });

  const { data: events, isLoading: eventsLoading, refetch: refetchEvents } = useDedupedQuery({
    queryKey: ["mdm-locations", since],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mdm_location_events")
        .select("id,device_id,recorded_at,lat,lng,address")
        .gte("recorded_at", since)
        .order("recorded_at", { ascending: false })
        .limit(15000);
      if (error) throw error;
      return (data || []) as LocationEvent[];
    },
  });

  const { data: dwellVisits, isLoading: dwellLoading, refetch: refetchDwell } = useDedupedQuery({
    queryKey: ["mdm-visits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mdm_visits")
        .select("id, device_id, coach_name, location_name, latitude, longitude, arrival_time, departure_time, dwell_minutes, is_ptd_location, created_at")
        .order("arrival_time", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data || []) as CoachVisit[];
    },
  });

  // GPS Pattern data from coach_gps_patterns
  const { data: gpsPatterns, isLoading: patternsLoading, refetch: refetchPatterns } = useDedupedQuery({
    queryKey: ["coach-gps-patterns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("view_coach_pattern_latest")
        .select("coach_name,analysis_date,total_sessions,gps_verified,gps_mismatch,no_gps,ghost_session_count,late_arrival_count,early_departure_count,avg_arrival_offset_min,avg_dwell_vs_scheduled_min,verification_rate,pattern_score,risk_level,anomalies")
        .order("pattern_score", { ascending: true });
      if (error) {
        console.warn("GPS patterns query failed (view may not exist yet):", error.message);
        return [] as CoachGpsPattern[];
      }
      return (data || []) as CoachGpsPattern[];
    },
  });

  const [patternRunning, setPatternRunning] = useState(false);
  const runPatternAnalyzer = useCallback(async () => {
    setPatternRunning(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token ?? "";
      const res = await fetch("https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/gps-pattern-analyzer", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ days_back: 30 }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success(`Pattern analysis complete — ${result.coaches_analyzed} coaches, ${result.critical_coaches} critical`);
        refetchPatterns();
      } else {
        toast.error("Pattern analysis failed: " + (result.error || "unknown"));
      }
    } catch {
      toast.error("Pattern analyzer request failed");
    } finally {
      setPatternRunning(false);
    }
  }, [refetchPatterns]);

  // Build pattern score lookup for report tab (coach_name → pattern)
  const patternByCoach = useMemo(() => {
    const map = new Map<string, CoachGpsPattern>();
    for (const p of gpsPatterns || []) {
      map.set(p.coach_name, p);
    }
    return map;
  }, [gpsPatterns]);

  const [dwellProcessing, setDwellProcessing] = useState(false);
  const runDwellEngine = useCallback(async () => {
    setDwellProcessing(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token ?? "";
      const res = await fetch("https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/gps-dwell-engine", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const result = await res.json();
      if (result.success) {
        toast.success(`Dwell engine: ${result.total_visits || 0} visits processed`);
        refetchDwell();
      } else {
        toast.error("Dwell engine failed: " + (result.error || "unknown"));
      }
    } catch {
      toast.error("Dwell engine request failed");
    } finally {
      setDwellProcessing(false);
    }
  }, [refetchDwell]);

  const dwellSummary = useMemo(() => {
    const visits = dwellVisits || [];
    const ptdHours = Math.round(visits.filter(v => v.is_ptd_location).reduce((s, v) => s + (v.dwell_minutes || 0), 0) / 60);
    const extHours = Math.round(visits.filter(v => !v.is_ptd_location).reduce((s, v) => s + (v.dwell_minutes || 0), 0) / 60);
    const avgSession = visits.length > 0 ? Math.round(visits.reduce((s, v) => s + (v.dwell_minutes || 0), 0) / visits.length) : 0;
    const coachMin = new Map<string, number>();
    for (const v of visits) {
      const name = v.coach_name || v.device_id;
      coachMin.set(name, (coachMin.get(name) || 0) + (v.dwell_minutes || 0));
    }
    const mostActive = [...coachMin.entries()].sort((a, b) => b[1] - a[1])[0];
    const byCoach = new Map<string, { ptd: number; ext: number; visits: number }>();
    for (const v of visits) {
      const name = v.coach_name || v.device_id;
      if (!byCoach.has(name)) byCoach.set(name, { ptd: 0, ext: 0, visits: 0 });
      const c = byCoach.get(name)!;
      c.visits++;
      if (v.is_ptd_location) c.ptd += (v.dwell_minutes || 0); else c.ext += (v.dwell_minutes || 0);
    }
    const today = new Date().toISOString().slice(0, 10);
    const todayCoaches = new Set(visits.filter(v => (v.arrival_time || "").slice(0, 10) === today).map(v => v.coach_name || v.device_id));
    return { ptdHours, extHours, avgSession, mostActive, byCoach, todayCoaches, total: visits.length };
  }, [dwellVisits]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token ?? "";
      const headers: Record<string, string> = { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
      const base = "https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1";
      await fetch(`${base}/tinymdm-sync-devices`, { method: "POST", headers });
      await fetch(`${base}/tinymdm-pull-locations`, { method: "POST", headers });
      refetchDevices();
      refetchEvents();
      toast.success("TinyMDM sync completed");
    } catch {
      toast.error("TinyMDM sync failed");
    } finally {
      setSyncing(false);
    }
  }, [refetchDevices, refetchEvents]);

  const deviceNameMap = useMemo(() =>
    new Map((devices || []).map(d => [d.tinymdm_device_id, d.coach_name || d.device_name])),
  [devices]);

  const selectedCoachName = useMemo(() => {
    if (!selectedCoach) return null;
    return deviceNameMap.get(selectedCoach) || null;
  }, [selectedCoach, deviceNameMap]);

  const coachReport = useMemo(() => buildCoachReport(events || [], devices || []), [events, devices]);
  const hotspots = useMemo(() => buildHotspots(events || [], devices || []), [events, devices]);
  const patterns = useMemo(() => detectPatterns(events || [], devices || []), [events, devices]);
  const activeDevices = (devices || []).filter(d => d.last_lat && d.coach_name && !d.coach_name.startsWith("SM-"));

  const coachOptions = useMemo(() =>
    (devices || []).filter(d => d.coach_name && !d.coach_name.startsWith("SM-")).map(d => ({
      value: d.tinymdm_device_id, label: d.coach_name,
    })).sort((a, b) => a.label.localeCompare(b.label)),
  [devices]);

  const isLoading = devicesLoading || eventsLoading;

  return (
    <div className="space-y-4 p-3 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <MapPin className="h-5 w-5 md:h-6 md:w-6 text-blue-500" />
            Coach GPS Intelligence
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            Live tracking • Heatmaps • AI Intelligence • Notes
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => exportCSV(coachReport)} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
          <Button onClick={handleSync} disabled={syncing} variant="outline" size="sm">
            <RefreshCw className={`h-4 w-4 mr-1 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : "Sync GPS"}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 md:gap-4 items-center flex-wrap">
        <Select value={String(dateRange)} onValueChange={(v) => setDateRange(Number(v))}>
          <SelectTrigger className="w-[130px] md:w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Last 24h</SelectItem>
            <SelectItem value="3">Last 3 days</SelectItem>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="14">Last 14 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
          </SelectContent>
        </Select>
        <Select value={selectedCoach || "all"} onValueChange={(v) => setSelectedCoach(v === "all" ? null : v)}>
          <SelectTrigger className="w-[160px] md:w-[200px]"><SelectValue placeholder="All Coaches" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Coaches</SelectItem>
            {coachOptions.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex gap-1 md:gap-2 ml-auto flex-wrap">
          <Badge variant="outline" className="text-xs"><Users className="h-3 w-3 mr-1" />{activeDevices.length}</Badge>
          <Badge variant="outline" className="text-xs"><MapPin className="h-3 w-3 mr-1" />{(events || []).length.toLocaleString()}</Badge>
          <Badge variant="outline" className="text-xs"><AlertTriangle className="h-3 w-3 mr-1" />{patterns.filter(p => p.severity === "high").length}</Badge>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
        <Card>
          <CardContent className="pt-3 pb-2 px-3 md:pt-4 md:pb-3 md:px-4">
            <p className="text-xs text-muted-foreground">Active Coaches</p>
            <p className="text-xl md:text-2xl font-bold">{activeDevices.length}</p>
            <p className="text-xs text-muted-foreground">of {(devices || []).length} devices</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-2 px-3 md:pt-4 md:pb-3 md:px-4">
            <p className="text-xs text-muted-foreground">Areas Covered</p>
            <p className="text-xl md:text-2xl font-bold">{hotspots.length}</p>
            <p className="text-xs text-muted-foreground">in {dateRange}d</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-2 px-3 md:pt-4 md:pb-3 md:px-4">
            <p className="text-xs text-muted-foreground">Avg Stops/Day</p>
            <p className="text-xl md:text-2xl font-bold">
              {coachReport.length > 0 ? Math.round(coachReport.reduce((s, r) => s + r.uniqueStops, 0) / Math.max(coachReport.reduce((s, r) => s + r.activeDays, 0), 1)) : 0}
            </p>
            <p className="text-xs text-muted-foreground">per coach</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-2 px-3 md:pt-4 md:pb-3 md:px-4">
            <p className="text-xs text-muted-foreground">Alerts</p>
            <p className="text-xl md:text-2xl font-bold text-red-500">{patterns.filter(p => p.severity === "high").length}</p>
            <p className="text-xs text-muted-foreground">{patterns.filter(p => p.severity === "medium").length} medium</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="map" className="space-y-4">
        <TabsList className="w-full overflow-x-auto flex justify-start">
          <TabsTrigger value="map" className="text-xs md:text-sm"><MapPin className="h-3 w-3 md:h-4 md:w-4 mr-1" />Map</TabsTrigger>
          <TabsTrigger value="intelligence" className="text-xs md:text-sm"><Brain className="h-3 w-3 md:h-4 md:w-4 mr-1" />AI Intel</TabsTrigger>
          <TabsTrigger value="report" className="text-xs md:text-sm"><TrendingUp className="h-3 w-3 md:h-4 md:w-4 mr-1" />Report</TabsTrigger>
          <TabsTrigger value="patterns" className="text-xs md:text-sm"><AlertTriangle className="h-3 w-3 md:h-4 md:w-4 mr-1" />Patterns</TabsTrigger>
          <TabsTrigger value="notes" className="text-xs md:text-sm"><StickyNote className="h-3 w-3 md:h-4 md:w-4 mr-1" />Notes</TabsTrigger>
          <TabsTrigger value="hotspots" className="text-xs md:text-sm"><Navigation className="h-3 w-3 md:h-4 md:w-4 mr-1" />Hotspots</TabsTrigger>
          <TabsTrigger value="devices" className="text-xs md:text-sm"><Battery className="h-3 w-3 md:h-4 md:w-4 mr-1" />Devices</TabsTrigger>
          <TabsTrigger value="dwell" className="text-xs md:text-sm"><Timer className="h-3 w-3 md:h-4 md:w-4 mr-1" />Dwell</TabsTrigger>
          <TabsTrigger value="gps-patterns" className="text-xs md:text-sm"><ShieldCheck className="h-3 w-3 md:h-4 md:w-4 mr-1" />GPS Patterns</TabsTrigger>
        </TabsList>

        {/* MAP */}
        <TabsContent value="map">
          {isLoading ? (
            <div className="flex items-center justify-center h-[400px] md:h-[550px]"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : (
            <LocationMap events={events || []} selectedCoach={selectedCoach} deviceNameMap={deviceNameMap} />
          )}
        </TabsContent>

        {/* AI INTELLIGENCE */}
        <TabsContent value="intelligence">
          <IntelligencePanel dateRange={dateRange} selectedCoachName={selectedCoachName} />
        </TabsContent>

        {/* COACH REPORT */}
        <TabsContent value="report">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-sm md:text-base"><TrendingUp className="h-5 w-5" />Coach Activity ({dateRange}d)</CardTitle></CardHeader>
            <CardContent className="p-0">
              {coachReport.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No data. Click "Sync GPS".</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Coach</TableHead>
                        <TableHead className="text-right">Pts</TableHead>
                        <TableHead className="text-right hidden md:table-cell">Days</TableHead>
                        <TableHead className="text-right">Stops</TableHead>
                        <TableHead className="text-right hidden md:table-cell">Moves</TableHead>
                        <TableHead className="hidden lg:table-cell">Top Areas</TableHead>
                        <TableHead className="hidden md:table-cell">Time (Dubai)</TableHead>
                        <TableHead className="text-right hidden md:table-cell">Trust</TableHead>
                        <TableHead className="text-right">Batt</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {coachReport.map((r) => (
                        <TableRow key={r.coach} className="cursor-pointer hover:bg-muted/30 transition-colors">
                          <TableCell className="font-medium text-xs md:text-sm">{r.coach}</TableCell>
                          <TableCell className="text-right">{r.totalPoints}</TableCell>
                          <TableCell className="text-right hidden md:table-cell">{r.activeDays}</TableCell>
                          <TableCell className="text-right">{r.uniqueStops}</TableCell>
                          <TableCell className="text-right hidden md:table-cell">{r.transitions}</TableCell>
                          <TableCell className="text-xs max-w-[200px] truncate hidden lg:table-cell">
                            {r.topAreas.map(([area, cnt]) => `${area} (${cnt})`).join(", ")}
                          </TableCell>
                          <TableCell className="text-xs hidden md:table-cell">{r.firstSeen} → {r.lastSeen}</TableCell>
                          <TableCell className="text-right hidden md:table-cell">
                            {(() => {
                              const pat = patternByCoach.get(r.coach);
                              if (!pat) return <span className="text-xs text-muted-foreground">—</span>;
                              const color = pat.pattern_score >= 80 ? "text-green-600" : pat.pattern_score >= 60 ? "text-yellow-600" : "text-red-600";
                              const icon = pat.risk_level === "critical" ? "🚨" : pat.risk_level === "review" ? "⚠️" : "✅";
                              return <span className={`font-mono text-xs font-bold ${color}`}>{icon} {pat.pattern_score}</span>;
                            })()}
                          </TableCell>
                          <TableCell className={`text-right font-mono ${getBatteryColor(r.device?.battery_level ?? null)}`}>
                            {r.device?.battery_level != null ? `${r.device.battery_level}%` : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PATTERNS */}
        <TabsContent value="patterns">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-sm md:text-base"><AlertTriangle className="h-5 w-5" />Pattern Detection</CardTitle></CardHeader>
            <CardContent className="p-0">
              {patterns.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No patterns yet. Need 2-3 days of GPS data.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[80px]">Level</TableHead>
                        <TableHead className="w-[100px] hidden md:table-cell">Type</TableHead>
                        <TableHead>Coach</TableHead>
                        <TableHead>Detail</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {patterns.slice(0, 50).map((p, i) => (
                        <TableRow key={i} className="cursor-pointer hover:bg-muted/30 transition-colors">
                          <TableCell>
                            <Badge variant={p.severity === "high" ? "destructive" : p.severity === "medium" ? "default" : "secondary"}>
                              {p.severity.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs font-mono hidden md:table-cell">
                            {p.type === "idle_gap" ? "⏸️ Idle" : p.type === "low_movement" ? "📍 Static" : "⚡ Low"}
                          </TableCell>
                          <TableCell className="font-medium text-xs md:text-sm">{p.coach}</TableCell>
                          <TableCell className="text-xs">{p.detail}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* NOTES */}
        <TabsContent value="notes">
          <NotesPanel coachName={selectedCoachName || undefined} />
        </TabsContent>

        {/* HOTSPOTS */}
        <TabsContent value="hotspots">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-sm md:text-base"><Navigation className="h-5 w-5" />Area Hotspots</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]">#</TableHead>
                      <TableHead>Area</TableHead>
                      <TableHead className="text-right">Visits</TableHead>
                      <TableHead className="text-right hidden md:table-cell">Coaches</TableHead>
                      <TableHead className="hidden md:table-cell">Who</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {hotspots.map((h, i) => (
                      <TableRow key={h.area} className="cursor-pointer hover:bg-muted/30 transition-colors">
                        <TableCell className="font-mono text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium text-xs md:text-sm">{h.area}</TableCell>
                        <TableCell className="text-right">{h.count}</TableCell>
                        <TableCell className="text-right hidden md:table-cell">{h.coaches.length}</TableCell>
                        <TableCell className="text-xs max-w-[300px] truncate hidden md:table-cell">{h.coaches.slice(0, 4).join(", ")}{h.coaches.length > 4 ? ` +${h.coaches.length - 4}` : ""}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* DEVICES */}
        <TabsContent value="devices">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-sm md:text-base"><Battery className="h-5 w-5" />Device Fleet</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Coach</TableHead>
                      <TableHead className="hidden md:table-cell">Device</TableHead>
                      <TableHead className="text-right">Batt</TableHead>
                      <TableHead>GPS</TableHead>
                      <TableHead className="hidden md:table-cell">Last Location</TableHead>
                      <TableHead>Last Seen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(devices || []).filter(d => !d.coach_name?.startsWith("SM-")).sort((a, b) => (a.coach_name || "").localeCompare(b.coach_name || "")).map((d) => (
                      <TableRow key={d.tinymdm_device_id} className="cursor-pointer hover:bg-muted/30 transition-colors">
                        <TableCell className="font-medium text-xs md:text-sm">{d.coach_name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground hidden md:table-cell">{d.device_name}</TableCell>
                        <TableCell className={`text-right font-mono ${getBatteryColor(d.battery_level)}`}>
                          {d.battery_level != null ? `${d.battery_level}%` : "—"}
                        </TableCell>
                        <TableCell>{d.is_online ? <Badge className="bg-green-500 text-xs">ON</Badge> : <Badge variant="secondary" className="text-xs">OFF</Badge>}</TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate hidden md:table-cell">{shortAddress(d.last_address)}</TableCell>
                        <TableCell className="text-xs">{d.last_location_at ? formatDubaiTime(d.last_location_at) : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* DWELL */}
        <TabsContent value="dwell">
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button onClick={runDwellEngine} disabled={dwellProcessing} variant="outline" size="sm">
                <RefreshCw className={`h-4 w-4 mr-1 ${dwellProcessing ? "animate-spin" : ""}`} />
                {dwellProcessing ? "Processing..." : "Run Dwell Engine"}
              </Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
              <Card>
                <CardContent className="pt-3 pb-2 px-3"><p className="text-xs text-muted-foreground">PTD Hours</p><p className="text-xl font-bold text-green-600">{dwellSummary.ptdHours}h</p></CardContent>
              </Card>
              <Card>
                <CardContent className="pt-3 pb-2 px-3"><p className="text-xs text-muted-foreground">External</p><p className="text-xl font-bold text-yellow-600">{dwellSummary.extHours}h</p></CardContent>
              </Card>
              <Card>
                <CardContent className="pt-3 pb-2 px-3"><p className="text-xs text-muted-foreground">Most Active</p><p className="text-sm font-bold">{dwellSummary.mostActive?.[0] || "—"}</p></CardContent>
              </Card>
              <Card>
                <CardContent className="pt-3 pb-2 px-3"><p className="text-xs text-muted-foreground">Avg Dwell</p><p className="text-xl font-bold">{dwellSummary.avgSession}m</p></CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Visit Log ({dwellSummary.total})</CardTitle></CardHeader>
              <CardContent className="p-0">
                {dwellLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : (dwellVisits || []).length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No dwell data. Run Dwell Engine to process GPS.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Coach</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead className="hidden md:table-cell">Arrival</TableHead>
                          <TableHead className="hidden md:table-cell">Departure</TableHead>
                          <TableHead className="text-right">Min</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(dwellVisits || []).slice(0, 100).map((v) => (
                          <TableRow key={v.id} className={v.is_ptd_location ? "bg-green-50 dark:bg-green-950/20" : ""}>
                            <TableCell className="font-medium text-xs">{v.coach_name || v.device_id}</TableCell>
                            <TableCell>
                              <Badge variant={v.is_ptd_location ? "default" : "secondary"} className={`text-xs ${v.is_ptd_location ? "bg-green-500" : ""}`}>
                                {v.location_name}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs hidden md:table-cell">{v.arrival_time ? formatDubaiTime(v.arrival_time) : "—"}</TableCell>
                            <TableCell className="text-xs hidden md:table-cell">{v.departure_time ? formatDubaiTime(v.departure_time) : "—"}</TableCell>
                            <TableCell className="text-right font-mono">{v.dwell_minutes || 0}m</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* GPS PATTERNS */}
        <TabsContent value="gps-patterns">
          <GpsPatternPanel
            patterns={gpsPatterns || []}
            loading={patternsLoading}
            onRunAnalyzer={runPatternAnalyzer}
            running={patternRunning}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
