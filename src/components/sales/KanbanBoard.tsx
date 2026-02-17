import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { 
  Users, 
  Phone, 
  Calendar, 
  Target, 
  CheckCircle, 
  XCircle,
  DollarSign,
  Clock,
  ArrowRight,
  GripVertical,
  TrendingUp
} from "lucide-react";
import { differenceInDays, formatDistanceToNow } from "date-fns";

interface Lead {
  id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  status: string;
  created_at: string;
  deal_value?: number;
  owner_name?: string;
  source?: string;
}

interface KanbanBoardProps {
  leads: Lead[];
  onMoveCard?: (leadId: string, newStatus: string) => void;
}

const STAGES = [
  { id: "new", label: "New Leads", icon: Users, color: "bg-blue-500", textColor: "text-blue-500", borderColor: "border-blue-500/30", bgLight: "bg-blue-500/10" },
  { id: "follow_up", label: "Follow Up", icon: Phone, color: "bg-amber-500", textColor: "text-amber-500", borderColor: "border-amber-500/30", bgLight: "bg-amber-500/10" },
  { id: "appointment_set", label: "Appointment Set", icon: Calendar, color: "bg-purple-500", textColor: "text-purple-500", borderColor: "border-purple-500/30", bgLight: "bg-purple-500/10" },
  { id: "pitch_given", label: "Pitch Given", icon: Target, color: "bg-cyan-500", textColor: "text-cyan-500", borderColor: "border-cyan-500/30", bgLight: "bg-cyan-500/10" },
  { id: "closed", label: "Closed Won", icon: CheckCircle, color: "bg-success", textColor: "text-success", borderColor: "border-success/30", bgLight: "bg-success/10" },
];

export function KanbanBoard({ leads, onMoveCard }: KanbanBoardProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  const leadsByStage = useMemo(() => {
    const grouped: Record<string, Lead[]> = {};
    STAGES.forEach(stage => {
      grouped[stage.id] = leads.filter(lead => lead.status === stage.id);
    });
    return grouped;
  }, [leads]);

  const totalPipelineValue = useMemo(() => {
    return leads.reduce((sum, l) => sum + (Number(l.deal_value) || 0), 0);
  }, [leads]);

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    setDraggingId(leadId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    setDragOverStage(stageId);
  };

  const handleDragLeave = () => {
    setDragOverStage(null);
  };

  const handleDrop = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    if (draggingId && onMoveCard) {
      onMoveCard(draggingId, stageId);
    }
    setDraggingId(null);
    setDragOverStage(null);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverStage(null);
  };

  const isStuck = (lead: Lead) => {
    const daysInStage = differenceInDays(new Date(), new Date(lead.created_at));
    return daysInStage > 7;
  };

  const getInitials = (firstName?: string, lastName?: string) => {
    const first = firstName?.charAt(0) || "";
    const last = lastName?.charAt(0) || "";
    return (first + last).toUpperCase() || "?";
  };

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Sales Pipeline
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {leads.length} leads • AED {totalPipelineValue.toLocaleString()} total value
            </p>
          </div>
          <Badge variant="outline" className="gap-2 px-3 py-1.5">
            <TrendingUp className="h-4 w-4 text-success" />
            <span className="font-mono">AED {totalPipelineValue.toLocaleString()}</span>
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pb-6">
        {/* Kanban Columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {STAGES.map((stage) => {
            const stageLeads = leadsByStage[stage.id] || [];
            const Icon = stage.icon;
            const totalValue = stageLeads.reduce((sum, l) => sum + (Number(l.deal_value) || 0), 0);

            return (
              <div
                key={stage.id}
                className={cn(
                  "flex flex-col rounded-xl border-2 transition-all duration-200 overflow-hidden",
                  stage.borderColor,
                  dragOverStage === stage.id && "border-primary bg-primary/5 scale-[1.02] shadow-lg"
                )}
                onDragOver={(e) => handleDragOver(e, stage.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, stage.id)}
              >
                {/* Stage Header */}
                <div className="p-3 border-b border-border/50 bg-muted/20">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className={cn("p-1.5 rounded-lg", stage.bgLight)}>
                        <Icon className={cn("h-4 w-4", stage.textColor)} />
                      </div>
                      <span className="font-medium text-sm">{stage.label}</span>
                    </div>
                    <Badge variant="secondary" className="text-xs font-mono">
                      {stageLeads.length}
                    </Badge>
                  </div>
                  {totalValue > 0 && (
                    <p className="text-xs text-muted-foreground font-mono pl-8">
                      AED {totalValue.toLocaleString()}
                    </p>
                  )}
                </div>

                {/* Cards Container */}
                <ScrollArea className="flex-1 max-h-[400px]">
                  <div className="p-2 space-y-2 min-h-[200px]">
                    {stageLeads.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground/50">
                        <Icon className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p className="text-xs">No leads</p>
                      </div>
                    ) : (
                      stageLeads.slice(0, 10).map((lead) => {
                        const stuck = isStuck(lead);
                        const daysInStage = differenceInDays(new Date(), new Date(lead.created_at));

                        return (
                          <TooltipProvider key={lead.id}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, lead.id)}
                                  onDragEnd={handleDragEnd}
                                  className={cn(
                                    "group p-3 bg-card rounded-lg border cursor-grab active:cursor-grabbing transition-all duration-200",
                                    "hover:shadow-md hover:-translate-y-0.5 hover:border-primary/30",
                                    draggingId === lead.id && "opacity-50 scale-95 ring-2 ring-primary",
                                    stuck && "border-destructive/50 bg-destructive/5"
                                  )}
                                >
                                  <div className="flex items-start gap-2">
                                    <Avatar className="h-8 w-8 shrink-0">
                                      <AvatarFallback className={cn("text-xs font-medium", stage.bgLight, stage.textColor)}>
                                        {getInitials(lead.first_name, lead.last_name)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                                        {lead.first_name || "Unknown"} {lead.last_name || ""}
                                      </p>
                                      {lead.email && (
                                        <p className="text-xs text-muted-foreground truncate">
                                          {lead.email}
                                        </p>
                                      )}
                                    </div>
                                    <GripVertical className="h-4 w-4 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                  </div>
                                  
                                  <div className="flex items-center gap-2 mt-2 pl-10">
                                    {lead.deal_value && lead.deal_value > 0 && (
                                      <Badge variant="secondary" className="text-xs gap-1 font-mono">
                                        <DollarSign className="h-3 w-3" />
                                        {lead.deal_value.toLocaleString()}
                                      </Badge>
                                    )}
                                    <span className={cn(
                                      "text-[10px] flex items-center gap-1 ml-auto",
                                      stuck ? "text-destructive" : "text-muted-foreground"
                                    )}>
                                      <Clock className="h-3 w-3" />
                                      {daysInStage}d
                                    </span>
                                  </div>
                                  
                                  {lead.owner_name && (
                                    <div className="mt-2 pt-2 border-t border-border/30 pl-10">
                                      <p className="text-[10px] text-muted-foreground">
                                        {lead.owner_name}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent className="bg-card border-border max-w-xs">
                                <div className="space-y-1">
                                  <p className="font-medium">{lead.first_name} {lead.last_name}</p>
                                  {lead.email && <p className="text-xs">{lead.email}</p>}
                                  {lead.phone && <p className="text-xs">{lead.phone}</p>}
                                  {lead.owner_name && (
                                    <p className="text-xs text-muted-foreground">Owner: {lead.owner_name}</p>
                                  )}
                                  {lead.source && (
                                    <p className="text-xs text-muted-foreground">Source: {lead.source}</p>
                                  )}
                                  {stuck && (
                                    <p className="text-xs text-destructive font-medium">⚠️ Stuck for {daysInStage} days!</p>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        );
                      })
                    )}
                    
                    {stageLeads.length > 10 && (
                      <Button variant="ghost" size="sm" className="w-full text-xs gap-1 mt-2">
                        +{stageLeads.length - 10} more leads
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </ScrollArea>
              </div>
            );
          })}
        </div>

        {/* Stage Flow Indicator */}
        <div className="flex items-center justify-center gap-1 mt-6 text-muted-foreground flex-wrap">
          {STAGES.map((stage, index) => (
            <div key={stage.id} className="flex items-center gap-1">
              <div className={cn("w-2.5 h-2.5 rounded-full", stage.color)} />
              <span className="text-[10px] hidden sm:inline">{stage.label}</span>
              {index < STAGES.length - 1 && (
                <ArrowRight className="h-3 w-3 mx-0.5 text-muted-foreground/30" />
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
