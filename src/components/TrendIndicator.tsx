import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface TrendIndicatorProps {
  trend: 'IMPROVING' | 'STABLE' | 'DECLINING' | string | null;
  size?: number;
}

export const TrendIndicator = ({ trend, size = 16 }: TrendIndicatorProps) => {
  if (trend === 'IMPROVING') {
    return <TrendingUp className="text-green-500" size={size} />;
  }
  if (trend === 'DECLINING') {
    return <TrendingDown className="text-red-500" size={size} />;
  }
  return <Minus className="text-gray-500" size={size} />;
};
