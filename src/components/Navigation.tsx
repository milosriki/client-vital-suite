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

export const Navigation = () => {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
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
    staleTime: Infinity, // Real-time updates via useVitalState
  });

  const navItems = [
    // COMMAND
    { path: "/executive-dashboard", label: "Command", icon: LayoutDashboard },
    { path: "/war-room", label: "War Room", icon: Crown },

    // GROWTH
    { path: "/sales-pipeline", label: "Pipeline", icon: TrendingUp },
    { path: "/money-map", label: "Money Map", icon: Wallet },

    // OPERATIONS
    { path: "/clients", label: "Clients", icon: Users },
    { path: "/interventions", label: "Risks", icon: AlertTriangle },

    // INTELLIGENCE
    { path: "/stripe", label: "Stripe", icon: CreditCard },
    { path: "/reconciliation", label: "Leak Detector", icon: ShieldAlert },
    { path: "/ai-advisor", label: "AI Advisor", icon: BrainCircuit },
  ];

  const moreItems = [
    { path: "/", label: "Legacy Dashboard", icon: LayoutDashboard },
    { path: "/coaches", label: "Coaches", icon: UserCheck },
    { path: "/call-tracking", label: "Calls", icon: Phone },
    { path: "/hubspot-live", label: "HubSpot Live", icon: Zap },
    { path: "/leaderboard", label: "Leaderboard", icon: Award },
    { path: "/audit-trail", label: "Audit", icon: History },
    { path: "/ai-knowledge", label: "AI Knowledge", icon: Brain },
    { path: "/ai-learning", label: "AI Learning", icon: Lightbulb },
    { path: "/ai-dev", label: "AI Dev Console", icon: Cpu },
    { path: "/observability", label: "AI Observability", icon: Activity },
    { path: "/analytics", label: "Analytics", icon: BarChart3 },
    {
      path: "/marketing-stress-test",
      label: "Marketing Stress Test",
      icon: TestTube,
    },
    { path: "/ptd-control", label: "PTD Control", icon: Settings },
    { path: "/ultimate-ceo", label: "AI CEO", icon: Bot },
    { path: "/hubspot-analyzer", label: "HubSpot Analyzer", icon: FileSearch },
    { path: "/sales-coach-tracker", label: "Coach Tracker", icon: UserCheck },
    {
      path: "/yesterday-bookings",
      label: "Yesterday Bookings",
      icon: Calendar,
    },
    { path: "/workflow-strategy", label: "Workflow Strategy", icon: Workflow },
    { path: "/global-brain", label: "Global Brain", icon: Brain },
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
    onClick,
  }: {
    item: (typeof navItems)[0];
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
              onContextMenu={(e) => {
                e.preventDefault();
                window.open(item.path, "_blank");
              }}
              className={cn("nav-link", isActive && "active")}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="font-medium whitespace-nowrap">
                {item.label}
              </span>
            </Link>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            <p>{item.label}</p>
            <p className="text-muted-foreground">Shortcut: {shortcutKey}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <nav className="glass border-b sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/60 rounded-lg flex items-center justify-center shadow-glow-sm">
              <span className="text-white font-bold text-lg">P</span>
            </div>
            <span className="font-bold text-lg hidden sm:block">
              PTD Fitness
            </span>
          </div>

          {/* Desktop Navigation */}
          {!isMobile && (
            <div className="flex items-center gap-1 flex-1 justify-center">
              {navItems.map((item) => (
                <NavLink key={item.path} item={item} />
              ))}

              {/* More Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="nav-link flex items-center gap-1">
                    <span className="font-medium">More</span>
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
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
          )}

          {/* Right Side Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Notification Center */}
            <NotificationCenter />

            {/* System Status Dropdown */}
            <div className="hidden sm:block">
              <SystemStatusDropdown
                isSyncing={isSyncing}
                onSync={handleSync}
                onFullSync={handleFullSync}
              />
            </div>

            {/* Sync Button with Circuit Breaker Warning */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={circuitBreakerTripped ? "destructive" : "outline"}
                    size="sm"
                    onClick={handleSync}
                    disabled={isSyncing}
                    className={cn(
                      "hidden sm:flex gap-2 text-xs relative",
                      circuitBreakerTripped && "border-destructive",
                    )}
                  >
                    {circuitBreakerTripped ? (
                      <AlertTriangle className="h-3.5 w-3.5" />
                    ) : (
                      <RefreshCw
                        className={cn(
                          "h-3.5 w-3.5",
                          isSyncing && "animate-spin",
                        )}
                      />
                    )}
                    {isSyncing
                      ? "Syncing..."
                      : circuitBreakerTripped
                        ? "Paused"
                        : "Sync"}
                    {circuitBreakerTripped && (
                      <Badge
                        variant="destructive"
                        className="absolute -top-2 -right-2 h-4 w-4 p-0 flex items-center justify-center text-[10px]"
                      >
                        !
                      </Badge>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {circuitBreakerTripped
                    ? "Circuit breaker tripped - sync paused due to repeated failures"
                    : "Click to sync all data"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Mobile Menu - Always show hamburger for more options */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[300px]">
                <div className="flex flex-col gap-2 mt-8">
                  <div className="flex items-center gap-2 pb-4 border-b border-border/50">
                    <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/60 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold">P</span>
                    </div>
                    <span className="font-bold text-xl">PTD Fitness</span>
                  </div>

                  {/* Main Nav */}
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mt-4 mb-2">
                    Main
                  </p>
                  {navItems.map((item) => (
                    <NavLink
                      key={item.path}
                      item={item}
                      onClick={() => setMobileMenuOpen(false)}
                    />
                  ))}

                  {/* More Pages */}
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mt-6 mb-2">
                    More
                  </p>
                  {moreItems.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className="nav-link"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  ))}

                  {/* Quick Actions */}
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mt-6 mb-2">
                    Quick Actions
                  </p>
                  {circuitBreakerTripped && (
                    <div className="flex items-center gap-2 p-2 bg-destructive/10 border border-destructive/20 rounded-md text-xs text-destructive mb-2">
                      <AlertTriangle className="h-4 w-4" />
                      <span>Circuit breaker tripped - sync paused</span>
                    </div>
                  )}
                  <Button
                    variant={circuitBreakerTripped ? "destructive" : "outline"}
                    size="sm"
                    onClick={handleSync}
                    disabled={isSyncing}
                    className="justify-start"
                  >
                    {circuitBreakerTripped ? (
                      <AlertTriangle className="h-4 w-4 mr-2" />
                    ) : (
                      <RefreshCw
                        className={cn(
                          "h-4 w-4 mr-2",
                          isSyncing && "animate-spin",
                        )}
                      />
                    )}
                    {isSyncing
                      ? "Syncing..."
                      : circuitBreakerTripped
                        ? "Sync Paused"
                        : "Sync HubSpot"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="justify-start"
                  >
                    <a
                      href="https://dashboard.stripe.com"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <CreditCard className="h-4 w-4 mr-2" />
                      Open Stripe
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="justify-start"
                  >
                    <a
                      href="https://app.hubspot.com"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Zap className="h-4 w-4 mr-2" />
                      Open HubSpot
                    </a>
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
};
