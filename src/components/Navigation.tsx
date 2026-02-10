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
  BrainCircuit,
  ShieldAlert,
  ChevronRight,
  ChevronLeft,
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
import { QUERY_KEYS } from "@/config/queryKeys";
import { GlobalDateRangePicker } from "@/components/GlobalDateRangePicker";

export const Navigation = () => {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const isMobile = useIsMobile();

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
    COMMERCIAL: [
      { path: "/executive-dashboard", label: "Command", icon: LayoutDashboard },
      {
        path: "/marketing-intelligence",
        label: "Marketing",
        icon: BarChart3,
      },
      { path: "/sales-pipeline", label: "Pipeline", icon: TrendingUp },
      { path: "/money-map", label: "Money Map", icon: Wallet },
      { path: "/stripe", label: "Stripe", icon: CreditCard },
    ],
    OPERATIONS: [
      { path: "/clients", label: "Clients", icon: Users },
      { path: "/interventions", label: "Risks", icon: AlertTriangle },
      { path: "/coaches", label: "Coaches", icon: UserCheck },
      { path: "/leaderboard", label: "Leaderboard", icon: Award },
    ],
    INTELLIGENCE: [
      { path: "/ai-advisor", label: "AI Advisor", icon: BrainCircuit },
      { path: "/skills-matrix", label: "Skill Power", icon: Zap },
      { path: "/war-room", label: "War Room", icon: Crown },
      { path: "/global-brain", label: "Global Brain", icon: Brain },
      { path: "/reconciliation", label: "Leak Detector", icon: ShieldAlert },
    ],
  };

  const moreItems = [
    { path: "/", label: "Legacy Dashboard", icon: LayoutDashboard },
    { path: "/call-tracking", label: "Calls", icon: Phone },
    { path: "/hubspot-live", label: "HubSpot Live", icon: Zap },
    { path: "/audit-trail", label: "Audit", icon: History },
    { path: "/ai-knowledge", label: "AI Knowledge", icon: Brain },
    { path: "/ai-learning", label: "AI Learning", icon: Lightbulb },
    { path: "/ai-dev", label: "AI Dev Console", icon: Cpu },
    { path: "/observability", label: "AI Observability", icon: Activity },
    { path: "/analytics", label: "Analytics", icon: BarChart3 },
    { path: "/ptd-control", label: "PTD Control", icon: Settings },
    { path: "/ultimate-ceo", label: "AI CEO", icon: Bot },
  ];

  const handleSync = async () => {
    await hubspotSync.execute(
      async () => {
        setIsSyncing(true);
        try {
          const { error } = await supabase.functions.invoke(
            "sync-hubspot-to-supabase",
          );
          if (error) throw error;
          toast({
            title: "Sync Complete",
            description: "HubSpot data synchronized",
          });
        } catch (error: any) {
          toast({
            title: "Sync Error",
            description: error.message,
            variant: "destructive",
          });
        } finally {
          setIsSyncing(false);
        }
      },
      { lockMessage: "HubSpot sync is already in progress" },
    );
  };

  const handleFullSync = async () => {
    if (
      !window.confirm(
        "This will perform a FULL sync of all historical data (5+ years). It may take several minutes. Continue?",
      )
    ) {
      return;
    }
    await hubspotSync.execute(
      async () => {
        setIsSyncing(true);
        try {
          const { error } = await supabase.functions.invoke(
            "sync-hubspot-to-supabase",
            {
              body: { incremental: false },
            },
          );
          if (error) throw error;
          toast({
            title: "Full Sync Started",
            description:
              "Historical data sync initiated. Check logs for progress.",
          });
        } catch (error: any) {
          toast({
            title: "Sync Error",
            description: error.message,
            variant: "destructive",
          });
        } finally {
          setIsSyncing(false);
        }
      },
      { lockMessage: "HubSpot sync is already in progress" },
    );
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
                "flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
                collapsed && "justify-center px-2",
              )}
            >
              <Icon
                className={cn("h-4 w-4 shrink-0", isActive && "text-primary")}
              />
              {!collapsed && <span>{item.label}</span>}
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
        "fixed left-0 top-0 z-40 h-screen border-r bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-all duration-300 flex flex-col",
        isCollapsed ? "w-[72px]" : "w-64",
      )}
    >
      {/* HUD Header */}
      <div className="h-16 flex items-center justify-center border-b shrink-0 relative">
        <div
          className="w-8 h-8 bg-gradient-to-br from-primary to-primary/60 rounded-lg flex items-center justify-center shadow-glow-sm cursor-pointer"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <span className="text-white font-bold text-lg">P</span>
        </div>
        {!isCollapsed && (
          <span
            className="ml-3 font-bold text-lg tracking-tight animate-in fade-in cursor-pointer"
            onClick={() => setIsCollapsed(true)}
          >
            IV-OS
          </span>
        )}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        {Object.entries(NAV_GROUPS).map(([group, items]) => (
          <div key={group}>
            {!isCollapsed && (
              <p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider mb-2 px-2 animate-in fade-in">
                {group}
              </p>
            )}
            <div className="space-y-1">
              {items.map((item) => (
                <NavLink key={item.path} item={item} collapsed={isCollapsed} />
              ))}
            </div>
            {isCollapsed && <div className="h-px bg-border/50 my-2 mx-2" />}
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
            <TooltipContent side="right">HubSpot Sync Status</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* More Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "w-full",
                isCollapsed ? "justify-center px-0" : "justify-start",
              )}
            >
              <Settings className={cn("h-4 w-4", isCollapsed ? "" : "mr-2")} />
              {!isCollapsed && "System"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 ml-2">
            {moreItems.map((item) => (
              <DropdownMenuItem key={item.path} asChild>
                <Link to={item.path} className="flex items-center gap-2">
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
};
