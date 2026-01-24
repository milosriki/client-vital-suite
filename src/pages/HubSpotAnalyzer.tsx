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

  // Fetch Property Counts
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

  // Fetch Revenue at Risk (Stalled Deals)
  const { data: revenueAtRisk, isLoading: revenueLoading } = useDedupedQuery({
    queryKey: ["hubspot-revenue-risk"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select("deal_value")
        .neq("status", "closed")
        .neq("status", "won" as any)
        .lt(
          "updated_at",
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        ); // Older than 30 days

      if (error) throw error;
      return data.reduce((sum, d) => sum + (d.deal_value || 0), 0);
    },
  });

  // Fetch SLA Breach Rate (Leads not contacted in 24h)
  const { data: slaStats, isLoading: slaLoading } = useDedupedQuery({
    queryKey: ["hubspot-sla-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("created_at, status")
        .eq("status", "new")
        .lt(
          "created_at",
          new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        );

      if (error) throw error;

      // Get total new leads for rate calculation
      const { count } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("status", "new");

      return {
        breached: data.length,
        total: count || 1,
        rate: Math.round((data.length / (count || 1)) * 100),
      };
    },
  });

  const isLoading = propsLoading || revenueLoading || slaLoading;

  const metrics: CriticalMetrics = {
    totalWorkflows: 0, // Placeholder until sync
    activeWorkflows: 0,
    inactiveWorkflows: 0,
    totalProperties: propertyCounts?.total || 0,
    contactProperties: propertyCounts?.contact || 0,
    dealProperties: propertyCounts?.deal || 0,
    revenueAtRisk: revenueAtRisk || 0,
    monthlyRevenueLoss: (revenueAtRisk || 0) * 0.1, // Est 10% loss
    buriedPremiumLeads: 0, // Dynamic calculation to be added
    potentialRecovery: (revenueAtRisk || 0) * 0.2, // Est 20% recovery
    slaBreachRate: slaStats?.rate || 0,
    blankLeadPercentage: 0, // To be implemented
  };

  const recommendations: Recommendation[] = [
    {
      priority: 1,
      title: "Fix Infinite Loop in Reassignment Workflow",
      description:
        "Workflow 1655409725 must be fixed immediately to stop SLA breaches",
      effort: "Medium",
      impact: "Critical",
      revenue: "634K+ AED/month",
    },
    {
      priority: 2,
      title: "Rescue Buried Premium Leads",
      description:
        "Manually contact all Downtown/Marina/DIFC leads sitting uncalled",
      effort: "High",
      impact: "High",
      revenue: "275K AED immediate",
    },
    {
      priority: 3,
      title: "Activate Nurture Sequences",
      description: "Review and turn on the 19 inactive follow-up workflows",
      effort: "Low",
      impact: "High",
      revenue: "Significant conversion boost",
    },
  ];

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
          <LeadLossAnalysis
            points={[
              {
                point: "Reassignment on No Contact",
                status: "critical",
                description:
                  "Reassignment workflow has infinite loop - 100% failure",
                leadsAffected: "All uncalled leads",
                revenueImpact: "634K+ AED/month",
              },
            ]}
          />
        </TabsContent>

        <TabsContent value="properties" className="space-y-4">
          <PropertyAudit
            categories={[
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
            ]}
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
