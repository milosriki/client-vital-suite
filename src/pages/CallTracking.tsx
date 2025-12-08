import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, PhoneIncoming, PhoneOutgoing, Clock, Calendar, Star } from "lucide-react";
import { format } from "date-fns";

export default function CallTracking() {
  const { data: callRecords, isLoading } = useQuery({
    queryKey: ["call-records"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_records")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const stats = {
    totalCalls: callRecords?.length || 0,
    completedCalls: callRecords?.filter(c => c.call_status === "completed").length || 0,
    avgDuration: callRecords?.length 
      ? Math.round(callRecords.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) / callRecords.length)
      : 0,
    avgScore: callRecords?.length
      ? Math.round(callRecords.reduce((sum, c) => sum + (c.call_score || 0), 0) / callRecords.length)
      : 0,
    appointmentsSet: callRecords?.filter(c => c.appointment_set).length || 0,
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading call data...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Call Tracking</h1>
          <p className="text-muted-foreground">Monitor call performance and setter activity</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Phone className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{stats.totalCalls}</p>
                  <p className="text-xs text-muted-foreground">Total Calls</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <PhoneIncoming className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.completedCalls}</p>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Clock className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{Math.floor(stats.avgDuration / 60)}:{String(stats.avgDuration % 60).padStart(2, '0')}</p>
                  <p className="text-xs text-muted-foreground">Avg Duration</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Star className="h-8 w-8 text-yellow-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.avgScore}</p>
                  <p className="text-xs text-muted-foreground">Avg Score</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Calendar className="h-8 w-8 text-purple-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.appointmentsSet}</p>
                  <p className="text-xs text-muted-foreground">Appointments</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Call Records Table */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Calls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium">Caller</th>
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium">Direction</th>
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium">Status</th>
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium">Duration</th>
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium">Score</th>
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {callRecords?.map((call) => (
                    <tr key={call.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium">{call.caller_number}</p>
                          <p className="text-xs text-muted-foreground">{call.caller_country}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {call.call_direction === "inbound" ? (
                          <Badge variant="outline" className="gap-1">
                            <PhoneIncoming className="h-3 w-3" /> Inbound
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1">
                            <PhoneOutgoing className="h-3 w-3" /> Outbound
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={call.call_status === "completed" ? "default" : "secondary"}>
                          {call.call_status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        {call.duration_seconds 
                          ? `${Math.floor(call.duration_seconds / 60)}:${String(call.duration_seconds % 60).padStart(2, '0')}`
                          : "-"}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`font-medium ${
                          (call.call_score || 0) >= 80 ? "text-green-500" :
                          (call.call_score || 0) >= 60 ? "text-yellow-500" : "text-red-500"
                        }`}>
                          {call.call_score || "-"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground text-sm">
                        {call.created_at ? format(new Date(call.created_at), "MMM d, HH:mm") : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(!callRecords || callRecords.length === 0) && (
                <div className="text-center py-8 text-muted-foreground">No call records found</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Transcriptions */}
        <Card>
          <CardHeader>
            <CardTitle>Call Transcriptions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {callRecords?.filter(c => c.transcription).slice(0, 5).map((call) => (
              <div key={call.id} className="p-4 rounded-lg bg-muted/30 border border-border/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{call.caller_number}</span>
                  <span className="text-xs text-muted-foreground">
                    {call.created_at ? format(new Date(call.created_at), "MMM d, HH:mm") : "-"}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{call.transcription}</p>
              </div>
            ))}
            {!callRecords?.some(c => c.transcription) && (
              <div className="text-center py-8 text-muted-foreground">No transcriptions available</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
