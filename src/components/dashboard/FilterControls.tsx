import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface FilterControlsProps {
  filterMode: 'all' | 'high-risk' | 'early-warning';
  onFilterModeChange: (mode: 'all' | 'high-risk' | 'early-warning') => void;
  selectedCoach: string;
  onCoachChange: (coach: string) => void;
  selectedZone: string;
  onZoneChange: (zone: string) => void;
  coaches: string[];
}

export function FilterControls({
  filterMode,
  onFilterModeChange,
  selectedCoach,
  onCoachChange,
  selectedZone,
  onZoneChange,
  coaches,
}: FilterControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 p-4 bg-card rounded-lg border">
      <div className="flex gap-2">
        <Button
          variant={filterMode === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onFilterModeChange('all')}
        >
          Show All
        </Button>
        <Button
          variant={filterMode === 'high-risk' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onFilterModeChange('high-risk')}
        >
          High Risk Only
        </Button>
        <Button
          variant={filterMode === 'early-warning' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onFilterModeChange('early-warning')}
        >
          🚨 Early Warnings
        </Button>
      </div>

      <Select value={selectedCoach} onValueChange={onCoachChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Filter by coach" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Coaches</SelectItem>
          {coaches.map((coach) => (
            <SelectItem key={coach} value={coach}>
              {coach}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={selectedZone} onValueChange={onZoneChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Filter by zone" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Zones</SelectItem>
          <SelectItem value="RED">RED</SelectItem>
          <SelectItem value="YELLOW">YELLOW</SelectItem>
          <SelectItem value="GREEN">GREEN</SelectItem>
          <SelectItem value="PURPLE">PURPLE</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
