import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen } from "lucide-react";
import { CalibrationExample } from "@/types/ceo";

interface CEOMemoryProps {
  calibrationData: CalibrationExample[] | undefined;
}

export function CEOMemory({ calibrationData }: CEOMemoryProps) {
  return (
    <div className="space-y-4">
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-purple-400" />
            CEO Calibration Data (How AI Learns from You)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {calibrationData?.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-lg bg-black/20 border border-white/5"
              >
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-medium text-white">
                    {item.scenario_description}
                  </h4>
                  <Badge
                    variant={item.was_ai_correct ? "default" : "destructive"}
                  >
                    {item.was_ai_correct ? "AI Correct" : "AI Wrong"}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-white/40 mb-1">AI Recommendation:</p>
                    <p className="text-white/80">{item.ai_recommendation}</p>
                  </div>
                  <div>
                    <p className="text-white/40 mb-1">CEO Decision:</p>
                    <p className="text-white/80">{item.your_decision}</p>
                  </div>
                </div>
              </div>
            ))}
            {(!calibrationData || calibrationData.length === 0) && (
              <p className="text-center text-white/40 py-8">
                No calibration data yet. Approve or reject actions to teach the
                AI.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
