import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Play, Eye, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface AutomationTabProps {
  mode: "test" | "live";
}

export default function AutomationTab({ mode }: AutomationTabProps) {
  const { toast } = useToast();
  const [csvUrl, setCsvUrl] = useState("");

  // Fetch automation logs
  const { data: logs } = useQuery({
    queryKey: ["automation-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automation_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const handleDailyHealth = async () => {
    try {
      const { error } = await supabase.rpc("calculate_daily_health_scores");
      if (error) throw error;
      
      // Log the action
      await supabase.from("automation_logs").insert({
        action_type: "daily_health_calculation",
        status: "success",
        mode,
      });

      toast({
        title: "Success",
        description: "Daily health scores calculated",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to run daily health calculation",
        variant: "destructive",
      });
    }
  };

  const handleMonthlyReview = async () => {
    try {
      const { data, error } = await supabase.rpc("monthly_coach_review", {
        p_coach: "default",
      });
      if (error) throw error;

      // Save to coach_reviews
      await supabase.from("coach_reviews").insert({
        coach: "default",
        period_month: new Date().getMonth() + 1,
        period_year: new Date().getFullYear(),
        summary: data,
      });

      toast({
        title: "Success",
        description: "Monthly review completed",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to run monthly review",
        variant: "destructive",
      });
    }
  };

  const handleBackfillPreflight = () => {
    toast({
      title: "Preflight Check",
      description: `CSV URL: ${csvUrl}\nReady to process`,
    });
  };

  const handleBackfillSimulate = () => {
    console.log("Simulating backfill from:", csvUrl);
    toast({
      title: "Simulation",
      description: "Backfill simulated (no actual processing)",
    });
  };

  const handleBackfillRun = async () => {
    if (!csvUrl) {
      toast({
        title: "Error",
        description: "Please enter a CSV URL",
        variant: "destructive",
      });
      return;
    }

    try {
      // Log the backfill attempt
      await supabase.from("automation_logs").insert({
        action_type: "capi_backfill",
        status: "started",
        mode,
        payload: { csv_url: csvUrl },
      });

      toast({
        title: "Backfill Started",
        description: "Processing CSV events...",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to start backfill",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Run Daily Health</CardTitle>
            <CardDescription>
              Calculate health scores for all clients
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleDailyHealth} className="w-full">
              <Play className="h-4 w-4 mr-2" />
              Run Now
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Run Monthly Review</CardTitle>
            <CardDescription>
              Generate coach performance summary
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleMonthlyReview} className="w-full">
              <Play className="h-4 w-4 mr-2" />
              Run Now
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Backfill CSV to CAPI */}
      <Card>
        <CardHeader>
          <CardTitle>Backfill CSV to CAPI</CardTitle>
          <CardDescription>
            Process historical events from CSV file
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="csv-url">CSV URL</Label>
            <Input
              id="csv-url"
              value={csvUrl}
              onChange={(e) => setCsvUrl(e.target.value)}
              placeholder="https://example.com/events.csv"
            />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={handleBackfillPreflight}>
              <Eye className="h-4 w-4 mr-2" />
              Preflight
            </Button>
            <Button variant="outline" onClick={handleBackfillSimulate}>
              <Play className="h-4 w-4 mr-2" />
              Simulate
            </Button>
            <Button onClick={handleBackfillRun}>
              <Upload className="h-4 w-4 mr-2" />
              Run
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Logs Viewer */}
      <Card>
        <CardHeader>
          <CardTitle>Automation Logs</CardTitle>
          <CardDescription>Recent automation activity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs?.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium">{log.action_type}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          log.status === "success"
                            ? "bg-green-500/10 text-green-500"
                            : log.status === "started"
                            ? "bg-blue-500/10 text-blue-500"
                            : "bg-red-500/10 text-red-500"
                        }
                      >
                        {log.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{log.mode}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(log.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-xs text-red-500">
                      {log.error_message || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
