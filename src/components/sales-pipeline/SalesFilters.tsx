import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Calendar, UserCheck, Target, RefreshCw, Trash2 } from "lucide-react";

interface SalesFiltersProps {
  daysFilter: string;
  setDaysFilter: (value: string) => void;
  ownerFilter: string;
  setOwnerFilter: (value: string) => void;
  campaignFilter: string;
  setCampaignFilter: (value: string) => void;
  owners: string[];
  campaigns: string[];
  syncFromHubspot: any;
  DAYS_FILTER_OPTIONS: { value: string; label: string }[];
}

export const SalesFilters = ({
  daysFilter,
  setDaysFilter,
  ownerFilter,
  setOwnerFilter,
  campaignFilter,
  setCampaignFilter,
  owners,
  campaigns,
  syncFromHubspot,
  DAYS_FILTER_OPTIONS,
}: SalesFiltersProps) => {
  return (
    <div className="flex flex-wrap items-center gap-3 bg-card/50 backdrop-blur-sm rounded-lg p-2 border border-border/50">
      {/* Days Filter */}
      <Select value={daysFilter} onValueChange={setDaysFilter}>
        <SelectTrigger className="w-[140px] bg-background border-border/50">
          <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
          <SelectValue placeholder="Period" />
        </SelectTrigger>
        <SelectContent>
          {DAYS_FILTER_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Owner Filter */}
      <Select value={ownerFilter} onValueChange={setOwnerFilter}>
        <SelectTrigger className="w-[140px] bg-background border-border/50">
          <UserCheck className="h-4 w-4 mr-2 text-muted-foreground" />
          <SelectValue placeholder="Owner" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Owners</SelectItem>
          {owners.map((owner) => (
            <SelectItem key={owner} value={owner}>
              {owner}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Campaign Filter */}
      <Select value={campaignFilter} onValueChange={setCampaignFilter}>
        <SelectTrigger className="w-[140px] bg-background border-border/50">
          <Target className="h-4 w-4 mr-2 text-muted-foreground" />
          <SelectValue placeholder="Campaign" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Campaigns</SelectItem>
          {campaigns.map((campaign) => (
            <SelectItem key={campaign} value={campaign}>
              {campaign}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="h-6 w-px bg-border/50" />

      <Button
        variant="outline"
        size="sm"
        onClick={() => syncFromHubspot.mutate(false)}
        disabled={syncFromHubspot.isPending}
        className="bg-background border-border/50"
      >
        <RefreshCw
          className={`h-4 w-4 mr-2 ${syncFromHubspot.isPending ? "animate-spin" : ""}`}
        />
        Sync
      </Button>

      <Dialog>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={syncFromHubspot.isPending}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear Test Data & Sync</DialogTitle>
            <DialogDescription>
              This will delete all fake/test data and sync real data from
              HubSpot. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => {}}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => syncFromHubspot.mutate(true)}
              disabled={syncFromHubspot.isPending}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear & Sync
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
