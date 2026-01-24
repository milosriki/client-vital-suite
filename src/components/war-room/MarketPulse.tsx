import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Radio, BarChart3, Target, Users } from "lucide-react";

export const MarketPulse = () => {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Radio className="h-5 w-5 text-amber-400" />
        <h2 className="text-lg font-semibold text-zinc-200">Market Pulse</h2>
        <Badge className="bg-zinc-800 text-zinc-400 border-zinc-700 text-xs">
          COMING SOON
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-zinc-900/30 border-zinc-800/50 border-dashed">
          <CardContent className="p-5 text-center">
            <BarChart3 className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
            <h3 className="text-sm font-medium text-zinc-500">
              Competitor Ad Activity
            </h3>
            <p className="text-xs text-zinc-600 mt-1">
              Integration coming soon
            </p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/30 border-zinc-800/50 border-dashed">
          <CardContent className="p-5 text-center">
            <Target className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
            <h3 className="text-sm font-medium text-zinc-500">
              Share of Voice
            </h3>
            <p className="text-xs text-zinc-600 mt-1">
              Integration coming soon
            </p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/30 border-zinc-800/50 border-dashed">
          <CardContent className="p-5 text-center">
            <Users className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
            <h3 className="text-sm font-medium text-zinc-500">
              Customer Sentiment (NPS)
            </h3>
            <p className="text-xs text-zinc-600 mt-1">
              Integration coming soon
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
