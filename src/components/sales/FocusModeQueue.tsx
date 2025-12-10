import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Phone, MessageCircle, SkipForward, Clock, MapPin, DollarSign, Zap } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface Lead {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string | null;
  lead_status: string | null;
  location: string | null;
  ai_suggested_reply?: string;
  smart_score?: number;
}

export function FocusModeQueue() {
  const queryClient = useQueryClient();
  const [skipDialogOpen, setSkipDialogOpen] = useState(false);
  const [skipReason, setSkipReason] = useState("");
  const [currentLeadId, setCurrentLeadId] = useState<string | null>(null);

  // Fetch unworked leads sorted by smart score
  const { data: leads, isLoading } = useQuery({
    queryKey: ['focus-queue'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('contact_unworked', true)
        .is('first_outbound_call_time', null)
        .order('created_at', { ascending: true })
        .limit(10);

      if (error) throw error;

      // Calculate smart score based on wait time, location, etc.
      return (data || []).map((lead) => {
        const waitMinutes = Math.floor(
          (new Date().getTime() - new Date(lead.created_at || '').getTime()) / 60000
        );
        
        // Smart score: higher is more urgent
        let score = 0;
        score += Math.min(waitMinutes * 2, 100); // Wait time weight
        if (lead.city === 'Dubai') score += 20;
        if (lead.neighborhood) score += 10;
        
        return {
          ...lead,
          smart_score: score,
          wait_time_minutes: waitMinutes,
        };
      }).sort((a, b) => (b.smart_score || 0) - (a.smart_score || 0));
    },
    refetchInterval: 30000,
  });

  const logAction = useMutation({
    mutationFn: async ({ leadId, action }: { leadId: string; action: string }) => {
      // Update contact to mark as worked
      if (action === 'call' || action === 'whatsapp') {
        await supabase
          .from('contacts')
          .update({ 
            contact_unworked: false,
            first_outbound_call_time: new Date().toISOString(),
            last_activity_date: new Date().toISOString(),
          })
          .eq('id', leadId);
      }
      
      // Log activity in contact_activities
      await supabase
        .from('contact_activities')
        .insert({
          contact_id: leadId,
          activity_type: action,
          activity_title: `Focus Mode: ${action}`,
          activity_description: `${action} action taken via Focus Mode Queue`,
          occurred_at: new Date().toISOString(),
        });

      return { success: true };
    },
    onSuccess: (_, { action }) => {
      toast.success(`${action === 'call' ? 'Call initiated' : 'WhatsApp opened'}`);
      queryClient.invalidateQueries({ queryKey: ['focus-queue'] });
    },
  });

  const skipLead = useMutation({
    mutationFn: async ({ leadId, reason }: { leadId: string; reason: string }) => {
      // Log skip activity
      await supabase
        .from('contact_activities')
        .insert({
          contact_id: leadId,
          activity_type: 'skip',
          activity_title: 'Lead Skipped',
          activity_description: `Lead skipped: ${reason}`,
          occurred_at: new Date().toISOString(),
        });

      // Increment reassignation count
      const { data: contact } = await supabase
        .from('contacts')
        .select('count_of_reassignations')
        .eq('id', leadId)
        .single();

      await supabase
        .from('contacts')
        .update({ 
          count_of_reassignations: (contact?.count_of_reassignations || 0) + 1,
        })
        .eq('id', leadId);

      return { success: true };
    },
    onSuccess: () => {
      toast.info('Lead skipped');
      setSkipDialogOpen(false);
      setSkipReason("");
      queryClient.invalidateQueries({ queryKey: ['focus-queue'] });
    },
  });

  const handleAction = (leadId: string, action: 'call' | 'whatsapp') => {
    const lead = leads?.find(l => l.id === leadId);
    
    if (action === 'call' && lead?.phone) {
      window.open(`tel:${lead.phone}`, '_blank');
    } else if (action === 'whatsapp' && lead?.phone) {
      const message = encodeURIComponent(`Hi ${lead.first_name || ''}, following up on your inquiry...`);
      window.open(`https://wa.me/${lead.phone.replace(/\D/g, '')}?text=${message}`, '_blank');
    }
    
    logAction.mutate({ leadId, action });
  };

  const handleSkipClick = (leadId: string) => {
    setCurrentLeadId(leadId);
    setSkipDialogOpen(true);
  };

  const confirmSkip = () => {
    if (currentLeadId && skipReason.trim()) {
      skipLead.mutate({ leadId: currentLeadId, reason: skipReason });
    } else {
      toast.error('Please provide a reason for skipping');
    }
  };

  const nextLead = leads?.[0];

  if (isLoading) {
    return (
      <div className="max-w-xl mx-auto mt-8">
        <Card className="animate-pulse">
          <CardContent className="h-64" />
        </Card>
      </div>
    );
  }

  if (!nextLead) {
    return (
      <div className="max-w-xl mx-auto mt-8 text-center">
        <Card className="border-green-500 bg-green-50 dark:bg-green-900/20">
          <CardContent className="pt-8 pb-8">
            <div className="text-6xl mb-4">🎉</div>
            <h3 className="text-xl font-bold text-green-700 dark:text-green-400">All caught up!</h3>
            <p className="text-muted-foreground mt-2">No leads waiting in the queue</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const waitMinutes = Math.floor(
    (new Date().getTime() - new Date(nextLead.created_at || '').getTime()) / 60000
  );

  return (
    <div className="max-w-xl mx-auto mt-8">
      <div className="text-center mb-4">
        <Badge variant="default" className="bg-green-500 animate-pulse">
          <Zap className="h-3 w-3 mr-1" />
          LIVE OPPORTUNITY
        </Badge>
        <p className="text-xs text-muted-foreground mt-2">
          {leads?.length || 0} leads in queue
        </p>
      </div>
      
      <Card className="border-2 border-primary shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center justify-between">
            {nextLead.first_name} {nextLead.last_name}
            <Badge variant={waitMinutes > 30 ? "destructive" : waitMinutes > 15 ? "secondary" : "outline"}>
              <Clock className="h-3 w-3 mr-1" />
              {waitMinutes}m wait
            </Badge>
          </CardTitle>
          <CardDescription className="flex items-center gap-4">
            {nextLead.phone && <span>{nextLead.phone}</span>}
            {nextLead.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {nextLead.location}
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* AI Suggested Opening */}
          <div className="bg-muted p-4 rounded-lg text-sm">
            <strong className="text-xs text-muted-foreground uppercase">AI Suggested Opening:</strong>
            <p className="mt-1 italic">
              "Hi {nextLead.first_name}, saw you were interested in personal training. Would love to chat about your fitness goals!"
            </p>
          </div>
          
          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Button 
              onClick={() => handleAction(nextLead.id, 'call')} 
              size="lg" 
              className="w-full bg-green-600 hover:bg-green-700"
              disabled={logAction.isPending}
            >
              <Phone className="h-4 w-4 mr-2" />
              Call Now
            </Button>
            <Button 
              onClick={() => handleAction(nextLead.id, 'whatsapp')} 
              variant="outline" 
              size="lg" 
              className="w-full"
              disabled={logAction.isPending}
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              WhatsApp
            </Button>
          </div>
          
          {/* Skip Button */}
          <div className="text-center pt-2">
            <button 
              className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 mx-auto"
              onClick={() => handleSkipClick(nextLead.id)}
            >
              <SkipForward className="h-3 w-3" />
              Skip (Requires Reason)
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Skip Reason Dialog */}
      <Dialog open={skipDialogOpen} onOpenChange={setSkipDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Skip this lead?</DialogTitle>
            <DialogDescription>
              Please provide a reason for skipping. This will be logged for review.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Enter reason (e.g., Wrong number, Already contacted, etc.)"
            value={skipReason}
            onChange={(e) => setSkipReason(e.target.value)}
            className="min-h-[100px]"
          />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setSkipDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmSkip}
              disabled={!skipReason.trim() || skipLead.isPending}
            >
              Confirm Skip
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
