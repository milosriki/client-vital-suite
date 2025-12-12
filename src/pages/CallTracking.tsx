import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, PhoneIncoming, PhoneOutgoing, Clock, Calendar, Star, MapPin, User, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { format } from "date-fns";

// Format phone number for display
const formatPhoneNumber = (phone: string) => {
  if (!phone) return "-";
  // Remove non-digits
  const digits = phone.replace(/\D/g, '');
  // Format based on length
  if (digits.length === 12 && digits.startsWith('971')) {
    return `+${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }
  if (digits.length >= 10) {
    return `+${digits.slice(0, -9)} ${digits.slice(-9, -6)} ${digits.slice(-6, -3)} ${digits.slice(-3)}`;
  }
  return phone;
};

// Get country flag emoji from country code
const getCountryFlag = (countryCode: string | null) => {
  if (!countryCode) return "🌍";
  const code = countryCode.toUpperCase();
  const flags: Record<string, string> = {
    'AE': '🇦🇪', 'US': '🇺🇸', 'GB': '🇬🇧', 'IN': '🇮🇳', 'SA': '🇸🇦', 
    'EG': '🇪🇬', 'PK': '🇵🇰', 'PH': '🇵🇭', 'BD': '🇧🇩', 'LB': '🇱🇧',
    'JO': '🇯🇴', 'KW': '🇰🇼', 'QA': '🇶🇦', 'BH': '🇧🇭', 'OM': '🇴🇲'
  };
  return flags[code] || '🌍';
};

// Get status color and icon
const getStatusInfo = (status: string, outcome: string | null) => {
  if (status === 'completed') {
    if (outcome === 'appointment_set' || outcome === 'qualified') {
      return { color: 'text-green-500 bg-green-500/10 border-green-500/30', icon: CheckCircle2, label: 'Success' };
    }
    if (outcome === 'not_interested' || outcome === 'disqualified') {
      return { color: 'text-red-500 bg-red-500/10 border-red-500/30', icon: XCircle, label: 'No Interest' };
    }
    return { color: 'text-blue-500 bg-blue-500/10 border-blue-500/30', icon: CheckCircle2, label: 'Completed' };
  }
  if (status === 'no_answer' || status === 'missed') {
    return { color: 'text-orange-500 bg-orange-500/10 border-orange-500/30', icon: AlertCircle, label: 'Missed' };
  }
  if (status === 'initiated' || status === 'ringing') {
    return { color: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30', icon: Phone, label: 'Initiated' };
  }
  return { color: 'text-muted-foreground bg-muted/30', icon: Phone, label: status };
};

export default function CallTracking() {
  const { data: callRecordsData, isLoading } = useQuery({
    queryKey: ["call-records"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_records")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  const callRecords = Array.isArray(callRecordsData) ? callRecordsData : [];

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

        {/* Recent Calls - Card-based layout for better visibility */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Recent Calls
            </CardTitle>
            <Badge variant="outline" className="font-normal">
              {callRecords.length} calls
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {callRecords?.map((call) => {
                const statusInfo = getStatusInfo(call.call_status, call.call_outcome);
                const StatusIcon = statusInfo.icon;
                const isInbound = call.call_direction === "inbound";
                
                return (
                  <div 
                    key={call.id} 
                    className="p-4 hover:bg-muted/30 transition-colors flex items-center gap-4"
                  >
                    {/* Caller Avatar with Direction Indicator */}
                    <div className="relative">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-semibold ${
                        isInbound ? 'bg-green-500/10 text-green-500' : 'bg-blue-500/10 text-blue-500'
                      }`}>
                        {getCountryFlag(call.caller_country)}
                      </div>
                      <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center ${
                        isInbound ? 'bg-green-500' : 'bg-blue-500'
                      }`}>
                        {isInbound ? (
                          <PhoneIncoming className="h-3 w-3 text-white" />
                        ) : (
                          <PhoneOutgoing className="h-3 w-3 text-white" />
                        )}
                      </div>
                    </div>

                    {/* Caller Info - Main Focus */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-foreground text-lg tracking-wide">
                          {formatPhoneNumber(call.caller_number)}
                        </span>
                        {call.appointment_set && (
                          <Badge className="bg-green-500/20 text-green-500 border-green-500/30 text-xs">
                            <Calendar className="h-3 w-3 mr-1" />
                            Appt Set
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        {(call.caller_city || call.caller_state || call.caller_country) && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {[call.caller_city, call.caller_state, call.caller_country].filter(Boolean).join(', ')}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {call.created_at ? format(new Date(call.created_at), "MMM d, h:mm a") : "-"}
                        </span>
                      </div>
                    </div>

                    {/* Duration - Prominent Display */}
                    <div className="text-right hidden sm:block">
                      <div className="text-lg font-mono font-medium text-foreground">
                        {call.duration_seconds 
                          ? `${Math.floor(call.duration_seconds / 60)}:${String(call.duration_seconds % 60).padStart(2, '0')}`
                          : "--:--"}
                      </div>
                      <div className="text-xs text-muted-foreground">duration</div>
                    </div>

                    {/* Score - Visual Indicator */}
                    {call.call_score !== null && call.call_score !== undefined ? (
                      <div className="hidden md:flex flex-col items-center">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                          call.call_score >= 80 ? 'bg-green-500/20 text-green-500' :
                          call.call_score >= 60 ? 'bg-yellow-500/20 text-yellow-500' : 
                          'bg-red-500/20 text-red-500'
                        }`}>
                          {call.call_score}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">score</div>
                      </div>
                    ) : (
                      <div className="hidden md:flex flex-col items-center">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center bg-muted/30 text-muted-foreground text-sm">
                          --
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">score</div>
                      </div>
                    )}

                    {/* Status Badge */}
                    <Badge 
                      variant="outline" 
                      className={`${statusInfo.color} border flex items-center gap-1.5 px-3 py-1.5`}
                    >
                      <StatusIcon className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{statusInfo.label}</span>
                    </Badge>
                  </div>
                );
              })}
            </div>
            {(!callRecords || callRecords.length === 0) && (
              <div className="text-center py-12 text-muted-foreground">
                <Phone className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No call records found</p>
              </div>
            )}
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
                  <span className="font-medium flex items-center gap-2">
                    {getCountryFlag(call.caller_country)}
                    {formatPhoneNumber(call.caller_number)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {call.created_at ? format(new Date(call.created_at), "MMM d, h:mm a") : "-"}
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