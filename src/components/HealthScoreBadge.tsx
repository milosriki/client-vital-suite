interface HealthScoreBadgeProps {
  score: number;
  zone: 'RED' | 'YELLOW' | 'GREEN' | 'PURPLE';
  size?: 'sm' | 'md' | 'lg';
}

export const HealthScoreBadge = ({ score, zone, size = 'md' }: HealthScoreBadgeProps) => {
  const sizeClasses = {
    sm: 'w-12 h-12 text-sm',
    md: 'w-16 h-16 text-lg',
    lg: 'w-24 h-24 text-3xl'
  };

  const colorClasses = {
    RED: 'bg-[#ef4444]',
    YELLOW: 'bg-[#eab308]',
    GREEN: 'bg-[#22c55e]',
    PURPLE: 'bg-[#a855f7]'
  };

  return (
    <div className={`${sizeClasses[size]} ${colorClasses[zone]} rounded-full flex items-center justify-center text-white font-bold shadow-lg`}>
      {score.toFixed(0)}
    </div>
  );
};
