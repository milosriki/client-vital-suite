import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface HealthData {
  red: number;
  yellow: number;
  green: number;
  purple: number;
}

interface HealthChartProps {
  data: HealthData;
  total: number;
}

export const HealthChart = ({ data, total }: HealthChartProps) => {
  const getPercentage = (value: number) => total > 0 ? (value / total) * 100 : 0;

  const zones = [
    { name: 'RED', count: data.red, color: 'bg-red-500', percentage: getPercentage(data.red) },
    { name: 'YELLOW', count: data.yellow, color: 'bg-yellow-500', percentage: getPercentage(data.yellow) },
    { name: 'GREEN', count: data.green, color: 'bg-green-500', percentage: getPercentage(data.green) },
    { name: 'PURPLE', count: data.purple, color: 'bg-purple-500', percentage: getPercentage(data.purple) },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Health Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Stacked Bar Chart */}
          <div className="h-12 flex rounded-lg overflow-hidden shadow-md">
            {zones.map((zone) => (
              zone.percentage > 0 && (
                <div
                  key={zone.name}
                  className={`${zone.color} transition-all duration-500 ease-in-out hover:opacity-80 cursor-pointer`}
                  style={{ width: `${zone.percentage}%` }}
                  title={`${zone.name}: ${zone.count} clients (${zone.percentage.toFixed(1)}%)`}
                />
              )
            ))}
          </div>

          {/* Legend */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {zones.map((zone) => (
              <div key={zone.name} className="flex items-center space-x-3">
                <div className={`w-4 h-4 rounded ${zone.color}`} />
                <div className="flex-1">
                  <p className="text-sm font-medium">{zone.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {zone.count} ({zone.percentage.toFixed(1)}%)
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
