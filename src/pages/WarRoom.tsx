import { useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Crown, Zap, Pause, Rocket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// Components & Hooks
import { useWarRoomData } from "@/components/war-room/hooks/useWarRoomData";
import { UnitEconomics } from "@/components/war-room/UnitEconomics";
import { PredictiveForecasting } from "@/components/war-room/PredictiveForecasting";
import { RevenueIntegrity } from "@/components/war-room/RevenueIntegrity";
import { MarketPulse } from "@/components/war-room/MarketPulse";

const WarRoom = () => {
  const {
    adSpend,
    setAdSpend,
    autoPilotEnabled,
    setAutoPilotEnabled,
    isReassigning,
    setIsReassigning,
    isSendingBreakup,
    setIsSendingBreakup,
    queryClient,
    cac,
    ltv,
    ltvCacRatio,
    burnMultiple,
    buriedLeads,
    stalledDeals,
    discountedDeals,
    forecastData,
    gapToTarget,
    isLoading,
    dealsError,
    leadsError,
    clientsError,
  } = useWarRoomData();

  // Show error toast if any query fails
  useEffect(() => {
    if (dealsError) toast.error("Failed to load deals data");
    if (leadsError) toast.error("Failed to load leads data");
    if (clientsError) toast.error("Failed to load client data");
  }, [dealsError, leadsError, clientsError]);

  const handleAutoPilotToggle = async (enabled: boolean) => {
    setAutoPilotEnabled(enabled);

    if (enabled) {
      try {
        const { error } = await supabase.functions.invoke("ptd-24x7-monitor", {
          body: {
            action: "start",
            mode: "autonomous",
            config: {
              auto_reassign_leads: true,
              auto_intervention_alerts: true,
              auto_churn_detection: true,
              sla_breach_monitoring: true,
            },
          },
        });

        if (error) {
          setAutoPilotEnabled(false);
          throw error;
        }

        toast.success("Auto-Pilot ENGAGED - AI is now managing operations", {
          description:
            "Monitoring: Lead reassignment, Churn detection, SLA breaches",
          icon: <Rocket className="h-4 w-4" />,
          duration: 5000,
        });
      } catch (error) {
        console.error("Failed to enable Auto-Pilot:", error);
        toast.error("Failed to enable Auto-Pilot", {
          description: error instanceof Error ? error.message : "Unknown error",
        });
      }
    } else {
      try {
        await supabase.functions.invoke("ptd-24x7-monitor", {
          body: { action: "stop" },
        });

        toast.info("Auto-Pilot disengaged - Manual control restored");
      } catch (error) {
        console.error("Failed to disable Auto-Pilot:", error);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a12] text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30">
            <Crown className="h-8 w-8 text-amber-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-200 to-amber-500 bg-clip-text text-transparent">
              CEO War Room
            </h1>
            <p className="text-zinc-500 text-sm">Strategic Command Center</p>
          </div>
        </div>

        {/* Auto-Pilot Switch */}
        <div className="flex items-center gap-4 p-4 rounded-xl bg-zinc-900/50 border border-zinc-800">
          <div className="flex items-center gap-2">
            {autoPilotEnabled ? (
              <Zap className="h-5 w-5 text-amber-400 animate-pulse" />
            ) : (
              <Pause className="h-5 w-5 text-zinc-500" />
            )}
            <span className="font-medium">Auto-Pilot</span>
          </div>
          <Switch
            checked={autoPilotEnabled}
            onCheckedChange={handleAutoPilotToggle}
            className="data-[state=checked]:bg-amber-500"
          />
          {autoPilotEnabled && (
            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
              AI ACTIVE
            </Badge>
          )}
        </div>
      </div>

      {/* Section 1: Unit Economics */}
      <UnitEconomics
        adSpend={adSpend}
        setAdSpend={setAdSpend}
        cac={cac}
        ltv={ltv}
        ltvCacRatio={ltvCacRatio}
        burnMultiple={burnMultiple}
        isLoading={isLoading}
      />

      {/* Section 2: Predictive Forecasting */}
      <PredictiveForecasting
        forecastData={forecastData}
        gapToTarget={gapToTarget}
      />

      {/* Section 3: Revenue Integrity */}
      <RevenueIntegrity
        buriedLeads={buriedLeads}
        stalledDeals={stalledDeals}
        discountedDeals={discountedDeals}
        isLoading={isLoading}
        isReassigning={isReassigning}
        setIsReassigning={setIsReassigning}
        isSendingBreakup={isSendingBreakup}
        setIsSendingBreakup={setIsSendingBreakup}
        queryClient={queryClient}
      />

      {/* Section 4: Market Pulse */}
      <MarketPulse />

      {/* Auto-Pilot Status Footer */}
      {autoPilotEnabled && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
          <div className="flex items-center gap-3 px-6 py-3 rounded-full bg-amber-500/20 border border-amber-500/40 backdrop-blur-sm">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-amber-400 font-medium">
              Auto-Pilot Active
            </span>
            <span className="text-amber-400/60 text-sm">
              • Monitoring all systems
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default WarRoom;
