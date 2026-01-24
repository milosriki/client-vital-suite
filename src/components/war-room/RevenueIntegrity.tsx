import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  Users,
  RefreshCw,
  Loader2,
  Pause,
  Zap,
  DollarSign,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface RevenueIntegrityProps {
  buriedLeads: any[];
  stalledDeals: any[];
  discountedDeals: any[];
  isLoading: boolean;
  isReassigning: boolean;
  setIsReassigning: (value: boolean) => void;
  isSendingBreakup: boolean;
  setIsSendingBreakup: (value: boolean) => void;
  queryClient: any;
}

export const RevenueIntegrity = ({
  buriedLeads,
  stalledDeals,
  discountedDeals,
  isLoading,
  isReassigning,
  setIsReassigning,
  isSendingBreakup,
  setIsSendingBreakup,
  queryClient,
}: RevenueIntegrityProps) => {
  const handleReassignLeads = async () => {
    if (buriedLeads.length === 0) {
      toast.info("No buried leads to reassign");
      return;
    }

    setIsReassigning(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "auto-reassign-leads",
        {
          body: {
            lead_ids: buriedLeads.map((l) => l.hubspot_id || l.id),
            reason: "BURIED_LEAD_7_DAYS_NO_ACTIVITY",
          },
        },
      );

      if (error) throw error;

      const proposalsCreated = data?.proposals_created || 0;

      if (proposalsCreated > 0) {
        toast.success(
          `${proposalsCreated} lead reassignment proposals queued for CEO approval`,
          {
            description:
              "Check AI Agent Approvals to review and approve reassignments",
            duration: 5000,
          },
        );
      } else {
        toast.info(
          "No leads met the reassignment criteria (5+ call attempts required)",
        );
      }

      queryClient.invalidateQueries({ queryKey: ["war-room-leads"] });
    } catch (error) {
      console.error("Failed to reassign leads:", error);
      toast.error("Failed to process lead reassignments", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsReassigning(false);
    }
  };

  const handleSendBreakupEmails = async () => {
    if (stalledDeals.length === 0) {
      toast.info("No stalled deals to send break-up emails");
      return;
    }

    setIsSendingBreakup(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "intervention-recommender",
        {
          body: {
            zones: ["RED", "YELLOW"],
            generate_messages: true,
            save_to_db: true,
            limit: stalledDeals.length,
          },
        },
      );

      if (error) throw error;

      const recommendationsCount = data?.count || 0;

      if (recommendationsCount > 0) {
        toast.success(
          `${recommendationsCount} break-up email drafts generated`,
          {
            description: "Review in Intervention Log before sending",
            duration: 5000,
          },
        );
      } else {
        toast.info("No intervention recommendations generated");
      }

      queryClient.invalidateQueries({ queryKey: ["war-room-deals"] });
    } catch (error) {
      console.error("Failed to generate break-up emails:", error);
      toast.error("Failed to generate break-up emails", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsSendingBreakup(false);
    }
  };

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="h-5 w-5 text-amber-400" />
        <h2 className="text-lg font-semibold text-zinc-200">
          Revenue Integrity - Leakage Detector
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Buried Leads */}
        <Card
          className={`border ${buriedLeads.length > 0 ? "border-red-500/50 bg-red-500/5" : "border-zinc-800 bg-zinc-900/50"}`}
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-zinc-400">Buried Leads</span>
              <Users className="h-4 w-4 text-red-400" />
            </div>
            <div className="text-4xl font-bold text-red-400 font-mono mb-2">
              {isLoading ? (
                <Skeleton className="h-10 w-12 bg-zinc-800" />
              ) : (
                buriedLeads.length
              )}
            </div>
            <p className="text-xs text-zinc-500 mb-4">
              &gt; 7 days old with no activity
            </p>
            <Button
              onClick={handleReassignLeads}
              disabled={buriedLeads.length === 0 || isReassigning}
              className="w-full bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30"
            >
              {isReassigning ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {isReassigning ? "Reassigning..." : "Reassign to Shark Team"}
            </Button>
          </CardContent>
        </Card>

        {/* Stalled Deals */}
        <Card
          className={`border ${stalledDeals.length > 0 ? "border-amber-500/50 bg-amber-500/5" : "border-zinc-800 bg-zinc-900/50"}`}
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-zinc-400">Stalled Deals</span>
              <Pause className="h-4 w-4 text-amber-400" />
            </div>
            <div className="text-4xl font-bold text-amber-400 font-mono mb-2">
              {isLoading ? (
                <Skeleton className="h-10 w-12 bg-zinc-800" />
              ) : (
                stalledDeals.length
              )}
            </div>
            <p className="text-xs text-zinc-500 mb-4">
              Stuck in same stage &gt; 14 days
            </p>
            <Button
              onClick={handleSendBreakupEmails}
              disabled={stalledDeals.length === 0 || isSendingBreakup}
              className="w-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30"
            >
              {isSendingBreakup ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Zap className="h-4 w-4 mr-2" />
              )}
              {isSendingBreakup ? "Generating..." : "Send Break-up Emails"}
            </Button>
          </CardContent>
        </Card>

        {/* Discount Abuse */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-zinc-400">Discount Abuse</span>
              <DollarSign className="h-4 w-4 text-zinc-500" />
            </div>
            <div className="text-4xl font-bold text-zinc-400 font-mono mb-2">
              {discountedDeals.length}
            </div>
            <p className="text-xs text-zinc-500 mb-4">
              Deals with &gt; 20% discount
            </p>
            <Button
              disabled
              className="w-full bg-zinc-800 text-zinc-500 border border-zinc-700"
            >
              Flag for Review
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
