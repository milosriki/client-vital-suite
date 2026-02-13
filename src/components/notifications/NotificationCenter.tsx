import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Bell, X, Check, AlertTriangle, Info, AlertCircle, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDistanceToNow } from "date-fns";

interface Notification {
  id: string;
  type: "critical" | "important" | "info";
  title: string;
  message: string;
  category: string;
  metadata: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

export const NotificationCenter = () => {
  const [open, setOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const queryClient = useQueryClient();

  // Fetch notifications
  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, type, title, message, category, metadata, read, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as Notification[];
    },
  });

  // Mark as read mutation
  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  // Mark all as read
  const markAllAsRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("read", false);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  // Subscribe to realtime notifications
  useEffect(() => {
    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          const notification = payload.new as Notification;
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
          
          // Play sound for critical/important
          if (soundEnabled && (notification.type === "critical" || notification.type === "important")) {
            playNotificationSound();
          }
          
          // Show browser notification
          showBrowserNotification(notification);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, soundEnabled]);

  // Request notification permission on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const playNotificationSound = () => {
    const audio = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleRkAO5PX4L+XRRQHf63G69uZWjQvZarW5sqccEIhWJ7T5tKpgU4mRYzJzd+3olxCNE+Iz+bbu5JpSjxPjMnm27uSaUo8T4zJ5tu7kmlKPE+MyebbuZJpSjxPjMnm27mSaUo8T4zJ5tu5kmlKPE+MyebauZJpSjtNi8jl2rmSaUo7TYvI5dq5kmlKO02LyOXauZJpSjtNi8jl2rmSaUo7TYvI5dq5kmlKO02LyOXauZJpSjtNi8jk2bmSaUo7TYvI5Nm5kmlKO02KyOTZuZJpSjtNisjk2bmSaUo7TYrI5Nm5kmlKO02KyOTZuZJpSjtNisjk2bmSaUo7TYnI5Nm5kmlKOkyJx+TZuZJpSjpMicfk2bmSaUo6TInH5Nm5kmlKOkyJx+TZuZJpSjpMicfk2bmSaUo6TInH5Nm5kmlKOkyJx+TZuJJpSjpMicfj2biSaUo6TIjH49m4kmlKOkyIx+PZuJJpSjpMiMfj2biSaUo6TIjH49m4kmlKOkyIx+PZuJJpSjpMiMfj2biSaUo6TIjH49m4kmlKOkyIx+PZuJJpSjpMiMfi2biSaUo6TIjG4tm4kmlKOkuIxuLZuJJpSjpLiMbi2biSaUo6S4jG4tm4kmlKOkuIxuLZuJJpSjpLiMbi2biSaUo6S4jG4tm4kmlKOkuIxuLZt5JpSjpLh8bi2beSaUo6S4fG4tm3kmlKOkuHxuLZt5JpSjpLh8bi2beSaUo6S4fG4tm3kmlKOkuHxuLZt5JpSjpLh8bi2beSaUo5S4fF4dm3kmlKOUuHxeHZt5JpSjlLh8Xh2beSaUo5S4fF4dm3kmlKOUuHxeHZt5JpSjlLh8Xh2beSaUo5S4fF4dm3kmlKOUuHxeHZt5JpSjlLh8Xh2beSaUo5S4fF4dm2kmlKOUqGxeHZtpJpSjlKhsXh2baSaUo=");
    audio.volume = 0.3;
    audio.play().catch(() => {}); // Ignore autoplay errors
  };

  const showBrowserNotification = (notification: Notification) => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(notification.title, {
        body: notification.message,
        icon: notification.type === "critical" ? "🚨" : notification.type === "important" ? "⚠️" : "ℹ️",
        tag: notification.id,
      });
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "critical":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "important":
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getTypeBg = (type: string) => {
    switch (type) {
      case "critical":
        return "bg-red-500/10 border-red-500/30";
      case "important":
        return "bg-amber-500/10 border-amber-500/30";
      default:
        return "bg-blue-500/10 border-blue-500/30";
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center bg-red-500 text-white text-xs">
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Notifications</h3>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="h-8 w-8"
            >
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </Button>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => markAllAsRead.mutate()}
                className="text-xs"
              >
                <Check className="h-3 w-3 mr-1" />
                Mark all read
              </Button>
            )}
          </div>
        </div>
        <ScrollArea className="h-[400px]">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-accent/50 cursor-pointer transition-colors ${
                    !notification.read ? "bg-accent/20" : ""
                  }`}
                  onClick={() => !notification.read && markAsRead.mutate(notification.id)}
                >
                  <div className="flex gap-3">
                    <div className={`p-2 rounded-lg ${getTypeBg(notification.type)}`}>
                      {getTypeIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`font-medium text-sm ${!notification.read ? "text-foreground" : "text-muted-foreground"}`}>
                          {notification.title}
                        </p>
                        {!notification.read && (
                          <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
