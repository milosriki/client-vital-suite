import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface CoachCardProps {
  coach: {
    coach_name: string;
    total_clients: number;
    avg_health_score: number;
    red_clients: number;
    yellow_clients: number;
    green_clients: number;
    purple_clients: number;
    trend: string | null;
  };
  onViewClients: () => void;
}

const getScoreColor = (score: number) => {
  if (score >= 70) return 'text-green-500';
  if (score >= 50) return 'text-yellow-500';
  return 'text-red-500';
};

const getTrendIcon = (trend: string | null) => {
  switch (trend) {
    case 'improving':
      return <TrendingUp className="h-5 w-5 text-green-500" />;
    case 'declining':
      return <TrendingDown className="h-5 w-5 text-red-500" />;
    default:
      return <Minus className="h-5 w-5 text-gray-500" />;
  }
};

export const CoachCard = ({ coach, onViewClients }: CoachCardProps) => {
  const total = coach.red_clients + coach.yellow_clients + coach.green_clients + coach.purple_clients;
  
  return (
    <Card className="card-hover">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-semibold text-xl mb-1">{coach.coach_name}</h3>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{coach.total_clients} clients</span>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {getTrendIcon(coach.trend)}
          </div>
        </div>

        <div className="mb-4">
          <p className="text-sm text-muted-foreground mb-1">Average Health Score</p>
          <p className={`text-3xl font-bold ${getScoreColor(coach.avg_health_score)}`}>
            {coach.avg_health_score.toFixed(1)}
          </p>
        </div>

        {/* Mini distribution bar */}
        <div className="h-3 flex rounded-full overflow-hidden mb-4 shadow-sm">
          {coach.red_clients > 0 && (
            <div
              className="bg-red-500"
              style={{ width: `${(coach.red_clients / total) * 100}%` }}
              title={`RED: ${coach.red_clients}`}
            />
          )}
          {coach.yellow_clients > 0 && (
            <div
              className="bg-yellow-500"
              style={{ width: `${(coach.yellow_clients / total) * 100}%` }}
              title={`YELLOW: ${coach.yellow_clients}`}
            />
          )}
          {coach.green_clients > 0 && (
            <div
              className="bg-green-500"
              style={{ width: `${(coach.green_clients / total) * 100}%` }}
              title={`GREEN: ${coach.green_clients}`}
            />
          )}
          {coach.purple_clients > 0 && (
            <div
              className="bg-purple-500"
              style={{ width: `${(coach.purple_clients / total) * 100}%` }}
              title={`PURPLE: ${coach.purple_clients}`}
            />
          )}
        </div>

        <div className="grid grid-cols-4 gap-2 mb-4 text-xs text-center">
          <div>
            <p className="text-red-500 font-semibold">{coach.red_clients}</p>
            <p className="text-muted-foreground">RED</p>
          </div>
          <div>
            <p className="text-yellow-500 font-semibold">{coach.yellow_clients}</p>
            <p className="text-muted-foreground">YLW</p>
          </div>
          <div>
            <p className="text-green-500 font-semibold">{coach.green_clients}</p>
            <p className="text-muted-foreground">GRN</p>
          </div>
          <div>
            <p className="text-purple-500 font-semibold">{coach.purple_clients}</p>
            <p className="text-muted-foreground">PUR</p>
          </div>
        </div>

        <Button onClick={onViewClients} className="w-full">
          View Clients
        </Button>
      </CardContent>
    </Card>
  );
};
