import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, AlertTriangle, RefreshCw, Calendar as CalendarIcon, Sparkles } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { QUERY_KEYS } from "@/config/queryKeys";
import { useDedupedQuery } from "@/hooks/useDedupedQuery";

interface GreetingBarProps {
  onDateChange?: (date: Date) => void;
}

export function GreetingBar({ onDateChange }: GreetingBarProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const displayDate = format(selectedDate, 'EEEE, MMMM d, yyyy');
  const isToday = format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

  // Check for sync errors
  const { data: syncErrors } = useDedupedQuery({
    queryKey: QUERY_KEYS.sync.errors.check,
    dedupeIntervalMs: 1000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('sync_errors')
        .select('id')
        .is('resolved_at', null)
        .limit(5);
      
      if (error) return [];
      return data || [];
    },
    staleTime: Infinity, // Real-time updates via useVitalState
  });

  // Get last sync time
  const { data: lastSync } = useDedupedQuery({
    queryKey: QUERY_KEYS.sync.lastTime,
    dedupeIntervalMs: 1000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('sync_logs')
        .select('started_at, status')
        .order('started_at', { ascending: false })
        .limit(1);
      
      if (error || !data?.[0]) return null;
      return data[0];
    },
    staleTime: Infinity, // Real-time updates via useVitalState
  });

  const hasErrors = (syncErrors?.length || 0) > 0;
  const syncStatus = lastSync?.status === 'completed' ? 'operational' : 'syncing';

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      onDateChange?.(date);
      setCalendarOpen(false);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-up">
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight gradient-text">
            {greeting}
          </h1>
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20">
            <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse" />
            <span className="text-xs font-medium text-primary">AI-Powered</span>
          </div>
        </div>
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <button className="text-sm text-muted-foreground flex items-center gap-2 hover:text-foreground transition-colors group">
              <span className="group-hover:underline underline-offset-4">{displayDate}</span>
              {!isToday && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-warning/10 text-warning border border-warning/20">
                  Historical
                </span>
              )}
              <CalendarIcon className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-all duration-200 group-hover:translate-x-0 -translate-x-1" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 bg-card border-border" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              initialFocus
              className="rounded-lg"
            />
            <div className="p-2 border-t border-border">
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full hover:bg-primary/10"
                onClick={() => handleDateSelect(new Date())}
              >
                Jump to Today
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      
      <div className="flex items-center gap-3">
        {lastSync && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            <span>Last sync: {format(new Date(lastSync.started_at), 'h:mm a')}</span>
          </div>
        )}
        
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className={cn(
                "relative flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-all duration-300 overflow-hidden group",
                hasErrors 
                  ? "bg-warning/10 text-warning border border-warning/20 hover:bg-warning/20 hover:border-warning/40" 
                  : "bg-success/10 text-success border border-success/20 hover:bg-success/20 hover:border-success/40"
              )}>
                {/* Shine effect */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                </div>
                
                <span className="relative flex items-center gap-2">
                  {hasErrors ? (
                    <>
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {syncErrors?.length} Issues
                    </>
                  ) : syncStatus === 'syncing' ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-3.5 w-3.5" />
                      All Systems Operational
                    </>
                  )}
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent className="bg-card border-border">
              <p className="font-medium">System Status</p>
              <p className="text-xs text-muted-foreground">Real-time health monitoring</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
