import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

export default function ConnectionStatus() {
  const [status, setStatus] = useState<"loading" | "connected" | "error">(
    "loading",
  );
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [envInfo, setEnvInfo] = useState<Record<string, string>>({});

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      setStatus("loading");

      // Check Env Vars (safely)
      setEnvInfo({
        URL_SET: import.meta.env.VITE_SUPABASE_URL ? "YES" : "NO",
        KEY_SET: import.meta.env.VITE_SUPABASE_ANON_KEY ? "YES" : "NO",
        MODE: import.meta.env.MODE,
      });

      // Check Tables
      const tables = ["contacts", "deals", "stripe_outbound_transfers"];
      const newCounts: Record<string, number> = {};

      for (const table of tables) {
        const { count, error: countError } = await supabase
          .from(table)
          .select("*", { count: "exact", head: true });

        if (countError) throw countError;
        newCounts[table] = count || 0;
      }

      setCounts(newCounts);
      setStatus("connected");
    } catch (err: any) {
      console.error("Connection check failed:", err);
      setError(err.message);
      setStatus("error");
    }
  };

  return (
    <Card className="mb-6 border-2 border-blue-100">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center justify-between">
          <span>System Diagnostics</span>
          {status === "loading" && (
            <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
          )}
          {status === "connected" && (
            <Badge className="bg-green-500">Connected</Badge>
          )}
          {status === "error" && (
            <Badge variant="destructive">Connection Failed</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Env Var Status */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="p-2 bg-slate-50 rounded border">
              <span className="text-muted-foreground">Supabase URL:</span>
              <div className="font-mono font-bold">{envInfo.URL_SET}</div>
            </div>
            <div className="p-2 bg-slate-50 rounded border">
              <span className="text-muted-foreground">Anon Key:</span>
              <div className="font-mono font-bold">{envInfo.KEY_SET}</div>
            </div>
            <div className="p-2 bg-slate-50 rounded border">
              <span className="text-muted-foreground">Mode:</span>
              <div className="font-mono font-bold">{envInfo.MODE}</div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm flex items-start gap-2">
              <XCircle className="h-4 w-4 mt-0.5" />
              <div>
                <p className="font-bold">Connection Error:</p>
                <p className="font-mono text-xs">{error}</p>
              </div>
            </div>
          )}

          {/* Data Counts */}
          {status === "connected" && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                Live Data Counts:
              </p>
              <div className="grid grid-cols-3 gap-4">
                {Object.entries(counts).map(([table, count]) => (
                  <div
                    key={table}
                    className="text-center p-2 bg-slate-50 rounded border"
                  >
                    <div className="text-xs text-muted-foreground uppercase">
                      {table}
                    </div>
                    <div className="text-xl font-bold text-slate-900">
                      {count}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
