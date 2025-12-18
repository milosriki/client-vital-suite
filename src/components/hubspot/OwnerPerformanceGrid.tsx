import { useDedupedQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RefreshCw, Users, DollarSign, Search, TrendingUp, TrendingDown } from 'lucide-react';
import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { useDedupedQuery } from "@/hooks/useDedupedQuery";

interface OwnerStats {
  id: string;
  name: string;
  email: string;
  contactsCount: number;
  dealsCount: number;
  dealsValue: number;
  recentActivity: number;
}

export function OwnerPerformanceGrid() {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'contacts' | 'deals' | 'value'>('contacts');

  // Fetch owners
  const { data: ownersData, isLoading: ownersLoading, refetch: refetchOwners } = useDedupedQuery({
    queryKey: ['hubspot-owners-grid'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('hubspot-live-query', {
        body: { query: 'owners' }
      });
      if (error) throw error;
      return data;
    },
    staleTime: 300000, // Cache for 5 minutes
  });

  // Fetch latest contacts to count per owner
  const { data: contactsData } = useDedupedQuery({
    queryKey: ['hubspot-contacts-for-owners'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('hubspot-live-query', {
        body: { query: 'latest_contacts', limit: 500 }
      });
      if (error) throw error;
      return data;
    },
    staleTime: 300000,
  });

  // Fetch latest deals to count per owner
  const { data: dealsData } = useDedupedQuery({
    queryKey: ['hubspot-deals-for-owners'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('hubspot-live-query', {
        body: { query: 'latest_deals', limit: 500 }
      });
      if (error) throw error;
      return data;
    },
    staleTime: 300000,
  });

  // Calculate owner stats
  const ownerStats = useMemo(() => {
    if (!ownersData?.owners) return [];

    const statsMap = new Map<string, OwnerStats>();

    // Initialize all owners
    ownersData.owners.forEach((owner: any) => {
      statsMap.set(owner.id, {
        id: owner.id,
        name: owner.name,
        email: owner.email,
        contactsCount: 0,
        dealsCount: 0,
        dealsValue: 0,
        recentActivity: 0,
      });
    });

    // Count contacts per owner
    if (contactsData?.contacts) {
      contactsData.contacts.forEach((contact: any) => {
        if (contact.owner_id && statsMap.has(contact.owner_id)) {
          const stats = statsMap.get(contact.owner_id)!;
          stats.contactsCount++;
          // Count recent activity (contacts modified in last 24h)
          const lastModified = contact.last_modified ? new Date(contact.last_modified) : null;
          if (lastModified && (Date.now() - lastModified.getTime()) < 24 * 60 * 60 * 1000) {
            stats.recentActivity++;
          }
        }
      });
    }

    // Count deals per owner
    if (dealsData?.deals) {
      dealsData.deals.forEach((deal: any) => {
        if (deal.owner_id && statsMap.has(deal.owner_id)) {
          const stats = statsMap.get(deal.owner_id)!;
          stats.dealsCount++;
          stats.dealsValue += deal.amount || 0;
        }
      });
    }

    return Array.from(statsMap.values());
  }, [ownersData, contactsData, dealsData]);

  // Filter and sort
  const filteredAndSorted = useMemo(() => {
    let filtered = ownerStats;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(owner =>
        owner.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        owner.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'contacts':
          return b.contactsCount - a.contactsCount;
        case 'deals':
          return b.dealsCount - a.dealsCount;
        case 'value':
          return b.dealsValue - a.dealsValue;
        default:
          return 0;
      }
    });

    return filtered;
  }, [ownerStats, searchTerm, sortBy]);

  // Calculate load balance
  const loadBalance = useMemo(() => {
    if (ownerStats.length === 0) return 0;
    const contacts = ownerStats.map(o => o.contactsCount);
    const max = Math.max(...contacts);
    const min = Math.min(...contacts);
    return max - min;
  }, [ownerStats]);

  if (ownersLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Owner Performance</CardTitle>
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
              <Users className="h-5 w-5" />
              Owner Performance
            </CardTitle>
            <CardDescription>
              {ownerStats.length} team members • Load balance: {loadBalance} contacts
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetchOwners()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search and Sort */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search owners..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 border rounded-md text-sm"
          >
            <option value="contacts">Sort by Contacts</option>
            <option value="deals">Sort by Deals</option>
            <option value="value">Sort by Value</option>
            <option value="name">Sort by Name</option>
          </select>
        </div>

        {/* Owner Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAndSorted.map((owner) => (
            <Card key={owner.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-4">
                <div className="space-y-3">
                  <div>
                    <h3 className="font-semibold text-lg">{owner.name}</h3>
                    <p className="text-sm text-muted-foreground">{owner.email}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 rounded bg-muted">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="h-3 w-3" />
                        Contacts
                      </div>
                      <div className="text-xl font-bold">{owner.contactsCount}</div>
                    </div>

                    <div className="p-2 rounded bg-muted">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <DollarSign className="h-3 w-3" />
                        Deals
                      </div>
                      <div className="text-xl font-bold">{owner.dealsCount}</div>
                    </div>
                  </div>

                  {owner.dealsValue > 0 && (
                    <div className="p-2 rounded bg-green-50 dark:bg-green-950/20">
                      <div className="text-xs text-muted-foreground">Deal Value</div>
                      <div className="text-lg font-bold text-green-600 dark:text-green-400">
                        {owner.dealsValue.toLocaleString()} AED
                      </div>
                    </div>
                  )}

                  {owner.recentActivity > 0 && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <TrendingUp className="h-3 w-3 text-green-500" />
                      {owner.recentActivity} recent activity
                    </div>
                  )}

                  {owner.contactsCount === 0 && (
                    <Badge variant="outline" className="w-fit">No contacts</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredAndSorted.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No owners found matching your search
          </div>
        )}
      </CardContent>
    </Card>
  );
}

