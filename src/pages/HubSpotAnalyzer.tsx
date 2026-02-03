import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useDedupedQuery } from "@/hooks/useDedupedQuery";
import { AnalyzerHeader } from "@/components/hubspot-analyzer/AnalyzerHeader";
import { MetricsGrid } from "@/components/hubspot-analyzer/MetricsGrid";
import { ActionPlan } from "@/components/hubspot-analyzer/ActionPlan";
import { WorkflowAnalysis } from "@/components/hubspot-analyzer/WorkflowAnalysis";
import { LeadLossAnalysis } from "@/components/hubspot-analyzer/LeadLossAnalysis";
import { PropertyAudit } from "@/components/hubspot-analyzer/PropertyAudit";
import {
  CriticalMetrics,
  Recommendation,
  CriticalIssue,
} from "@/components/hubspot-analyzer/types";
import { Skeleton } from "@/components/ui/skeleton";

const HubSpotAnalyzer = () => {
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch Property Counts (Keep this as it was working and independent)
  const { data: propertyCounts, isLoading: propsLoading } = useDedupedQuery({
    queryKey: ["hubspot-property-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hubspot_property_definitions")
        .select("object_type");

      if (error) throw error;

      const contactProps = data.filter(
        (p) => p.object_type === "contact",
      ).length;
      const dealProps = data.filter((p) => p.object_type === "deal").length;

      return {
        total: data.length,
        contact: contactProps,
        deal: dealProps,
      };
    },
  });

  // Fetch Real Analysis from Edge Function
  const { data: analysisData, isLoading: analysisLoading } = useDedupedQuery({
    queryKey: ["hubspot-analyzer-data"],
    queryFn: async () => {
      const { data, error } =
        await supabase.functions.invoke("hubspot-analyzer");
      if (error) throw error;
      return data;
    },
  });

  const isLoading = propsLoading || analysisLoading;

  const metrics: CriticalMetrics = {
    totalWorkflows: 0,
    activeWorkflows: 0,
    inactiveWorkflows: 0,
    totalProperties:
      analysisData?.summary?.totalProperties || propertyCounts?.total || 0,
    contactProperties:
      analysisData?.summary?.contactProperties || propertyCounts?.contact || 0,
    dealProperties:
      analysisData?.summary?.dealProperties || propertyCounts?.deal || 0,
    revenueAtRisk: analysisData?.summary?.totalRevenueAtRisk || 0,
    monthlyRevenueLoss: (analysisData?.summary?.totalRevenueAtRisk || 0) * 0.1,
    buriedPremiumLeads: 0,
    potentialRecovery: (analysisData?.summary?.totalRevenueAtRisk || 0) * 0.2,
    slaBreachRate: parseFloat(analysisData?.summary?.neverCalledRate || "0"),
    blankLeadPercentage: parseFloat(
      analysisData?.summary?.dataQualityIssueRate || "0",
    ),
  };

  const recommendations: Recommendation[] = analysisData?.recommendations || [];
  const leadLossPoints = analysisData?.leadLossPoints || [];

  if (isLoading) {
    return (
      <div className="p-8 space-y-8">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AnalyzerHeader />
      <MetricsGrid metrics={metrics} />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="workflows">Workflows</TabsTrigger>
          <TabsTrigger value="lead-loss">Lead Loss</TabsTrigger>
          <TabsTrigger value="properties">Properties</TabsTrigger>
          <TabsTrigger value="actions">Action Plan</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <ActionPlan recommendations={recommendations} />
        </TabsContent>

        <TabsContent value="workflows" className="space-y-4">
          <WorkflowAnalysis />
        </TabsContent>

        <TabsContent value="lead-loss" className="space-y-4">
          <LeadLossAnalysis points={leadLossPoints} />
        </TabsContent>

        <TabsContent value="properties" className="space-y-4">
          <PropertyAudit
            categories={
              analysisData?.propertyCategories || [
                {
                  category: "Contact Properties",
                  count: metrics.contactProperties,
                  usage: "High",
                  quality: "Good",
                },
                {
                  category: "Deal Properties",
                  count: metrics.dealProperties,
                  usage: "High",
                  quality: "Good",
                },
              ]
            }
            totalProperties={metrics.totalProperties}
          />
        </TabsContent>

        <TabsContent value="actions" className="space-y-4">
          <ActionPlan recommendations={recommendations} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default HubSpotAnalyzer;
