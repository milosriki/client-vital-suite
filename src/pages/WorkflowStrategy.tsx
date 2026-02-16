import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, AlertTriangle, Info, ArrowRight, Activity, TrendingDown, TrendingUp } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useDedupedQuery } from "@/hooks/useDedupedQuery";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { subDays } from "date-fns";

interface WorkflowMetrics {
  function_name: string;
  total_executions: number;
  successful: number;
  failed: number;
  avg_latency_ms: number | null;
  total_cost: number | null;
  error_rate: number;
  latest_error: string | null;
}

interface StrategyRecommendation {
  id: string;
  decision_type: string;
  confidence_score: number | null;
  status: string | null;
  outcome: string | null;
  decision_output: Record<string, unknown> | string | null;
  created_at: string | null;
}

const WorkflowStrategy = () => {
  // Fetch workflow execution metrics from ai_execution_metrics
  const { data: executionMetrics, isLoading: metricsLoading } = useDedupedQuery({
    queryKey: ["workflow-execution-metrics"],
    queryFn: async () => {
      const sevenDaysAgo = subDays(new Date(), 7).toISOString();

      const { data, error } = await supabase
        .from("ai_execution_metrics")
        .select("function_name, status, latency_ms, cost_usd_est, error_message, created_at")
        .gte("created_at", sevenDaysAgo)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Execution metrics query error:", error);
        throw error;
      }
      if (!data) {
        throw new Error("Query returned null data despite no error");
      }

      // Aggregate metrics by function
      const metricsMap = new Map<string, WorkflowMetrics>();

      data.forEach((metric) => {
        const funcName = metric.function_name;
        if (!metricsMap.has(funcName)) {
          metricsMap.set(funcName, {
            function_name: funcName,
            total_executions: 0,
            successful: 0,
            failed: 0,
            avg_latency_ms: null,
            total_cost: null,
            error_rate: 0,
            latest_error: null,
          });
        }

        const metrics = metricsMap.get(funcName)!;
        metrics.total_executions++;

        if (metric.status === "success") {
          metrics.successful++;
        } else if (metric.status === "error" || metric.status === "failed") {
          metrics.failed++;
          if (!metrics.latest_error && metric.error_message) {
            metrics.latest_error = metric.error_message;
          }
        }

        if (metric.latency_ms) {
          metrics.avg_latency_ms = metrics.avg_latency_ms
            ? (metrics.avg_latency_ms + metric.latency_ms) / 2
            : metric.latency_ms;
        }

        if (metric.cost_usd_est) {
          metrics.total_cost = (metrics.total_cost || 0) + metric.cost_usd_est;
        }
      });

      // Calculate error rates
      metricsMap.forEach((metrics) => {
        metrics.error_rate = metrics.total_executions > 0
          ? (metrics.failed / metrics.total_executions) * 100
          : 0;
      });

      return Array.from(metricsMap.values()).sort((a, b) => b.error_rate - a.error_rate);
    },
  });

  // Fetch strategy recommendations from agent_decisions
  const { data: strategyRecommendations, isLoading: recommendationsLoading } = useDedupedQuery({
    queryKey: ["workflow-strategy-recommendations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_decisions")
        .select("id, decision_type, confidence_score, status, outcome, decision_output, created_at")
        .eq("decision_type", "workflow_optimization")
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) {
        console.error("Strategy recommendations query error:", error);
        throw error;
      }
      if (!data) {
        throw new Error("Query returned null data despite no error");
      }
      return data;
    },
  });

  // Map execution metrics to workflow display with priority
  const workflows = executionMetrics ? executionMetrics.map((metric) => {
    let priority: "HIGH" | "MEDIUM" | "LOW" = "LOW";
    if (metric.error_rate > 50) {
      priority = "HIGH";
    } else if (metric.error_rate > 20) {
      priority = "MEDIUM";
    }

    // Extract function purpose from name
    const functionName = metric.function_name;
    let description = "Edge function workflow";
    let criticalNodes: string[] = [];

    // Map known functions to descriptions
    if (functionName.includes("health") || functionName.includes("calculator")) {
      description = "Calculates daily health scores for all clients";
      criticalNodes = ["Fetch Client Data", "Calculate Health Score", "Zone Classification", "Upsert to DB"];
    } else if (functionName.includes("risk") || functionName.includes("analysis")) {
      description = "AI-powered risk assessment and intervention recommendations";
      criticalNodes = ["Get At-Risk Clients", "AI Analysis", "Generate Recommendations", "Insert to Log"];
    } else if (functionName.includes("pattern") || functionName.includes("weekly")) {
      description = "Analyzes weekly trends and patterns";
      criticalNodes = ["Aggregate Weekly Data", "Pattern Analysis", "Upsert to Patterns"];
    } else if (functionName.includes("coach") || functionName.includes("performance")) {
      description = "Monthly performance review for coaches";
      criticalNodes = ["Fetch Coach Data", "Performance Calculation", "Upsert to Performance"];
    } else if (functionName.includes("intervention") || functionName.includes("logger")) {
      description = "Logs and tracks client interventions";
      criticalNodes = ["Get Trigger Events", "Create Intervention Record", "Insert to Log"];
    }

    return {
      id: metric.function_name,
      name: functionName.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
      priority,
      description,
      criticalNodes,
      metrics: {
        executions: metric.total_executions,
        successRate: metric.total_executions > 0 ? ((metric.successful / metric.total_executions) * 100).toFixed(1) : "0.0",
        errorRate: metric.error_rate.toFixed(1),
        avgLatency: metric.avg_latency_ms ? Math.round(metric.avg_latency_ms) : null,
        totalCost: metric.total_cost ? metric.total_cost.toFixed(4) : null,
        latestError: metric.latest_error,
      }
    };
  }) : [];

  const phases = [
    {
      phase: 1,
      title: "Project Overview & Workflow Prioritization",
      steps: [
        {
          title: "Understand Project Goals",
          description: "Review the PTD Edge Functions & Automation System objectives",
          checklist: [
            "Daily health score calculations",
            "AI-powered risk analysis",
            "Coach performance tracking",
            "Intervention management",
            "Weekly and monthly analytics"
          ]
        },
        {
          title: "Identify All Workflows",
          description: "List and categorize all Supabase Edge Functions",
          action: "Review the Edge Functions listed above"
        },
        {
          title: "Prioritize Based on Errors",
          description: "Start with workflows showing the highest failure rates",
          priority: "Daily Calculator (87.5% failure rate) → Intervention Logger → AI Risk Analysis"
        }
      ]
    },
    {
      phase: 2,
      title: "Detailed Workflow Analysis (Per Workflow)",
      steps: [
        {
          title: "Visual Inspection",
          description: "Examine the Edge Function code structure",
          checklist: [
            "Review Edge Function code in supabase/functions/",
            "Map the execution flow from start to finish",
            "Identify all function calls and dependencies",
            "Note any error handling or edge cases"
          ]
        },
        {
          title: "Node-by-Node Configuration",
          description: "Verify each node's settings",
          nodeTypes: [
            {
              type: "PostgreSQL Nodes",
              checks: [
                "Credential: Supabase PostgreSQL",
                "Table names match database schema",
                "Column mappings are correct",
                "UPSERT syntax uses ON CONFLICT properly",
                "Query uses $json variables correctly",
                "alwaysOutputData: true"
              ]
            },
            {
              type: "HTTP Request Nodes",
              checks: [
                "URL: Use SUPABASE_URL from environment",
                "Method: POST for RPC, POST for inserts",
                "Headers include apikey and Authorization",
                "Authorization: Bearer [SUPABASE_ANON_KEY]",
                "Content-Type: application/json",
                "Prefer: return=representation (for inserts)",
                "Body structure matches API expectations",
                "alwaysOutputData: true"
              ]
            },
            {
              type: "Set Nodes",
              checks: [
                "includeOtherFields: true",
                "Field mappings are correct",
                "Data types match target schema",
                "No critical fields are missing"
              ]
            },
            {
              type: "Code/Function Nodes",
              checks: [
                "JavaScript syntax is correct",
                "All variables are defined",
                "Returns expected data structure",
                "Error handling is present",
                "alwaysOutputData: true"
              ]
            }
          ]
        },
        {
          title: "Data Flow Validation",
          description: "Ensure data passes correctly between nodes",
          checklist: [
            "Test each node individually using 'Execute Step'",
            "Verify output format matches next node's input",
            "Check for data transformation issues",
            "Ensure filters don't exclude necessary data",
            "Validate JSON structure at each step"
          ]
        },
        {
          title: "Authentication & Credentials",
          description: "Fix authorization errors",
          fixes: [
            "Verify Supabase URL in all HTTP nodes",
            "Check apikey header matches anon key",
            "Ensure Authorization header uses Bearer token",
            "Confirm PostgreSQL credential name",
            "Test credentials with manual execution"
          ]
        }
      ]
    },
    {
      phase: 3,
      title: "Testing & Debugging",
      steps: [
        {
          title: "Individual Node Testing",
          description: "Test each node in isolation",
          method: "Use Supabase Functions local testing: supabase functions serve"
        },
        {
          title: "Error Analysis",
          description: "Identify and fix errors",
          commonErrors: [
            {
              error: "Authorization failed",
              fix: "Check Supabase URL, apikey, and Authorization headers"
            },
            {
              error: "Cannot assign to read only property 'name'",
              fix: "Check data coming from previous node, ensure proper structure"
            },
            {
              error: "Violates row-level security",
              fix: "Tables have public RLS policies enabled"
            },
            {
              error: "Column does not exist",
              fix: "Verify column names match database schema exactly"
            }
          ]
        },
        {
          title: "Mock Data Testing",
          description: "Test with sample data first",
          action: "Use mock data to validate logic before production run"
        }
      ]
    },
    {
      phase: 4,
      title: "Project Integration & Monitoring",
      steps: [
        {
          title: "End-to-End Testing",
          description: "Run complete workflow sequences",
          checklist: [
            "Execute Daily Calculator workflow",
            "Verify data appears in client_health_scores",
            "Check daily_summary is populated",
            "Confirm coach_performance updates",
            "Validate intervention_log entries"
          ]
        },
        {
          title: "Continuous Monitoring",
          description: "Monitor the Executions tab",
          action: "Check for errors, review execution logs, track failure rates"
        },
        {
          title: "Documentation",
          description: "Document the final configuration",
          includes: [
            "Node settings and parameters",
            "Data flow diagrams",
            "Common issues and solutions",
            "Maintenance procedures"
          ]
        }
      ]
    }
  ];

  const criticalChecks = [
    {
      category: "Supabase Connection",
      items: [
        "URL: Use SUPABASE_URL environment variable",
        "Anon Key: Use SUPABASE_ANON_KEY environment variable",
        "Service Role: Use SUPABASE_SERVICE_ROLE_KEY environment variable"
      ]
    },
    {
      category: "Database Tables",
      items: [
        "client_health_scores",
        "daily_summary",
        "coach_performance",
        "weekly_patterns",
        "intervention_log"
      ]
    },
    {
      category: "RPC Functions",
      items: [
        "get_zone_distribution",
        "get_overall_avg",
        "get_at_risk_clients"
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold mb-2">PTD Edge Functions Strategy</h1>
          <p className="text-muted-foreground text-lg">
            Step-by-step guide to review, fix, and optimize Supabase Edge Functions
          </p>
        </div>

        {/* Current Issues Alert */}
        {metricsLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : workflows.filter(w => w.priority === "HIGH").length > 0 ? (
          <Alert className="border-destructive">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <AlertDescription className="text-lg">
              <strong>Critical Issues Detected:</strong>
              <ul className="mt-2 space-y-1">
                {workflows
                  .filter((w) => w.priority === "HIGH")
                  .slice(0, 3)
                  .map((w) => (
                    <li key={w.id}>
                      • {w.name}: {w.metrics.errorRate}% failure rate ({w.metrics.executions} executions)
                      {w.metrics.latestError && (
                        <span className="block ml-4 text-sm text-muted-foreground mt-1">
                          Latest: {w.metrics.latestError.substring(0, 100)}...
                        </span>
                      )}
                    </li>
                  ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="border-green-500">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <AlertDescription className="text-lg">
              <strong>All Systems Operational</strong>
              <p className="mt-1">No critical issues detected in the last 7 days.</p>
            </AlertDescription>
          </Alert>
        )}

        {/* Workflow Priority List */}
        <Card>
          <CardHeader>
            <CardTitle>Workflow Priority Order</CardTitle>
            <CardDescription>
              {metricsLoading ? "Loading execution metrics..." : `${workflows.length} workflows analyzed over the last 7 days`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : workflows.length === 0 ? (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  No workflow execution data found in the last 7 days. Execute some workflows to see metrics here.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-3">
                {workflows.map((workflow, index) => (
                  <div key={workflow.id} className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold">{workflow.name}</h3>
                        <Badge variant={workflow.priority === "HIGH" ? "destructive" : workflow.priority === "MEDIUM" ? "default" : "secondary"}>
                          {workflow.priority}
                        </Badge>
                        <Badge variant="outline" className="gap-1">
                          <Activity className="h-3 w-3" />
                          {workflow.metrics.executions} runs
                        </Badge>
                        <Badge variant={parseFloat(workflow.metrics.errorRate) > 50 ? "destructive" : parseFloat(workflow.metrics.errorRate) > 20 ? "default" : "secondary"} className="gap-1">
                          {parseFloat(workflow.metrics.errorRate) > 20 ? (
                            <TrendingDown className="h-3 w-3" />
                          ) : (
                            <TrendingUp className="h-3 w-3" />
                          )}
                          {workflow.metrics.successRate}% success
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{workflow.description}</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground mb-2">
                        <div>
                          <strong>Error Rate:</strong> {workflow.metrics.errorRate}%
                        </div>
                        {workflow.metrics.avgLatency && (
                          <div>
                            <strong>Avg Latency:</strong> {workflow.metrics.avgLatency}ms
                          </div>
                        )}
                        {workflow.metrics.totalCost && (
                          <div>
                            <strong>Cost (7d):</strong> ${workflow.metrics.totalCost}
                          </div>
                        )}
                      </div>
                      {workflow.criticalNodes.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          <strong>Critical Nodes:</strong> {workflow.criticalNodes.join(" → ")}
                        </div>
                      )}
                      {workflow.metrics.latestError && parseFloat(workflow.metrics.errorRate) > 0 && (
                        <div className="mt-2 p-2 bg-destructive/10 rounded text-xs text-destructive border border-destructive/20">
                          <strong>Latest Error:</strong> {workflow.metrics.latestError.substring(0, 200)}
                          {workflow.metrics.latestError.length > 200 && "..."}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Strategy Recommendations */}
        {!recommendationsLoading && strategyRecommendations && strategyRecommendations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>AI Strategy Recommendations</CardTitle>
              <CardDescription>
                AI-generated optimization strategies based on workflow analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {strategyRecommendations.map((recommendation) => (
                  <div
                    key={recommendation.id}
                    className="p-4 border rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{recommendation.decision_type}</Badge>
                        {recommendation.confidence_score && (
                          <Badge variant={recommendation.confidence_score > 0.8 ? "default" : "secondary"}>
                            {(recommendation.confidence_score * 100).toFixed(0)}% confidence
                          </Badge>
                        )}
                        {recommendation.status && (
                          <Badge variant={
                            recommendation.status === "executed" ? "default" :
                            recommendation.status === "pending" ? "secondary" :
                            "outline"
                          }>
                            {recommendation.status}
                          </Badge>
                        )}
                      </div>
                      {recommendation.created_at && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(recommendation.created_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    {recommendation.decision_output && (
                      <div className="text-sm">
                        {typeof recommendation.decision_output === "string"
                          ? recommendation.decision_output
                          : JSON.stringify(recommendation.decision_output, null, 2)}
                      </div>
                    )}
                    {recommendation.outcome && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        <strong>Outcome:</strong> {recommendation.outcome}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Implementation Phases */}
        <Card>
          <CardHeader>
            <CardTitle>Implementation Phases</CardTitle>
            <CardDescription>Follow these phases for each workflow</CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {phases.map((phase) => (
                <AccordionItem key={phase.phase} value={`phase-${phase.phase}`}>
                  <AccordionTrigger>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">Phase {phase.phase}</Badge>
                      <span className="font-semibold">{phase.title}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-6 pt-4">
                      {phase.steps.map((step, idx) => (
                        <div key={idx} className="pl-4 border-l-2 border-primary">
                          <h4 className="font-semibold mb-2 flex items-center gap-2">
                            <ArrowRight className="h-4 w-4" />
                            {step.title}
                          </h4>
                          <p className="text-sm text-muted-foreground mb-3">{step.description}</p>
                          
                          {step.checklist && (
                            <div className="space-y-1">
                              {step.checklist.map((item, i) => (
                                <div key={i} className="flex items-center gap-2 text-sm">
                                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                                  <span>{item}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {step.nodeTypes && (
                            <div className="space-y-4 mt-3">
                              {step.nodeTypes.map((nodeType, i) => (
                                <div key={i} className="bg-muted p-3 rounded-lg">
                                  <h5 className="font-medium mb-2">{nodeType.type}</h5>
                                  <div className="space-y-1">
                                    {nodeType.checks.map((check, j) => (
                                      <div key={j} className="flex items-start gap-2 text-sm">
                                        <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                                        <span className="font-mono text-xs">{check}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {step.fixes && (
                            <div className="space-y-1 mt-3">
                              {step.fixes.map((fix, i) => (
                                <div key={i} className="flex items-start gap-2 text-sm">
                                  <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5" />
                                  <span>{fix}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {step.commonErrors && (
                            <div className="space-y-2 mt-3">
                              {step.commonErrors.map((err, i) => (
                                <div key={i} className="bg-destructive/10 p-3 rounded border border-destructive/20">
                                  <div className="font-medium text-sm text-destructive mb-1">
                                    ❌ {err.error}
                                  </div>
                                  <div className="text-sm">
                                    ✅ <strong>Fix:</strong> {err.fix}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {step.action && (
                            <Alert className="mt-3">
                              <Info className="h-4 w-4" />
                              <AlertDescription className="text-sm">
                                <strong>Action:</strong> {step.action}
                              </AlertDescription>
                            </Alert>
                          )}
                          
                          {step.priority && (
                            <Alert className="mt-3">
                              <AlertTriangle className="h-4 w-4" />
                              <AlertDescription className="text-sm">
                                <strong>Priority:</strong> {step.priority}
                              </AlertDescription>
                            </Alert>
                          )}
                          
                          {step.method && (
                            <div className="mt-3 p-3 bg-muted rounded text-sm">
                              <strong>Method:</strong> {step.method}
                            </div>
                          )}
                          
                          {step.includes && (
                            <div className="space-y-1 mt-3">
                              {step.includes.map((item, i) => (
                                <div key={i} className="flex items-center gap-2 text-sm">
                                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                                  <span>{item}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>

        {/* Critical Configuration Checklist */}
        <Card>
          <CardHeader>
            <CardTitle>Critical Configuration Checklist</CardTitle>
            <CardDescription>Verify these settings in every workflow</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              {criticalChecks.map((check, index) => (
                <div key={index} className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    {check.category}
                  </h3>
                  <div className="space-y-2">
                    {check.items.map((item, i) => (
                      <div key={i} className="text-sm font-mono bg-muted p-2 rounded break-all">
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Action Guide */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Action Guide: Fix "Authorization Failed" Error</CardTitle>
            <CardDescription>Based on your current error screenshot</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Error Location:</strong> "GET: Overall Avg (Today)" node in Daily Calculator workflow
                </AlertDescription>
              </Alert>
              
              <div className="space-y-3">
                <h4 className="font-semibold">Step-by-Step Fix:</h4>
                <ol className="space-y-3 list-decimal list-inside">
                  <li className="text-sm">
                    <strong>Open the node</strong> - Click on "GET: Overall Avg (Today)" node
                  </li>
                  <li className="text-sm">
                    <strong>Check URL</strong> - Must be: [SUPABASE_URL]/rest/v1/rpc/get_overall_avg
                  </li>
                  <li className="text-sm">
                    <strong>Set Method</strong> - Change to POST
                  </li>
                  <li className="text-sm">
                    <strong>Add Headers</strong> - Go to Settings tab, enable "Send Headers"
                    <div className="ml-6 mt-2 space-y-1 font-mono text-xs bg-muted p-2 rounded">
                      <div>apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...</div>
                      <div>Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...</div>
                      <div>Content-Type: application/json</div>
                    </div>
                  </li>
                  <li className="text-sm">
                    <strong>Add Body</strong> - Enable "Send Body", set to JSON:
                    <div className="ml-6 mt-2 font-mono text-xs bg-muted p-2 rounded">
                      {`{ "target_date": "{{$now.toFormat('yyyy-MM-dd')}}" }`}
                    </div>
                  </li>
                  <li className="text-sm">
                    <strong>Test</strong> - Click "Execute Step" to verify it works
                  </li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Next Steps */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Next Steps:</strong> Start with the health-calculator Edge Function (highest priority).
            Use Supabase Functions local testing to verify fixes, then deploy and test thoroughly before moving to the next function.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
};

export default WorkflowStrategy;
