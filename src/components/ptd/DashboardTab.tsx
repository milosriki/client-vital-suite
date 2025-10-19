import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, TrendingUp, Settings, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface DashboardTabProps {
  mode: "test" | "live";
}

export default function DashboardTab({ mode }: DashboardTabProps) {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/analytics')}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-lg">Ad Performance (CAPI)</CardTitle>
            </div>
            <CardDescription>View conversion tracking & Meta events</CardDescription>
          </CardHeader>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/dashboard')}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Activity className="h-5 w-5 text-green-500" />
              </div>
              <CardTitle className="text-lg">Health Intelligence</CardTitle>
            </div>
            <CardDescription>Client health scores & risk analysis</CardDescription>
          </CardHeader>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Settings className="h-5 w-5 text-blue-500" />
              </div>
              <CardTitle className="text-lg">Automation</CardTitle>
            </div>
            <CardDescription>Workflows & scheduled tasks</CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Danger Zone (Dev Only) */}
      {mode === "test" && (
        <Card className="border-destructive/50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
            </div>
            <CardDescription>
              These actions are only available in test mode
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
              <div>
                <p className="font-medium">Pause all sends</p>
                <p className="text-sm text-muted-foreground">
                  Stop all automated workflows
                </p>
              </div>
              <Button variant="destructive" size="sm">
                Pause
              </Button>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
              <div>
                <p className="font-medium">Flush dev data</p>
                <p className="text-sm text-muted-foreground">
                  Clear all test events and logs
                </p>
              </div>
              <Button variant="destructive" size="sm">
                Flush
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
