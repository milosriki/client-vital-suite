import { cn } from '@/lib/utils';

type Zone = 'RED' | 'YELLOW' | 'GREEN' | 'PURPLE' | string;

interface TrafficLightBadgeProps {
  zone: Zone;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  pulsing?: boolean;
  className?: string;
}

const zoneConfig: Record<string, { bg: string; glow: string; label: string }> = {
  RED: {
    bg: 'bg-destructive',
    glow: 'shadow-[0_0_12px_hsl(var(--destructive)/0.6)]',
    label: 'Critical',
  },
  YELLOW: {
    bg: 'bg-warning',
    glow: 'shadow-[0_0_12px_hsl(var(--warning)/0.6)]',
    label: 'Warning',
  },
  GREEN: {
    bg: 'bg-success',
    glow: 'shadow-[0_0_12px_hsl(var(--success)/0.6)]',
    label: 'Healthy',
  },
  PURPLE: {
    bg: 'bg-primary',
    glow: 'shadow-[0_0_12px_hsl(var(--primary)/0.6)]',
    label: 'VIP',
  },
};

const sizeClasses = {
  sm: 'w-3 h-3',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
};

export function TrafficLightBadge({
  zone,
  size = 'md',
  showLabel = false,
  pulsing = false,
  className,
}: TrafficLightBadgeProps) {
  const config = zoneConfig[zone] || {
    bg: 'bg-muted',
    glow: '',
    label: 'Unknown',
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className={cn(
          'rounded-full transition-all duration-300',
          sizeClasses[size],
          config.bg,
          config.glow,
          pulsing && 'animate-pulse'
        )}
      />
      {showLabel && (
        <span className="text-xs font-medium text-muted-foreground">
          {config.label}
        </span>
      )}
    </div>
  );
}
