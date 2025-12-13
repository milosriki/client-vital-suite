import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  Phone, PhoneIncoming, PhoneOutgoing, Clock, Calendar, MapPin, 
  User, CheckCircle2, XCircle, AlertCircle, Flame, Thermometer, 
  Snowflake, ChevronDown, ChevronUp, PlayCircle, ExternalLink,
  Plus, DollarSign, StickyNote
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface CallCardProps {
  call: {
    id: string;
    caller_number: string;
    call_status: string;
    call_outcome: string | null;
    call_direction: string | null;
    duration_seconds: number | null;
    call_score: number | null;
    appointment_set: boolean | null;
    recording_url: string | null;
    transcription: string | null;
    created_at: string | null;
    caller_city: string | null;
    caller_state: string | null;
    caller_country: string | null;
    // Joined contact data
    first_name: string | null;
    last_name: string | null;
    city: string | null;
    location: string | null;
    neighborhood: string | null;
    lifecycle_stage: string | null;
    lead_status: string | null;
    owner_name: string | null;
    latest_traffic_source: string | null;
    call_attempt_count: number | null;
    // Joined enhanced lead data
    lead_score: number | null;
    ltv_prediction: number | null;
    campaign_name: string | null;
    dubai_area: string | null;
  };
}

const formatPhoneNumber = (phone: string) => {
  if (!phone) return "-";
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('971')) {
    return `+${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }
  if (digits.length >= 10) {
    return `+${digits.slice(0, -9)} ${digits.slice(-9, -6)} ${digits.slice(-6, -3)} ${digits.slice(-3)}`;
  }
  return phone;
};

const getDurationInSeconds = (ms: number | null | undefined) => {
  if (!ms) return 0;
  return ms > 1000 ? Math.round(ms / 1000) : ms;
};

const formatDuration = (seconds: number) => {
  if (!seconds) return "--:--";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
};

const getLeadQualityInfo = (score: number | null) => {
  if (!score) return { label: "Unknown", icon: Thermometer, className: "bg-muted text-muted-foreground" };
  if (score >= 80) return { label: "Hot Lead", icon: Flame, className: "bg-orange-500/20 text-orange-500 border-orange-500/30 animate-pulse" };
  if (score >= 60) return { label: "Warm", icon: Thermometer, className: "bg-yellow-500/20 text-yellow-500 border-yellow-500/30" };
  return { label: "Cold", icon: Snowflake, className: "bg-blue-500/20 text-blue-400 border-blue-500/30" };
};

const getLifecycleChip = (stage: string | null) => {
  if (!stage) return null;
  const stageMap: Record<string, { label: string; className: string }> = {
    salesqualifiedlead: { label: "SQL", className: "bg-purple-500/20 text-purple-400" },
    marketingqualifiedlead: { label: "MQL", className: "bg-blue-500/20 text-blue-400" },
    lead: { label: "Lead", className: "bg-muted text-muted-foreground" },
    customer: { label: "Customer", className: "bg-green-500/20 text-green-400" },
    subscriber: { label: "Subscriber", className: "bg-sky-500/20 text-sky-400" },
    opportunity: { label: "Opportunity", className: "bg-amber-500/20 text-amber-400" },
  };
  const info = stageMap[stage.toLowerCase()] || { label: stage, className: "bg-muted text-muted-foreground" };
  return <Badge variant="outline" className={cn("text-xs", info.className)}>{info.label}</Badge>;
};

const getStatusInfo = (status: string, outcome: string | null) => {
  if (status === 'completed') {
    if (outcome === 'appointment_set' || outcome === 'qualified') {
      return { color: 'text-green-500 bg-green-500/10 border-green-500/30', icon: CheckCircle2, label: 'Success' };
    }
    if (outcome === 'not_interested' || outcome === 'disqualified') {
      return { color: 'text-red-500 bg-red-500/10 border-red-500/30', icon: XCircle, label: 'No Interest' };
    }
    return { color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30', icon: CheckCircle2, label: 'Completed' };
  }
  if (status === 'no_answer' || status === 'missed') {
    return { color: 'text-orange-500 bg-orange-500/10 border-orange-500/30', icon: AlertCircle, label: 'Missed' };
  }
  if (status === 'initiated' || status === 'ringing') {
    return { color: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30', icon: Phone, label: 'Initiated' };
  }
  return { color: 'text-muted-foreground bg-muted/30', icon: Phone, label: status };
};

const getCallAttemptBadge = (attempts: number | null) => {
  if (!attempts || attempts <= 1) return null;
  if (attempts === 2) return <Badge variant="outline" className="bg-yellow-500/20 text-yellow-500 text-xs">2nd attempt</Badge>;
  return <Badge variant="outline" className="bg-orange-500/20 text-orange-500 text-xs">{attempts}+ attempts</Badge>;
};

export function CallCard({ call }: CallCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const fullName = [call.first_name, call.last_name].filter(Boolean).join(' ');
  const displayName = fullName || formatPhoneNumber(call.caller_number);
  const isInbound = call.call_direction === "inbound";
  const statusInfo = getStatusInfo(call.call_status, call.call_outcome);
  const StatusIcon = statusInfo.icon;
  const leadQuality = getLeadQualityInfo(call.lead_score);
  const LeadIcon = leadQuality.icon;
  const durationSecs = getDurationInSeconds(call.duration_seconds);
  
  // Location: prefer contact city, fall back to call data
  const locationParts = [
    call.city || call.caller_city,
    call.neighborhood || call.dubai_area,
    call.location
  ].filter(Boolean);
  const locationDisplay = locationParts.length > 0 ? locationParts.slice(0, 2).join(', ') : null;

  // Booking probability (simulated based on lead score if not available)
  const bookingProbability = call.lead_score ? Math.min(95, call.lead_score + 10) : null;

  return (
    <Card 
      className={cn(
        "transition-all duration-200 hover:shadow-md cursor-pointer border-border/50",
        isExpanded && "ring-1 ring-primary/30"
      )}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="p-4 space-y-3">
        {/* ROW 1: Identity */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {/* Avatar with direction indicator */}
            <div className="relative flex-shrink-0">
              <div className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center font-semibold text-lg",
                isInbound ? "bg-green-500/10 text-green-500" : "bg-blue-500/10 text-blue-500"
              )}>
                {fullName ? fullName.charAt(0).toUpperCase() : '?'}
              </div>
              <div className={cn(
                "absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center",
                isInbound ? "bg-green-500" : "bg-blue-500"
              )}>
                {isInbound ? <PhoneIncoming className="h-3 w-3 text-white" /> : <PhoneOutgoing className="h-3 w-3 text-white" />}
              </div>
            </div>

            {/* Name and phone */}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-foreground text-lg truncate">{displayName}</span>
                {call.lead_score && (
                  <Badge variant="outline" className={cn("flex items-center gap-1 text-xs", leadQuality.className)}>
                    <LeadIcon className="h-3 w-3" />
                    {leadQuality.label}
                  </Badge>
                )}
                {bookingProbability && (
                  <span className={cn(
                    "text-xs font-medium",
                    bookingProbability >= 70 ? "text-green-500" :
                    bookingProbability >= 40 ? "text-yellow-500" : "text-muted-foreground"
                  )}>
                    {bookingProbability}% likely
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="font-mono">{formatPhoneNumber(call.caller_number)}</span>
                {call.lead_score && (
                  <span className="text-xs">Score: {call.lead_score}</span>
                )}
              </div>
            </div>
          </div>

          {/* Status badge */}
          <Badge variant="outline" className={cn("flex items-center gap-1.5 px-3 py-1.5 flex-shrink-0", statusInfo.color)}>
            <StatusIcon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{statusInfo.label}</span>
          </Badge>
        </div>

        {/* ROW 2: Context */}
        <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
          {locationDisplay && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {locationDisplay}
            </span>
          )}
          {call.owner_name && (
            <span className="flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              {call.owner_name}
            </span>
          )}
          {(call.latest_traffic_source || call.campaign_name) && (
            <span className="flex items-center gap-1 text-primary/70">
              🎯 {call.campaign_name || call.latest_traffic_source}
            </span>
          )}
          {getCallAttemptBadge(call.call_attempt_count)}
          {getLifecycleChip(call.lifecycle_stage)}
        </div>

        {/* ROW 3: Call Details */}
        <div className="flex items-center gap-4 text-sm flex-wrap">
          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono font-medium">{formatDuration(durationSecs)}</span>
          </span>
          
          {call.appointment_set && (
            <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
              <Calendar className="h-3 w-3 mr-1" />
              Appt Set
            </Badge>
          )}
          
          {call.ltv_prediction && (
            <span className="flex items-center gap-1 text-amber-500">
              <DollarSign className="h-4 w-4" />
              LTV: {call.ltv_prediction.toLocaleString()}
            </span>
          )}

          {bookingProbability && (
            <div className="flex items-center gap-2">
              <Progress 
                value={bookingProbability} 
                className={cn(
                  "w-16 h-2",
                  bookingProbability >= 70 ? "[&>div]:bg-green-500" :
                  bookingProbability >= 40 ? "[&>div]:bg-yellow-500" : "[&>div]:bg-muted-foreground"
                )}
              />
            </div>
          )}

          <span className="text-xs text-muted-foreground ml-auto">
            {call.created_at ? format(new Date(call.created_at), "MMM d, h:mm a") : "-"}
          </span>

          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>

        {/* ROW 4: Expanded Details */}
        {isExpanded && (
          <div className="pt-3 border-t border-border/50 space-y-3" onClick={(e) => e.stopPropagation()}>
            {/* Transcription */}
            {call.transcription && (
              <div className="p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <StickyNote className="h-3.5 w-3.5" />
                  Transcription
                </div>
                <p className="text-sm">{call.transcription}</p>
              </div>
            )}

            {/* Quick Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button size="sm" variant="outline" className="gap-1.5">
                <Phone className="h-4 w-4" />
                Call Again
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5">
                <Plus className="h-4 w-4" />
                Create Task
              </Button>
              {call.recording_url && (
                <Button size="sm" variant="outline" className="gap-1.5">
                  <PlayCircle className="h-4 w-4" />
                  Play Recording
                </Button>
              )}
              <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground">
                <ExternalLink className="h-4 w-4" />
                View in HubSpot
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
