"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PreparedAction } from "@/types/ceo";
import { useCEOData } from "@/hooks/use-ceo-data";

// Sub-components
import { CEOHeader } from "@/components/ceo/CEOHeader";
import { CEOBusinessIntelligence } from "@/components/ceo/CEOBusinessIntelligence";
import { CEOStatsGrid } from "@/components/ceo/CEOStatsGrid";
import { CEOClientHealth } from "@/components/ceo/CEOClientHealth";
import { CEOChurnAlerts } from "@/components/ceo/CEOChurnAlerts";
import { CEOCommandInput } from "@/components/ceo/CEOCommandInput";
import { CEOActionCenter } from "@/components/ceo/CEOActionCenter";
import { CEOInsights } from "@/components/ceo/CEOInsights";
import { CEOMemory } from "@/components/ceo/CEOMemory";
import { CEOActionModal } from "@/components/ceo/CEOActionModal";

export function UltimateAICEO() {
  // State
  const [command, setCommand] = useState("");
  const [selectedAction, setSelectedAction] = useState<PreparedAction | null>(
    null,
  );

  // Data & Mutations
  const {
    pendingActions,
    loadingActions,
    executedActions,
    goals,
    calibrationData,
    insights,
    biData,
    loadingBI,
    refetchBI,
    revenueData,
    clientHealth,
    integrationStatus,
    churnAlerts,
    approveAction,
    rejectAction,
    generateSolution,
    runMonitor,
  } = useCEOData();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <CEOHeader runMonitor={runMonitor} />

        {/* Executive Summary */}
        <CEOBusinessIntelligence
          biData={biData}
          loadingBI={loadingBI}
          refetchBI={refetchBI}
        />

        {/* Stats Grid */}
        <CEOStatsGrid
          revenueData={revenueData}
          clientHealth={clientHealth}
          pendingActions={pendingActions}
          goals={goals}
        />

        {/* Client Health & Integration */}
        <CEOClientHealth
          clientHealth={clientHealth}
          integrationStatus={integrationStatus}
        />

        {/* Churn Alerts */}
        <CEOChurnAlerts churnAlerts={churnAlerts} />

        {/* Command Input */}
        <CEOCommandInput
          command={command}
          setCommand={setCommand}
          generateSolution={generateSolution}
        />

        {/* Main Tabs */}
        <Tabs defaultValue="actions" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-white/5 border-white/10">
            <TabsTrigger value="actions" className="text-xs sm:text-sm">
              Pending Actions ({pendingActions?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="insights" className="text-xs sm:text-sm">
              Proactive Insights
            </TabsTrigger>
            <TabsTrigger value="memory" className="text-xs sm:text-sm">
              AI Memory & Learning
            </TabsTrigger>
          </TabsList>

          <TabsContent value="actions" className="mt-4 sm:mt-6">
            <CEOActionCenter
              pendingActions={pendingActions}
              executedActions={executedActions}
              goals={goals}
              loadingActions={loadingActions}
              onSelectAction={setSelectedAction}
              approveAction={approveAction}
            />
          </TabsContent>

          <TabsContent value="insights" className="mt-6">
            <CEOInsights
              insights={insights}
              generateSolution={generateSolution}
            />
          </TabsContent>

          <TabsContent value="memory" className="mt-6">
            <CEOMemory calibrationData={calibrationData} />
          </TabsContent>
        </Tabs>

        {/* Detail Modal */}
        {selectedAction && (
          <CEOActionModal
            selectedAction={selectedAction}
            onClose={() => setSelectedAction(null)}
            approveAction={approveAction}
            rejectAction={rejectAction}
          />
        )}
      </div>
    </div>
  );
}
