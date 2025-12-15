import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  GripVertical
} from "lucide-react";
import { format, differenceInDays } from "date-fns";

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
  { id: "new", label: "New Leads", icon: Users, color: "bg-blue-500", borderColor: "border-blue-500/30" },
  { id: "follow_up", label: "Follow Up", icon: Phone, color: "bg-amber-500", borderColor: "border-amber-500/30" },
  { id: "appointment_set", label: "Appointment Set", icon: Calendar, color: "bg-purple-500", borderColor: "border-purple-500/30" },
  { id: "pitch_given", label: "Pitch Given", icon: Target, color: "bg-cyan-500", borderColor: "border-cyan-500/30" },
  { id: "closed", label: "Closed Won", icon: CheckCircle, color: "bg-success", borderColor: "border-success/30" },
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

  return (
    <Card className="border-border/50 bg-card/80">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          Sales Pipeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STAGES.map((stage) => {
            const stageLeads = leadsByStage[stage.id] || [];
            const Icon = stage.icon;
            const totalValue = stageLeads.reduce((sum, l) => sum + (l.deal_value || 0), 0);

            return (
              <div
                key={stage.id}
                className={cn(
                  "flex-shrink-0 w-72 rounded-xl border-2 transition-all duration-200",
                  stage.borderColor,
                  dragOverStage === stage.id && "border-primary bg-primary/5 scale-[1.02]"
                )}
                onDragOver={(e) => handleDragOver(e, stage.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, stage.id)}
              >
                {/* Stage Header */}
                <div className={cn("p-3 rounded-t-lg", stage.color)}>
                  <div className="flex items-center justify-between text-white">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      <span className="font-medium text-sm">{stage.label}</span>
                    </div>
                    <Badge variant="secondary" className="bg-white/20 text-white">
                      {stageLeads.length}
                    </Badge>
                  </div>
                  {totalValue > 0 && (
                    <p className="text-xs text-white/80 mt-1">
                      AED {totalValue.toLocaleString()}
                    </p>
                  )}
                </div>

                {/* Cards Container */}
                <div className="p-2 space-y-2 min-h-[300px] max-h-[500px] overflow-y-auto bg-muted/10">
                  {stageLeads.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No leads
                    </div>
                  ) : (
                    stageLeads.map((lead) => {
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
                                  "p-3 bg-card rounded-lg border cursor-grab active:cursor-grabbing transition-all duration-200",
                                  "hover:shadow-md hover:-translate-y-0.5",
                                  draggingId === lead.id && "opacity-50 scale-95",
                                  stuck && "border-destructive/50 bg-destructive/5"
                                )}
                              >
                                <div className="flex items-start gap-2">
                                  <GripVertical className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm truncate">
                                      {lead.first_name} {lead.last_name}
                                    </p>
                                    {lead.email && (
                                      <p className="text-xs text-muted-foreground truncate">
                                        {lead.email}
                                      </p>
                                    )}
                                    <div className="flex items-center gap-2 mt-2">
                                      {lead.deal_value && lead.deal_value > 0 && (
                                        <Badge variant="outline" className="text-xs gap-1">
                                          <DollarSign className="h-3 w-3" />
                                          {lead.deal_value.toLocaleString()}
                                        </Badge>
                                      )}
                                      <span className={cn(
                                        "text-xs flex items-center gap-1",
                                        stuck ? "text-destructive" : "text-muted-foreground"
                                      )}>
                                        <Clock className="h-3 w-3" />
                                        {daysInStage}d
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="bg-card border-border">
                              <div className="space-y-1">
                                <p className="font-medium">{lead.first_name} {lead.last_name}</p>
                                {lead.phone && <p className="text-xs">{lead.phone}</p>}
                                {lead.owner_name && (
                                  <p className="text-xs text-muted-foreground">Owner: {lead.owner_name}</p>
                                )}
                                {lead.source && (
                                  <p className="text-xs text-muted-foreground">Source: {lead.source}</p>
                                )}
                                {stuck && (
                                  <p className="text-xs text-destructive">Stuck for {daysInStage} days!</p>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Stage Flow Indicator */}
        <div className="flex items-center justify-center gap-2 mt-4 text-muted-foreground">
          {STAGES.map((stage, index) => (
            <div key={stage.id} className="flex items-center gap-2">
              <div className={cn("w-3 h-3 rounded-full", stage.color)} />
              <span className="text-xs">{stage.label}</span>
              {index < STAGES.length - 1 && (
                <ArrowRight className="h-4 w-4 mx-1" />
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
