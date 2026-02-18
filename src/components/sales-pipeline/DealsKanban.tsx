import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Deal,
  dealsApi,
} from "@/features/sales-operations/api/dealsApi";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { DollarSign } from "lucide-react";
import { toast } from "sonner";
import { DEAL_STAGES, HUBSPOT_STAGE_IDS, STAGE_LABELS } from "@/constants/dealStages";

const KANBAN_STAGES = [
  { id: DEAL_STAGES.DECISION_MAKER_BOUGHT_IN, label: "Called - Follow up", color: "bg-blue-500/10 border-blue-500/20" },
  { id: DEAL_STAGES.QUALIFIED_TO_BUY, label: "Assessment Scheduled", color: "bg-indigo-500/10 border-indigo-500/20" },
  { id: HUBSPOT_STAGE_IDS.ASSESSMENT_BOOKING, label: "Assessment Booking", color: "bg-cyan-500/10 border-cyan-500/20" },
  { id: HUBSPOT_STAGE_IDS.BOOKED, label: "Confirmed", color: "bg-teal-500/10 border-teal-500/20" },
  { id: HUBSPOT_STAGE_IDS.ASSESSMENT_POSTPONED, label: "Postponed", color: "bg-amber-500/10 border-amber-500/20" },
  { id: HUBSPOT_STAGE_IDS.ASSESSMENT_DONE, label: "Assessment Done", color: "bg-purple-500/10 border-purple-500/20" },
  { id: DEAL_STAGES.CONTRACT_SENT, label: "Waiting Decision", color: "bg-orange-500/10 border-orange-500/20" },
  { id: DEAL_STAGES.CLOSED_WON, label: "Won", color: "bg-green-500/10 border-green-500/20" },
  { id: DEAL_STAGES.CLOSED_LOST, label: "Lost", color: "bg-red-500/10 border-red-500/20" },
];

interface DealsKanbanProps {
  deals: Deal[];
  onDealClick?: (deal: Deal) => void;
}

export const DealsKanban = ({ deals, onDealClick }: DealsKanbanProps) => {
  const columns = useMemo(() => {
    const grouped: Record<string, Deal[]> = {};
    KANBAN_STAGES.forEach((s) => (grouped[s.id] = []));
    deals.forEach((deal) => {
      if (grouped[deal.stage]) {
        grouped[deal.stage].push(deal);
      }
    });
    return grouped;
  }, [deals]);

  return (
    <div className="flex h-[calc(100vh-200px)] overflow-x-auto gap-4 p-2 pb-4">
      {KANBAN_STAGES.map((stage) => (
        <div
          key={stage.id}
          className={`flex-shrink-0 w-64 rounded-lg flex flex-col ${stage.color} border p-2`}
        >
          <div className="flex justify-between items-center px-2 py-3 mb-2">
            <h3 className="font-bold text-xs uppercase tracking-wider">
              {stage.label}
            </h3>
            <Badge variant="secondary" className="text-xs bg-background/50">
              {columns[stage.id]?.length || 0}
            </Badge>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar space-y-2">
            {columns[stage.id]?.map((deal) => (
              <motion.div
                key={deal.id}
                whileHover={{ scale: 1.02 }}
                transition={{ duration: 0.15 }}
              >
                <Card
                  className="mb-2 hover:shadow-md hover:bg-muted/30 transition-all duration-200 bg-white/50 backdrop-blur-sm border-l-4 border-l-primary/50 cursor-pointer"
                  onClick={() => onDealClick?.(deal)}
                >
                  <CardContent className="p-3">
                    <h4 className="font-semibold text-sm line-clamp-2 mb-2">
                      {deal.deal_name}
                    </h4>
                    <div className="flex justify-between items-center text-xs text-muted-foreground">
                      <span className="flex items-center gap-1 font-medium text-foreground">
                        <DollarSign className="h-3 w-3" />
                        {deal.amount?.toLocaleString() ?? 0}
                      </span>
                      <span>
                        {format(new Date(deal.created_at || new Date()), "MMM d")}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
