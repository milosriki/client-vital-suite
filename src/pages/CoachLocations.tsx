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
import { RefreshCw, MapPin, Clock, Navigation, AlertTriangle, Loader2, Battery, TrendingUp, Route, Users, Download } from "lucide-react";
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

function shortAddress(addr: string | null) {
  if (!addr) return "—";
  const parts = addr.split(" - ");
  return parts.length > 1 ? `${parts[0].slice(0, 30)} · ${parts[1].slice(0, 25)}` : addr.slice(0, 55);
}

// ── Map Component ──
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
    return () => { if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null; } };
  }, []);

  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapInstance.current || !layerGroup.current) return;
    layerGroup.current.clearLayers();
    if (heatLayer.current) { mapInstance.current.removeLayer(heatLayer.current); heatLayer.current = null; }

    const filtered = selectedCoach ? events.filter((e) => e.device_id === selectedCoach) : events;
    if (filtered.length === 0) return;

    // Latest position per device
    const latest = new Map<string, LocationEvent>();
    for (const evt of filtered) {
      const ex = latest.get(evt.device_id);
      if (!ex || new Date(evt.recorded_at) > new Date(ex.recorded_at)) latest.set(evt.device_id, evt);
    }

    const colors = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];
    let ci = 0;
    for (const [devId, evt] of latest) {
      const color = colors[ci++ % colors.length];
      const name = deviceNameMap.get(devId) || devId;
      L.circleMarker([evt.lat, evt.lng], {
        radius: 10, fillColor: color, color: "#fff", weight: 2, opacity: 1, fillOpacity: 0.9,
      }).bindPopup(`<b>${name}</b><br>${formatDubaiTime(evt.recorded_at)}<br>${shortAddress(evt.address)}`).addTo(layerGroup.current);

      // Trail for this coach
      const trail = filtered.filter(e => e.device_id === devId).sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
      if (trail.length > 1) {
        const latlngs = trail.map(e => [e.lat, e.lng]);
        L.polyline(latlngs, { color, weight: 2, opacity: 0.4, dashArray: "5,5" }).addTo(layerGroup.current);
      }
    }

    // Heatmap
    const heatData = filtered.map((e) => [e.lat, e.lng, 0.5]);
    heatLayer.current = (L as any).heatLayer(heatData, {
      radius: 25, blur: 15, maxZoom: 17,
      gradient: { 0.4: "blue", 0.6: "cyan", 0.7: "lime", 0.8: "yellow", 1: "red" },
    }).addTo(mapInstance.current);

    if (filtered.length > 0) {
      const bounds = L.latLngBounds(filtered.map((e) => [e.lat, e.lng]));
      mapInstance.current.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [events, selectedCoach, deviceNameMap]);

  return <div ref={mapRef} style={{ height: "550px", width: "100%", borderRadius: "8px" }} />;
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

    // Detect idle gaps > 60 min
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

    // Detect repeated locations (home base / not moving)
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

    // Detect low activity days
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

    // Top areas
    const areaCount = new Map<string, number>();
    for (const a of addresses) {
      const parts = a.split(" - ");
      const area = (parts[1] || parts[0]).trim().slice(0, 30);
      areaCount.set(area, (areaCount.get(area) || 0) + 1);
    }
    const topAreas = [...areaCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

    // First/last time (Dubai)
    const firstUTC = sorted[0]?.recorded_at;
    const lastUTC = sorted[sorted.length - 1]?.recorded_at;

    // Travel estimate: count distinct locations transitions
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

// ── CSV Export ──
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
        .limit(10000);
      if (error) throw error;
      return (data || []) as LocationEvent[];
    },
  });

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token ?? "";
      const headers: Record<string, string> = { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
      const base = `https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1`;
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
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MapPin className="h-6 w-6 text-blue-500" />
            Coach Location Intelligence
          </h1>
          <p className="text-muted-foreground mt-1">
            GPS tracking, heatmaps, route analysis & proactive pattern detection
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => exportCSV(coachReport)} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
          <Button onClick={handleSync} disabled={syncing} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : "Sync TinyMDM"}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center flex-wrap">
        <Select value={String(dateRange)} onValueChange={(v) => setDateRange(Number(v))}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Last 24 hours</SelectItem>
            <SelectItem value="3">Last 3 days</SelectItem>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="14">Last 14 days</SelectItem>
          </SelectContent>
        </Select>
        <Select value={selectedCoach || "all"} onValueChange={(v) => setSelectedCoach(v === "all" ? null : v)}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="All Coaches" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Coaches</SelectItem>
            {coachOptions.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex gap-2 ml-auto">
          <Badge variant="outline"><Users className="h-3 w-3 mr-1" />{activeDevices.length} coaches</Badge>
          <Badge variant="outline"><MapPin className="h-3 w-3 mr-1" />{(events || []).length.toLocaleString()} points</Badge>
          <Badge variant="outline"><AlertTriangle className="h-3 w-3 mr-1" />{patterns.filter(p => p.severity === "high").length} alerts</Badge>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Active Coaches</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{activeDevices.length}</p>
            <p className="text-xs text-muted-foreground">of {(devices || []).length} devices</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Unique Areas Covered</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{hotspots.length}</p>
            <p className="text-xs text-muted-foreground">neighborhoods in {dateRange}d</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Avg Stops/Coach/Day</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {coachReport.length > 0 ? Math.round(coachReport.reduce((s, r) => s + r.uniqueStops, 0) / Math.max(coachReport.reduce((s, r) => s + r.activeDays, 0), 1)) : 0}
            </p>
            <p className="text-xs text-muted-foreground">client locations visited</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Pattern Alerts</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-500">{patterns.filter(p => p.severity === "high").length}</p>
            <p className="text-xs text-muted-foreground">{patterns.filter(p => p.severity === "medium").length} medium, {patterns.filter(p => p.severity === "low").length} low</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="map" className="space-y-4">
        <TabsList>
          <TabsTrigger value="map"><MapPin className="h-4 w-4 mr-1" />Heatmap</TabsTrigger>
          <TabsTrigger value="report"><TrendingUp className="h-4 w-4 mr-1" />Coach Report</TabsTrigger>
          <TabsTrigger value="hotspots"><Navigation className="h-4 w-4 mr-1" />Hotspots</TabsTrigger>
          <TabsTrigger value="patterns"><AlertTriangle className="h-4 w-4 mr-1" />Patterns</TabsTrigger>
          <TabsTrigger value="devices"><Battery className="h-4 w-4 mr-1" />Devices</TabsTrigger>
        </TabsList>

        {/* MAP TAB */}
        <TabsContent value="map">
          {isLoading ? (
            <div className="flex items-center justify-center h-[550px]"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : (
            <LocationMap events={events || []} selectedCoach={selectedCoach} deviceNameMap={deviceNameMap} />
          )}
        </TabsContent>

        {/* COACH REPORT TAB */}
        <TabsContent value="report">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" />Coach Activity Report ({dateRange}-Day)</CardTitle></CardHeader>
            <CardContent>
              {coachReport.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No coach data yet. Click "Sync TinyMDM" to pull data.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Coach</TableHead>
                      <TableHead className="text-right">Points</TableHead>
                      <TableHead className="text-right">Days</TableHead>
                      <TableHead className="text-right">Stops</TableHead>
                      <TableHead className="text-right">Moves</TableHead>
                      <TableHead>Top Areas</TableHead>
                      <TableHead>First → Last (Dubai)</TableHead>
                      <TableHead>Battery</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {coachReport.map((r) => (
                      <TableRow key={r.coach} className="cursor-pointer hover:bg-muted/30 transition-colors">
                        <TableCell className="font-medium">{r.coach}</TableCell>
                        <TableCell className="text-right">{r.totalPoints}</TableCell>
                        <TableCell className="text-right">{r.activeDays}</TableCell>
                        <TableCell className="text-right">{r.uniqueStops}</TableCell>
                        <TableCell className="text-right">{r.transitions}</TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">
                          {r.topAreas.map(([area, cnt]) => `${area} (${cnt})`).join(", ")}
                        </TableCell>
                        <TableCell className="text-xs">{r.firstSeen} → {r.lastSeen}</TableCell>
                        <TableCell>
                          {r.device?.battery_level != null ? (
                            <span className={getBatteryColor(r.device.battery_level)}>
                              {r.device.battery_level}%
                            </span>
                          ) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* HOTSPOTS TAB */}
        <TabsContent value="hotspots">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Navigation className="h-5 w-5" />Area Hotspots — Where Coaches Spend Time</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">#</TableHead>
                    <TableHead>Area</TableHead>
                    <TableHead className="text-right">Visits</TableHead>
                    <TableHead className="text-right">Coaches</TableHead>
                    <TableHead>Who</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hotspots.map((h, i) => (
                    <TableRow key={h.area} className="cursor-pointer hover:bg-muted/30 transition-colors">
                      <TableCell className="font-mono text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium">{h.area}</TableCell>
                      <TableCell className="text-right">{h.count}</TableCell>
                      <TableCell className="text-right">{h.coaches.length}</TableCell>
                      <TableCell className="text-xs max-w-[300px] truncate">{h.coaches.slice(0, 4).join(", ")}{h.coaches.length > 4 ? ` +${h.coaches.length - 4}` : ""}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PATTERNS TAB */}
        <TabsContent value="patterns">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5" />Proactive Pattern Detection</CardTitle></CardHeader>
            <CardContent>
              {patterns.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No patterns detected yet. Need more GPS data (sync hourly for 2-3 days).</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">Severity</TableHead>
                      <TableHead className="w-[120px]">Type</TableHead>
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
                        <TableCell className="text-xs font-mono">
                          {p.type === "idle_gap" ? "⏸️ Idle Gap" : p.type === "low_movement" ? "📍 Static" : "⚡ Low Activity"}
                        </TableCell>
                        <TableCell className="font-medium">{p.coach}</TableCell>
                        <TableCell className="text-xs">{p.detail}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* DEVICES TAB */}
        <TabsContent value="devices">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Battery className="h-5 w-5" />Device Fleet Status</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Coach</TableHead>
                    <TableHead>Device</TableHead>
                    <TableHead>OS</TableHead>
                    <TableHead className="text-right">Battery</TableHead>
                    <TableHead>GPS Active</TableHead>
                    <TableHead>Last Location</TableHead>
                    <TableHead>Last Seen (Dubai)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(devices || []).filter(d => !d.coach_name?.startsWith("SM-")).sort((a, b) => (a.coach_name || "").localeCompare(b.coach_name || "")).map((d) => (
                    <TableRow key={d.tinymdm_device_id} className="cursor-pointer hover:bg-muted/30 transition-colors">
                      <TableCell className="font-medium">{d.coach_name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{d.device_name}</TableCell>
                      <TableCell className="text-xs">{d.os_version || "—"}</TableCell>
                      <TableCell className={`text-right font-mono ${getBatteryColor(d.battery_level)}`}>
                        {d.battery_level != null ? `${d.battery_level}%` : "—"}
                      </TableCell>
                      <TableCell>{d.is_online ? <Badge variant="default" className="bg-green-500">ON</Badge> : <Badge variant="secondary">OFF</Badge>}</TableCell>
                      <TableCell className="text-xs max-w-[250px] truncate">{shortAddress(d.last_address)}</TableCell>
                      <TableCell className="text-xs">{d.last_location_at ? formatDubaiTime(d.last_location_at) : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
