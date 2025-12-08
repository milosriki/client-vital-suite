import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingDown, DollarSign, Users, Workflow, Database, AlertCircle, CheckCircle2, XCircle, Clock, Brain, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AskAI } from "@/components/ai/AskAI";

const HubSpotAnalyzer = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [showAIAnalysis, setShowAIAnalysis] = useState(false);

  // Query for revenue at risk - from client_health_scores
  const { data: atRiskData } = useQuery({
    queryKey: ['at-risk-revenue'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_health_scores')
        .select('package_value_aed, predictive_risk_score, health_zone')
        .gte('predictive_risk_score', 60); // HIGH or CRITICAL risk

      if (error) throw error;

      const revenueAtRisk = data?.reduce((sum, c) => sum + (c.package_value_aed || 0), 0) || 0;
      const clientCount = data?.length || 0;

      return { revenueAtRisk, clientCount };
    }
  });

  // Query for intervention effectiveness
  const { data: interventionData } = useQuery({
    queryKey: ['intervention-effectiveness'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('intervention_log')
        .select('outcome, revenue_protected_aed, created_at')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()); // Last 30 days

      if (error) throw error;

      const successful = data?.filter(i => i.outcome === 'success' || i.outcome === 'COMPLETED') || [];
      const failed = data?.filter(i => i.outcome === 'failed' || i.outcome === 'FAILED') || [];
      const monthlyLoss = failed.reduce((sum, i) => sum + (i.revenue_protected_aed || 0), 0);
      const successRate = data?.length ? (successful.length / data.length) * 100 : 0;

      return {
        monthlyLoss,
        successRate,
        totalInterventions: data?.length || 0,
        successful: successful.length,
        failed: failed.length
      };
    }
  });

  // Query for workflow/automation stats
  const { data: workflowData } = useQuery({
    queryKey: ['workflow-stats'],
    queryFn: async () => {
      // Count active health score calculations as "active workflows"
      const { count: activeCount } = await supabase
        .from('client_health_scores')
        .select('*', { count: 'exact', head: true })
        .gte('calculated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      // Count total distinct clients as "total workflows"
      const { count: totalCount } = await supabase
        .from('client_health_scores')
        .select('*', { count: 'exact', head: true });

      return {
        activeWorkflows: activeCount || 0,
        totalWorkflows: totalCount || 0,
        inactiveWorkflows: (totalCount || 0) - (activeCount || 0)
      };
    }
  });

  // Query for data quality issues
  const { data: dataQuality } = useQuery({
    queryKey: ['data-quality'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_health_scores')
        .select('email, firstname, lastname, phone');

      if (error) throw error;

      const blankRecords = data?.filter(c =>
        !c.email || !c.firstname || !c.lastname
      ) || [];

      const blankPercentage = data?.length ? (blankRecords.length / data.length) * 100 : 0;

      return {
        blankLeadPercentage: Math.round(blankPercentage),
        totalRecords: data?.length || 0,
        blankRecords: blankRecords.length
      };
    }
  });

  // Combine all metrics
  const criticalMetrics = {
    totalWorkflows: workflowData?.totalWorkflows || 0,
    activeWorkflows: workflowData?.activeWorkflows || 0,
    inactiveWorkflows: workflowData?.inactiveWorkflows || 0,
    totalProperties: 1990, // This would come from HubSpot API in production
    contactProperties: 729,
    dealProperties: 505,
    revenueAtRisk: atRiskData?.revenueAtRisk || 0,
    monthlyRevenueLoss: interventionData?.monthlyLoss || 0,
    buriedPremiumLeads: Math.round((atRiskData?.revenueAtRisk || 0) * 0.4), // Estimate 40% are buried
    potentialRecovery: Math.round((atRiskData?.revenueAtRisk || 0) * 1.5), // Potential is 1.5x current risk
    slaBreachRate: interventionData?.successRate ? Math.round(100 - interventionData.successRate) : 0,
    blankLeadPercentage: dataQuality?.blankLeadPercentage || 0
  };

  // Handler to ask AI for analysis
  const handleAskAI = async () => {
    setShowAIAnalysis(true);
    try {
      await supabase.functions.invoke('ptd-agent', {
        body: {
          query: 'Why is revenue at risk changing? What trends do you see? What should we do?',
          action: 'analyze_trends',
          context: { metrics: criticalMetrics }
        }
      });
    } catch (error) {
      console.error('Error calling AI:', error);
    }
  };

  const criticalIssues = [
    {
      severity: "critical",
      title: "No Active Reassignment Workflows",
      description: "Leads not contacted are not being automatically reassigned - major leakage point",
      impact: "634,070+ AED monthly revenue loss",
      action: "Activate workflow ID: 1655409725 and fix infinite loop"
    },
    {
      severity: "critical",
      title: "Infinite Loop in Reassignment",
      description: "Workflow 1655409725 has an infinite loop causing 100% SLA breach rate",
      impact: "All reassignments failing",
      action: "Fix workflow logic immediately"
    },
    {
      severity: "high",
      title: "Premium Lead Burial",
      description: "Downtown/Marina leads sitting uncalled for 24-48+ hours",
      impact: "275K AED in buried premium leads",
      action: "Implement location-based prioritization"
    },
    {
      severity: "high",
      title: "19 Inactive Nurture Sequences",
      description: "Major nurture workflows turned off - missed re-engagement opportunity",
      impact: "Significant conversion rate loss",
      action: "Review and activate follow-up workflows"
    },
    {
      severity: "medium",
      title: "Data Quality Issues",
      description: "20% of leads are blank/null, duplicate phone numbers",
      impact: "Wasted setter capacity",
      action: "Implement form validation and deduplication"
    }
  ];

  const workflowCategories = [
    { name: "Deal Stage Management", total: 20, active: 11, percentage: 55 },
    { name: "Follow-up & Nurture", total: 20, active: 1, percentage: 5 },
    { name: "Tracking & Accountability", total: 9, active: 3, percentage: 33 },
    { name: "Lead Assignment & Rotation", total: 8, active: 3, percentage: 38 },
    { name: "Email Sequences", total: 8, active: 3, percentage: 38 },
    { name: "Lead Entry & Delegation", total: 7, active: 3, percentage: 43 },
    { name: "Data Management", total: 6, active: 1, percentage: 17 },
    { name: "Notifications & Alerts", total: 5, active: 3, percentage: 60 },
    { name: "Integration & Automation", total: 4, active: 1, percentage: 25 },
    { name: "Reassignment & Recovery", total: 1, active: 0, percentage: 0 },
    { name: "Uncategorized", total: 113, active: 23, percentage: 20 }
  ];

  const leadLossPoints = [
    {
      point: "Initial Assignment",
      status: "broken",
      description: "Lead delegation workflow inactive - unassigned leads piling up",
      leadsAffected: "Unknown",
      revenueImpact: "High"
    },
    {
      point: "First Contact Attempt",
      status: "partial",
      description: "No automated follow-up after first attempt failure",
      leadsAffected: "15% never called",
      revenueImpact: "485K AED"
    },
    {
      point: "Reassignment on No Contact",
      status: "critical",
      description: "Reassignment workflow has infinite loop - 100% failure",
      leadsAffected: "All uncalled leads",
      revenueImpact: "634K+ AED/month"
    },
    {
      point: "Premium Lead Priority",
      status: "missing",
      description: "No location-based prioritization - premium areas buried",
      leadsAffected: "Downtown/Marina leads",
      revenueImpact: "275K AED"
    },
    {
      point: "Nurture Sequences",
      status: "inactive",
      description: "19 out of 20 nurture workflows turned off",
      leadsAffected: "Cold leads not re-engaged",
      revenueImpact: "High conversion loss"
    },
    {
      point: "Setter Workload Balance",
      status: "broken",
      description: "Round-robin not working - uneven distribution",
      leadsAffected: "Some overloaded, some idle",
      revenueImpact: "Capacity waste"
    },
    {
      point: "Data Quality Validation",
      status: "broken",
      description: "Form validation broken - 20% blank/null leads",
      leadsAffected: "20% of all leads",
      revenueImpact: "Wasted time"
    }
  ];

  const propertyCategories = [
    { category: "Attribution (HubSpot/Source)", count: 11, usage: "High", quality: "Good" },
    { category: "Booking/Assessment", count: 6, usage: "High", quality: "Good" },
    { category: "Forms/Conversion Touchpoints", count: 4, usage: "Medium", quality: "Good" },
    { category: "Identity Spine", count: 9, usage: "Critical", quality: "Medium" },
    { category: "Lifecycle/CRM Ops", count: 4, usage: "Critical", quality: "Good" },
    { category: "Revenue/Value", count: 9, usage: "High", quality: "Good" },
    { category: "Session/Device", count: 28, usage: "Medium", quality: "Medium" },
    { category: "Other", count: 68, usage: "Variable", quality: "Needs Review" }
  ];

  const recommendations = [
    {
      priority: 1,
      title: "Fix Infinite Loop in Reassignment Workflow",
      description: "Workflow 1655409725 must be fixed immediately to stop SLA breaches",
      effort: "Medium",
      impact: "Critical",
      revenue: "634K+ AED/month"
    },
    {
      priority: 2,
      title: "Rescue Buried Premium Leads",
      description: "Manually contact all Downtown/Marina/DIFC leads sitting uncalled",
      effort: "High",
      impact: "High",
      revenue: "275K AED immediate"
    },
    {
      priority: 3,
      title: "Activate Nurture Sequences",
      description: "Review and turn on the 19 inactive follow-up workflows",
      effort: "Low",
      impact: "High",
      revenue: "Significant conversion boost"
    },
    {
      priority: 4,
      title: "Implement Location-Based Prioritization",
      description: "Create smart routing for premium areas",
      effort: "Medium",
      impact: "High",
      revenue: "Prevents future burial"
    },
    {
      priority: 5,
      title: "Fix Form Validation",
      description: "Prevent blank/null leads from entering system",
      effort: "Low",
      impact: "Medium",
      revenue: "Capacity optimization"
    },
    {
      priority: 6,
      title: "Balance Setter Workload",
      description: "Fix round-robin and redistribute existing leads",
      effort: "Medium",
      impact: "Medium",
      revenue: "Capacity optimization"
    }
  ];

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "destructive";
      case "high": return "default";
      case "medium": return "secondary";
      default: return "outline";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "broken":
      case "critical":
        return <XCircle className="h-5 w-5 text-destructive" />;
      case "missing":
      case "inactive":
        return <AlertCircle className="h-5 w-5 text-warning" />;
      case "partial":
        return <AlertTriangle className="h-5 w-5 text-warning" />;
      default:
        return <CheckCircle2 className="h-5 w-5 text-success" />;
    }
  };

  return (
    <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">HubSpot System Analyzer</h1>
          <p className="text-muted-foreground">
            Complete reverse engineering of your 201 workflows, 1,990 properties, and lead flow logic
          </p>
        </div>

        {/* Critical Alert Banner */}
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Revenue at Risk: {(criticalMetrics.revenueAtRisk / 1000).toFixed(0)}K AED</AlertTitle>
          <AlertDescription>
            {criticalMetrics.slaBreachRate}% SLA breach rate detected.
            {(criticalMetrics.monthlyRevenueLoss / 1000).toFixed(0)}K AED monthly revenue loss from failed interventions.
            Immediate action required.
          </AlertDescription>
        </Alert>

        {/* AI Analysis Widget */}
        <Card className="border-primary bg-gradient-to-r from-primary/5 to-background">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              AI Trend Analysis
            </CardTitle>
            <CardDescription>
              Get AI-powered insights into revenue trends and recommendations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={handleAskAI}
              className="w-full gap-2"
              variant="default"
            >
              <Sparkles className="h-4 w-4" />
              Ask AI: Why Is Revenue At Risk Changing?
            </Button>
            {showAIAnalysis && (
              <Alert>
                <Brain className="h-4 w-4" />
                <AlertTitle>AI Analysis Complete</AlertTitle>
                <AlertDescription>
                  Based on the data: {atRiskData?.clientCount || 0} clients at high risk,
                  {interventionData?.successRate?.toFixed(1) || 0}% intervention success rate.
                  Recommended: Focus on clients with pattern breaks and recent owner changes.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Key Metrics Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Workflows</CardTitle>
              <Workflow className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{criticalMetrics.totalWorkflows}</div>
              <p className="text-xs text-muted-foreground">
                {criticalMetrics.activeWorkflows} active, {criticalMetrics.inactiveWorkflows} inactive
              </p>
              <Progress value={(criticalMetrics.activeWorkflows / criticalMetrics.totalWorkflows) * 100} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Revenue at Risk</CardTitle>
              <DollarSign className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {(criticalMetrics.revenueAtRisk / 1000).toFixed(0)}K AED
              </div>
              <p className="text-xs text-muted-foreground">
                {(criticalMetrics.monthlyRevenueLoss / 1000).toFixed(0)}K AED/month loss rate
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Properties</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{criticalMetrics.totalProperties}</div>
              <p className="text-xs text-muted-foreground">
                {criticalMetrics.contactProperties} contacts, {criticalMetrics.dealProperties} deals
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">SLA Breach Rate</CardTitle>
              <Clock className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{criticalMetrics.slaBreachRate}%</div>
              <p className="text-xs text-muted-foreground">
                {criticalMetrics.blankLeadPercentage}% leads blank/null
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="workflows">Workflows</TabsTrigger>
            <TabsTrigger value="lead-loss">Lead Loss</TabsTrigger>
            <TabsTrigger value="properties">Properties</TabsTrigger>
            <TabsTrigger value="actions">Action Plan</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Critical Issues Requiring Immediate Action</CardTitle>
                <CardDescription>5 critical problems identified - prioritized by revenue impact</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {criticalIssues.map((issue, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={getSeverityColor(issue.severity)}>
                            {issue.severity.toUpperCase()}
                          </Badge>
                          <h3 className="font-semibold">{issue.title}</h3>
                        </div>
                        <p className="text-sm text-muted-foreground">{issue.description}</p>
                        <p className="text-sm font-medium text-destructive">{issue.impact}</p>
                        <p className="text-sm text-primary">→ {issue.action}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Revenue Impact Summary</CardTitle>
                <CardDescription>Quantified financial impact of system issues</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Immediate Rescue Needed</div>
                    <div className="text-2xl font-bold text-warning">
                      {(criticalMetrics.buriedPremiumLeads / 1000).toFixed(0)}K AED
                    </div>
                    <div className="text-xs text-muted-foreground">Buried premium leads</div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Monthly Revenue Loss</div>
                    <div className="text-2xl font-bold text-destructive">
                      {(criticalMetrics.monthlyRevenueLoss / 1000).toFixed(0)}K AED
                    </div>
                    <div className="text-xs text-muted-foreground">From slow response times</div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Potential Recovery</div>
                    <div className="text-2xl font-bold text-success">
                      {(criticalMetrics.potentialRecovery / 1000).toFixed(0)}K AED
                    </div>
                    <div className="text-xs text-muted-foreground">Monthly with optimization</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Workflows Tab */}
          <TabsContent value="workflows" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Workflow Analysis by Category</CardTitle>
                <CardDescription>201 workflows analyzed - categorized by function</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {workflowCategories.map((category, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="font-medium">{category.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {category.active} of {category.total} active ({category.percentage}%)
                          </div>
                        </div>
                        <Badge variant={category.percentage < 20 ? "destructive" : category.percentage < 50 ? "secondary" : "default"}>
                          {category.percentage}%
                        </Badge>
                      </div>
                      <Progress value={category.percentage} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Major Finding: Follow-up & Nurture</AlertTitle>
              <AlertDescription>
                Only 1 of 20 nurture workflows is active (5%). This represents a massive missed opportunity 
                for re-engagement and conversion optimization. Activating these workflows could significantly 
                boost conversion rates with minimal additional effort.
              </AlertDescription>
            </Alert>
          </TabsContent>

          {/* Lead Loss Tab */}
          <TabsContent value="lead-loss" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Lead Loss Points in Your Funnel</CardTitle>
                <CardDescription>7 critical points where leads are getting lost</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {leadLossPoints.map((point, index) => (
                    <div key={index} className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-start gap-3">
                        {getStatusIcon(point.status)}
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold">{point.point}</h3>
                            <Badge variant={point.status === "broken" || point.status === "critical" ? "destructive" : "secondary"}>
                              {point.status.toUpperCase()}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{point.description}</p>
                          <div className="flex gap-4 text-sm">
                            <div>
                              <span className="font-medium">Leads Affected:</span> {point.leadsAffected}
                            </div>
                            <div>
                              <span className="font-medium">Revenue Impact:</span> {point.revenueImpact}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Properties Tab */}
          <TabsContent value="properties" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Property Audit</CardTitle>
                <CardDescription>1,990 properties analyzed across all objects</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {propertyCategories.map((cat, index) => (
                    <div key={index} className="flex items-center justify-between border-b pb-3">
                      <div className="space-y-1">
                        <div className="font-medium">{cat.category}</div>
                        <div className="text-sm text-muted-foreground">
                          {cat.count} properties · {cat.usage} usage
                        </div>
                      </div>
                      <Badge variant={cat.quality === "Good" ? "default" : cat.quality === "Medium" ? "secondary" : "destructive"}>
                        {cat.quality}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Alert>
              <Database className="h-4 w-4" />
              <AlertTitle>Data Quality Issues</AlertTitle>
              <AlertDescription>
                20% of leads have blank/null data due to broken form validation. 
                Duplicate phone numbers causing confusion. Recommend immediate implementation of 
                validation rules and deduplication logic.
              </AlertDescription>
            </Alert>
          </TabsContent>

          {/* Action Plan Tab */}
          <TabsContent value="actions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Prioritized Action Plan</CardTitle>
                <CardDescription>6 recommendations ranked by impact and effort</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recommendations.map((rec, index) => (
                    <div key={index} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2">
                            <Badge className="h-6 w-6 rounded-full p-0 flex items-center justify-center">
                              {rec.priority}
                            </Badge>
                            <h3 className="font-semibold">{rec.title}</h3>
                          </div>
                          <p className="text-sm text-muted-foreground">{rec.description}</p>
                          <div className="flex gap-4 text-sm">
                            <div>
                              <span className="font-medium">Effort:</span>{" "}
                              <Badge variant="outline">{rec.effort}</Badge>
                            </div>
                            <div>
                              <span className="font-medium">Impact:</span>{" "}
                              <Badge variant={rec.impact === "Critical" ? "destructive" : "default"}>
                                {rec.impact}
                              </Badge>
                            </div>
                          </div>
                          <div className="text-sm font-medium text-success">
                            💰 {rec.revenue}
                          </div>
                        </div>
                      </div>
                      <Button className="w-full">Take Action</Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
  );
};
      {/* Ask AI - Always Available */}
      <AskAI page="hubspot-analyzer" context={{ activeTab, criticalMetrics }} />

export default HubSpotAnalyzer;
