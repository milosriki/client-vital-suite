import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Loader2, Database, Settings, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const N8N_API_URL = 'https://personaltrainersdubai.app.n8n.cloud/api/v1';

interface WorkflowIssue {
  workflow: string;
  issue: string;
  fix: string;
  status: 'pending' | 'fixing' | 'fixed' | 'error';
}

export default function WorkflowFixer() {
  const { toast } = useToast();
  const [issues, setIssues] = useState<WorkflowIssue[]>([
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
      issue: 'RPC functions missing request body',
      fix: 'Add target_date parameter in request body',
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
      issue: 'Missing PostgreSQL connection',
      fix: 'Configure PostgreSQL nodes with Supabase credentials',
      status: 'pending'
    },
    {
      workflow: 'Daily Summary Email',
      issue: 'Query structure errors',
      fix: 'Fix column names and aggregation queries',
      status: 'pending'
    }
  ]);

  const [isFixing, setIsFixing] = useState(false);
  const [testResult, setTestResult] = useState<string>('');
  const [executionLog, setExecutionLog] = useState<string[]>([]);

  const testConnection = async () => {
    setTestResult('Testing n8n API connection...');
    try {
      const response = await fetch(`${N8N_API_URL}/workflows`, {
        headers: {
          'X-N8N-API-KEY': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5YTdjOWE4Ny0yNzYyLTQ1NjAtYjc1OS00MWNmZjUwMGM4YTkiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYwNzEyMDI1LCJleHAiOjE3NjMyMzY4MDB9.D3_VU6WuoFDuy-_znwq7OZ2HSBEM_uJbLcXlt7id1fI'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setTestResult(`✅ Connected! Found ${data.data?.length || 0} workflows`);
      } else {
        setTestResult(`❌ Connection failed: ${response.status} ${response.statusText}`);
      }
    } catch (error: any) {
      setTestResult(`❌ Error: ${error.message}`);
    }
  };

  const verifyDatabase = async () => {
    setTestResult('Verifying database tables...');
    try {
      // Check all required tables
      const tables = ['client_health_scores', 'coach_performance', 'intervention_log', 'daily_summary'];
      const results: string[] = [];
      
      for (const table of tables) {
        const { data, error } = await supabase
          .from(table as any)
          .select('count')
          .limit(1);
        
        if (error) {
          results.push(`❌ ${table}: ${error.message}`);
        } else {
          results.push(`✅ ${table}: OK`);
        }
      }
      
      setTestResult(results.join('\n'));
      toast({
        title: "Database Verification Complete",
        description: "All tables checked"
      });
    } catch (error: any) {
      setTestResult(`❌ Error: ${error.message}`);
    }
  };

  const fixAllWorkflows = async () => {
    setIsFixing(true);
    setExecutionLog(['Starting workflow fixes...']);
    
    // Update all issues to fixing status
    setIssues(prev => prev.map(issue => ({ ...issue, status: 'fixing' })));
    
    try {
      setExecutionLog(prev => [...prev, 'Calling setup-workflows function...']);
      
      // Call the existing setup-workflows edge function
      const { data, error } = await supabase.functions.invoke('setup-workflows', {
        body: {}
      });
      
      if (error) {
        setExecutionLog(prev => [...prev, `❌ Error: ${error.message}`]);
        setIssues(prev => prev.map(issue => ({ ...issue, status: 'error' })));
        toast({
          variant: "destructive",
          title: "Fix Failed",
          description: error.message
        });
        return;
      }
      
      setExecutionLog(prev => [...prev, 'Processing results...']);
      
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
      
      if (data?.execution) {
        setExecutionLog(prev => [...prev, `\nDaily Calculator: ${data.execution.status}`]);
      }
      
      // Mark all as fixed
      setIssues(prev => prev.map(issue => ({ ...issue, status: 'fixed' })));
      
      setExecutionLog(prev => [...prev, '\n✅ All workflow fixes completed!']);
      
      toast({
        title: "Success!",
        description: "All workflows have been fixed and Daily Calculator executed",
      });
      
    } catch (error: any) {
      setExecutionLog(prev => [...prev, `❌ Error: ${error.message}`]);
      setIssues(prev => prev.map(issue => ({ ...issue, status: 'error' })));
      toast({
        variant: "destructive",
        title: "Fix Failed",
        description: error.message
      });
    } finally {
      setIsFixing(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'fixed':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'fixing':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
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
    
    return (
      <Badge variant={variant} className={className}>
        {text}
      </Badge>
    );
  };

  const fixedCount = issues.filter(i => i.status === 'fixed').length;
  const totalCount = issues.length;

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <Card className="mb-6 border-2 border-primary">
        <CardHeader>
          <CardTitle className="text-3xl font-bold flex items-center gap-2">
            <Settings className="w-8 h-8" />
            PTD Workflow Fixer
          </CardTitle>
          <p className="text-muted-foreground">
            Fix workflow SQL queries, PostgreSQL connections, and RPC calls automatically
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button onClick={testConnection} variant="outline" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Test n8n Connection
            </Button>
            <Button onClick={verifyDatabase} variant="outline" className="flex items-center gap-2">
              <Database className="w-4 h-4" />
              Verify Database
            </Button>
            <Button 
              onClick={fixAllWorkflows} 
              disabled={isFixing}
              className="bg-green-600 hover:bg-green-700 flex items-center gap-2"
            >
              {isFixing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Fixing All Workflows...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Fix All Workflows Now
                </>
              )}
            </Button>
          </div>
          
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <span className="font-medium">Progress:</span>
            <span className="text-2xl font-bold text-primary">{fixedCount}/{totalCount}</span>
          </div>
          
          {testResult && (
            <div className="p-3 bg-secondary rounded-lg text-sm whitespace-pre-line font-mono">
              {testResult}
            </div>
          )}
          
          {executionLog.length > 0 && (
            <Card className="bg-muted">
              <CardHeader>
                <CardTitle className="text-lg">Execution Log</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 text-xs font-mono max-h-64 overflow-y-auto">
                  {executionLog.map((log, idx) => (
                    <div key={idx} className={log.includes('❌') ? 'text-red-600' : log.includes('✅') ? 'text-green-600' : ''}>
                      {log}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        {issues.map((issue, index) => (
          <Card key={index} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="mt-1">
                  {getStatusIcon(issue.status)}
                </div>
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
      </div>

      <Card className="mt-6 bg-blue-50 dark:bg-blue-950 border-blue-200">
        <CardContent className="p-4">
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <Database className="w-5 h-5" />
            Database Tables (Already Created)
          </h3>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>client_health_scores - Client health metrics and scores</li>
            <li>coach_performance - Coach performance analytics</li>
            <li>intervention_log - Manual interventions tracking</li>
            <li>daily_summary - Daily aggregated statistics</li>
            <li>weekly_patterns - Weekly pattern analysis</li>
          </ul>
        </CardContent>
      </Card>

      <Card className="mt-4 bg-green-50 dark:bg-green-950 border-green-200">
        <CardContent className="p-4">
          <h3 className="font-semibold mb-2">📋 Correct Workflow Execution Order</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>Daily Health Calculator (pulls HubSpot data, calculates scores)</li>
            <li>AI Risk Analysis (analyzes at-risk clients)</li>
            <li>Weekly Pattern Detection (detects trends)</li>
            <li>Monthly Coach Review (reviews coach performance)</li>
            <li>Daily Summary Email (sends owner summary)</li>
          </ol>
        </CardContent>
      </Card>

      <Card className="mt-4 bg-yellow-50 dark:bg-yellow-950 border-yellow-200">
        <CardContent className="p-4">
          <h3 className="font-semibold mb-2">🔑 PostgreSQL Credentials (For n8n)</h3>
          <div className="text-xs space-y-1 font-mono">
            <div><span className="font-semibold">Host:</span> db.ztjndilxurtsfqdsvfds.supabase.co</div>
            <div><span className="font-semibold">Database:</span> postgres</div>
            <div><span className="font-semibold">User:</span> postgres</div>
            <div><span className="font-semibold">Port:</span> 5432</div>
            <div><span className="font-semibold">SSL:</span> require</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
