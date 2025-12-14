import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Users } from "lucide-react";

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
    { 
      key: 'purple', 
      label: 'Champions', 
      color: 'bg-health-purple', 
      textColor: 'text-health-purple', 
      desc: '85-100',
      gradient: 'from-health-purple/20 to-health-purple/5',
      border: 'border-health-purple/30 hover:border-health-purple/50',
      glow: 'hover:shadow-[0_0_20px_hsl(var(--health-purple)/0.3)]'
    },
    { 
      key: 'green', 
      label: 'Healthy', 
      color: 'bg-health-green', 
      textColor: 'text-health-green', 
      desc: '70-84',
      gradient: 'from-health-green/20 to-health-green/5',
      border: 'border-health-green/30 hover:border-health-green/50',
      glow: 'hover:shadow-[0_0_20px_hsl(var(--health-green)/0.3)]'
    },
    { 
      key: 'yellow', 
      label: 'Warning', 
      color: 'bg-health-yellow', 
      textColor: 'text-health-yellow', 
      desc: '50-69',
      gradient: 'from-health-yellow/20 to-health-yellow/5',
      border: 'border-health-yellow/30 hover:border-health-yellow/50',
      glow: 'hover:shadow-[0_0_20px_hsl(var(--health-yellow)/0.3)]'
    },
    { 
      key: 'red', 
      label: 'Critical', 
      color: 'bg-health-red', 
      textColor: 'text-health-red', 
      desc: '0-49',
      gradient: 'from-health-red/20 to-health-red/5',
      border: 'border-health-red/30 hover:border-health-red/50',
      glow: 'hover:shadow-[0_0_20px_hsl(var(--health-red)/0.3)]'
    },
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
        <div className="skeleton h-5 w-full rounded-full mb-6" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="skeleton h-28 rounded-xl" />
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
        <div className="text-center py-10 text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No clients found</p>
          <p className="text-xs mt-1">Sync from HubSpot to see health data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-card via-card to-muted/10 p-6 animate-fade-up shadow-sm hover:shadow-md transition-shadow duration-300" style={{ animationDelay: '200ms' }}>
      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-health-purple/5 to-transparent rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-health-green/5 to-transparent rounded-full blur-2xl" />
      
      <div className="relative flex items-center justify-between mb-6">
        <div>
          <button 
            onClick={() => navigate('/clients')}
            className="text-sm font-semibold uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors flex items-center gap-2 group"
          >
            <Users className="h-4 w-4 text-primary" />
            Client Health Distribution
            <span className="text-xs opacity-0 group-hover:opacity-100 transition-opacity">→</span>
          </button>
          <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            {distribution.total} active clients tracked
          </p>
        </div>
      </div>

      {/* Stacked Bar */}
      <div className="relative h-6 rounded-full overflow-hidden flex mb-8 bg-muted/30 border border-border/30 shadow-inner">
        {zoneConfig.map((zone, index) => {
          const percent = distribution.percentages[zone.key as keyof typeof distribution.percentages];
          const count = distribution.zones[zone.key as keyof typeof distribution.zones];
          if (percent === 0) return null;
          return (
            <TooltipProvider key={zone.key}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleZoneClick(zone.key)}
                    className={cn(
                      "relative h-full transition-all duration-300 hover:brightness-110 cursor-pointer group",
                      zone.color,
                      index === 0 && "rounded-l-full",
                      index === zoneConfig.length - 1 && "rounded-r-full"
                    )}
                    style={{ width: `${percent}%` }}
                  >
                    {/* Shine effect on hover */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-500" />
                    </div>
                    {/* Percentage label for larger segments */}
                    {percent >= 15 && (
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white/90">
                        {percent}%
                      </span>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent className="bg-card border-border">
                  <p className="font-medium">{zone.label}</p>
                  <p className="text-xs text-muted-foreground">{count} clients ({percent}%)</p>
                  <p className="text-xs text-muted-foreground mt-1">Score range: {zone.desc}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>

      {/* Legend Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {zoneConfig.map(zone => {
          const count = distribution.zones[zone.key as keyof typeof distribution.zones];
          const percent = distribution.percentages[zone.key as keyof typeof distribution.percentages];
          return (
            <TooltipProvider key={zone.key}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleZoneClick(zone.key)}
                    className={cn(
                      "relative overflow-hidden flex flex-col items-center p-4 rounded-xl transition-all duration-300 border",
                      "bg-gradient-to-b",
                      zone.gradient,
                      zone.border,
                      zone.glow,
                      "hover:-translate-y-1 hover:scale-[1.02]"
                    )}
                  >
                    {/* Shine effect */}
                    <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-500">
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full hover:translate-x-full transition-transform duration-700" />
                    </div>
                    
                    <div className="relative flex items-center gap-2 mb-2">
                      <div className={cn(
                        "w-3 h-3 rounded-full",
                        zone.color,
                        count > 0 && "animate-pulse"
                      )} />
                      <span className="text-xs font-medium text-muted-foreground">{zone.label}</span>
                    </div>
                    <span className={cn("stat-number text-3xl", zone.textColor)}>{count}</span>
                    <span className="text-xs text-muted-foreground mt-1">{percent}%</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent className="bg-card border-border">
                  <p className="font-medium">Score range: {zone.desc}</p>
                  <p className="text-xs text-muted-foreground">Click to view {zone.label.toLowerCase()} clients</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>
    </div>
  );
}