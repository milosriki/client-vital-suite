import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, AlertTriangle, Info, ArrowRight } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const WorkflowStrategy = () => {
  const workflows = [
    {
      id: "eSzjByOJHo3Si03y",
      name: "Daily Calculator",
      priority: "HIGH",
      description: "Calculates daily health scores for all clients",
      criticalNodes: [
        "Fetch Client Data",
        "Calculate Health Score",
        "Zone Classification",
        "Upsert to client_health_scores"
      ]
    },
    {
      id: "BdVKbuQH6f5nYkvV",
      name: "AI Risk Analysis",
      priority: "HIGH",
      description: "AI-powered risk assessment and intervention recommendations",
      criticalNodes: [
        "Get At-Risk Clients",
        "AI Analysis",
        "Generate Recommendations",
        "Insert to intervention_log"
      ]
    },
    {
      id: "oWCnjPfErKrjUXG",
      name: "Weekly Pattern Detection",
      priority: "MEDIUM",
      description: "Analyzes weekly trends and patterns",
      criticalNodes: [
        "Aggregate Weekly Data",
        "Pattern Analysis",
        "Upsert to weekly_patterns"
      ]
    },
    {
      id: "S2BCDEjVrUGRzQM0",
      name: "Monthly Coach Review",
      priority: "MEDIUM",
      description: "Monthly performance review for coaches",
      criticalNodes: [
        "Fetch Coach Data",
        "Performance Calculation",
        "Upsert to coach_performance"
      ]
    },
    {
      id: "DSj6s8POqhl40SOo",
      name: "Intervention Logger",
      priority: "HIGH",
      description: "Logs and tracks client interventions",
      criticalNodes: [
        "Get Trigger Events",
        "Create Intervention Record",
        "Insert to intervention_log"
      ]
    }
  ];

  const phases = [
    {
      phase: 1,
      title: "Project Overview & Workflow Prioritization",
      steps: [
        {
          title: "Understand Project Goals",
          description: "Review the PTD Workflow Fixer & n8n Management System objectives",
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
          description: "List and categorize all n8n workflows",
          action: "Review the 5 main workflows listed above"
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
          description: "Examine the workflow structure in n8n",
          checklist: [
            "Open workflow in n8n editor",
            "Map the flow from start to finish",
            "Identify all node types and connections",
            "Note any disconnected or orphaned nodes"
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
          method: "Use 'Execute Step' button in n8n to run one node at a time"
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
          <h1 className="text-4xl font-bold mb-2">PTD n8n Workflow Strategy</h1>
          <p className="text-muted-foreground text-lg">
            Step-by-step guide to review, fix, and optimize every n8n workflow
          </p>
        </div>

        {/* Current Issues Alert */}
        <Alert className="border-destructive">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <AlertDescription className="text-lg">
            <strong>Critical Issues Detected:</strong>
            <ul className="mt-2 space-y-1">
              <li>• Daily Calculator: 87.5% failure rate (35 of 40 executions failed)</li>
              <li>• Authorization errors in "GET: Overall Avg (Today)" node</li>
              <li>• Data flow interruptions causing incomplete calculations</li>
            </ul>
          </AlertDescription>
        </Alert>

        {/* Workflow Priority List */}
        <Card>
          <CardHeader>
            <CardTitle>Workflow Priority Order</CardTitle>
            <CardDescription>Review and fix in this sequence</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {workflows.map((workflow, index) => (
                <div key={workflow.id} className="flex items-start gap-4 p-4 border rounded-lg">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{workflow.name}</h3>
                      <Badge variant={workflow.priority === "HIGH" ? "destructive" : "secondary"}>
                        {workflow.priority}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{workflow.description}</p>
                    <div className="text-xs text-muted-foreground">
                      <strong>Critical Nodes:</strong> {workflow.criticalNodes.join(" → ")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

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
            <strong>Next Steps:</strong> Start with the Daily Calculator workflow (highest priority).
            Use the Workflow Fixer page to automatically apply these fixes, then manually verify each
            node configuration in n8n. Test thoroughly before moving to the next workflow.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
};

export default WorkflowStrategy;
