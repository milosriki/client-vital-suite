import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Target, TrendingUp, Rocket, ShieldAlert } from "lucide-react";

interface UnitEconomicsProps {
  adSpend: number;
  setAdSpend: (value: number) => void;
  cac: number;
  ltv: number;
  ltvCacRatio: number;
  burnMultiple: number;
  isLoading: boolean;
}

export const UnitEconomics = ({
  adSpend,
  setAdSpend,
  cac,
  ltv,
  ltvCacRatio,
  burnMultiple,
  isLoading,
}: UnitEconomicsProps) => {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Target className="h-5 w-5 text-amber-400" />
        <h2 className="text-lg font-semibold text-zinc-200">
          The North Star - Unit Economics
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Ad Spend Input */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4">
            <label className="text-xs text-zinc-400 uppercase tracking-wide">
              Monthly Ad Spend
            </label>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-zinc-400">AED</span>
              <Input
                type="number"
                value={adSpend}
                onChange={(e) => setAdSpend(Number(e.target.value))}
                className="bg-zinc-800 border-zinc-700 text-amber-400 font-mono text-lg"
              />
            </div>
          </CardContent>
        </Card>

        {/* CAC */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400 uppercase tracking-wide">
                CAC
              </span>
              {cac < 500 ? (
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                  ON TARGET
                </Badge>
              ) : (
                <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">
                  HIGH
                </Badge>
              )}
            </div>
            <div className="mt-2">
              <span className="text-3xl font-bold text-amber-400 font-mono">
                {isLoading ? (
                  <Skeleton className="h-9 w-24 bg-zinc-800" />
                ) : (
                  cac === 0 ? "Insufficient data" : `AED ${cac.toFixed(0)}`
                )}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-1">Goal: &lt; AED 500</p>
          </CardContent>
        </Card>

        {/* LTV */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400 uppercase tracking-wide">
                LTV
              </span>
              <TrendingUp className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="mt-2">
              <span className="text-3xl font-bold text-amber-400 font-mono">
                {isLoading ? (
                  <Skeleton className="h-9 w-24 bg-zinc-800" />
                ) : (
                  ltv === 0 ? "Insufficient data" : `AED ${ltv.toFixed(0)}`
                )}
              </span>
            </div>
            <p className="text-xs text-emerald-400 mt-1">+5% vs last quarter</p>
          </CardContent>
        </Card>

        {/* LTV:CAC Ratio */}
        <Card
          className={`border ${ltvCacRatio >= 3 ? "border-emerald-500/50 bg-emerald-500/5" : ltvCacRatio < 1 ? "border-red-500/50 bg-red-500/5" : "border-zinc-800 bg-zinc-900/50"}`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400 uppercase tracking-wide">
                LTV:CAC Ratio
              </span>
              <span className="text-xs text-amber-400">THE GOD METRIC</span>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <span className="text-3xl font-bold text-amber-400 font-mono">
                {isLoading ? (
                  <Skeleton className="h-9 w-16 bg-zinc-800" />
                ) : (
                  ltvCacRatio === 0 ? "—" : `${ltvCacRatio.toFixed(1)}x`
                )}
              </span>
              {ltvCacRatio >= 3 ? (
                <Badge className="bg-emerald-500 text-white animate-pulse">
                  <Rocket className="h-3 w-3 mr-1" /> SCALE NOW
                </Badge>
              ) : ltvCacRatio < 1 ? (
                <Badge className="bg-red-500 text-white animate-pulse">
                  <ShieldAlert className="h-3 w-3 mr-1" /> STOP SPEND
                </Badge>
              ) : (
                <Badge className="bg-amber-500/20 text-amber-400">
                  OPTIMIZE
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Burn Multiple */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400 uppercase tracking-wide">
                Burn Multiple
              </span>
            </div>
            <div className="mt-2">
              <span className="text-3xl font-bold text-amber-400 font-mono">
                {isLoading ? (
                  <Skeleton className="h-9 w-16 bg-zinc-800" />
                ) : (
                  burnMultiple === 0 ? "Insufficient data" : `${burnMultiple.toFixed(1)}x`
                )}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-1">Net Burn / Net New ARR</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
