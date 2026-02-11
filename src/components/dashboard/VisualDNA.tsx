import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap } from "lucide-react";
import { MarketingDashboardData } from "@/types/marketing";

interface VisualDNAProps {
  ads: MarketingDashboardData["zone_d"]["top_performers"];
  integrityScore?: number;
}

export function VisualDNA({ ads, integrityScore = 1.0 }: VisualDNAProps) {
  if (!ads || ads.length === 0) {
    return (
      <div className="col-span-full text-center py-20 bg-black/40 rounded-xl border border-dashed border-white/10">
        <div className="flex flex-col items-center gap-3">
          <Zap className="h-8 w-8 text-muted-foreground/30" />
          <p className="text-muted-foreground font-mono text-xs uppercase tracking-widest">
            Scanning Creative Data Stream...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {ads.map((ad, i) => {
        // Calculate Roas
        // If purchase_value is present, use it. Otherwise 0.
        const platformRoas = ad.purchase_value
          ? ad.purchase_value / ad.spend
          : 0;
        // Apply Integrity Score (The "Truth")
        const trueRoas = platformRoas * integrityScore;

        return (
          <Card
            key={i}
            className="overflow-hidden border-white/5 bg-black/40 group/ad transition-all duration-300 hover:border-primary/30"
          >
            {/* Creative Preview */}
            <div className="aspect-video relative overflow-hidden bg-muted/20 border-b border-white/5">
              <img
                src={`https://pipeboard.com/api/meta/creative/${ad.ad_id}/thumbnail`}
                alt={ad.ad_name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover/ad:scale-110"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1000&auto=format&fit=crop";
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
              <div className="absolute bottom-2 left-2 right-2 flex justify-between items-end">
                <Badge
                  variant="secondary"
                  className="bg-black/60 backdrop-blur-md text-[9px] font-mono border-white/10 uppercase tracking-tighter"
                >
                  ID: {ad.ad_id.slice(-6)}
                </Badge>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[10px] text-white/60 font-mono uppercase tracking-tighter">
                    True ROAS
                  </span>
                  <span
                    className={`text-sm font-bold font-mono leading-none ${trueRoas > 2 ? "text-emerald-400" : "text-primary"}`}
                  >
                    {trueRoas.toFixed(2)}x
                  </span>
                </div>
              </div>
            </div>

            <CardContent className="pt-4">
              <h3
                className="font-bold text-sm truncate text-white/90 font-mono tracking-tight"
                title={ad.ad_name}
              >
                {ad.ad_name}
              </h3>

              <div className="grid grid-cols-4 gap-2 mt-4 pt-4 border-t border-white/5">
                <div className="space-y-1">
                  <p className="text-white/40 text-[9px] font-bold uppercase tracking-widest">
                    Spend
                  </p>
                  <p className="text-sm font-bold font-mono">
                    AED{" "}
                    {ad.spend.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-white/40 text-[9px] font-bold uppercase tracking-widest">
                    CTR
                  </p>
                  <p className="text-sm font-bold font-mono text-emerald-500">
                    {ad.ctr.toFixed(2)}%
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-white/40 text-[9px] font-bold uppercase tracking-widest">
                    P-ROAS
                  </p>
                  <p
                    className="text-sm font-bold font-mono text-muted-foreground"
                    title="Platform Reported ROAS"
                  >
                    {platformRoas.toFixed(2)}x
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-white/40 text-[9px] font-bold uppercase tracking-widest">
                    Leads
                  </p>
                  <p className="text-sm font-bold font-mono text-indigo-400">
                    {ad.leads || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
