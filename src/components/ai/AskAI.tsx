import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sparkles,
  Send,
  Loader2,
  AlertTriangle,
  Users,
  TrendingUp,
  Lightbulb,
  MessageSquare,
  X
} from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AskAIProps {
  page: string;
  context?: Record<string, any>;
}

export function AskAI({ page, context = {} }: AskAIProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get current page data dynamically based on page context
  const getCurrentPageData = () => {
    const baseData = { page, ...context };

    // Add any additional context from localStorage or session
    return baseData;
  };

  // Send message to AI agent
  const sendMessage = useMutation({
    mutationFn: async (userQuery: string) => {
      const { data, error } = await supabase.functions.invoke("ptd-agent", {
        body: {
          query: userQuery,
          context: {
            page,
            current_data: getCurrentPageData(),
            session_id: sessionId
          },
          action: "chat"
        }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "AI agent error");

      return data.response;
    },
    onSuccess: (response) => {
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: response }
      ]);
    },
    onError: (error: any) => {
      toast({
        title: "AI Error",
        description: error?.message || "Failed to get AI response",
        variant: "destructive"
      });
    }
  });

  // Quick action handlers with page-specific queries
  const getQuickActions = () => {
    const baseActions = [
      {
        label: "Who should I call today?",
        query: "Based on health scores and engagement patterns, who are the top 5 clients I should contact today? Prioritize by urgency.",
        icon: <AlertTriangle className="h-3 w-3 mr-1" />
      },
      {
        label: "Analyze team performance",
        query: "Analyze my team's performance. Which coaches are excelling and which need support?",
        icon: <Users className="h-3 w-3 mr-1" />
      },
      {
        label: "Show patterns",
        query: "What patterns have you noticed this week in client behavior and engagement?",
        icon: <TrendingUp className="h-3 w-3 mr-1" />
      },
      {
        label: "Explain formulas",
        query: "Explain how the health score calculation works and what factors matter most.",
        icon: <Lightbulb className="h-3 w-3 mr-1" />
      }
    ];

    // Add page-specific actions
    const pageActions: Record<string, any[]> = {
      dashboard: [
        {
          label: "Critical clients?",
          query: "Which clients are in the RED zone and need immediate intervention?",
          icon: <AlertTriangle className="h-3 w-3 mr-1 text-red-500" />
        }
      ],
      clients: [
        {
          label: "At-risk analysis",
          query: "Analyze all at-risk clients. What are the common patterns?",
          icon: <TrendingUp className="h-3 w-3 mr-1" />
        }
      ],
      "client-detail": context?.clientEmail ? [
        {
          label: `Why is ${context.clientEmail}'s score ${context.healthScore || 'this'}?`,
          query: `Explain ${context.clientEmail}'s health score in detail. Why is it ${context.healthScore || 'at this level'}? What factors contributed?`,
          icon: <Lightbulb className="h-3 w-3 mr-1" />
        },
        {
          label: "Generate intervention",
          query: `Generate a personalized intervention plan for ${context.clientEmail} including specific actions and a draft message.`,
          icon: <Sparkles className="h-3 w-3 mr-1" />
        }
      ] : [],
      "setter-activity": [
        {
          label: "Generate call queue",
          query: `Generate my call queue for ${context?.selectedOwner || 'today'}. Show clients who need calling with priority and draft messages.`,
          icon: <AlertTriangle className="h-3 w-3 mr-1" />
        }
      ]
    };

    return [...(pageActions[page] || []), ...baseActions];
  };

  const handleQuickAction = (actionQuery: string) => {
    setMessages(prev => [...prev, { role: "user", content: actionQuery }]);
    sendMessage.mutate(actionQuery);
  };

  const handleSend = () => {
    if (query.trim() && !sendMessage.isPending) {
      setMessages(prev => [...prev, { role: "user", content: query }]);
      sendMessage.mutate(query);
      setQuery("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Check for proactive insights
  const { data: criticalInsights } = useQuery({
    queryKey: ["critical-insights-count"],
    queryFn: async (): Promise<number> => {
      try {
        const { count } = await (supabase as any)
          .from("proactive_insights")
          .select("*", { count: "exact", head: true })
          .eq("is_dismissed", false)
          .in("priority", ["critical", "high"]);
        return count || 0;
      } catch {
        return 0;
      }
    },
    refetchInterval: 30000,
    retry: false
  });

  const quickActions = getQuickActions();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          className="fixed bottom-4 right-4 rounded-full h-14 w-14 shadow-lg z-50 group"
          size="icon"
        >
          <Sparkles className="h-6 w-6 group-hover:scale-110 transition-transform" />
          {criticalInsights && criticalInsights > 0 && (
            <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full h-5 w-5 text-xs flex items-center justify-center animate-pulse">
              {criticalInsights}
            </span>
          )}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl h-[80vh] flex flex-col p-0">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <span className="text-lg">Ask AI</span>
              <p className="text-xs text-muted-foreground font-normal">
                AI assistant for {page.replace(/-/g, ' ')}
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Messages */}
        <ScrollArea className="flex-1 px-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <MessageSquare className="h-16 w-16 mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-2">How can I help you?</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-md">
                I have access to all your client data, formulas, and patterns. Ask me anything!
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {quickActions.slice(0, 4).map((action, idx) => (
                  <Button
                    key={idx}
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickAction(action.query)}
                    className="text-xs"
                  >
                    {action.icon}
                    {action.label}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] p-3 rounded-lg ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                  </div>
                </div>
              ))}

              {sendMessage.isPending && (
                <div className="flex justify-start">
                  <div className="bg-muted p-3 rounded-lg flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Thinking...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        <Separator />

        {/* Quick Actions Bar */}
        {messages.length > 0 && (
          <div className="px-4 py-2 bg-muted/30">
            <div className="flex gap-1.5 flex-wrap">
              {quickActions.slice(0, 6).map((action, idx) => (
                <Button
                  key={idx}
                  variant="ghost"
                  size="sm"
                  onClick={() => handleQuickAction(action.query)}
                  className="text-xs h-7"
                  disabled={sendMessage.isPending}
                >
                  {action.icon}
                  {action.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        <Separator />

        {/* Input */}
        <div className="p-4 pt-2 flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask me anything about your clients, patterns, or performance..."
            className="flex-1"
            onKeyDown={handleKeyDown}
            disabled={sendMessage.isPending}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!query.trim() || sendMessage.isPending}
          >
            {sendMessage.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AskAI;
