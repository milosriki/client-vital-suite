import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CriticalAlertsBar } from './CriticalAlertsBar';
import { TodaysActivity } from './TodaysActivity';
import { OwnerPerformanceGrid } from './OwnerPerformanceGrid';
import { PipelineHealth } from './PipelineHealth';
import { ConversationsFeed } from './ConversationsFeed';
import { QuickActionsPanel } from './QuickActionsPanel';
import { Calendar, Users, TrendingUp, MessageSquare, Zap, Activity } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface HubSpotManagementDashboardProps {
  defaultTab?: string;
  ownerFilter?: string;
  sourceFilter?: string;
  locationFilter?: 'all' | 'premium' | 'standard';
}

export function HubSpotManagementDashboard({
  defaultTab = 'today',
  ownerFilter,
  sourceFilter,
  locationFilter = 'all',
}: HubSpotManagementDashboardProps) {
  const [globalOwnerFilter, setGlobalOwnerFilter] = useState<string>(ownerFilter || 'all');
  const [globalSourceFilter, setGlobalSourceFilter] = useState<string>(sourceFilter || 'all');
  const [globalLocationFilter, setGlobalLocationFilter] = useState<'all' | 'premium' | 'standard'>(locationFilter);

  return (
    <div className="space-y-4">
      {/* Critical Alerts Bar - Always Visible */}
      <CriticalAlertsBar />

      {/* Global Filters */}
      <div className="flex gap-2 flex-wrap items-center p-4 border rounded-lg bg-muted/30">
        <span className="text-sm font-medium">Filters:</span>
        <Select value={globalOwnerFilter} onValueChange={setGlobalOwnerFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Owners" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Owners</SelectItem>
            {/* Owners will be loaded dynamically in child components */}
          </SelectContent>
        </Select>

        <Select value={globalLocationFilter} onValueChange={(v) => setGlobalLocationFilter(v as any)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>
            <SelectItem value="premium">Premium Only</SelectItem>
            <SelectItem value="standard">Standard Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Main Tabbed Interface */}
      <Tabs defaultValue={defaultTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5">
          <TabsTrigger value="today" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Today</span>
          </TabsTrigger>
          <TabsTrigger value="team" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Team</span>
          </TabsTrigger>
          <TabsTrigger value="pipeline" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Pipeline</span>
          </TabsTrigger>
          <TabsTrigger value="conversations" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Chat</span>
          </TabsTrigger>
          <TabsTrigger value="actions" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            <span className="hidden sm:inline">Actions</span>
          </TabsTrigger>
        </TabsList>

        {/* Today Tab */}
        <TabsContent value="today" className="space-y-4">
          <TodaysActivity
            ownerFilter={globalOwnerFilter !== 'all' ? globalOwnerFilter : undefined}
            sourceFilter={globalSourceFilter !== 'all' ? globalSourceFilter : undefined}
            locationFilter={globalLocationFilter}
          />
        </TabsContent>

        {/* Team Tab */}
        <TabsContent value="team" className="space-y-4">
          <OwnerPerformanceGrid />
        </TabsContent>

        {/* Pipeline Tab */}
        <TabsContent value="pipeline" className="space-y-4">
          <PipelineHealth />
        </TabsContent>

        {/* Conversations Tab */}
        <TabsContent value="conversations" className="space-y-4">
          <ConversationsFeed />
        </TabsContent>

        {/* Actions Tab */}
        <TabsContent value="actions" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <QuickActionsPanel />
            <div className="space-y-4">
              {/* Additional action widgets can go here */}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}


