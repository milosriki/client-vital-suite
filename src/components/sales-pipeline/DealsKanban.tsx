import { useState, useMemo } from "react";
import {
  motion,
  AnimatePresence,
  Reorder,
  useDragControls,
} from "framer-motion";
import {
  Deal,
  DealStage,
  dealsApi,
} from "@/features/sales-operations/api/dealsApi";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { DollarSign, GripVertical } from "lucide-react";
import { toast } from "sonner";

// Grouping helper
const groupDealsByStage = (deals: Deal[]) => {
  const columns: Record<DealStage, Deal[]> = {
    new: [],
    qualified: [],
    proposal: [],
    negotiation: [],
    closedwon: [],
    closedlost: [],
  };

  deals.forEach((deal) => {
    if (columns[deal.stage]) {
      columns[deal.stage].push(deal);
    }
  });

  return columns;
};

// Column Config
const stages: { id: DealStage; label: string; color: string }[] = [
  { id: "new", label: "New", color: "bg-blue-500/10 border-blue-500/20" },
  {
    id: "qualified",
    label: "Qualified",
    color: "bg-indigo-500/10 border-indigo-500/20",
  },
  {
    id: "proposal",
    label: "Proposal",
    color: "bg-purple-500/10 border-purple-500/20",
  },
  {
    id: "negotiation",
    label: "Negotiation",
    color: "bg-amber-500/10 border-amber-500/20",
  },
  {
    id: "closedwon",
    label: "Won",
    color: "bg-green-500/10 border-green-500/20",
  },
];

interface KanbanCardProps {
  deal: Deal;
}

const KanbanCard = ({ deal }: KanbanCardProps) => {
  const controls = useDragControls();

  return (
    <Card className="mb-3 hover:shadow-md transition-shadow bg-white/50 backdrop-blur-sm border-l-4 border-l-primary/50 cursor-grab active:cursor-grabbing">
      <CardContent className="p-3">
        <div className="flex justify-between items-start mb-2">
          <h4 className="font-semibold text-sm line-clamp-2">
            {deal.deal_name}
          </h4>
          <GripVertical className="h-4 w-4 text-muted-foreground opacity-50" />
        </div>

        <div className="flex justify-between items-center text-xs text-muted-foreground mt-2">
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
  );
};

interface DealsKanbanProps {
  deals: Deal[];
}

export const DealsKanban = ({ deals }: DealsKanbanProps) => {
  const queryClient = useQueryClient();
  const [activeDrag, setActiveDrag] = useState<string | null>(null);

  // Optimistic Mutation
  const updateStageMutation = useMutation({
    mutationFn: dealsApi.updateDealStage,
    onMutate: async (newDeal) => {
      await queryClient.cancelQueries({ queryKey: ["deals-summary"] });
      const previousDeals = queryClient.getQueryData<any>(["deals-summary"]);

      queryClient.setQueryData(["deals-summary"], (old: any) => {
        if (!old || !old.deals) return old;
        return {
          ...old,
          deals: old.deals.map((d: Deal) =>
            d.id === newDeal.dealId ? { ...d, stage: newDeal.stage } : d,
          ),
        };
      });

      return { previousDeals };
    },
    onError: (err, newDeal, context) => {
      toast.error("Failed to move deal");
      if (context?.previousDeals) {
        queryClient.setQueryData(["deals-summary"], context.previousDeals);
      }
    },
    onSuccess: () => {
      toast.success("Deal moved!", { position: "top-center", duration: 1000 });
      queryClient.invalidateQueries({ queryKey: ["deals-summary"] });
    },
  });

  const columns = useMemo(() => groupDealsByStage(deals), [deals]);

  return (
    <div className="flex h-[calc(100vh-200px)] overflow-x-auto gap-4 p-2 pb-4">
      {stages.map((stage) => (
        <div
          key={stage.id}
          className={`flex-shrink-0 w-72 rounded-lg flex flex-col ${stage.color} border p-2`}
        >
          <div className="flex justify-between items-center px-2 py-3 mb-2">
            <h3 className="font-bold text-sm uppercase tracking-wider">
              {stage.label}
            </h3>
            <Badge variant="secondary" className="text-xs bg-background/50">
              {columns[stage.id].length}
            </Badge>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar space-y-2">
            {columns[stage.id].map((deal) => (
              <motion.div
                key={deal.id}
                layoutId={deal.id}
                drag={stage.id !== "closedwon"} // Disable drag FROM Won for safety? actually maybe enabled is mostly fine
                dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                dragElastic={0.1}
                whileHover={{ scale: 1.02 }}
                whileDrag={{ scale: 1.05, zIndex: 50, cursor: "grabbing" }}
                onDragEnd={(e, { point }) => {
                  // Since we don't have true "Drop Zones" with pure Framer Motion dragConstraints easily without refs,
                  // Implementing a simple "Next/Prev" or dedicated "Reorder" is easier.
                  // BUT to support "Board Dragging", we usually need a library like dnd-kit.
                  // Since libraries failed, I will implement a simpler "Action Intercept" or
                  // rely on "Click to Move" for now if Drag is too complex without dnd-kit context.
                  // WAIT: Reorder.Group is for Lists.
                  // Cross-list dragging in framer-motion requires significant boilerplate (SharedLayout).
                  // Given constraints, I will make the cards interactive with a "Quick Move" menu or
                  // stick to a 'List' view Reorder?
                  // FALLBACK STRATEGY:
                  // High-fidelity "Click to Move" with animation is safer than broken DnD.
                  // I will implement a Context Menu or Action Sheet on click.
                }}
              >
                {/** Use Context Menu for Moves if DnD is blocked **/}
                <KanbanCard deal={deal} />
              </motion.div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
