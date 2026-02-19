import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";

interface Props {
  value: number;
  onChange: (days: number) => void;
}

const RANGES = [
  { label: "7d", days: 7 },
  { label: "14d", days: 14 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

export function TimeRangeFilter({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-2">
      <Calendar className="h-4 w-4 text-muted-foreground" />
      <div className="flex gap-1">
        {RANGES.map(r => (
          <Button
            key={r.days}
            variant={value === r.days ? "default" : "ghost"}
            size="sm"
            className="cursor-pointer h-7 px-3 text-xs"
            onClick={() => onChange(r.days)}
          >
            {r.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
