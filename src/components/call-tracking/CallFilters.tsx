import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface CallFiltersProps {
  filters: {
    owner: string;
    quality: string;
    status: string;
    location: string;
  };
  onFilterChange: (key: string, value: string) => void;
  onClearFilters: () => void;
  owners: string[];
  locations: string[];
}

export function CallFilters({ filters, onFilterChange, onClearFilters, owners, locations }: CallFiltersProps) {
  const hasActiveFilters = Object.values(filters).some(v => v !== 'all');

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Select value={filters.owner} onValueChange={(v) => onFilterChange('owner', v)}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Owner/Setter" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Owners</SelectItem>
          {owners.map(owner => (
            <SelectItem key={owner} value={owner}>{owner}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.quality} onValueChange={(v) => onFilterChange('quality', v)}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Lead Quality" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Quality</SelectItem>
          <SelectItem value="hot">🔥 Hot (80+)</SelectItem>
          <SelectItem value="warm">🌡️ Warm (60-79)</SelectItem>
          <SelectItem value="cold">❄️ Cold (&lt;60)</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.status} onValueChange={(v) => onFilterChange('status', v)}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Call Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
          <SelectItem value="missed">Missed</SelectItem>
          <SelectItem value="initiated">Initiated</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.location} onValueChange={(v) => onFilterChange('location', v)}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Location" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Locations</SelectItem>
          {locations.map(loc => (
            <SelectItem key={loc} value={loc}>{loc}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={onClearFilters} className="gap-1.5 text-muted-foreground">
          <X className="h-4 w-4" />
          Clear
        </Button>
      )}
    </div>
  );
}
