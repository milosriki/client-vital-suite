import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Zap, UserPlus, FileText, Search, RefreshCw } from 'lucide-react';

export function QuickActionsPanel() {
  const [contactId, setContactId] = useState('');
  const [newOwnerId, setNewOwnerId] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Fetch owners for dropdown
  const { data: ownersData } = useQuery({
    queryKey: ['hubspot-owners-actions'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('hubspot-live-query', {
        body: { query: 'owners' }
      });
      if (error) throw error;
      return data;
    },
    staleTime: 300000,
  });

  // Reassign mutation
  const reassignMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('hubspot-live-query', {
        body: {
          query: 'reassign',
          contact_id: contactId,
          new_owner_id: newOwnerId,
        }
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Reassignment failed');
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Owner Reassigned',
        description: `Contact ${contactId} → ${data.new_owner_name}`,
      });
      setContactId('');
      setNewOwnerId('');
    },
    onError: (error: any) => {
      toast({
        title: 'Reassignment Failed',
        description: error.message || 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  // Log note mutation
  const logNoteMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('hubspot-live-query', {
        body: {
          query: 'log_note',
          contact_id: contactId,
          note_body: noteBody,
        }
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Note logging failed');
      return data;
    },
    onSuccess: () => {
      toast({
        title: 'Note Logged',
        description: 'Note added to contact successfully',
      });
      setNoteBody('');
      setContactId('');
    },
    onError: (error: any) => {
      toast({
        title: 'Note Logging Failed',
        description: error.message || 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  // Search contacts
  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    
    setIsSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke('hubspot-live-query', {
        body: {
          query: 'search',
          search_term: searchTerm,
          limit: 20,
        }
      });
      if (error) throw error;
      setSearchResults(data?.contacts || []);
    } catch (error: any) {
      toast({
        title: 'Search Failed',
        description: error.message || 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Quick Actions
        </CardTitle>
        <CardDescription>
          Reassign contacts, log notes, and search quickly
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Search Contacts */}
        <div className="space-y-2">
          <Label>Search Contacts</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Search by name, email, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={isSearching}>
              {isSearching ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>
          {searchResults.length > 0 && (
            <div className="border rounded-lg p-2 max-h-40 overflow-y-auto space-y-1">
              {searchResults.map((contact: any) => (
                <div
                  key={contact.id}
                  className="p-2 hover:bg-muted rounded cursor-pointer"
                  onClick={() => {
                    setContactId(contact.id);
                    setSearchTerm(contact.name);
                    setSearchResults([]);
                  }}
                >
                  <div className="font-medium">{contact.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {contact.email} • {contact.phone}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Owner: {contact.owner}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reassign Owner */}
        <div className="space-y-2">
          <Label>Reassign Contact Owner</Label>
          <div className="space-y-2">
            <Input
              placeholder="Contact ID"
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
            />
            <Select value={newOwnerId} onValueChange={setNewOwnerId}>
              <SelectTrigger>
                <SelectValue placeholder="Select new owner" />
              </SelectTrigger>
              <SelectContent>
                {(ownersData?.owners || []).map((owner: any) => (
                  <SelectItem key={owner.id} value={owner.id}>
                    {owner.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => reassignMutation.mutate()}
              disabled={!contactId || !newOwnerId || reassignMutation.isPending}
              className="w-full"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              {reassignMutation.isPending ? 'Reassigning...' : 'Reassign Owner'}
            </Button>
          </div>
        </div>

        {/* Log Note */}
        <div className="space-y-2">
          <Label>Log Note to Contact</Label>
          <div className="space-y-2">
            <Input
              placeholder="Contact ID"
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
            />
            <Textarea
              placeholder="Enter note content..."
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
              rows={4}
            />
            <Button
              onClick={() => logNoteMutation.mutate()}
              disabled={!contactId || !noteBody.trim() || logNoteMutation.isPending}
              className="w-full"
            >
              <FileText className="h-4 w-4 mr-2" />
              {logNoteMutation.isPending ? 'Logging...' : 'Log Note'}
            </Button>
          </div>
        </div>

        {/* Bulk Actions */}
        <div className="pt-4 border-t">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full">
                Bulk Reassign (SLA Breach)
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Bulk Reassign</DialogTitle>
                <DialogDescription>
                  Reassign contacts that have breached SLA (not contacted within 30 minutes)
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  This will automatically reassign contacts that haven't been contacted within the SLA timeframe.
                </div>
                <Button className="w-full">
                  Run Bulk Reassign
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}


