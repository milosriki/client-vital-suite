import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, UserCheck, TrendingUp, Phone, Zap, Menu, RefreshCw, Bot, CreditCard, Settings, BarChart3, History, ChevronDown, FileSearch, Calendar, Workflow, Crown, AlertTriangle, Activity, Command, Brain, Lightbulb, TestTube, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { SystemStatusDropdown } from "@/components/dashboard/SystemStatusDropdown";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";

export const Navigation = () => {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const isMobile = useIsMobile();

  const navItems = [
    { path: "/", label: "Dashboard", icon: LayoutDashboard },
    { path: "/sales-pipeline", label: "Sales", icon: TrendingUp },
    { path: "/stripe", label: "Stripe", icon: CreditCard },
    { path: "/call-tracking", label: "Calls", icon: Phone },
    { path: "/hubspot-live", label: "HubSpot", icon: Zap },
    { path: "/audit-trail", label: "Audit", icon: History },
    { path: "/clients", label: "Clients", icon: Users },
    { path: "/coaches", label: "Coaches", icon: UserCheck },
    { path: "/interventions", label: "Interventions", icon: AlertTriangle },
    { path: "/ai-knowledge", label: "AI Knowledge", icon: Brain },
    { path: "/ai-learning", label: "AI Learning", icon: Lightbulb },
  ];

  const moreItems = [
    { path: "/ai-dev", label: "AI Dev Console", icon: Cpu },
    { path: "/war-room", label: "CEO War Room", icon: Crown },
    { path: "/analytics", label: "Analytics", icon: BarChart3 },
    { path: "/marketing-stress-test", label: "Marketing Stress Test", icon: TestTube },
    { path: "/ptd-control", label: "PTD Control", icon: Settings },
    { path: "/ultimate-ceo", label: "AI CEO", icon: Bot },
    { path: "/hubspot-analyzer", label: "HubSpot Analyzer", icon: FileSearch },
    { path: "/sales-coach-tracker", label: "Coach Tracker", icon: UserCheck },
    { path: "/yesterday-bookings", label: "Yesterday Bookings", icon: Calendar },
    { path: "/workflow-strategy", label: "Workflow Strategy", icon: Workflow },
  ];

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const { error } = await supabase.functions.invoke('sync-hubspot-to-supabase');
      if (error) throw error;
      toast({ title: 'Sync Complete', description: 'HubSpot data synchronized' });
    } catch (error: any) {
      toast({ title: 'Sync Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsSyncing(false);
    }
  };

  const NavLink = ({ item, onClick }: { item: typeof navItems[0]; onClick?: () => void }) => {
    const Icon = item.icon;
    const isActive = location.pathname === item.path;
    const shortcutKey = item.path === '/' ? 'g d' : `g ${item.label[0].toLowerCase()}`;

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              to={item.path}
              onClick={onClick}
              onContextMenu={(e) => {
                e.preventDefault();
                window.open(item.path, '_blank');
              }}
              className={cn(
                "nav-link",
                isActive && "active"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="font-medium whitespace-nowrap">{item.label}</span>
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
            <span className="font-bold text-lg hidden sm:block">PTD Fitness</span>
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
              <SystemStatusDropdown isSyncing={isSyncing} onSync={handleSync} />
            </div>

            {/* Sync Button */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSync}
                    disabled={isSyncing}
                    className="hidden sm:flex gap-2 text-xs"
                  >
                    <RefreshCw className={cn("h-3.5 w-3.5", isSyncing && "animate-spin")} />
                    {isSyncing ? "Syncing..." : "Sync"}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Click to sync all data</TooltipContent>
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
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mt-4 mb-2">Main</p>
                  {navItems.map((item) => (
                    <NavLink key={item.path} item={item} onClick={() => setMobileMenuOpen(false)} />
                  ))}
                  
                  {/* More Pages */}
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mt-6 mb-2">More</p>
                  <Link to="/analytics" onClick={() => setMobileMenuOpen(false)} className="nav-link">
                    <BarChart3 className="h-4 w-4" />
                    <span>Analytics</span>
                  </Link>
                  <Link to="/ptd-control" onClick={() => setMobileMenuOpen(false)} className="nav-link">
                    <Settings className="h-4 w-4" />
                    <span>PTD Control</span>
                  </Link>
                  <Link to="/ultimate-ceo" onClick={() => setMobileMenuOpen(false)} className="nav-link">
                    <Bot className="h-4 w-4" />
                    <span>AI CEO</span>
                  </Link>
                  
                  {/* Quick Actions */}
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mt-6 mb-2">Quick Actions</p>
                  <Button variant="outline" size="sm" onClick={handleSync} disabled={isSyncing} className="justify-start">
                    <RefreshCw className={cn("h-4 w-4 mr-2", isSyncing && "animate-spin")} />
                    {isSyncing ? "Syncing..." : "Sync HubSpot"}
                  </Button>
                  <Button variant="outline" size="sm" asChild className="justify-start">
                    <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer">
                      <CreditCard className="h-4 w-4 mr-2" />
                      Open Stripe
                    </a>
                  </Button>
                  <Button variant="outline" size="sm" asChild className="justify-start">
                    <a href="https://app.hubspot.com" target="_blank" rel="noopener noreferrer">
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
