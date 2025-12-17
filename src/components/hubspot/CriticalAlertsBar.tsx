import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Users, Clock, DollarSign, MessageSquare, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface Alert {
  type: 'unassigned' | 'sla_breach' | 'stuck_deal' | 'conversation';
  count: number;
  label: string;
  color: string;
  icon: React.ReactNode;
  onClick?: () => void;
}

export function CriticalAlertsBar() {
  const navigate = useNavigate();

  // Fetch today's activity to calculate alerts
  const { data: todayData, isLoading, refetch } = useQuery({
    queryKey: ['hubspot-critical-alerts'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('hubspot-live-query', {
        body: { query: 'today_activity' }
      });
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch latest contacts to check for unassigned
  const { data: contactsData } = useQuery({
    queryKey: ['hubspot-latest-contacts-alerts'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('hubspot-live-query', {
        body: { query: 'latest_contacts', limit: 100 }
      });
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });

  // Fetch conversations
  const { data: conversationsData } = useQuery({
    queryKey: ['hubspot-conversations-alerts'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('hubspot-live-query', {
        body: { query: 'conversations', limit: 50 }
      });
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });

  // Calculate alerts
  const alerts: Alert[] = [];

  if (todayData) {
    // Unassigned premium leads (premium locations: Marina, Downtown, DIFC, JBR, Arabian Ranches, Jumeirah)
    const premiumLocations = ['marina', 'downtown', 'difc', 'jbr', 'arabian ranches', 'jumeirah'];
    const unassignedPremium = (todayData.new_contacts || []).filter((c: any) => 
      !c.owner_id && premiumLocations.some(loc => c.city?.toLowerCase().includes(loc))
    );
    
    if (unassignedPremium.length > 0) {
      alerts.push({
        type: 'unassigned',
        count: unassignedPremium.length,
        label: `Unassigned Premium Lead${unassignedPremium.length > 1 ? 's' : ''}`,
        color: 'bg-red-500',
        icon: <Users className="h-4 w-4" />,
        onClick: () => navigate('/ptd-control?tab=hubspot&filter=unassigned_premium')
      });
    }

    // SLA breaches (contacts created today but not contacted - assuming 30min SLA)
    const now = new Date();
    const slaBreaches = (todayData.new_contacts || []).filter((c: any) => {
      if (c.owner_id) return false; // Assigned contacts might be OK
      const created = new Date(c.created_at);
      const minutesSince = (now.getTime() - created.getTime()) / (1000 * 60);
      return minutesSince > 30; // 30 minute SLA
    });

    if (slaBreaches.length > 0) {
      alerts.push({
        type: 'sla_breach',
        count: slaBreaches.length,
        label: `SLA Breach${slaBreaches.length > 1 ? 'es' : ''}`,
        color: 'bg-orange-500',
        icon: <Clock className="h-4 w-4" />,
        onClick: () => navigate('/ptd-control?tab=hubspot&filter=sla_breach')
      });
    }
  }

  // Stuck deals (deals in same stage >7 days) - would need deal detail data
  // For now, we'll show if there are deals without recent activity
  if (todayData?.new_deals) {
    const stuckDeals = todayData.new_deals.filter((d: any) => {
      // This is simplified - ideally we'd check last_modified vs created_at
      return d.amount > 10000; // High value deals
    });
    
    if (stuckDeals.length > 0 && stuckDeals.length < todayData.new_deals.length) {
      alerts.push({
        type: 'stuck_deal',
        count: stuckDeals.length,
        label: `High-Value Deal${stuckDeals.length > 1 ? 's' : ''}`,
        color: 'bg-yellow-500',
        icon: <DollarSign className="h-4 w-4" />,
        onClick: () => navigate('/ptd-control?tab=hubspot&filter=high_value')
      });
    }
  }

  // Open conversations
  if (conversationsData?.conversations) {
    const openConversations = conversationsData.conversations.filter((c: any) => 
      c.status === 'OPEN' || !c.assigned_to
    );
    
    if (openConversations.length > 0) {
      alerts.push({
        type: 'conversation',
        count: openConversations.length,
        label: `Open Conversation${openConversations.length > 1 ? 's' : ''}`,
        color: 'bg-blue-500',
        icon: <MessageSquare className="h-4 w-4" />,
        onClick: () => navigate('/ptd-control?tab=hubspot&view=conversations')
      });
    }
  }

  // Overall unassigned contacts (from latest contacts)
  if (contactsData?.contacts) {
    const unassigned = contactsData.contacts.filter((c: any) => !c.owner_id);
    if (unassigned.length > 0 && !alerts.find(a => a.type === 'unassigned')) {
      alerts.push({
        type: 'unassigned',
        count: unassigned.length,
        label: `Unassigned Contact${unassigned.length > 1 ? 's' : ''}`,
        color: 'bg-red-500',
        icon: <Users className="h-4 w-4" />,
        onClick: () => navigate('/ptd-control?tab=hubspot&filter=unassigned')
      });
    }
  }

  if (isLoading) {
    return (
      <div className="border-b bg-muted/50 p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Loading alerts...
        </div>
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="border-b bg-green-50 dark:bg-green-950/20 p-4">
        <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
          <AlertTriangle className="h-4 w-4" />
          All systems operational - no critical alerts
        </div>
      </div>
    );
  }

  return (
    <div className="border-b bg-muted/50 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 flex-wrap">
          {alerts.map((alert, idx) => (
            <Button
              key={idx}
              variant="ghost"
              size="sm"
              onClick={alert.onClick}
              className="h-auto p-2 hover:bg-background"
            >
              <Badge className={`${alert.color} text-white mr-2`}>
                {alert.icon}
              </Badge>
              <span className="font-semibold">{alert.count}</span>
              <span className="text-muted-foreground ml-1">{alert.label}</span>
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <RefreshCw 
            className="h-3 w-3 cursor-pointer hover:text-foreground" 
            onClick={() => refetch()}
          />
          <span>Updated {format(new Date(), 'HH:mm:ss')}</span>
        </div>
      </div>
    </div>
  );
}


