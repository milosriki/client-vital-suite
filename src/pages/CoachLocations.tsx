import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { RefreshCw, MapPin, Clock, Navigation, AlertTriangle, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useDedupedQuery } from "@/hooks/useDedupedQuery";
import { format, subDays } from "date-fns";

// ── Types ──
interface LocationEvent {
  id: string;
  device_id: string;
  recorded_at: string;
  lat: number;
  lng: number;
  accuracy_m: number | null;
}

interface Device {
  tinymdm_device_id: string;
  device_name: string;
  coach_name: string;
  coach_id: string;
  last_sync_at: string | null;
  battery_level: number | null;
  is_online: boolean;
}

interface Visit {
  id: string;
  coach_id: string;
  device_id: string;
  poi_id: string;
  start_ts: string;
  end_ts: string | null;
  duration_min: number | null;
  confidence: number;
}

// ── Map Component ──
function LocationMap({ events, selectedCoach }: { events: LocationEvent[]; selectedCoach: string | null }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const layerGroup = useRef<any>(null);
  const heatLayer = useRef<any>(null);

  useEffect(() => {
    // Load Leaflet from CDN
    if (typeof window === "undefined") return;

    const loadLeaflet = async () => {
      if (!(window as any).L) {
        // Load CSS
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);

        // Load JS
        await new Promise<void>((resolve) => {
          const script = document.createElement("script");
          script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
          script.onload = () => resolve();
          document.head.appendChild(script);
        });

        // Load heatmap plugin
        await new Promise<void>((resolve) => {
          const script = document.createElement("script");
          script.src = "https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js";
          script.onload = () => resolve();
          document.head.appendChild(script);
        });
      }

      const L = (window as any).L;
      if (!mapRef.current || mapInstance.current) return;

      // Default to Dubai (PTD Fitness headquarters)
      mapInstance.current = L.map(mapRef.current).setView([25.2048, 55.2708], 12);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(mapInstance.current);

      layerGroup.current = L.layerGroup().addTo(mapInstance.current);
    };

    loadLeaflet();

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapInstance.current || !layerGroup.current) return;

    layerGroup.current.clearLayers();
    if (heatLayer.current) {
      mapInstance.current.removeLayer(heatLayer.current);
      heatLayer.current = null;
    }

    const filtered = selectedCoach
      ? events.filter((e) => e.device_id === selectedCoach)
      : events;

    if (filtered.length === 0) return;

    // Add markers for latest position per device
    const latestByDevice = new Map<string, LocationEvent>();
    for (const evt of filtered) {
      const existing = latestByDevice.get(evt.device_id);
      if (!existing || new Date(evt.recorded_at) > new Date(existing.recorded_at)) {
        latestByDevice.set(evt.device_id, evt);
      }
    }

    for (const [deviceId, evt] of latestByDevice) {
      L.circleMarker([evt.lat, evt.lng], {
        radius: 8,
        fillColor: "#3b82f6",
        color: "#1e40af",
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8,
      })
        .bindPopup(`<b>${deviceId}</b><br>${format(new Date(evt.recorded_at), "MMM d, h:mm a")}<br>Lat: ${evt.lat.toFixed(5)}, Lng: ${evt.lng.toFixed(5)}`)
        .addTo(layerGroup.current);
    }

    // Heatmap layer
    const heatData = filtered.map((e) => [e.lat, e.lng, 0.5]);
    heatLayer.current = (L as any).heatLayer(heatData, {
      radius: 25,
      blur: 15,
      maxZoom: 17,
      gradient: { 0.4: "blue", 0.6: "cyan", 0.7: "lime", 0.8: "yellow", 1: "red" },
    }).addTo(mapInstance.current);

    // Fit bounds
    if (filtered.length > 0) {
      const bounds = L.latLngBounds(filtered.map((e) => [e.lat, e.lng]));
      mapInstance.current.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [events, selectedCoach]);

  return <div ref={mapRef} style={{ height: "500px", width: "100%", borderRadius: "8px" }} />;
}

// ── Main Page ──
export default function CoachLocations() {
  const [dateRange, setDateRange] = useState(7);
  const [selectedCoach, setSelectedCoach] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const since = useMemo(() => subDays(new Date(), dateRange).toISOString(), [dateRange]);

  const { data: devices, isLoading: devicesLoading, refetch: refetchDevices } = useDedupedQuery({
    queryKey: ["mdm-devices"],
    queryFn: async () => {
      const { data, error } = await supabase.from("mdm_devices").select("*");
      if (error) throw error;
      return (data || []) as Device[];
    },
  });

  const { data: events, isLoading: eventsLoading, refetch: refetchEvents } = useDedupedQuery({
    queryKey: ["mdm-locations", since],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mdm_location_events")
        .select("*")
        .gte("recorded_at", since)
        .order("recorded_at", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data || []) as LocationEvent[];
    },
  });

  const { data: visits } = useDedupedQuery({
    queryKey: ["mdm-visits", since],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mdm_visits")
        .select("*")
        .gte("start_ts", since)
        .order("start_ts", { ascending: false });
      if (error) throw error;
      return (data || []) as Visit[];
    },
  });

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      const base = `https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1`;
      await fetch(`${base}/tinymdm-sync-devices`, { method: "POST" });
      await fetch(`${base}/tinymdm-pull-locations`, { method: "POST" });
      await fetch(`${base}/tinymdm-visit-builder`, { method: "POST" });
      refetchDevices();
      refetchEvents();
    } catch (e) {
      console.error("Sync failed:", e);
    } finally {
      setSyncing(false);
    }
  }, [refetchDevices, refetchEvents]);

  // Coach utilization summary
  const utilization = useMemo(() => {
    if (!devices?.length || !visits?.length) return [];

    return (devices || []).map((d) => {
      const coachVisits = (visits || []).filter((v) => v.device_id === d.tinymdm_device_id);
      const billableMin = coachVisits.reduce((sum, v) => sum + (v.duration_min || 0), 0);
      const totalEvents = (events || []).filter((e) => e.device_id === d.tinymdm_device_id).length;

      return {
        device_id: d.tinymdm_device_id,
        coach_name: d.coach_name || d.device_name || d.tinymdm_device_id,
        is_online: d.is_online,
        battery: d.battery_level,
        total_points: totalEvents,
        billable_min: billableMin,
        travel_min: Math.round(totalEvents * 5 * 0.3), // Estimate: 30% travel
        idle_min: Math.max(0, totalEvents * 5 - billableMin - Math.round(totalEvents * 5 * 0.3)),
        visit_count: coachVisits.length,
      };
    });
  }, [devices, visits, events]);

  const coachOptions = useMemo(() => {
    return (devices || []).map((d) => ({
      value: d.tinymdm_device_id,
      label: d.coach_name || d.device_name || d.tinymdm_device_id,
    }));
  }, [devices]);

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
            Real-time coach tracking, heatmaps, and visit verification
          </p>
        </div>
        <Button onClick={handleSync} disabled={syncing} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing..." : "Sync from TinyMDM"}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <Select value={String(dateRange)} onValueChange={(v) => setDateRange(Number(v))}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Last 24 hours</SelectItem>
            <SelectItem value="3">Last 3 days</SelectItem>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="14">Last 14 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedCoach || "all"} onValueChange={(v) => setSelectedCoach(v === "all" ? null : v)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Coaches" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Coaches</SelectItem>
            {coachOptions.map((c) => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex gap-2 ml-auto">
          <Badge variant="outline">{devices?.length || 0} devices</Badge>
          <Badge variant="outline">{events?.length || 0} location points</Badge>
          <Badge variant="outline">{visits?.length || 0} visits detected</Badge>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Active Devices</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{devices?.filter((d) => d.is_online).length || 0}</p>
            <p className="text-xs text-muted-foreground">of {devices?.length || 0} total</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Visits</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{visits?.length || 0}</p>
            <p className="text-xs text-muted-foreground">in {dateRange} days</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Billable Minutes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {(visits || []).reduce((s, v) => s + (v.duration_min || 0), 0).toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">from verified visits</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Location Points</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{(events?.length || 0).toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">collected this period</p>
          </CardContent>
        </Card>
      </div>

      {/* Map */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Navigation className="h-5 w-5" />
            Coach Heatmap — {dateRange} Day View
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(devicesLoading || eventsLoading) ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-8 w-8 mb-3 animate-spin opacity-50" />
              <p className="text-sm">Loading map data...</p>
            </div>
          ) : (
            <LocationMap events={events || []} selectedCoach={selectedCoach} />
          )}
        </CardContent>
      </Card>

      {/* Utilization Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Coach Utilization Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Coach</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Battery</TableHead>
                <TableHead>Location Points</TableHead>
                <TableHead>Visits</TableHead>
                <TableHead className="text-right">Billable Min</TableHead>
                <TableHead className="text-right">Travel Min</TableHead>
                <TableHead className="text-right">Idle Min</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {utilization.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    <AlertTriangle className="h-5 w-5 mx-auto mb-2" />
                    No device data yet. Click "Sync from TinyMDM" to pull devices.
                  </TableCell>
                </TableRow>
              ) : (
                utilization.map((u) => (
                  <TableRow
                    key={u.device_id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedCoach(u.device_id === selectedCoach ? null : u.device_id)}
                  >
                    <TableCell className="font-medium">{u.coach_name}</TableCell>
                    <TableCell>
                      <Badge variant={u.is_online ? "default" : "secondary"}>
                        {u.is_online ? "Online" : "Offline"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {u.battery !== null ? (
                        <span className={u.battery < 20 ? "text-red-500 font-medium" : ""}>
                          {u.battery}%
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell>{u.total_points}</TableCell>
                    <TableCell>{u.visit_count}</TableCell>
                    <TableCell className="text-right font-medium">{u.billable_min}</TableCell>
                    <TableCell className="text-right">{u.travel_min}</TableCell>
                    <TableCell className="text-right">{u.idle_min}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
