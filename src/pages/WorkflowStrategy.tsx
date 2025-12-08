import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Info, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const WorkflowStrategy = () => {
  const navigate = useNavigate();
  
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold mb-2">n8n Workflow Management</h1>
          <p className="text-muted-foreground text-lg">
            Historical reference - System migrated to Supabase
          </p>
        </div>

        {/* Deprecation Alert */}
        <Alert className="border-yellow-500 bg-yellow-500/10">
          <AlertTriangle className="h-5 w-5 text-yellow-500" />
          <AlertDescription className="text-lg">
            <strong>⚠️ DEPRECATED:</strong> This page is kept for historical reference only.
            <div className="mt-3 space-y-2">
              <p>n8n workflows have been <strong>fully migrated</strong> to Supabase Edge Functions and RPC calls.</p>
              <p>All automation now runs directly within Supabase, providing better reliability, maintainability, and cost efficiency.</p>
            </div>
          </AlertDescription>
        </Alert>

        {/* Migration Status */}
        <Card>
          <CardHeader>
            <CardTitle>Migration Status: Complete ✅</CardTitle>
            <CardDescription>All n8n workflows have been replaced</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <h3 className="font-semibold">What Was Migrated:</h3>
              <div className="grid gap-3">
                <div className="flex items-start gap-3 p-3 border rounded-lg">
                  <div className="text-green-500 mt-1">✓</div>
                  <div>
                    <div className="font-medium">Daily Health Calculator</div>
                    <div className="text-sm text-muted-foreground">
                      Now: <code className="text-xs bg-muted px-1 py-0.5 rounded">calculate_daily_health_scores()</code> RPC
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 border rounded-lg">
                  <div className="text-green-500 mt-1">✓</div>
                  <div>
                    <div className="font-medium">Monthly Coach Review</div>
                    <div className="text-sm text-muted-foreground">
                      Now: <code className="text-xs bg-muted px-1 py-0.5 rounded">monthly_coach_review()</code> RPC
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 border rounded-lg">
                  <div className="text-green-500 mt-1">✓</div>
                  <div>
                    <div className="font-medium">AI Risk Analysis</div>
                    <div className="text-sm text-muted-foreground">
                      Now: Integrated via Supabase Edge Functions with Claude AI
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 border rounded-lg">
                  <div className="text-green-500 mt-1">✓</div>
                  <div>
                    <div className="font-medium">Weekly Pattern Detection</div>
                    <div className="text-sm text-muted-foreground">
                      Now: Automated via Supabase scheduled functions
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 border rounded-lg">
                  <div className="text-green-500 mt-1">✓</div>
                  <div>
                    <div className="font-medium">CSV Backfill Processing</div>
                    <div className="text-sm text-muted-foreground">
                      Now: Custom Supabase Edge Function
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Benefits Card */}
        <Card>
          <CardHeader>
            <CardTitle>Benefits of the Migration</CardTitle>
            <CardDescription>Why we moved away from n8n</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Cost Savings</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• No n8n Cloud subscription ($50/month saved)</li>
                  <li>• Included in existing Supabase tier</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Reliability</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• From 87.5% failure rate to near 100% success</li>
                  <li>• Better error handling and recovery</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Maintainability</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• All code in version control (Git)</li>
                  <li>• TypeScript with type safety</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Developer Experience</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Local testing and debugging</li>
                  <li>• IDE autocompletion and linting</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Current System Card */}
        <Card>
          <CardHeader>
            <CardTitle>Current Automation System</CardTitle>
            <CardDescription>Where to manage automation workflows</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                All automation is now managed through the <strong>PTD Control Panel</strong> in the Automation tab.
              </AlertDescription>
            </Alert>
            
            <Button 
              onClick={() => navigate('/ptd-control')}
              className="w-full"
            >
              Go to PTD Control Panel
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        {/* Historical Reference */}
        <Card>
          <CardHeader>
            <CardTitle>Historical Reference</CardTitle>
            <CardDescription>Documentation kept for reference</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              For details about the original n8n implementation and the migration strategy, see:
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <code className="text-xs bg-muted px-2 py-1 rounded">N8N_WORKFLOW_ANALYSIS.md</code> - Original workflows and migration plan
              </li>
              <li>
                <code className="text-xs bg-muted px-2 py-1 rounded">PTD_SETUP_GUIDE.md</code> - Updated setup documentation
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default WorkflowStrategy;
