import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Medal, Trophy, Award } from "lucide-react";
import { cn } from "@/lib/utils";

interface CoachPerformance {
  coach_name: string;
  performance_score: number;
  total_clients: number;
}

export function CoachLeaderboard() {
  const navigate = useNavigate();

  const { data: coaches, isLoading } = useQuery({
    queryKey: ['coach-leaderboard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('coach_performance')
        .select('coach_name, performance_score, total_clients')
        .order('performance_score', { ascending: false })
        .limit(3);
      
      if (error) throw error;
      return data as CoachPerformance[];
    },
    refetchInterval: 120000,
  });

  const rankIcons = [
    { icon: Trophy, color: "text-yellow-400" },
    { icon: Medal, color: "text-zinc-400" },
    { icon: Award, color: "text-amber-600" },
  ];

  return (
    <div className="premium-card p-6 animate-fade-up" style={{ animationDelay: '400ms' }}>
      <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-4">
        Top Performers
      </h3>
      
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3">
              <div className="skeleton h-8 w-8 rounded-full" />
              <div className="flex-1">
                <div className="skeleton h-4 w-24 mb-1" />
                <div className="skeleton h-2 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : coaches?.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground text-sm">
          <p>No coach data yet</p>
          <p className="text-xs mt-1">Run BI Agent to calculate</p>
        </div>
      ) : (
        <div className="space-y-4">
          {coaches?.map((coach, index) => {
            const RankIcon = rankIcons[index]?.icon || Award;
            const rankColor = rankIcons[index]?.color || "text-muted-foreground";
            const score = coach.performance_score || 0;
            
            return (
              <button
                key={coach.coach_name}
                onClick={() => navigate(`/coaches?selected=${encodeURIComponent(coach.coach_name)}`)}
                className="w-full flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-muted/30 transition-colors"
              >
                <div className={cn("p-1.5 rounded-full bg-muted/50", rankColor)}>
                  <RankIcon className="h-4 w-4" />
                </div>
                
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium truncate">{coach.coach_name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(score, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">
                      {score.toFixed(0)}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
