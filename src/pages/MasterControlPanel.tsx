import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ALL_EDGE_FUNCTIONS, EdgeFunction } from "@/config/edgeFunctions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getBusinessDate } from "@/lib/date-utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Play,
  Search,
  Terminal,
  AlertTriangle,
  CheckCircle,
  Clock,
} from "lucide-react";

export default function MasterControlPanel() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [running, setRunning] = useState<string | null>(null);
  const [confirmFunc, setConfirmFunc] = useState<EdgeFunction | null>(null);
  const [logs, setLogs] = useState<
    { func: string; output: string; status: "success" | "error" }[]
  >([]);

  const filteredFunctions = ALL_EDGE_FUNCTIONS.filter((f) =>
    f.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const runFunction = async (func: EdgeFunction) => {
    setRunning(func.name);
    try {
      const startTime = Date.now();
      const { data, error } = await supabase.functions.invoke(func.name, {
        body: { manual_trigger: true, source: "master_control_panel" },
      });

      const duration = Date.now() - startTime;

      if (error) throw error;

      const output = JSON.stringify(data, null, 2);
      setLogs((prev) => [
        {
          func: func.name,
          output: `✅ Success (${duration}ms)\n${output}`,
          status: "success",
        },
        ...prev,
      ]);

      toast({
        title: "Function Executed",
        description: `${func.name} completed successfully.`,
      });
    } catch (error: any) {
      setLogs((prev) => [
        {
          func: func.name,
          output: `❌ Error\n${error.message || JSON.stringify(error, null, 2)}`,
          status: "error",
        },
        ...prev,
      ]);

      toast({
        title: "Execution Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setRunning(null);
      setConfirmFunc(null);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6 animate-fade-in">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">
          Master Control Panel
        </h1>
        <p className="text-muted-foreground">
          Direct access to all {ALL_EDGE_FUNCTIONS.length} detected edge
          functions.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Function List */}
        <Card className="lg:col-span-2 h-[80vh] flex flex-col">
          <CardHeader>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search functions..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            <ScrollArea className="h-full">
              <div className="divide-y">
                {filteredFunctions.map((func) => (
                  <div
                    key={func.name}
                    className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium">
                          {func.name}
                        </span>
                        {func.isScheduled && (
                          <Badge variant="outline" className="text-xs">
                            <Clock className="h-3 w-3 mr-1" /> Cron
                          </Badge>
                        )}
                        {!func.hasSecrets && (
                          <Badge variant="destructive" className="text-xs">
                            Missing Secrets
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {func.hasIndex ? "Ready to run" : "Missing index.ts"}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/10"
                      onClick={() => navigate("/attribution")}
                    >
                      🦅 Fishbird Analytics (Truth Layer)
                    </Button>
                    <Button
                      variant="outline"
                      className={`w-full justify-start text-blue-400 border-blue-500/30 hover:bg-blue-500/10 ${
                        running === func.name ? "animate-pulse" : ""
                      }`}
                      onClick={() => setConfirmFunc(func)}
                    >
                      {running === func.name ? (
                        "Running..."
                      ) : (
                        <>
                          <Play className="h-3 w-3 mr-2" />
                          Run
                        </>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Output Console */}
        <Card className="h-[80vh] flex flex-col bg-slate-950 text-slate-50 border-slate-800">
          <CardHeader className="border-b border-slate-800 bg-slate-900/50">
            <CardTitle className="text-sm font-mono flex items-center gap-2">
              <Terminal className="h-4 w-4 text-green-400" />
              Execution Output
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0 font-mono text-xs">
            <ScrollArea className="h-full p-4">
              {logs.length === 0 ? (
                <div className="text-slate-300 italic">
                  No execution logs yet...
                </div>
              ) : (
                <div className="space-y-6">
                  {logs.map((log, i) => (
                    <div key={i} className="space-y-2 animate-fade-in">
                      <div className="flex items-center gap-2 border-b border-slate-800 pb-1">
                        {log.status === "success" ? (
                          <CheckCircle className="h-3 w-3 text-green-500" />
                        ) : (
                          <AlertTriangle className="h-3 w-3 text-red-500" />
                        )}
                        <span className="font-bold text-slate-300">
                          {log.func}
                        </span>
                        <span className="text-slate-300 ml-auto text-[10px]">
                          {getBusinessDate().toLocaleTimeString()}
                        </span>
                      </div>
                      <pre
                        className={`whitespace-pre-wrap ${log.status === "error" ? "text-red-400" : "text-slate-300"}`}
                      >
                        {log.output}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog
        open={!!confirmFunc}
        onOpenChange={(open) => !open && setConfirmFunc(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirm Execution
            </AlertDialogTitle>
            <AlertDialogDescription>
              You are about to run{" "}
              <strong className="font-mono">{confirmFunc?.name}</strong>. This
              action may modify data. Are you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmFunc && runFunction(confirmFunc)}
              className="bg-red-600 hover:bg-red-700"
            >
              Run Function
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
