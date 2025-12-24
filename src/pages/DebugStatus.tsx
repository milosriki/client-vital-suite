import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertCircle, RefreshCw } from "lucide-react";

type CheckStatus = "pass" | "warn" | "fail";
type Check = { name: string; status: CheckStatus; latencyMs?: number; message?: string };

type SystemCheckOk = {
  ok: boolean;
  status?: string;
  checks?: Check[];
  totalMs?: number;
  timestamp?: string;
};

type SystemCheckErr = { error: string; details?: string };

export default function DebugStatus() {
  const [systemCheck, setSystemCheck] = useState<SystemCheckOk | SystemCheckErr | null>(null);
  const [loading, setLoading] = useState(false);

  // Frontend env vars (ONLY VITE_* are visible in browser by design)
  // Vite exposes env vars via import.meta.env and only VITE_ prefixed keys are exposed.
  const frontendEnv = useMemo(() => ({
    VITE_SUPABASE_URL: !!import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
    VITE_SUPABASE_PUBLISHABLE_KEY: !!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    VITE_GEMINI_API_KEY: !!import.meta.env.VITE_GEMINI_API_KEY,
    VITE_API_BASE: !!import.meta.env.VITE_API_BASE,
    VITE_META_CAPI_URL: !!import.meta.env.VITE_META_CAPI_URL,
    MODE: import.meta.env.MODE,
  }), []);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/system-check", { cache: "no-store" });
      const data = await res.json();
      setSystemCheck(data);
    } catch (e) {
      setSystemCheck({
        error:
          "Could not reach /api/system-check (expected if running local dev without Vercel server routes).",
        details: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStatus(); }, []);

  const checks: Check[] =
    systemCheck && "checks" in systemCheck && Array.isArray(systemCheck.checks)
      ? systemCheck.checks
      : [];

  const get = (name: string) => checks.find((c) => c.name === name);

  const Icon = ({ status }: { status?: string }) => {
    if (status === "pass") return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    if (status === "warn") return <AlertCircle className="w-5 h-5 text-yellow-500" />;
    if (status === "fail") return <XCircle className="w-5 h-5 text-red-500" />;
    return <XCircle className="w-5 h-5 text-slate-500" />;
  };

  const ok = systemCheck && "ok" in systemCheck ? systemCheck.ok : false;

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold italic tracking-tighter">SYSTEM_DIAGNOSTICS</h1>
        <button onClick={fetchStatus} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
          <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-slate-950 border-slate-800">
          <CardHeader>
            <CardTitle className="text-sm uppercase text-slate-400">Frontend (UI) Keys</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(frontendEnv).map(([k, v]) => (
              <div key={k} className="flex justify-between items-center">
                <span className="text-sm">{k}</span>
                <Icon status={typeof v === "boolean" ? (v ? "pass" : "fail") : "pass"} />
              </div>
            ))}
            <Badge variant="outline">{frontendEnv.MODE} MODE</Badge>
          </CardContent>
        </Card>

        <Card className="bg-slate-950 border-slate-800">
          <CardHeader>
            <CardTitle className="text-sm uppercase text-slate-400">Backend (Vercel) API</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm">/api/system-check reachable</span>
              <Icon status={systemCheck && "error" in systemCheck ? "fail" : "pass"} />
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm">Overall OK</span>
              <Icon status={ok ? "pass" : "fail"} />
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm">env_vars</span>
              <Icon status={get("env_vars")?.status} />
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm">table_contacts</span>
              <Icon status={get("table_contacts")?.status} />
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm">table_agent_memory</span>
              <Icon status={get("table_agent_memory")?.status} />
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm">rpc_match_memories</span>
              <Icon status={get("rpc_match_memories")?.status} />
            </div>

            {"error" in (systemCheck || {}) && (
              <p className="text-xs text-red-400 mt-2">{(systemCheck as SystemCheckErr).error}</p>
            )}

            {!!get("rpc_match_memories")?.message && (
              <p className="text-xs text-yellow-400 mt-2">
                {get("rpc_match_memories")?.message}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-black border-slate-800">
        <CardHeader>
          <CardTitle className="text-sm uppercase text-slate-400">Raw Output</CardTitle>
        </CardHeader>
        <CardContent className="font-mono text-xs text-slate-300 whitespace-pre-wrap">
          {JSON.stringify({ frontendEnv, systemCheck }, null, 2)}
        </CardContent>
      </Card>
    </div>
  );
}