import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, UserCheck, TrendingUp, Phone, Zap, Menu, RefreshCw, Bot, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export const Navigation = () => {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const isMobile = useIsMobile();

  const navItems = [
    { path: "/", label: "Dashboard", icon: LayoutDashboard },
    { path: "/sales-pipeline", label: "Sales Pipeline", icon: TrendingUp },
    { path: "/call-tracking", label: "Calls", icon: Phone },
    { path: "/hubspot-live", label: "HubSpot", icon: Zap },
    { path: "/clients", label: "Clients", icon: Users },
    { path: "/coaches", label: "Coaches", icon: UserCheck },
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

    return (
      <Link
        to={item.path}
        onClick={onClick}
        className={cn(
          "nav-link",
          isActive && "active"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="font-medium whitespace-nowrap">{item.label}</span>
      </Link>
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
            </div>
          )}

          {/* Right Side Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Sync Status */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/10 border border-success/20">
              <CheckCircle className="h-3 w-3 text-success" />
              <span className="text-xs text-success font-medium">Connected</span>
            </div>
            
            {/* Sync Button */}
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

            {/* Mobile Menu */}
            {isMobile && (
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[280px]">
                  <div className="flex flex-col gap-4 mt-8">
                    <div className="flex items-center gap-2 pb-4 border-b">
                      <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/60 rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold">P</span>
                      </div>
                      <span className="font-bold text-xl">PTD Fitness</span>
                    </div>
                    {navItems.map((item) => (
                      <NavLink key={item.path} item={item} onClick={() => setMobileMenuOpen(false)} />
                    ))}
                  </div>
                </SheetContent>
              </Sheet>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};
