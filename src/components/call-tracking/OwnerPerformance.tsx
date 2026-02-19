import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Users, Download, ArrowUpDown } from "lucide-react";
import { exportToCSV } from "@/lib/csv-export";

export interface OwnerStats {
  owner: string;
  totalCalls: number;
  answered: number;
  missed: number;
  avgDuration: number;
  conversionRate: number;
}

interface Props {
  data: OwnerStats[];
  isLoading: boolean;
}

type SortKey = keyof OwnerStats;

export function OwnerPerformance({ data, isLoading }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("totalCalls");
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = [...data].sort((a, b) => {
    const av = a[sortKey], bv = b[sortKey];
    if (typeof av === "number" && typeof bv === "number") return sortAsc ? av - bv : bv - av;
    return sortAsc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const getRateColor = (rate: number) => {
    if (rate >= 80) return "text-green-500";
    if (rate >= 60) return "text-yellow-500";
    return "text-red-500";
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5 text-sky-500" />
            Owner Performance
          </CardTitle>
          <Button variant="ghost" size="sm" className="cursor-pointer" onClick={() => exportToCSV(data, "owner-performance")}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-48 animate-pulse bg-muted rounded" />
        ) : data.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No owner data available</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {([
                    ["owner", "Owner"],
                    ["totalCalls", "Total"],
                    ["answered", "Answered"],
                    ["missed", "Missed"],
                    ["avgDuration", "Avg Duration"],
                    ["conversionRate", "Conv. Rate"],
                  ] as [SortKey, string][]).map(([key, label]) => (
                    <TableHead key={key}>
                      <button className="flex items-center gap-1 cursor-pointer hover:text-foreground" onClick={() => toggleSort(key)}>
                        {label} <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((row) => {
                  const answerRate = row.totalCalls > 0 ? (row.answered / row.totalCalls) * 100 : 0;
                  return (
                    <TableRow key={row.owner} className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="font-medium">{row.owner || "Unknown"}</TableCell>
                      <TableCell>{row.totalCalls}</TableCell>
                      <TableCell className="text-green-500">{row.answered}</TableCell>
                      <TableCell className="text-red-500">{row.missed}</TableCell>
                      <TableCell>{Math.floor(row.avgDuration / 60)}:{String(Math.round(row.avgDuration % 60)).padStart(2, '0')}</TableCell>
                      <TableCell className={getRateColor(row.conversionRate)}>{row.conversionRate.toFixed(1)}%</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
