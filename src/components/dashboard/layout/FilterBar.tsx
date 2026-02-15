import { ReactNode } from "react";
import { Calendar } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FilterBarProps {
  dateRange?: {
    value: string;
    onChange: (value: string) => void;
    options: Array<{ value: string; label: string }>;
  };
  filters?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function FilterBar({
  dateRange,
  filters,
  actions,
  className,
}: FilterBarProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 mb-6 p-4 bg-[#0A0A0A] border border-[#1F2937] rounded-lg",
        className
      )}
    >
      <div className="flex items-center gap-3 flex-1">
        {/* Date Range Selector */}
        {dateRange && (
          <Select value={dateRange.value} onValueChange={dateRange.onChange}>
            <SelectTrigger className="w-[180px] bg-slate-800/50 border-slate-700">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              {dateRange.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Additional Filters */}
        {filters}
      </div>

      {/* Actions (Refresh, Export, etc.) */}
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

// Common date range presets
export const DATE_RANGE_PRESETS = [
  { value: "today", label: "Today" },
  { value: "last_7_days", label: "Last 7 days" },
  { value: "last_30_days", label: "Last 30 days" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "last_3_months", label: "Last 3 months" },
  { value: "this_year", label: "This year" },
];
