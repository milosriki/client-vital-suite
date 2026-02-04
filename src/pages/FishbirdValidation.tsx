import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Fishbird } from "@/lib/fishbird-analytics";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface TruthRow {
  metric: string;
  supabase: number; // The Operational DB
  rds_replica: number | null; // The "Gold Standard" Backup (Plan B)
  posthog: number | null; // The "Behavioral Truth" (Fishbird)
  status: "MATCH" | "WARNING" | "CRITICAL" | "PENDING";
}

export default function FishbirdValidation() {
  const [rdsData, setRdsData] = useState<Record<string, number> | null>(null);

  // 1. Fetch Supabase Data (Live)
  const { data: supabaseCounts } = useQuery({
    queryKey: ["fishbird-supabase-counts"],
    queryFn: async () => {
      const { count: contacts } = await supabase
        .from("contacts")
        .select("*", { count: "exact", head: true });
      const { count: deals } = await supabase
        .from("deals")
        .select("*", { count: "exact", head: true });
      return { contacts: contacts || 0, deals: deals || 0 };
    },
  });

  // 2. Fetch PostHog Data (Mocked for now until API integration)
  const posthogCounts = {
    contacts: 142, // Example: "Submit Form" events
    deals: 28, // Example: "Purchase" events
  };

  useEffect(() => {
    Fishbird.track("viewed_fishbird_dashboard");
    // In a real app, we'd fetch the RDS validation report from an Edge Function execution log
    // For now, we simulate pending status
  }, []);

  const metrics: TruthRow[] = [
    {
      metric: "Total Contacts",
      supabase: supabaseCounts?.contacts || 0,
      rds_replica: rdsData?.contacts || null,
      posthog: posthogCounts.contacts,
      status: "PENDING",
    },
    {
      metric: "Total Deals",
      supabase: supabaseCounts?.deals || 0,
      rds_replica: rdsData?.deals || null,
      posthog: posthogCounts.deals,
      status: "PENDING",
    },
  ];

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-600 bg-clip-text text-transparent">
            🦅 Fishbird Validation
          </h1>
          <p className="text-muted-foreground mt-2">
            The Triangle of Truth: Reconciling Operations (Supabase), Backup
            (RDS), and Behavior (PostHog).
          </p>
        </div>
        <Badge variant="outline" className="px-4 py-2 text-lg">
          System Integrity:{" "}
          <span className="text-yellow-500 ml-2">VERIFYING...</span>
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card className="bg-black/40 border-cyan-500/30 backdrop-blur-xl">
          <CardHeader>
            <CardTitle>Data Reconciliation Matrix</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-cyan-400">Metric</TableHead>
                  <TableHead>Supabase (Live)</TableHead>
                  <TableHead>RDS Replica (Backup)</TableHead>
                  <TableHead>PostHog (Behavior)</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.map((row) => (
                  <TableRow key={row.metric}>
                    <TableCell className="font-medium">{row.metric}</TableCell>
                    <TableCell className="text-2xl font-bold">
                      {row.supabase}
                    </TableCell>
                    <TableCell className="text-zinc-500 italic">
                      {row.rds_replica !== null
                        ? row.rds_replica
                        : "Connecting..."}
                    </TableCell>
                    <TableCell className="text-blue-400">
                      {row.posthog}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          row.status === "MATCH" ? "default" : "destructive"
                        }
                        className={
                          row.status === "PENDING"
                            ? "bg-yellow-500/20 text-yellow-500"
                            : ""
                        }
                      >
                        {row.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
