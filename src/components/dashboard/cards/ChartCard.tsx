import { ReactNode, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface ChartCardProps {
  title: string;
  children: ReactNode;
  chartTypes?: Array<{ value: string; label: string }>;
  onChartTypeChange?: (type: string) => void;
  onExport?: () => void;
  height?: "default" | "compact" | "tall";
  className?: string;
}

export function ChartCard({
  title,
  children,
  chartTypes,
  onChartTypeChange,
  onExport,
  height = "default",
  className,
}: ChartCardProps) {
  const [selectedType, setSelectedType] = useState(chartTypes?.[0]?.value || "");

  const handleTypeChange = (type: string) => {
    setSelectedType(type);
    onChartTypeChange?.(type);
  };

  const heightClasses = {
    compact: "h-64",
    default: "h-96",
    tall: "h-[32rem]",
  };

  return (
    <div className={cn("bg-[#0A0A0A] border border-[#1F2937] p-6 rounded-xl", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-50">{title}</h3>
        <div className="flex items-center gap-2">
          {chartTypes && chartTypes.length > 0 && (
            <Tabs value={selectedType} onValueChange={handleTypeChange}>
              <TabsList className="bg-slate-800/50">
                {chartTypes.map((type) => (
                  <TabsTrigger
                    key={type.value}
                    value={type.value}
                    className="text-xs"
                  >
                    {type.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}
          {onExport && (
            <Button variant="ghost" size="icon" onClick={onExport} className="h-8 w-8">
              <Download className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Chart Content */}
      <div className={cn(heightClasses[height], "w-full")}>
        {children}
      </div>
    </div>
  );
}

// Recharts theme configuration for dark mode
export const chartTheme = {
  background: "transparent",
  textColor: "#CBD5E1", // slate-300
  grid: {
    stroke: "#1F2937", // border-subtle
    strokeDasharray: "3 3",
  },
  axis: {
    stroke: "#374151", // gray-700
    tick: { fill: "#94A3B8" }, // slate-400
  },
  tooltip: {
    backgroundColor: "#1A1A1A", // background-elevated
    border: "1px solid #374151",
    borderRadius: "8px",
    padding: "12px",
  },
};
