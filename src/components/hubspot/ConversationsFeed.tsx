import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, MessageSquare, Clock, User, AlertCircle } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { useState } from 'react';
import { useDedupedQuery } from "@/hooks/useDedupedQuery";

export function ConversationsFeed() {
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'assigned' | 'unassigned'>('all');

  const { data, isLoading, refetch } = useDedupedQuery({
    queryKey: ['hubspot-conversations-feed', filterStatus],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('hubspot-live-query', {
        body: { query: 'conversations', limit: 50 }
      });
      if (error) throw error;
      return data;
    },
    staleTime: Infinity, // Real-time updates via useVitalState
  });

  const conversations = data?.conversations || [];

  // Filter conversations
  const filteredConversations = conversations.filter((conv: any) => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'open') return conv.status === 'OPEN';
    if (filterStatus === 'assigned') return conv.assigned_to;
    if (filterStatus === 'unassigned') return !conv.assigned_to;
    return true;
  });

  // Calculate stats
  const stats = {
    total: conversations.length,
    open: conversations.filter((c: any) => c.status === 'OPEN').length,
    assigned: conversations.filter((c: any) => c.assigned_to).length,
    unassigned: conversations.filter((c: any) => !c.assigned_to).length,
  };

  // Sort by urgency (unassigned first, then by updated_at)
  const sortedConversations = [...filteredConversations].sort((a: any, b: any) => {
    if (!a.assigned_to && b.assigned_to) return -1;
    if (a.assigned_to && !b.assigned_to) return 1;
    const aTime = new Date(a.updated_at || a.created_at).getTime();
    const bTime = new Date(b.updated_at || b.created_at).getTime();
    return bTime - aTime;
  });

  if (isLoading && !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Conversations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Live Conversations
            </CardTitle>
            <CardDescription>
              {stats.total} total • {stats.open} open • {stats.unassigned} unassigned
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filter Buttons */}
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={filterStatus === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterStatus('all')}
          >
            All ({stats.total})
          </Button>
          <Button
            variant={filterStatus === 'open' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterStatus('open')}
          >
            Open ({stats.open})
          </Button>
          <Button
            variant={filterStatus === 'assigned' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterStatus('assigned')}
          >
            Assigned ({stats.assigned})
          </Button>
          <Button
            variant={filterStatus === 'unassigned' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterStatus('unassigned')}
          >
            Unassigned ({stats.unassigned})
          </Button>
        </div>

        {/* Conversations List */}
        <div className="space-y-2">
          {sortedConversations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {data?.note ? (
                <div className="space-y-2">
                  <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground" />
                  <p>{data.note}</p>
                </div>
              ) : (
                'No conversations found'
              )}
            </div>
          ) : (
            sortedConversations.map((conversation: any) => {
              const updatedAt = conversation.updated_at
                ? new Date(conversation.updated_at)
                : conversation.created_at
                  ? new Date(conversation.created_at)
                  : null;
              const timeAgo = updatedAt ? formatDistanceToNow(updatedAt, { addSuffix: true }) : 'Unknown';

              return (
                <Card key={conversation.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={conversation.status === 'OPEN' ? 'default' : 'secondary'}
                          >
                            {conversation.status || 'UNKNOWN'}
                          </Badge>
                          {conversation.channel && (
                            <Badge variant="outline">{conversation.channel}</Badge>
                          )}
                          {!conversation.assigned_to && (
                            <Badge variant="destructive">Unassigned</Badge>
                          )}
                        </div>

                        {conversation.subject && (
                          <h3 className="font-semibold">{conversation.subject}</h3>
                        )}

                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          {conversation.assigned_to && (
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              <span>Assigned</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>Updated {timeAgo}</span>
                          </div>
                          {updatedAt && (
                            <span>
                              {format(updatedAt, 'MMM d, HH:mm')}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        {!conversation.assigned_to && (
                          <Button size="sm" variant="outline">
                            Assign
                          </Button>
                        )}
                        <Button size="sm" variant="ghost">
                          View
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Last Updated */}
        {data?.fetched_at && (
          <div className="text-xs text-muted-foreground text-center pt-2 border-t">
            Last updated: {format(new Date(data.fetched_at), 'HH:mm:ss')}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

