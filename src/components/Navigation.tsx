import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, UserCheck, AlertTriangle, BarChart3, Settings, BookOpen, Activity, Command, Search, TrendingUp, PhoneCall, Zap, Phone, Brain, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConnectionStatus } from "./ConnectionStatus";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

export const Navigation = () => {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isMobile = useIsMobile();

  const navItems = [
    { path: "/", label: "Dashboard", icon: LayoutDashboard },
    { path: "/sales-pipeline", label: "Sales Pipeline", icon: TrendingUp },
    { path: "/call-tracking", label: "Call Tracking", icon: Phone },
    { path: "/hubspot-live", label: "HubSpot Live", icon: Zap },
    { path: "/setter-activity-today", label: "Today's Activity", icon: PhoneCall },
    { path: "/clients", label: "Clients", icon: Users },
    { path: "/coaches", label: "Coaches", icon: UserCheck },
    { path: "/interventions", label: "Interventions", icon: AlertTriangle },
    { path: "/meta-dashboard", label: "Meta CAPI", icon: Activity },
    { path: "/ptd-control", label: "PTD Control", icon: Command },
    { path: "/ultimate-ceo", label: "AI CEO", icon: Brain },
  ];

  const NavLink = ({ item, onClick }: { item: typeof navItems[0]; onClick?: () => void }) => {
    const Icon = item.icon;
    const isActive = location.pathname === item.path;

    return (
      <Link
        to={item.path}
        onClick={onClick}
        className={cn(
          "flex items-center space-x-2 px-4 py-2 rounded-md transition-colors",
          isActive
            ? "bg-primary text-primary-foreground"
            : "hover:bg-accent text-muted-foreground hover:text-foreground"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="font-medium whitespace-nowrap">{item.label}</span>
      </Link>
    );
  };

  return (
    <nav className="bg-card border-b sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center space-x-2 shrink-0">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">P</span>
            </div>
            <span className="font-bold text-lg sm:text-xl">PTD Fitness</span>
          </div>

          {/* Desktop Navigation */}
          {!isMobile && (
            <div className="flex items-center space-x-4 flex-1 overflow-x-auto px-4 hide-scrollbar">
              <div className="flex space-x-1 min-w-max">
                {navItems.map((item) => (
                  <NavLink key={item.path} item={item} />
                ))}
              </div>
            </div>
          )}

          {/* Mobile Menu Button & Connection Status */}
          <div className="flex items-center gap-2 shrink-0">
            {isMobile ? (
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden">
                    <Menu className="h-5 w-5" />
                    <span className="sr-only">Toggle menu</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[300px] sm:w-[400px]">
                  <div className="flex flex-col space-y-4 mt-8">
                    <div className="flex items-center space-x-2 pb-4 border-b">
                      <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold text-lg">P</span>
                      </div>
                      <span className="font-bold text-xl">PTD Fitness</span>
                    </div>
                    {navItems.map((item) => (
                      <NavLink 
                        key={item.path} 
                        item={item} 
                        onClick={() => setMobileMenuOpen(false)}
                      />
                    ))}
                    <div className="pt-4 border-t">
                      <ConnectionStatus />
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            ) : (
              <ConnectionStatus />
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};
