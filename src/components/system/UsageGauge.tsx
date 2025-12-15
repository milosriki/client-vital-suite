import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface UsageGaugeProps {
  value: number;
  max: number;
  label: string;
  sublabel?: string;
  size?: 'sm' | 'md' | 'lg';
  showPercentage?: boolean;
  className?: string;
}

export function UsageGauge({
  value,
  max,
  label,
  sublabel,
  size = 'md',
  showPercentage = true,
  className,
}: UsageGaugeProps) {
  const percentage = useMemo(() => {
    return Math.min(Math.round((value / max) * 100), 100);
  }, [value, max]);

  const strokeColor = useMemo(() => {
    if (percentage >= 80) return 'stroke-destructive';
    if (percentage >= 50) return 'stroke-warning';
    return 'stroke-success';
  }, [percentage]);

  const glowColor = useMemo(() => {
    if (percentage >= 80) return 'drop-shadow-[0_0_8px_hsl(var(--destructive)/0.5)]';
    if (percentage >= 50) return 'drop-shadow-[0_0_8px_hsl(var(--warning)/0.5)]';
    return 'drop-shadow-[0_0_8px_hsl(var(--success)/0.5)]';
  }, [percentage]);

  const sizeConfig = {
    sm: { diameter: 80, strokeWidth: 6, textSize: 'text-lg' },
    md: { diameter: 120, strokeWidth: 8, textSize: 'text-2xl' },
    lg: { diameter: 160, strokeWidth: 10, textSize: 'text-3xl' },
  };

  const config = sizeConfig[size];
  const radius = (config.diameter - config.strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <div className="relative" style={{ width: config.diameter, height: config.diameter }}>
        <svg
          className="transform -rotate-90"
          width={config.diameter}
          height={config.diameter}
        >
          {/* Background circle */}
          <circle
            cx={config.diameter / 2}
            cy={config.diameter / 2}
            r={radius}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={config.strokeWidth}
            className="opacity-30"
          />
          {/* Progress circle */}
          <circle
            cx={config.diameter / 2}
            cy={config.diameter / 2}
            r={radius}
            fill="none"
            strokeWidth={config.strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={cn(strokeColor, glowColor, 'transition-all duration-500 ease-out')}
          />
        </svg>
        
        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {showPercentage && (
            <span className={cn('font-mono font-bold text-foreground', config.textSize)}>
              {percentage}%
            </span>
          )}
        </div>
      </div>
      
      {/* Labels */}
      <div className="mt-3 text-center">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {sublabel && (
          <p className="text-xs text-muted-foreground mt-0.5">{sublabel}</p>
        )}
        <p className="text-xs font-mono text-muted-foreground mt-1">
          {value.toLocaleString()} / {max.toLocaleString()}
        </p>
      </div>
    </div>
  );
}
