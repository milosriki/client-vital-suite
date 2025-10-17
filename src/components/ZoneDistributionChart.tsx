import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { ClientHealthScore } from "@/types/database";

interface ZoneDistributionChartProps {
  clients: ClientHealthScore[];
  selectedZone: string;
  onZoneSelect: (zone: string) => void;
}

const ZONE_CONFIG = [
  { name: 'PURPLE', color: '#a855f7', label: 'Purple Zone' },
  { name: 'GREEN', color: '#22c55e', label: 'Green Zone' },
  { name: 'YELLOW', color: '#eab308', label: 'Yellow Zone' },
  { name: 'RED', color: '#ef4444', label: 'Red Zone' },
] as const;

export function ZoneDistributionChart({ clients, selectedZone, onZoneSelect }: ZoneDistributionChartProps) {
  const totalClients = clients.length;
  
  // Calculate zone distribution
  const zoneStats = ZONE_CONFIG.map(zone => {
    const zoneClients = clients.filter(c => c.health_zone === zone.name);
    const count = zoneClients.length;
    const percentage = totalClients > 0 ? (count / totalClients) * 100 : 0;
    const avgScore = count > 0 
      ? zoneClients.reduce((sum, c) => sum + (c.health_score || 0), 0) / count 
      : 0;
    
    return {
      ...zone,
      count,
      percentage,
      avgScore,
    };
  });

  return (
    <Card className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Zone Distribution</h3>
        {selectedZone !== 'All' && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => onZoneSelect('All')}
          >
            Show All
          </Button>
        )}
      </div>

      {/* Stacked Bar Chart */}
      <TooltipProvider>
        <div className="relative h-16 w-full flex rounded-md overflow-hidden">
          {zoneStats.map((zone) => {
            if (zone.count === 0) return null;
            
            const isActive = selectedZone === zone.name;
            
            return (
              <Tooltip key={zone.name}>
                <TooltipTrigger asChild>
                  <button
                    className={`relative transition-all hover:opacity-90 ${
                      isActive ? 'ring-4 ring-offset-2 ring-foreground' : ''
                    }`}
                    style={{
                      width: `${zone.percentage}%`,
                      backgroundColor: zone.color,
                    }}
                    onClick={() => onZoneSelect(zone.name)}
                  >
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-semibold text-white drop-shadow-md">
                        {zone.count} ({zone.percentage.toFixed(0)}%)
                      </span>
                    </div>
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="space-y-1">
                    <p className="font-semibold">{zone.label}</p>
                    <p className="text-sm">{zone.count} clients ({zone.percentage.toFixed(1)}%)</p>
                    <p className="text-sm">Avg Health Score: {zone.avgScore.toFixed(1)}</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </TooltipProvider>

      {/* Legend */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {zoneStats.map((zone) => (
          <button
            key={zone.name}
            className={`p-3 rounded-lg border-2 transition-all hover:scale-105 ${
              selectedZone === zone.name 
                ? 'border-foreground bg-accent' 
                : 'border-transparent bg-muted/50'
            }`}
            onClick={() => onZoneSelect(zone.name)}
          >
            <div className="flex items-center gap-2 mb-1">
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: zone.color }}
              />
              <span className="font-semibold text-sm">{zone.name}</span>
            </div>
            <p className="text-lg font-bold">{zone.count}</p>
            <p className="text-xs text-muted-foreground">
              {zone.percentage.toFixed(1)}%
            </p>
          </button>
        ))}
      </div>
    </Card>
  );
}
