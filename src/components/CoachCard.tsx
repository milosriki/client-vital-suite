import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface CoachCardProps {
  coach: {
    coach_name: string;
    total_clients: number | null;
    active_clients?: number;
    avg_client_health: number | null;
    clients_red: number | null;
    clients_yellow: number | null;
    clients_green: number | null;
    clients_purple: number | null;
    health_trend: string | null;
    performance_score?: number | null;
    at_risk_revenue_aed?: number | null;
    coach_rank?: number | null;
    strengths?: string;
    weaknesses?: string;
  };
  onViewClients: () => void;
}

const getScoreColor = (score: number) => {
  if (score >= 70) return 'text-green-500';
  if (score >= 50) return 'text-yellow-500';
  return 'text-red-500';
};

const getTrendIcon = (trend: string | null) => {
  const t = trend?.toLowerCase();
  switch (t) {
    case 'improving':
      return <TrendingUp className="h-5 w-5 text-green-500" />;
    case 'declining':
      return <TrendingDown className="h-5 w-5 text-red-500" />;
    default:
      return <Minus className="h-5 w-5 text-gray-400" />;
  }
};

export const CoachCard = ({ coach, onViewClients }: CoachCardProps) => {
  const red = coach.clients_red ?? 0;
  const yellow = coach.clients_yellow ?? 0;
  const green = coach.clients_green ?? 0;
  const purple = coach.clients_purple ?? 0;
  const total = red + yellow + green + purple;
  const avgHealth = coach.avg_client_health ?? 0;
  
  return (
    <Card className="card-hover">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-semibold text-xl mb-1">{coach.coach_name}</h3>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{coach.total_clients ?? 0} clients</span>
              {coach.coach_rank && (
                <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                  Rank #{coach.coach_rank}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {getTrendIcon(coach.health_trend)}
          </div>
        </div>

        <div className="mb-4">
          <p className="text-sm text-muted-foreground mb-1">Average Health Score</p>
          <p className={`text-3xl font-bold ${getScoreColor(avgHealth)}`}>
            {avgHealth.toFixed(1)}
          </p>
        </div>

        {/* At-risk revenue warning */}
        {(coach.at_risk_revenue_aed ?? 0) > 0 && (
          <div className="mb-3 text-xs bg-red-500/10 text-red-400 rounded px-2 py-1">
            ⚠ AED {(coach.at_risk_revenue_aed ?? 0).toLocaleString()} at risk
          </div>
        )}

        {/* Mini distribution bar */}
        {total > 0 && (
          <div className="h-3 flex rounded-full overflow-hidden mb-4 shadow-sm">
            {red > 0 && (
              <div className="bg-red-500" style={{ width: `${(red / total) * 100}%` }} title={`RED: ${red}`} />
            )}
            {yellow > 0 && (
              <div className="bg-yellow-500" style={{ width: `${(yellow / total) * 100}%` }} title={`YELLOW: ${yellow}`} />
            )}
            {green > 0 && (
              <div className="bg-green-500" style={{ width: `${(green / total) * 100}%` }} title={`GREEN: ${green}`} />
            )}
            {purple > 0 && (
              <div className="bg-purple-500" style={{ width: `${(purple / total) * 100}%` }} title={`PURPLE: ${purple}`} />
            )}
          </div>
        )}

        <div className="grid grid-cols-4 gap-2 mb-4 text-xs text-center">
          <div>
            <p className="text-red-500 font-semibold">{red}</p>
            <p className="text-muted-foreground">RED</p>
          </div>
          <div>
            <p className="text-yellow-500 font-semibold">{yellow}</p>
            <p className="text-muted-foreground">YLW</p>
          </div>
          <div>
            <p className="text-green-500 font-semibold">{green}</p>
            <p className="text-muted-foreground">GRN</p>
          </div>
          <div>
            <p className="text-purple-500 font-semibold">{purple}</p>
            <p className="text-muted-foreground">PUR</p>
          </div>
        </div>

        {/* Weaknesses hint */}
        {coach.weaknesses && (
          <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{coach.weaknesses}</p>
        )}

        <Button onClick={onViewClients} className="w-full">
          View Clients
        </Button>
      </CardContent>
    </Card>
  );
};
