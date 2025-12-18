import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { Phone, Mail, Calendar, DollarSign, UserPlus, CheckCircle, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useRef, useState } from 'react';
import { useDedupedQuery } from "@/hooks/useDedupedQuery";

interface Activity {
  id: string;
  activity_type: string;
  activity_title: string;
  activity_description: string;
  occurred_at: string;
}

const activityConfig: Record<string, { icon: React.ElementType; color: string }> = {
  call: { icon: Phone, color: 'text-primary' },
  email: { icon: Mail, color: 'text-blue-400' },
  meeting: { icon: Calendar, color: 'text-success' },
  payment: { icon: DollarSign, color: 'text-success' },
  signup: { icon: UserPlus, color: 'text-warning' },
  note: { icon: CheckCircle, color: 'text-muted-foreground' },
};

export function TickerFeed() {
  const [isPaused, setIsPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: activities, isLoading } = useDedupedQuery({
    queryKey: ['ticker-activities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contact_activities')
        .select('id, activity_type, activity_title, activity_description, occurred_at')
        .order('occurred_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as Activity[];
    },
    staleTime: Infinity, // Real-time updates via useVitalState
  });

  // Auto-scroll animation
  useEffect(() => {
    if (!scrollRef.current || isPaused || !activities?.length) return;

    const container = scrollRef.current;
    let animationId: number;
    let scrollPosition = 0;

    const scroll = () => {
      if (!isPaused && container) {
        scrollPosition += 0.5;
        if (scrollPosition >= container.scrollWidth / 2) {
          scrollPosition = 0;
        }
        container.scrollLeft = scrollPosition;
      }
      animationId = requestAnimationFrame(scroll);
    };

    animationId = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(animationId);
  }, [isPaused, activities]);

  if (isLoading) {
    return (
      <div className="bg-card/50 border-y border-border/50 py-2">
        <div className="flex items-center gap-4 px-4 animate-pulse">
          <div className="h-4 w-4 bg-muted rounded-full" />
          <div className="h-3 w-48 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!activities?.length) {
    return null;
  }

  // Duplicate activities for seamless loop
  const duplicatedActivities = [...activities, ...activities];

  return (
    <div className="relative bg-card/30 border-y border-border/50 overflow-hidden">
      {/* Live indicator */}
      <div className="absolute left-0 top-0 bottom-0 z-10 flex items-center px-3 bg-gradient-to-r from-card via-card to-transparent">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider text-success">LIVE</span>
        </div>
      </div>

      {/* Scrolling content */}
      <div
        ref={scrollRef}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        className="flex items-center gap-8 py-2 pl-20 pr-4 overflow-hidden whitespace-nowrap"
        style={{ scrollBehavior: isPaused ? 'smooth' : 'auto' }}
      >
        {duplicatedActivities.map((activity, index) => {
          const config = activityConfig[activity.activity_type?.toLowerCase()] || activityConfig.note;
          const Icon = config.icon;

          return (
            <div
              key={`${activity.id}-${index}`}
              className={cn(
                'flex items-center gap-2 text-sm shrink-0 transition-opacity',
                isPaused ? 'opacity-100' : 'opacity-80 hover:opacity-100'
              )}
            >
              <Icon className={cn('h-3.5 w-3.5', config.color)} />
              <span className="font-medium text-foreground">
                {activity.activity_title || activity.activity_type}
              </span>
              <span className="text-muted-foreground text-xs">•</span>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(activity.occurred_at), { addSuffix: true })}
              </span>
            </div>
          );
        })}
      </div>

      {/* Fade edge */}
      <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-background to-transparent pointer-events-none" />
    </div>
  );
}