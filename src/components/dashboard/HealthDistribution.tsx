import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface HealthDistributionProps {
  clients: any[];
  onZoneClick?: (zone: string) => void;
}

export function HealthDistribution({ clients, onZoneClick }: HealthDistributionProps) {
  const distribution = useMemo(() => {
    const zones = {
      purple: clients.filter(c => c.health_zone === 'PURPLE').length,
      green: clients.filter(c => c.health_zone === 'GREEN').length,
      yellow: clients.filter(c => c.health_zone === 'YELLOW').length,
      red: clients.filter(c => c.health_zone === 'RED').length,
    };
    const total = clients.length || 1;
    return {
      zones,
      percentages: {
        purple: Math.round((zones.purple / total) * 100),
        green: Math.round((zones.green / total) * 100),
        yellow: Math.round((zones.yellow / total) * 100),
        red: Math.round((zones.red / total) * 100),
      },
      total,
    };
  }, [clients]);

  const zoneConfig = [
    { key: 'purple', label: 'Champions', color: 'bg-health-purple', textColor: 'text-health-purple' },
    { key: 'green', label: 'Healthy', color: 'bg-health-green', textColor: 'text-health-green' },
    { key: 'yellow', label: 'At Risk', color: 'bg-health-yellow', textColor: 'text-health-yellow' },
    { key: 'red', label: 'Critical', color: 'bg-health-red', textColor: 'text-health-red' },
  ];

  return (
    <div className="premium-card p-6 animate-fade-up" style={{ animationDelay: '200ms' }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold">Client Health Distribution</h3>
          <p className="text-sm text-muted-foreground">{distribution.total} active clients</p>
        </div>
      </div>

      {/* Stacked Bar */}
      <div className="h-4 rounded-full overflow-hidden flex mb-6 bg-muted/30">
        {zoneConfig.map(zone => {
          const percent = distribution.percentages[zone.key as keyof typeof distribution.percentages];
          if (percent === 0) return null;
          return (
            <button
              key={zone.key}
              onClick={() => onZoneClick?.(zone.key.toUpperCase())}
              className={cn(
                "h-full transition-all duration-300 hover:opacity-80 first:rounded-l-full last:rounded-r-full",
                zone.color
              )}
              style={{ width: `${percent}%` }}
              title={`${zone.label}: ${percent}%`}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {zoneConfig.map(zone => {
          const count = distribution.zones[zone.key as keyof typeof distribution.zones];
          const percent = distribution.percentages[zone.key as keyof typeof distribution.percentages];
          return (
            <button
              key={zone.key}
              onClick={() => onZoneClick?.(zone.key.toUpperCase())}
              className="flex flex-col items-center p-3 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors"
            >
              <div className="flex items-center gap-2 mb-1">
                <div className={cn("w-3 h-3 rounded-full", zone.color)} />
                <span className="text-xs font-medium text-muted-foreground">{zone.label}</span>
              </div>
              <span className={cn("stat-number text-2xl", zone.textColor)}>{count}</span>
              <span className="text-xs text-muted-foreground">{percent}%</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
