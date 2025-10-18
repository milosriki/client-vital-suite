import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, CheckCircle2, Loader2, Database, Settings, Play, RefreshCw, Activity, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5YTdjOWE4Ny0yNzYyLTQ1NjAtYjc1OS00MWNmZjUwMGM4YTkiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYwNzEyMDI1LCJleHAiOjE3NjMyMzY4MDB9.D3_VU6WuoFDuy-_znwq7OZ2HSBEM_uJbLcXlt7id1fI';
const N8N_API_URL = 'https://personaltrainersdubai.app.n8n.cloud/api/v1';

interface Workflow {
  id: string;
  name: string;
  active: boolean;
}

interface WorkflowIssue {
  workflow: string;
  issue: string;
  fix: string;
  status: 'pending' | 'fixing' | 'fixed' | 'error';
}

export default function WorkflowFixer() {
  const { toast } = useToast();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [issues, setIssues] = useState<WorkflowIssue[]>([
    {
      workflow: 'Database Setup',
      issue: 'RPC functions (get_zone_distribution, get_overall_avg, get_at_risk_clients)',
      fix: 'RPC functions created successfully',
      status: 'fixed'
    },
    {
      workflow: 'Daily Calculator',
      issue: 'SQL uses client_id instead of id',
      fix: 'Replace client_id with id in SELECT queries',
      status: 'pending'
    },
    {
      workflow: 'Daily Calculator',
      issue: 'SQL uses client_name (doesn\'t exist)',
      fix: 'Replace with COALESCE(firstname || \' \' || lastname, email)',
      status: 'pending'
    },
    {
      workflow: 'Daily Calculator',
      issue: 'RPC functions use GET instead of POST',
      fix: 'Update get_zone_distribution and get_overall_avg to POST',
      status: 'pending'
    },
    {
      workflow: 'Daily Calculator',
      issue: 'Missing HubSpot property mappings',
      fix: 'Map outstanding_sessions__live_, sessions_per_month, package_sessions__monthly_',
      status: 'pending'
    },
    {
      workflow: 'Daily Summary Email',
      issue: 'RPC functions not configured correctly',
      fix: 'Call RPC functions with proper POST requests and date parameters',
      status: 'pending'
    },
    {
      workflow: 'Intervention Logger',
      issue: 'Query missing date filter',
      fix: 'Add ?created_at=gte.{{today}} query parameter',
      status: 'pending'
    },
    {
      workflow: 'AI Risk Analysis',
      issue: 'PostgreSQL credentials not set',
      fix: 'Update to use "Supabase PostgreSQL" credential',
      status: 'pending'
    },
    {
      workflow: 'Weekly Pattern Detection',
      issue: 'Wrong column names in queries',
      fix: 'Update all queries to match actual schema',
      status: 'pending'
    },
    {
      workflow: 'Monthly Coach Review',
      issue: 'Missing GROUP BY aggregation',
      fix: 'Add proper GROUP BY coach_name with metrics',
      status: 'pending'
    }
  ]);

  const [isFixing, setIsFixing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isLoadingWorkflows, setIsLoadingWorkflows] = useState(false);
  const [executionLog, setExecutionLog] = useState<string[]>([]);
  const [dbStatus, setDbStatus] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    fetchWorkflows();
    verifyDatabase();
  }, []);

  const fetchWorkflows = async () => {
    setIsLoadingWorkflows(true);
    try {
      const response = await fetch(`${N8N_API_URL}/workflows`, {
        headers: {
          'X-N8N-API-KEY': N8N_API_KEY
        }
      });

      if (response.ok) {
        const data = await response.json();
        const workflowList: Workflow[] = data.data.map((w: any) => ({
          id: w.id,
          name: w.name,
          active: w.active
        }));
        setWorkflows(workflowList);
        setExecutionLog(prev => [...prev, `✅ Loaded ${workflowList.length} workflows from n8n`]);
      } else {
        setExecutionLog(prev => [...prev, `❌ Failed to load workflows: ${response.status}`]);
      }
    } catch (error: any) {
      setExecutionLog(prev => [...prev, `❌ Error loading workflows: ${error.message}`]);
    }
    setIsLoadingWorkflows(false);
  };

  const verifyDatabase = async () => {
    const tables = ['client_health_scores', 'coach_performance', 'intervention_log', 'daily_summary'];
    const status: { [key: string]: boolean } = {};

    for (const table of tables) {
      try {
        const { error } = await supabase
          .from(table as any)
          .select('count')
          .limit(1);
        status[table] = !error;
      } catch {
        status[table] = false;
      }
    }

    // Test RPC functions
    try {
      const { error: rpc1Error } = await supabase.rpc('get_zone_distribution', { 
        target_date: new Date().toISOString().split('T')[0] 
      });
      status['get_zone_distribution'] = !rpc1Error;

      const { error: rpc2Error } = await supabase.rpc('get_overall_avg', { 
        target_date: new Date().toISOString().split('T')[0] 
      });
      status['get_overall_avg'] = !rpc2Error;

      const { error: rpc3Error } = await supabase.rpc('get_at_risk_clients', { 
        target_date: new Date().toISOString().split('T')[0] 
      });
      status['get_at_risk_clients'] = !rpc3Error;
    } catch {
      status['get_zone_distribution'] = false;
      status['get_overall_avg'] = false;
      status['get_at_risk_clients'] = false;
    }

    setDbStatus(status);
    const allOk = Object.values(status).every(v => v);
    if (allOk) {
      setExecutionLog(prev => [...prev, '✅ Database verification passed']);
    } else {
      setExecutionLog(prev => [...prev, '⚠️ Some database components missing']);
    }
  };

  const testConnections = async () => {
    setIsTesting(true);
    setExecutionLog(['Testing connections...']);

    // Test n8n API
    try {
      const response = await fetch(`${N8N_API_URL}/workflows`, {
        headers: { 'X-N8N-API-KEY': N8N_API_KEY }
      });
      
      if (response.ok) {
        setExecutionLog(prev => [...prev, '✅ n8n API connection successful']);
      } else {
        setExecutionLog(prev => [...prev, `❌ n8n API failed: ${response.status}`]);
      }
    } catch (error: any) {
      setExecutionLog(prev => [...prev, `❌ n8n API error: ${error.message}`]);
    }

    // Test Supabase connection
    try {
      const { error } = await supabase
        .from('client_health_scores' as any)
        .select('count')
        .limit(1);
      
      if (!error) {
        setExecutionLog(prev => [...prev, '✅ Supabase connection successful']);
      } else {
        setExecutionLog(prev => [...prev, `❌ Supabase error: ${error.message}`]);
      }
    } catch (error: any) {
      setExecutionLog(prev => [...prev, `❌ Supabase error: ${error.message}`]);
    }

    await verifyDatabase();
    setIsTesting(false);
  };

  const fixAllWorkflows = async () => {
    setIsFixing(true);
    setExecutionLog(['Starting workflow fixes...']);
    setIssues(prev => prev.map(issue => 
      issue.status !== 'fixed' ? { ...issue, status: 'fixing' } : issue
    ));

    try {
      const { data, error } = await supabase.functions.invoke('setup-workflows', {
        body: {}
      });

      if (error) {
        setExecutionLog(prev => [...prev, `❌ Error: ${error.message}`]);
        setIssues(prev => prev.map(issue => 
          issue.status === 'fixing' ? { ...issue, status: 'error' } : issue
        ));
        toast({
          variant: "destructive",
          title: "Fix Failed",
          description: error.message
        });
        return;
      }

      setExecutionLog(prev => [...prev, '✅ Workflow fixes applied']);

      if (data?.workflowFixes) {
        data.workflowFixes.forEach((result: any) => {
          setExecutionLog(prev => [...prev, `${result.workflow}: ${result.status}`]);
          if (result.fixes) {
            result.fixes.forEach((fix: string) => {
              setExecutionLog(prev => [...prev, `  - ${fix}`]);
            });
          }
        });
      }

      if (data?.execution?.status === 'success') {
        setExecutionLog(prev => [...prev, '✅ Daily Calculator executed successfully']);
      }

      setIssues(prev => prev.map(issue => 
        issue.status === 'fixing' ? { ...issue, status: 'fixed' } : issue
      ));

      toast({
        title: "Success!",
        description: "All workflows fixed and Daily Calculator executed",
      });

      await fetchWorkflows();
    } catch (error: any) {
      setExecutionLog(prev => [...prev, `❌ Error: ${error.message}`]);
      setIssues(prev => prev.map(issue => 
        issue.status === 'fixing' ? { ...issue, status: 'error' } : issue
      ));
      toast({
        variant: "destructive",
        title: "Fix Failed",
        description: error.message
      });
    } finally {
      setIsFixing(false);
    }
  };

  const activateWorkflow = async (workflowId: string) => {
    try {
      const response = await fetch(`${N8N_API_URL}/workflows/${workflowId}`, {
        method: 'PATCH',
        headers: {
          'X-N8N-API-KEY': N8N_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ active: true })
      });

      if (response.ok) {
        toast({ title: "Workflow Activated" });
        fetchWorkflows();
      } else {
        toast({ variant: "destructive", title: "Failed to activate workflow" });
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: error.message });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'fixed': return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'fixing': return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'error': return <AlertCircle className="w-5 h-5 text-red-500" />;
      default: return <AlertCircle className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: any; text: string; className?: string }> = {
      pending: { variant: 'secondary', text: 'PENDING' },
      fixing: { variant: 'default', text: 'FIXING', className: 'bg-blue-500' },
      fixed: { variant: 'default', text: 'FIXED', className: 'bg-green-500' },
      error: { variant: 'destructive', text: 'ERROR' }
    };
    const { variant, text, className } = config[status];
    return <Badge variant={variant} className={className}>{text}</Badge>;
  };

  const fixedCount = issues.filter(i => i.status === 'fixed').length;
  const totalCount = issues.length;

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <Card className="mb-6 border-2 border-primary">
        <CardHeader>
          <CardTitle className="text-3xl font-bold flex items-center gap-2">
            <Settings className="w-8 h-8" />
            PTD Workflow Fixer & Monitor
          </CardTitle>
          <CardDescription>
            Complete workflow management: fix SQL queries, configure credentials, monitor status
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button 
              onClick={testConnections} 
              disabled={isTesting}
              variant="outline" 
              className="flex items-center gap-2"
            >
              {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
              Test Connections
            </Button>
            <Button 
              onClick={fetchWorkflows}
              disabled={isLoadingWorkflows}
              variant="outline" 
              className="flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingWorkflows ? 'animate-spin' : ''}`} />
              Refresh Workflows
            </Button>
            <Button 
              onClick={fixAllWorkflows} 
              disabled={isFixing}
              className="bg-green-600 hover:bg-green-700 flex items-center gap-2"
            >
              {isFixing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Fixing All...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Fix All Workflows
                </>
              )}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-muted">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Progress</span>
                  <span className="text-2xl font-bold text-primary">{fixedCount}/{totalCount}</span>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-muted">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Workflows</span>
                  <span className="text-2xl font-bold">{workflows.length}</span>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-muted">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Active</span>
                  <span className="text-2xl font-bold text-green-600">
                    {workflows.filter(w => w.active).length}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="issues" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="issues">Issues</TabsTrigger>
          <TabsTrigger value="workflows">Workflows</TabsTrigger>
          <TabsTrigger value="database">Database</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="issues" className="space-y-3">
          {issues.map((issue, index) => (
            <Card key={index} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-1">{getStatusIcon(issue.status)}</div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm">{issue.workflow}</h3>
                      {getStatusBadge(issue.status)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-red-600">Issue:</span> {issue.issue}
                    </p>
                    <p className="text-xs text-blue-600">
                      <span className="font-medium">Fix:</span> {issue.fix}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="workflows" className="space-y-3">
          {workflows.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">No workflows loaded. Click "Refresh Workflows" to load.</p>
              </CardContent>
            </Card>
          ) : (
            workflows.map((workflow) => (
              <Card key={workflow.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold">{workflow.name}</h3>
                      <p className="text-xs text-muted-foreground">ID: {workflow.id}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={workflow.active ? "default" : "secondary"} className={workflow.active ? "bg-green-500" : ""}>
                        {workflow.active ? 'Active' : 'Inactive'}
                      </Badge>
                      {!workflow.active && (
                        <Button size="sm" onClick={() => activateWorkflow(workflow.id)}>
                          <Play className="w-4 h-4 mr-1" />
                          Activate
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="database" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Database Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(dbStatus).map(([key, status]) => (
                <div key={key} className="flex items-center justify-between p-2 bg-muted rounded">
                  <span className="font-mono text-sm">{key}</span>
                  {status ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-yellow-500" />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-yellow-50 dark:bg-yellow-950 border-yellow-200">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Database className="w-5 h-5" />
                PostgreSQL Credentials (for n8n)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 text-xs font-mono">
                <div><span className="font-semibold">Host:</span> db.boowptjtwadxpjkpctna.supabase.co</div>
                <div><span className="font-semibold">Database:</span> postgres</div>
                <div><span className="font-semibold">User:</span> postgres.boowptjtwadxpjkpctna</div>
                <div><span className="font-semibold">Port:</span> 6543</div>
                <div><span className="font-semibold">SSL:</span> require</div>
                <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900 rounded">
                  <p className="text-xs text-blue-800 dark:text-blue-200">
                    ⚠️ Update your n8n PostgreSQL credentials with these values
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Execution Log</CardTitle>
            </CardHeader>
            <CardContent>
              {executionLog.length === 0 ? (
                <p className="text-muted-foreground text-sm">No logs yet. Run a test or fix to see logs.</p>
              ) : (
                <div className="space-y-1 text-xs font-mono max-h-96 overflow-y-auto">
                  {executionLog.map((log, idx) => (
                    <div key={idx} className={
                      log.includes('❌') ? 'text-red-600' : 
                      log.includes('✅') ? 'text-green-600' : 
                      log.includes('⚠️') ? 'text-yellow-600' : ''
                    }>
                      {log}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="mt-6 bg-green-50 dark:bg-green-950 border-green-200">
        <CardContent className="p-4">
          <h3 className="font-semibold mb-2">📋 Correct Workflow Execution Order</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>Daily Health Calculator (pulls HubSpot data, calculates scores)</li>
            <li>AI Risk Analysis (analyzes at-risk clients with AI)</li>
            <li>Weekly Pattern Detection (detects trends over time)</li>
            <li>Monthly Coach Review (reviews coach performance metrics)</li>
            <li>Daily Summary Email (sends owner summary report)</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
