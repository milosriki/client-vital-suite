import { useMemo } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useNavigate } from 'react-router-dom';

interface Client {
  id: number;
  firstname?: string | null;
  lastname?: string | null;
  email: string;
  health_score?: number | null;
  predictive_risk_score?: number | null;
  risk_category?: string | null;
  health_zone?: string | null;
  assigned_coach?: string | null;
}

interface HeatmapChartProps {
  clients: Client[];
  onClientClick?: (client: Client) => void;
}

const getRiskColor = (riskCategory: string | null) => {
  switch (riskCategory) {
    case 'CRITICAL': return 'hsl(0 84% 60%)';
    case 'HIGH': return 'hsl(25 95% 53%)';
    case 'MEDIUM': return 'hsl(38 92% 50%)';
    case 'LOW': return 'hsl(160 84% 39%)';
    default: return 'hsl(240 5% 46%)';
  }
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg backdrop-blur-sm">
        <p className="font-semibold text-foreground">
          {data.firstname} {data.lastname}
        </p>
        <p className="text-xs text-muted-foreground">{data.email}</p>
        <div className="mt-2 space-y-1 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Health Score:</span>
            <span className="font-mono font-bold">{data.health_score?.toFixed(0) || 0}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Risk Score:</span>
            <span className="font-mono font-bold">{data.predictive_risk_score?.toFixed(0) || 0}%</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Risk Level:</span>
            <span className={`font-semibold ${
              data.risk_category === 'CRITICAL' ? 'text-destructive' :
              data.risk_category === 'HIGH' ? 'text-orange-500' :
              data.risk_category === 'MEDIUM' ? 'text-warning' : 'text-success'
            }`}>{data.risk_category || 'N/A'}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Coach:</span>
            <span className="truncate max-w-[120px]">{data.assigned_coach || 'Unassigned'}</span>
          </div>
        </div>
        <p className="mt-2 text-xs text-primary">Click to view details</p>
      </div>
    );
  }
  return null;
};

export function HeatmapChart({ clients, onClientClick }: HeatmapChartProps) {
  const navigate = useNavigate();

  const chartData = useMemo(() => {
    return clients.map((client) => ({
      ...client,
      x: client.predictive_risk_score || 0,
      y: client.health_score || 0,
      z: 100, // Size of bubble
    }));
  }, [clients]);

  const handleClick = (data: any) => {
    if (onClientClick) {
      onClientClick(data);
    } else {
      navigate(`/clients/${data.id}`);
    }
  };

  return (
    <div className="w-full h-[400px]">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart
          margin={{ top: 20, right: 20, bottom: 40, left: 40 }}
        >
          <XAxis
            type="number"
            dataKey="x"
            name="Risk Score"
            domain={[0, 100]}
            tick={{ fill: 'hsl(240 5% 46%)', fontSize: 11 }}
            tickLine={{ stroke: 'hsl(240 4% 16%)' }}
            axisLine={{ stroke: 'hsl(240 4% 16%)' }}
            label={{
              value: 'Risk Score →',
              position: 'bottom',
              offset: 15,
              fill: 'hsl(240 5% 46%)',
              fontSize: 12,
            }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="Health Score"
            domain={[0, 100]}
            tick={{ fill: 'hsl(240 5% 46%)', fontSize: 11 }}
            tickLine={{ stroke: 'hsl(240 4% 16%)' }}
            axisLine={{ stroke: 'hsl(240 4% 16%)' }}
            label={{
              value: '↑ Health Score',
              angle: -90,
              position: 'left',
              offset: 10,
              fill: 'hsl(240 5% 46%)',
              fontSize: 12,
            }}
          />
          <ZAxis type="number" dataKey="z" range={[80, 120]} />
          <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
          <Scatter
            data={chartData}
            onClick={(data) => handleClick(data)}
            className="cursor-pointer"
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={getRiskColor(entry.risk_category)}
                fillOpacity={0.8}
                stroke={getRiskColor(entry.risk_category)}
                strokeWidth={2}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
      
      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4">
        {[
          { label: 'Critical', color: 'bg-destructive' },
          { label: 'High', color: 'bg-orange-500' },
          { label: 'Medium', color: 'bg-warning' },
          { label: 'Low', color: 'bg-success' },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${color}`} />
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
