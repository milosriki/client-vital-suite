import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, UserCheck, AlertTriangle, BarChart3, Settings, BookOpen, Activity, Command, Search, TrendingUp, PhoneCall, Zap, Phone, Brain } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConnectionStatus } from "./ConnectionStatus";

export const Navigation = () => {
  const location = useLocation();

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

  return (
    <nav className="bg-card border-b sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-8">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">P</span>
              </div>
              <span className="font-bold text-xl">PTD Fitness</span>
            </div>

            <div className="flex space-x-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "flex items-center space-x-2 px-4 py-2 rounded-md transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-accent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          <ConnectionStatus />
        </div>
      </div>
    </nav>
  );
};
