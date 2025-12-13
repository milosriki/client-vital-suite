import { useState } from "react";
import { Bot, X, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface FloatingAIButtonProps {
  onOpen?: () => void;
}

export function FloatingAIButton({ onOpen }: FloatingAIButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Button
      onClick={onOpen}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg shadow-primary/25",
        "bg-gradient-to-r from-primary to-primary/80 hover:from-primary hover:to-primary",
        "transition-all duration-300 z-50",
        isHovered && "scale-110 shadow-glow"
      )}
    >
      <Bot className={cn(
        "h-6 w-6 transition-transform duration-300",
        isHovered && "scale-110"
      )} />
    </Button>
  );
}
