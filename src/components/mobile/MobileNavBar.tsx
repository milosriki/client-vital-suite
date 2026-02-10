import { Home, Activity, Search, DollarSign, Menu } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

export function MobileNavBar() {
  const location = useLocation();

  const navItems = [
    { icon: Home, label: "Home", path: "/" },
    { icon: Activity, label: "Pulse", path: "/dashboard" }, // Executive Dashboard
    { icon: Search, label: "AI", path: "/ai-knowledge" },
    { icon: DollarSign, label: "Money", path: "/financials" },
    { icon: Menu, label: "Menu", path: "/settings" },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 h-16 bg-background/95 backdrop-blur-md border-t border-border z-50 md:hidden">
      <div className="grid grid-cols-5 h-full">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center gap-1",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <item.icon
                className={cn("h-5 w-5", isActive && "fill-current")}
              />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
