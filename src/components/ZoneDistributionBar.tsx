import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ZoneData {
  RED: number;
  YELLOW: number;
  GREEN: number;
  PURPLE: number;
}

interface ZoneDistributionBarProps {
  data: ZoneData;
  total: number;
  onZoneClick?: (zone: string) => void;
}

export const ZoneDistributionBar = ({ data, total, onZoneClick }: ZoneDistributionBarProps) => {
  const zones = [
    { key: 'PURPLE', color: 'bg-[#a855f7]', label: 'PURPLE' },
    { key: 'GREEN', color: 'bg-[#22c55e]', label: 'GREEN' },
    { key: 'YELLOW', color: 'bg-[#eab308]', label: 'YELLOW' },
    { key: 'RED', color: 'bg-[#ef4444]', label: 'RED' }
  ];

  return (
    <Card className="card-hover">
      <CardHeader>
        <CardTitle>Health Zone Distribution</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stacked Bar */}
        <div className="h-8 flex rounded-lg overflow-hidden">
          {zones.map(zone => {
            const count = data[zone.key as keyof ZoneData] || 0;
            const percentage = total > 0 ? (count / total) * 100 : 0;
            
            if (percentage === 0) return null;
            
            return (
              <div
                key={zone.key}
                className={`${zone.color} cursor-pointer hover:opacity-80 transition-opacity`}
                style={{ width: `${percentage}%` }}
                onClick={() => onZoneClick?.(zone.key)}
                title={`${zone.label}: ${count} clients (${percentage.toFixed(1)}%)`}
              />
            );
          })}
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {zones.map(zone => {
            const count = data[zone.key as keyof ZoneData] || 0;
            const percentage = total > 0 ? (count / total) * 100 : 0;
            
            return (
              <div
                key={zone.key}
                className="cursor-pointer hover:bg-muted/50 p-3 rounded-lg transition-colors"
                onClick={() => onZoneClick?.(zone.key)}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-3 h-3 rounded-full ${zone.color}`} />
                  <span className="text-sm font-medium">{zone.label}</span>
                </div>
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-xs text-muted-foreground">{percentage.toFixed(1)}%</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
