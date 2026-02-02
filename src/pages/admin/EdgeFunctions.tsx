import React, { useState } from "react";
import {
  SUPABASE_EDGE_FUNCTIONS,
  EdgeFunctionConfig,
} from "@/config/edgeFunctions";
import { apiClient } from "@/services/apiClient";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, CheckCircle2, Play, Activity } from "lucide-react";
import { toast } from "sonner";

export default function EdgeFunctionsPage() {
  const [filter, setFilter] = useState<
    "all" | "agent" | "integration" | "core" | "utility"
  >("all");
  const [runningFunctions, setRunningFunctions] = useState<
    Record<string, boolean>
  >({});
  const [logs, setLogs] = useState<Record<string, string>>({});

  const filteredFunctions = SUPABASE_EDGE_FUNCTIONS.filter(
    (f) => filter === "all" || f.category === filter,
  );

  const handleRun = async (func: EdgeFunctionConfig) => {
    setRunningFunctions((prev) => ({ ...prev, [func.name]: true }));
    setLogs((prev) => ({ ...prev, [func.name]: "Running..." }));

    try {
      const startTime = Date.now();
      const { data, error } = await apiClient.invoke(func.name, {
        manual_trigger: true,
      });
      const duration = Date.now() - startTime;

      if (error) {
        setLogs((prev) => ({
          ...prev,
          [func.name]: `❌ Error (${duration}ms): ${error}`,
        }));
        toast.error(`Failed to run ${func.name}`);
      } else {
        setLogs((prev) => ({
          ...prev,
          [func.name]: `✅ Success (${duration}ms): ${JSON.stringify(data, null, 2)}`,
        }));
        toast.success(`Successfully ran ${func.name}`);
      }
    } catch (err: any) {
      setLogs((prev) => ({
        ...prev,
        [func.name]: `❌ Critical Error: ${err.message}`,
      }));
    } finally {
      setRunningFunctions((prev) => ({ ...prev, [func.name]: false }));
    }
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case "agent":
        return "bg-purple-500/10 text-purple-500 border-purple-500/20";
      case "integration":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "core":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      default:
        return "bg-slate-500/10 text-slate-500 border-slate-500/20";
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Edge Functions Control Panel
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage and trigger {SUPABASE_EDGE_FUNCTIONS.length} detected
            serverless functions.
          </p>
        </div>
        <div className="flex gap-2">
          {(["all", "agent", "integration", "core", "utility"] as const).map(
            (cat) => (
              <Button
                key={cat}
                variant={filter === cat ? "default" : "outline"}
                onClick={() => setFilter(cat)}
                className="capitalize"
              >
                {cat}
              </Button>
            ),
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredFunctions.map((func) => (
          <Card
            key={func.name}
            className="flex flex-col h-full hover:shadow-lg transition-shadow border-slate-800 bg-slate-950/50"
          >
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <Badge
                  variant="outline"
                  className={`${getCategoryColor(func.category)} capitalize mb-2`}
                >
                  {func.category}
                </Badge>
                {func.isUsedInApp ? (
                  <Badge
                    variant="secondary"
                    className="bg-green-500/10 text-green-500"
                  >
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Connected
                  </Badge>
                ) : (
                  <Badge
                    variant="secondary"
                    className="bg-orange-500/10 text-orange-500"
                  >
                    <AlertCircle className="w-3 h-3 mr-1" /> Ghost
                  </Badge>
                )}
              </div>
              <CardTitle className="text-lg font-medium break-all">
                {func.name}
              </CardTitle>
              <CardDescription className="text-xs font-mono mt-1 text-slate-400">
                Secrets:{" "}
                {func.requiredSecrets.length > 0
                  ? func.requiredSecrets.join(", ")
                  : "None"}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              {logs[func.name] && (
                <ScrollArea className="h-24 w-full rounded border border-slate-800 bg-black/50 p-2">
                  <pre className="text-xs font-mono text-green-400 whitespace-pre-wrap break-all">
                    {logs[func.name]}
                  </pre>
                </ScrollArea>
              )}
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                onClick={() => handleRun(func)}
                disabled={runningFunctions[func.name]}
              >
                {runningFunctions[func.name] ? (
                  <Activity className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 mr-2" />
                )}
                {runningFunctions[func.name]
                  ? "Running..."
                  : "Trigger Function"}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
