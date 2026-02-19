import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  UserCheck,
  TrendingUp,
  Phone,
  Zap,
  Menu,
  RefreshCw,
  Bot,
  CreditCard,
  Settings,
  BarChart3,
  History,
  ChevronDown,
  FileSearch,
  Calendar,
  Workflow,
  Crown,
  AlertTriangle,
  Activity,
  Command,
  Brain,
  Lightbulb,
  TestTube,
  Cpu,
  Wallet,
  Award,
  Crosshair,
  BrainCircuit,
  ShieldAlert,
  ChevronRight,
  ChevronLeft,
  Headphones,
  Target,
  TrendingDown,
  MapPin,
  Megaphone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { SystemStatusDropdown } from "@/components/dashboard/SystemStatusDropdown";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { useSyncLock, SYNC_OPERATIONS } from "@/hooks/useSyncLock";
import { useDedupedQuery } from "@/hooks/useDedupedQuery";
import { useMasterSync } from "@/hooks/useMasterSync";
import { QUERY_KEYS } from "@/config/queryKeys";
import { GlobalDateRangePicker } from "@/components/GlobalDateRangePicker";
import { useSidebar } from "@/hooks/use-sidebar";

export const Navigation = () => {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isCollapsed, setIsCollapsed } = useSidebar();
  const isMobile = useIsMobile();
  const masterSync = useMasterSync();
  const isSyncing = masterSync.isSyncing;

  // Use sync lock to prevent concurrent syncs
  const hubspotSync = useSyncLock(SYNC_OPERATIONS.HUBSPOT_SYNC);

  // Check for recent circuit breaker trips (last 24 hours)
  const { data: circuitBreakerTripped } = useDedupedQuery({
    queryKey: QUERY_KEYS.sync.errors.all,
    dedupeIntervalMs: 1000,
    queryFn: async () => {
      const twentyFourHoursAgo = new Date(
        Date.now() - 24 * 60 * 60 * 1000,
      ).toISOString();
      const { data, error } = await supabase
        .from("sync_errors")
        .select("id, error_type, created_at")
        .eq("error_type", "circuit_breaker_trip")
        .gte("created_at", twentyFourHoursAgo)
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) return false;
      return data && data.length > 0;
    },
    staleTime: Infinity,
  });

  const NAV_GROUPS = {
    MAIN: [
      { path: "/intelligence", label: "AI Intelligence", icon: Lightbulb },
      { path: "/command-center", label: "Command Center", icon: Crosshair },
      { path: "/marketing", label: "Marketing", icon: BarChart3 },
      { path: "/sales-pipeline", label: "Pipeline", icon: TrendingUp },
      { path: "/revenue", label: "Revenue", icon: CreditCard },
      { path: "/attribution", label: "Attribution", icon: ShieldAlert },
      { path: "/clients", label: "Clients", icon: Users },
      { path: "/coaches", label: "Coaches", icon: UserCheck },
      { path: "/interventions", label: "Risks", icon: AlertTriangle },
      { path: "/global-brain", label: "AI Brain", icon: Brain },
      { path: "/ai-advisor", label: "AI Advisor", icon: BrainCircuit },
      { path: "/daily-ops", label: "Daily Ops", icon: Activity },
      { path: "/client-activity", label: "Client Activity", icon: Users },
      { path: "/predictions", label: "Predictions", icon: TrendingDown },
      { path: "/alert-center", label: "Alert Center", icon: AlertTriangle },
      { path: "/coach-locations", label: "Coach GPS", icon: MapPin },
      { path: "/meta-ads", label: "Meta Ads", icon: Megaphone },
    ],
    MORE: [
      { path: "/sales-tracker", label: "Sales Tracker", icon: Target },
      { path: "/calls", label: "Call Analytics", icon: Phone },
      { path: "/setter-command-center", label: "Setter Command", icon: Phone },
      { path: "/skills", label: "Skills", icon: Zap },
      { path: "/war-room", label: "War Room", icon: Crown },
      { path: "/audit", label: "Audit Trail", icon: History },
      { path: "/enterprise/strategy", label: "Strategy", icon: Crosshair },
      { path: "/enterprise/call-analytics", label: "Call Deep Dive", icon: Phone },
      { path: "/enterprise/observability", label: "System Health", icon: Activity },
      { path: "/enterprise/client-health", label: "Health Detail", icon: Activity },
      { path: "/enterprise/coach-performance", label: "Coach Stats", icon: UserCheck },
      { path: "/enterprise/knowledge-base", label: "Knowledge Base", icon: Brain },
    ],
  };

  const handleSync = async () => {
    if (masterSync.isSyncing) return;
    await masterSync.runSync();
  };

  const handleFullSync = async () => {
    if (
      !window.confirm(
        "This will perform a FULL sync of all data sources (HubSpot, Facebook, Stripe, Attribution). May take 1-2 minutes. Continue?",
      )
    ) {
      return;
    }
    await masterSync.runSync();
  };

  const NavLink = ({
    item,
    collapsed,
    onClick,
  }: {
    item: { path: string; label: string; icon: any };
    collapsed?: boolean;
    onClick?: () => void;
  }) => {
    const Icon = item.icon;
    const isActive = location.pathname === item.path;
    const shortcutKey =
      item.path === "/" ? "g d" : `g ${item.label[0].toLowerCase()}`;

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              to={item.path}
              onClick={onClick}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group/link relative",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-white/5 hover:text-white",
                collapsed && "justify-center px-2",
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-transform duration-200",
                  isActive
                    ? "text-primary scale-110"
                    : "group-hover/link:scale-110",
                )}
              />
              {!collapsed && (
                <span className="font-mono text-[11px] font-bold uppercase tracking-widest">
                  {item.label}
                </span>
              )}

              {isActive && !collapsed && (
                <div className="absolute right-2 h-1 w-1 rounded-full bg-primary shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
              )}
            </Link>
          </TooltipTrigger>
          {collapsed && (
            <TooltipContent side="right" className="text-xs">
              <p>{item.label}</p>
              <p className="text-muted-foreground">Shortcut: {shortcutKey}</p>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    );
  };

  // MOBILE NAV
  if (isMobile) {
    return (
      <nav className="glass border-b sticky top-0 z-50">
        <div className="flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/60 rounded-lg flex items-center justify-center shadow-glow-sm">
              <span className="text-white font-bold text-lg">P</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <NotificationCenter />
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[300px] overflow-y-auto">
                <div className="flex flex-col gap-6 mt-8">
                  {Object.entries(NAV_GROUPS).map(([group, items]) => (
                    <div key={group}>
                      <p className="text-xs font-semibold text-muted-foreground mb-2 px-2">
                        {group}
                      </p>
                      <div className="space-y-1">
                        {items.map((item) => (
                          <NavLink
                            key={item.path}
                            item={item}
                            onClick={() => setMobileMenuOpen(false)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* Sync Logic for Mobile */}
                  <div className="pt-4 border-t">
                    <Button
                      variant={
                        circuitBreakerTripped ? "destructive" : "outline"
                      }
                      size="sm"
                      onClick={handleSync}
                      disabled={isSyncing}
                      className="w-full justify-start"
                    >
                      {isSyncing ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      Sync HubSpot
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </nav>
    );
  }

  // DESKTOP SIDEBAR ("THE HUD")
  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen border-r border-white/10 bg-black transition-all duration-300 flex flex-col font-sans",
        isCollapsed ? "w-[72px]" : "w-64",
      )}
    >
      {/* HUD Header - Global Intelligence Bar */}
      <div className="h-16 flex items-center px-4 border-b border-white/10 shrink-0 relative overflow-hidden group">
        <div
          className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center shadow-glow-sm cursor-pointer shrink-0 transition-transform active:scale-95"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <Crown className="text-black h-6 w-6" />
        </div>
        {!isCollapsed && (
          <div className="ml-3 flex flex-col animate-in fade-in slide-in-from-left-2 duration-300">
            <span className="font-bold text-sm tracking-widest text-white uppercase font-mono">
              Supreme
            </span>
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-tighter font-mono">
                Truth: Aligned
              </span>
            </div>
          </div>
        )}

        {/* Glow Background */}
        <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto py-6 px-3 space-y-8 scrollbar-thin">
        {Object.entries(NAV_GROUPS).map(([group, items]) => (
          <div key={group} className="space-y-2">
            {!isCollapsed && (
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-3 px-3 animate-in fade-in slide-in-from-left-1">
                {group}
              </p>
            )}
            <div className="space-y-1">
              {items.map((item) => (
                <NavLink key={item.path} item={item} collapsed={isCollapsed} />
              ))}
            </div>
            {isCollapsed && <div className="h-px bg-white/5 my-4 mx-2" />}
          </div>
        ))}
      </div>

      {/* HUD Footer (Sync & User) */}
      <div className="p-3 border-t bg-muted/20 space-y-2">
        {/* Date Range Picker - Only visible when expanded */}
        {!isCollapsed && (
          <div className="mb-2">
            <GlobalDateRangePicker className="w-full" />
          </div>
        )}

        {/* Sync Status - Only Icon if collapsed */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={circuitBreakerTripped ? "destructive" : "ghost"}
                size="sm"
                className={cn(
                  "w-full",
                  isCollapsed ? "justify-center px-0" : "justify-start",
                )}
                onClick={handleSync}
              >
                {circuitBreakerTripped ? (
                  <AlertTriangle className="h-4 w-4 text-destructive-foreground" />
                ) : (
                  <RefreshCw
                    className={cn(
                      "h-4 w-4",
                      isCollapsed ? "" : "mr-2",
                      isSyncing && "animate-spin",
                    )}
                  />
                )}
                {!isCollapsed &&
                  (circuitBreakerTripped ? "Sync Paused" : "Sync Data")}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              Sync All Sources (HubSpot + FB + Stripe)
              {masterSync.lastSyncTime && (
                <span className="block text-xs text-muted-foreground mt-1">
                  Last: {masterSync.lastSyncTime.toLocaleTimeString()}
                </span>
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* System link placeholder */}
      </div>
    </aside>
  );
};
