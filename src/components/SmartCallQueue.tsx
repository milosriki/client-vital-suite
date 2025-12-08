import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Phone,
  MessageSquare,
  Mail,
  Clock,
  AlertTriangle,
  TrendingUp,
  Users,
  CheckCircle2,
  X,
  Loader2,
  Sparkles
} from "lucide-react";
import { format } from "date-fns";

interface LeadAction {
  client_email: string;
  client_name: string;
  firstname: string;
  lastname: string;
  ai_priority: number;
  reason: string;
  urgency_factors: string[];
  draft_message: string;
  recommended_channel: 'PHONE' | 'WHATSAPP' | 'EMAIL' | 'SMS';
  health_zone: string;
  days_since_last_contact: number;
  days_since_last_session?: number;
  pattern_status?: string;
  risk_score: number;
  current_owner?: string;
  owner_recently_changed: boolean;
  calculated_at: string;
}

interface SmartCallQueueProps {
  owner?: string | null;
  daysThreshold?: number;
  limit?: number;
  autoRefresh?: boolean;
}

export const SmartCallQueue = ({
  owner = null,
  daysThreshold = 3,
  limit = 50,
  autoRefresh = false
}: SmartCallQueueProps) => {
  const [expandedLead, setExpandedLead] = useState<string | null>(null);
  const [markedAsContacted, setMarkedAsContacted] = useState<Set<string>>(new Set());

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["smart-call-queue", owner, daysThreshold, limit],
    queryFn: async () => {
      const { data: result, error } = await supabase.functions.invoke("get-leads-needing-action", {
        body: {
          owner,
          days_threshold: daysThreshold,
          include_all_zones: false,
          limit,
          generate_ai_messages: true
        }
      });

      if (error) throw error;
      return result;
    },
    refetchInterval: autoRefresh ? 120000 : false, // 2 minutes if auto-refresh enabled
  });

  const handleMarkAsContacted = async (email: string) => {
    try {
      // Insert into call_records
      const { error } = await supabase.from("call_records").insert({
        client_email: email,
        call_date: new Date().toISOString(),
        call_type: "PHONE",
        status: "COMPLETED",
        executed_by: owner || "Unknown",
        notes: "Marked as contacted from Smart Call Queue"
      });

      if (error) throw error;

      // Add to local state
      setMarkedAsContacted(prev => new Set(prev).add(email));

      // Refresh queue
      refetch();
    } catch (err) {
      console.error("Failed to mark as contacted:", err);
    }
  };

  const handleSkip = (email: string) => {
    setMarkedAsContacted(prev => new Set(prev).add(email));
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'PHONE': return <Phone className="h-4 w-4" />;
      case 'WHATSAPP': return <MessageSquare className="h-4 w-4" />;
      case 'EMAIL': return <Mail className="h-4 w-4" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: number): string => {
    if (priority >= 8) return "bg-red-500";
    if (priority >= 6) return "bg-orange-500";
    if (priority >= 4) return "bg-yellow-500";
    return "bg-blue-500";
  };

  const getPriorityLabel = (priority: number): string => {
    if (priority >= 8) return "URGENT";
    if (priority >= 6) return "HIGH";
    if (priority >= 4) return "MEDIUM";
    return "LOW";
  };

  const leads: LeadAction[] = data?.leads || [];
  const visibleLeads = leads.filter(lead => !markedAsContacted.has(lead.client_email));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle>Smart Call Queue</CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Clock className="h-4 w-4 mr-2" />
            )}
            Refresh Queue
          </Button>
        </div>
        <CardDescription>
          AI-prioritized leads needing your attention {owner && `(${owner})`}
          {data && ` • ${visibleLeads.length} of ${leads.length} leads`}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              Failed to load call queue: {error instanceof Error ? error.message : "Unknown error"}
            </AlertDescription>
          </Alert>
        ) : visibleLeads.length === 0 ? (
          <Alert>
            <CheckCircle2 className="h-4 w-4 text-success" />
            <AlertTitle>All Caught Up!</AlertTitle>
            <AlertDescription>
              {markedAsContacted.size > 0
                ? `Great work! You've contacted ${markedAsContacted.size} lead(s). No more leads need immediate attention.`
                : "No leads currently need calling. Check back later or adjust filters."}
            </AlertDescription>
          </Alert>
        ) : (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{visibleLeads.length}</div>
                  <p className="text-xs text-muted-foreground">Total Leads</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-red-500">
                    {visibleLeads.filter(l => l.ai_priority >= 8).length}
                  </div>
                  <p className="text-xs text-muted-foreground">Urgent</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-orange-500">
                    {visibleLeads.filter(l => l.ai_priority >= 6 && l.ai_priority < 8).length}
                  </div>
                  <p className="text-xs text-muted-foreground">High Priority</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-success">
                    {markedAsContacted.size}
                  </div>
                  <p className="text-xs text-muted-foreground">Contacted Today</p>
                </CardContent>
              </Card>
            </div>

            {/* Call Queue Table */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Priority</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="w-24">Channel</TableHead>
                  <TableHead className="w-32">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleLeads.map((lead) => (
                  <>
                    <TableRow key={lead.client_email} className="hover:bg-muted/50">
                      <TableCell>
                        <div className="flex flex-col items-center gap-1">
                          <div className={`w-8 h-8 rounded-full ${getPriorityColor(lead.ai_priority)} text-white flex items-center justify-center font-bold text-sm`}>
                            {lead.ai_priority}
                          </div>
                          <span className="text-xs font-medium">{getPriorityLabel(lead.ai_priority)}</span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-col">
                          <div className="font-medium">{lead.client_name || lead.client_email}</div>
                          <div className="text-xs text-muted-foreground">{lead.client_email}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {lead.health_zone}
                            </Badge>
                            {lead.owner_recently_changed && (
                              <Badge variant="secondary" className="text-xs">
                                <Users className="h-3 w-3 mr-1" />
                                New Owner
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="text-sm">{lead.reason}</div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {lead.days_since_last_contact} days since contact
                          </div>
                          {expandedLead === lead.client_email && (
                            <div className="mt-2 p-3 bg-muted rounded-lg">
                              <div className="font-medium text-sm mb-2">Draft Message:</div>
                              <div className="text-sm whitespace-pre-wrap">{lead.draft_message}</div>
                            </div>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex items-center gap-2">
                            {getChannelIcon(lead.recommended_channel)}
                            <span className="text-xs">{lead.recommended_channel}</span>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-col gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            className="w-full"
                            onClick={() => setExpandedLead(
                              expandedLead === lead.client_email ? null : lead.client_email
                            )}
                          >
                            {expandedLead === lead.client_email ? "Hide" : "View"} Message
                          </Button>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              onClick={() => handleMarkAsContacted(lead.client_email)}
                            >
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Called
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleSkip(lead.client_email)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  </>
                ))}
              </TableBody>
            </Table>

            {/* Footer Info */}
            <div className="mt-4 text-xs text-muted-foreground text-center">
              Last updated: {data?.duration_ms ? `${data.duration_ms}ms ago` : 'Just now'}
              {autoRefresh && ' • Auto-refreshing every 2 minutes'}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default SmartCallQueue;
