import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye } from "lucide-react";

interface ClientCardProps {
  client: {
    firstname: string | null;
    lastname: string | null;
    email: string | null;
    health_score: number;
    health_zone: string;
    sessions_last_7d: number;
    sessions_last_30d: number;
    outstanding_sessions: number;
    assigned_coach: string | null;
  };
  onViewDetails: () => void;
}

const getHealthColor = (zone: string) => {
  switch (zone) {
    case 'RED': return 'bg-red-500 text-white';
    case 'YELLOW': return 'bg-yellow-500 text-white';
    case 'GREEN': return 'bg-green-500 text-white';
    case 'PURPLE': return 'bg-purple-500 text-white';
    default: return 'bg-gray-500 text-white';
  }
};

export const ClientCard = ({ client, onViewDetails }: ClientCardProps) => {
  return (
    <Card className="card-hover">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="font-semibold text-lg mb-1">
              {`${client.firstname || ''} ${client.lastname || ''}`.trim() || 'Unknown Client'}
            </h3>
            <p className="text-sm text-muted-foreground">{client.email}</p>
          </div>
          <div className="flex flex-col items-center">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${getHealthColor(client.health_zone)} font-bold text-xl shadow-md`}>
              {client.health_score.toFixed(0)}
            </div>
          </div>
        </div>

        <div className="mb-4">
          <Badge className={getHealthColor(client.health_zone)}>
            {client.health_zone}
          </Badge>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">7 Days</p>
            <p className="font-semibold">{client.sessions_last_7d}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">30 Days</p>
            <p className="font-semibold">{client.sessions_last_30d}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Outstanding</p>
            <p className="font-semibold">{client.outstanding_sessions}</p>
          </div>
        </div>

        {client.assigned_coach && (
          <p className="text-sm text-muted-foreground mb-4">
            Coach: <span className="font-medium text-foreground">{client.assigned_coach}</span>
          </p>
        )}

        <Button onClick={onViewDetails} className="w-full" variant="outline">
          <Eye className="h-4 w-4 mr-2" />
          View History
        </Button>
      </CardContent>
    </Card>
  );
};
