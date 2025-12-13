import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, AlertTriangle, RefreshCw, Calendar as CalendarIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

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
  const { data: syncErrors } = useQuery({
    queryKey: ['sync-errors-check'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('sync_errors')
        .select('id')
        .eq('resolved', false)
        .limit(5);
      
      if (error) return [];
      return data || [];
    },
    refetchInterval: 60000,
  });

  // Get last sync time
  const { data: lastSync } = useQuery({
    queryKey: ['last-sync-time'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('sync_logs')
        .select('started_at, status')
        .order('started_at', { ascending: false })
        .limit(1);
      
      if (error || !data?.[0]) return null;
      return data[0];
    },
    refetchInterval: 30000,
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
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          {greeting}
        </h1>
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <button className="text-sm text-muted-foreground mt-1 flex items-center gap-2 hover:text-primary transition-colors group">
              <span className="group-hover:underline">{displayDate}</span>
              {!isToday && <span className="text-xs text-warning">(historical view)</span>}
              <CalendarIcon className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              initialFocus
            />
            <div className="p-2 border-t">
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full"
                onClick={() => handleDateSelect(new Date())}
              >
                Today
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      
      <div className="flex items-center gap-3">
        {lastSync && (
          <span className="text-xs text-muted-foreground">
            Last sync: {format(new Date(lastSync.started_at), 'h:mm a')}
          </span>
        )}
        
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                hasErrors 
                  ? "bg-warning/10 text-warning border border-warning/20 hover:bg-warning/20" 
                  : "bg-success/10 text-success border border-success/20 hover:bg-success/20"
              )}>
                {hasErrors ? (
                  <>
                    <AlertTriangle className="h-3 w-3" />
                    {syncErrors?.length} Issues
                  </>
                ) : syncStatus === 'syncing' ? (
                  <>
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-3 w-3" />
                    All Systems Operational
                  </>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-medium">System Status</p>
              <p className="text-xs text-muted-foreground">Click for detailed status</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
