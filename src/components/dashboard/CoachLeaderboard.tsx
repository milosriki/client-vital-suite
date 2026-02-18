import { supabase } from "@/integrations/supabase/client";
import { QUERY_KEYS } from "@/config/queryKeys";
import { useDedupedQuery } from "@/hooks/useDedupedQuery";
import { useNavigate } from "react-router-dom";
import { Medal, Trophy, Award, Crown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface CoachPerformance {
  coach_name: string;
  performance_score: number;
  total_clients: number;
}

export function CoachLeaderboard() {
  const navigate = useNavigate();

  const { data: coaches, isLoading } = useDedupedQuery({
    queryKey: QUERY_KEYS.coaches.leaderboard,
    dedupeIntervalMs: 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('coach_performance')
        .select('coach_name, performance_score, total_clients')
        .order('performance_score', { ascending: false });
      
      if (error) throw error;
      return data as CoachPerformance[];
    },
    staleTime: Infinity, // Real-time updates via useVitalState
  });

  const rankConfig = [
    { 
      icon: Crown, 
      color: "text-yellow-400", 
      bg: "bg-yellow-400/10",
      border: "border-yellow-400/30",
      glow: "shadow-[0_0_15px_hsl(45_100%_50%/0.3)]",
      label: "1st"
    },
    { 
      icon: Medal, 
      color: "text-zinc-300", 
      bg: "bg-zinc-400/10",
      border: "border-zinc-400/30",
      glow: "",
      label: "2nd"
    },
    { 
      icon: Award, 
      color: "text-amber-600", 
      bg: "bg-amber-600/10",
      border: "border-amber-600/30",
      glow: "",
      label: "3rd"
    },
  ];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-card via-card to-yellow-500/5 p-6 animate-fade-up shadow-sm hover:shadow-md transition-shadow duration-300" style={{ animationDelay: '400ms' }}>
      {/* Decorative trophy glow */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-yellow-400/10 to-transparent rounded-full blur-2xl" />
      
      <div className="relative flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-yellow-400" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Top Performers
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Leaderboard</span>
        </div>
      </div>
      
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-muted/10">
              <div className="skeleton h-10 w-10 rounded-full" />
              <div className="flex-1">
                <div className="skeleton h-4 w-28 mb-2" />
                <div className="skeleton h-2 w-full rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : coaches?.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <TrendingUp className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No coach data yet</p>
          <p className="text-xs mt-1">Run BI Agent to calculate</p>
        </div>
      ) : (
        <div className="space-y-3">
          {coaches?.map((coach, index) => {
            const rank = rankConfig[index] || rankConfig[2];
            const RankIcon = rank.icon;
            const score = coach.performance_score || 0;
            
            return (
              <button
                key={coach.coach_name}
                onClick={() => navigate(`/coaches?selected=${encodeURIComponent(coach.coach_name)}`)}
                className={cn(
                  "w-full flex items-center gap-4 p-3 rounded-xl transition-all duration-300 group border",
                  "bg-gradient-to-r from-muted/20 to-transparent",
                  "hover:-translate-y-0.5 hover:bg-muted/30",
                  index === 0 && "border-yellow-400/20 hover:border-yellow-400/40",
                  index !== 0 && "border-transparent hover:border-primary/20"
                )}
              >
                {/* Rank Icon */}
                <div className={cn(
                  "relative shrink-0 p-2.5 rounded-xl border transition-all duration-300",
                  rank.bg,
                  rank.border,
                  index === 0 && rank.glow,
                  "group-hover:scale-110"
                )}>
                  <RankIcon className={cn("h-5 w-5", rank.color)} />
                  {/* Rank number badge */}
                  <span className={cn(
                    "absolute -bottom-1 -right-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                    rank.bg,
                    rank.color
                  )}>
                    {rank.label}
                  </span>
                </div>
                
                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                      {coach.coach_name}
                    </p>
                    <span className={cn(
                      "stat-number text-sm shrink-0",
                      index === 0 ? "text-yellow-400" : "text-muted-foreground"
                    )}>
                      {score.toFixed(0)}
                    </span>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="relative h-2 bg-muted/30 rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out",
                        index === 0 
                          ? "bg-gradient-to-r from-yellow-500 to-yellow-300" 
                          : "bg-gradient-to-r from-primary to-primary/60"
                      )}
                      style={{ width: `${Math.min(score, 100)}%` }}
                    />
                    {/* Shine effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 group-hover:animate-[shine_1s_ease-out]" />
                  </div>
                  
                  {coach.total_clients > 0 && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {coach.total_clients} clients managed
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
