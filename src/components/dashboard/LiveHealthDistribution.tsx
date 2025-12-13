import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface Client {
  health_zone?: string;
  health_score?: number;
}

interface LiveHealthDistributionProps {
  clients: Client[];
  isLoading?: boolean;
}

export function LiveHealthDistribution({ clients, isLoading }: LiveHealthDistributionProps) {
  const navigate = useNavigate();

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
      total: clients.length,
    };
  }, [clients]);

  const zoneConfig = [
    { key: 'purple', label: 'Champions', color: 'bg-health-purple', textColor: 'text-health-purple', desc: '85-100' },
    { key: 'green', label: 'Healthy', color: 'bg-health-green', textColor: 'text-health-green', desc: '70-84' },
    { key: 'yellow', label: 'Warning', color: 'bg-health-yellow', textColor: 'text-health-yellow', desc: '50-69' },
    { key: 'red', label: 'Critical', color: 'bg-health-red', textColor: 'text-health-red', desc: '0-49' },
  ];

  const handleZoneClick = (zone: string) => {
    navigate(`/clients?zone=${zone.toUpperCase()}`);
  };

  if (isLoading) {
    return (
      <div className="premium-card p-6 animate-fade-up" style={{ animationDelay: '200ms' }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="skeleton h-5 w-48 mb-2" />
            <div className="skeleton h-3 w-24" />
          </div>
        </div>
        <div className="skeleton h-4 w-full rounded-full mb-6" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="skeleton h-24 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (distribution.total === 0) {
    return (
      <div className="premium-card p-6 animate-fade-up" style={{ animationDelay: '200ms' }}>
        <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-4">
          Client Health Distribution
        </h3>
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">No clients found</p>
          <p className="text-xs mt-1">Sync from HubSpot to see health data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="premium-card p-6 animate-fade-up" style={{ animationDelay: '200ms' }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Client Health Distribution
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {distribution.total} active clients
          </p>
        </div>
      </div>

      {/* Stacked Bar */}
      <div className="h-3 rounded-full overflow-hidden flex mb-6 bg-muted/30">
        {zoneConfig.map(zone => {
          const percent = distribution.percentages[zone.key as keyof typeof distribution.percentages];
          if (percent === 0) return null;
          return (
            <button
              key={zone.key}
              onClick={() => handleZoneClick(zone.key)}
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

      {/* Legend Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {zoneConfig.map(zone => {
          const count = distribution.zones[zone.key as keyof typeof distribution.zones];
          const percent = distribution.percentages[zone.key as keyof typeof distribution.percentages];
          return (
            <button
              key={zone.key}
              onClick={() => handleZoneClick(zone.key)}
              className="flex flex-col items-center p-3 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors border border-transparent hover:border-primary/20"
            >
              <div className="flex items-center gap-2 mb-1">
                <div className={cn("w-2.5 h-2.5 rounded-full", zone.color)} />
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
