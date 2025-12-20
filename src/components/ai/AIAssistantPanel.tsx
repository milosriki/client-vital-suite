import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { getApiUrl, API_ENDPOINTS } from "@/config/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Bot,
  Send,
  AlertTriangle,
  Lightbulb,
  TrendingUp,
  TrendingDown,
  Users,
  Loader2,
  X,
  ChevronDown,
  ChevronUp,
  Sparkles,
  MessageSquare,
  Mic,
  MicOff,
  Volume2,
  VolumeX
} from "lucide-react";
import { useVoiceChat, useTextToSpeech } from "@/hooks/useVoiceChat";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

interface ProactiveInsight {
  id: string;
  insight_type: string;
  priority: string;
  title: string;
  content: string;
  action_items: any[];
  affected_entities: any;
  is_dismissed?: boolean;
  created_at: string;
}

export function AIAssistantPanel() {
  const [query, setQuery] = useState("");
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  const [isExpanded, setIsExpanded] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Voice chat hooks
  const {
    isListening,
    isSupported: voiceInputSupported,
    transcript,
    toggleListening,
    clearTranscript,
  } = useVoiceChat({
    onTranscript: (text) => {
      setQuery(text);
      clearTranscript();
    },
    onError: (error) => {
      toast({
        title: "Voice Input Error",
        description: error,
        variant: "destructive"
      });
    },
  });

  const {
    isSpeaking,
    isSupported: voiceOutputSupported,
    speak,
    stop: stopSpeaking,
  } = useTextToSpeech();

  // Fetch proactive insights (gracefully handles missing table)
  const { data: insights, refetch: refetchInsights } = useQuery({
    queryKey: ["proactive-insights"],
    queryFn: async (): Promise<ProactiveInsight[]> => {
      try {
        // Using raw query since table may not exist in schema yet
        const { data, error } = await (supabase as any)
          .from("proactive_insights")
          .select("*")
          .eq("is_dismissed", false)
          .order("created_at", { ascending: false })
          .limit(5);

        if (error) {
          // Table might not exist yet - that's okay
          if (error.code === "42P01" || error.message?.includes("does not exist")) {
            console.info("proactive_insights table not yet created");
            return [];
          }
          console.error("Error fetching insights:", error);
          return [];
        }
        return (data || []) as ProactiveInsight[];
      } catch (e) {
        console.error("Error in insights query:", e);
        return [];
      }
    },
    staleTime: Infinity, // Real-time updates via subscriptions
    retry: false
  });

  // Fetch conversation history (gracefully handles missing table)
  const { data: messages, refetch: refetchMessages } = useQuery({
    queryKey: ["agent-messages", sessionId],
    queryFn: async (): Promise<Message[]> => {
      try {
        // Using raw query since table may not exist in schema yet
        const { data, error } = await (supabase as any)
          .from("agent_conversations")
          .select("*")
          .eq("session_id", sessionId)
          .order("created_at", { ascending: true });

        if (error) {
          // Table might not exist yet - that's okay
          if (error.code === "42P01" || error.message?.includes("does not exist")) {
            console.info("agent_conversations table not yet created");
            return [];
          }
          console.error("Error fetching messages:", error);
          return [];
        }
        return (data || []) as Message[];
      } catch (e) {
        console.error("Error in messages query:", e);
        return [];
      }
    },
    refetchInterval: false,
    retry: false
  });

  // Send message to agent
  const sendMessage = useMutation({
    mutationFn: async (message: string) => {
      const response = await fetch(getApiUrl(API_ENDPOINTS.agent), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          thread_id: sessionId
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || data?.message || "Agent error");
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      refetchMessages();

      // Speak the AI response if voice is enabled
      if (voiceEnabled && voiceOutputSupported && data?.response) {
        const textToSpeak = data.response.replace(/[#*`_]/g, '').substring(0, 500);
        speak(textToSpeak);
      }
    },
    onError: (error: any) => {
      console.error("Error sending message:", error);
      toast({
        title: "AI Agent Error",
        description: error?.message || "Failed to get response. Make sure the agent is deployed and ANTHROPIC_API_KEY is set.",
        variant: "destructive"
      });
    }
  });

  // Dismiss insight
  const dismissInsight = useMutation({
    mutationFn: async (insightId: string) => {
      const { error } = await (supabase as any)
        .from("proactive_insights")
        .update({ is_dismissed: true })
        .eq("id", insightId);

      if (error) throw error;
    },
    onSuccess: () => {
      refetchInsights();
    }
  });

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (query.trim() && !sendMessage.isPending) {
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

  const handleQuickAction = (prompt: string) => {
    setQuery(prompt);
    sendMessage.mutate(prompt);
    setQuery("");
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical":
        return "destructive";
      case "high":
        return "destructive";
      case "medium":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case "alert":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case "pattern":
        return <TrendingUp className="h-4 w-4 text-blue-500" />;
      case "recommendation":
        return <Lightbulb className="h-4 w-4 text-yellow-500" />;
      default:
        return <Sparkles className="h-4 w-4 text-purple-500" />;
    }
  };

  const unreadInsights = insights?.filter(i => !i.is_dismissed) || [];
  const criticalCount = unreadInsights.filter(i => i.priority === "critical" || i.priority === "high").length;

  return (
    <Card className="h-full flex flex-col shadow-lg border-2 border-primary/20">
      {/* Header */}
      <CardHeader className="py-3 px-4 border-b bg-gradient-to-r from-primary/10 to-purple-500/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-primary rounded-lg">
              <Bot className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="text-base">PTD Intelligence</CardTitle>
              <p className="text-xs text-muted-foreground">AI-powered insights</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {criticalCount > 0 && (
              <Badge variant="destructive" className="animate-pulse">
                {criticalCount} alerts
              </Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <>
          {/* Proactive Insights */}
          {unreadInsights.length > 0 && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 border-b">
              <div className="text-sm font-medium mb-2 flex items-center gap-1">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                Proactive Insights
              </div>
              <div className="space-y-2 max-h-[150px] overflow-y-auto">
                {unreadInsights.slice(0, 3).map(insight => (
                  <div
                    key={insight.id}
                    className="text-sm p-2 bg-white dark:bg-gray-800 rounded-lg border cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-start gap-2"
                    onClick={() => handleQuickAction(`Tell me more about: ${insight.title}`)}
                  >
                    {getInsightIcon(insight.insight_type)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant={getPriorityColor(insight.priority) as any} className="text-xs">
                          {insight.priority}
                        </Badge>
                        <span className="font-medium truncate">{insight.title}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-1">
                        {insight.content.substring(0, 80)}...
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        dismissInsight.mutate(insight.id);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          <CardContent className="flex-1 p-0 overflow-hidden">
            <ScrollArea className="h-[300px] p-4">
              {!messages?.length ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mb-3 opacity-50" />
                  <p className="text-sm">Ask me anything about your clients</p>
                  <p className="text-xs mt-1">I know all your formulas and rules</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] p-3 rounded-lg ${msg.role === "user"
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
                        <span className="text-sm">Analyzing...</span>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>
          </CardContent>

          {/* Quick Actions */}
          <div className="p-2 border-t bg-muted/30">
            <div className="flex gap-1.5 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={() => handleQuickAction("Who needs immediate attention today?")}
              >
                <AlertTriangle className="h-3 w-3 mr-1 text-red-500" />
                Critical
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={() => handleQuickAction("Which coaches have the most declining clients?")}
              >
                <Users className="h-3 w-3 mr-1 text-orange-500" />
                Coaches
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={() => handleQuickAction("Show me early warning signs - GREEN clients that are declining")}
              >
                <TrendingDown className="h-3 w-3 mr-1 text-yellow-500" />
                Warnings
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={() => handleQuickAction("Explain how the health score is calculated")}
              >
                <Lightbulb className="h-3 w-3 mr-1 text-blue-500" />
                Formula
              </Button>
            </div>
          </div>

          <Separator />

          {/* Input */}
          <div className="p-3 flex gap-2">
            {/* Voice transcript indicator */}
            {isListening && (
              <div className="absolute bottom-full left-3 mb-1 text-xs text-primary animate-pulse flex items-center gap-1">
                <Mic className="h-3 w-3" />
                <span>Listening... {transcript && `"${transcript}"`}</span>
              </div>
            )}

            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask about clients, trends, interventions..."
              className="text-sm"
              onKeyDown={handleKeyDown}
              disabled={sendMessage.isPending}
            />

            {/* Voice input button */}
            {voiceInputSupported && (
              <Button
                size="icon"
                variant={isListening ? "destructive" : "outline"}
                onClick={toggleListening}
                disabled={sendMessage.isPending}
                title={isListening ? 'Stop recording' : 'Start voice input'}
              >
                {isListening ? (
                  <MicOff className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </Button>
            )}

            {/* Voice output toggle */}
            {voiceOutputSupported && (
              <Button
                size="icon"
                variant={voiceEnabled ? "default" : "outline"}
                onClick={() => {
                  setVoiceEnabled(!voiceEnabled);
                  if (!voiceEnabled && isSpeaking) {
                    stopSpeaking();
                  }
                }}
                title={voiceEnabled ? 'Disable voice output' : 'Enable voice output'}
              >
                {voiceEnabled ? (
                  <Volume2 className="h-4 w-4" />
                ) : (
                  <VolumeX className="h-4 w-4" />
                )}
              </Button>
            )}

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
        </>
      )}
    </Card>
  );
}

// Floating AI Button (for minimal mode)
export function AIAssistantButton({ onClick }: { onClick: () => void }) {
  const { data: insights } = useQuery({
    queryKey: ["proactive-insights-count"],
    queryFn: async (): Promise<number> => {
      try {
        const { count, error } = await (supabase as any)
          .from("proactive_insights")
          .select("*", { count: "exact", head: true })
          .eq("is_dismissed", false)
          .in("priority", ["critical", "high"]);

        if (error) return 0;
        return count || 0;
      } catch {
        return 0;
      }
    },
    staleTime: Infinity, // Real-time updates via subscriptions
    retry: false
  });

  return (
    <Button
      onClick={onClick}
      className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
      size="icon"
    >
      <Bot className="h-6 w-6" />
      {insights && insights > 0 && (
        <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full h-5 w-5 text-xs flex items-center justify-center animate-pulse">
          {insights}
        </span>
      )}
    </Button>
  );
}

export default AIAssistantPanel;
