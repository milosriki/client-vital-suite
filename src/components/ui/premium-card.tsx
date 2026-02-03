import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "./card";

interface PremiumCardProps extends React.ComponentProps<typeof Card> {
  variant?: "glass" | "glass-elevated" | "neon" | "default";
  glow?: boolean;
}

const PremiumCard = React.forwardRef<HTMLDivElement, PremiumCardProps>(
  ({ className, variant = "glass", glow = false, ...props }, ref) => {
    const variants = {
      default: "bg-card text-card-foreground shadow-sm",
      glass: "premium-card",
      "glass-elevated": "premium-card hover:translate-y-[-5px] hover:shadow-xl",
      neon: "border-primary/50 bg-background/50 backdrop-blur-xl shadow-glow",
    };

    return (
      <div
        ref={ref}
        className={cn(
          variants[variant],
          glow &&
            "shadow-glow-sm hover:shadow-glow transition-shadow duration-300",
          className,
        )}
        {...props}
      />
    );
  },
);
PremiumCard.displayName = "PremiumCard";

export {
  PremiumCard,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
};
