import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useDedupedQuery } from "@/hooks/useDedupedQuery";

interface AdEventsTabProps {
  mode: "test" | "live";
}

export default function AdEventsTab({ mode }: AdEventsTabProps) {
  const { data: events, isLoading, refetch } = useDedupedQuery({
    queryKey: ["capi-events", mode],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("capi_events" as any)
        .select("*")
        .eq("mode", mode)
        .order("created_at", { ascending: false })
        .limit(500) as any);
      
      if (error) throw error;
      return data as any[];
    },
    staleTime: Infinity, // Real-time updates via subscriptions
  });

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "sent":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "failed":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      case "pending":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>CAPI Events Log</CardTitle>
              <CardDescription>
                Last 500 Meta Conversions API events in {mode} mode
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              Loading events...
            </div>
          ) : events && events.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>FBP/FBC</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event: any) => (
                    <TableRow key={event.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{event.event_name}</Badge>
                          {event.event_id && (
                            <code className="text-xs bg-muted px-1 rounded">
                              {event.event_id.slice(0, 12)}...
                            </code>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {event.email || event.user_email || "-"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {event.phone || event.user_phone || "-"}
                      </TableCell>
                      <TableCell className="font-semibold">
                        {event.value_aed
                          ? `${event.currency || "AED"} ${event.value_aed}`
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getStatusColor(event.status)}>
                          {event.status || "pending"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="space-y-1">
                          {event.fbp && (
                            <div className="font-mono text-muted-foreground truncate max-w-[120px]">
                              fbp: {event.fbp.slice(0, 16)}...
                            </div>
                          )}
                          {event.fbc && (
                            <div className="font-mono text-muted-foreground truncate max-w-[120px]">
                              fbc: {event.fbc.slice(0, 16)}...
                            </div>
                          )}
                          {!event.fbp && !event.fbc && "-"}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(event.created_at), {
                          addSuffix: true,
                        })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No events found in {mode} mode
            </div>
          )}
        </CardContent>
      </Card>

      {/* Event Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{events?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Total Events</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-500">
              {events?.filter((e: any) => e.status === "sent").length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Sent</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-500">
              {events?.filter((e: any) => !e.status || e.status === "pending").length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-500">
              {events?.filter((e: any) => e.status === "failed").length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Failed</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}