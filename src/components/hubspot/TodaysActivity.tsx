import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { RefreshCw, Users, DollarSign, Phone, TrendingUp, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDedupedQuery } from "@/hooks/useDedupedQuery";

interface TodaysActivityProps {
  ownerFilter?: string;
  sourceFilter?: string;
  locationFilter?: 'all' | 'premium' | 'standard';
}

export function TodaysActivity({
  ownerFilter,
  sourceFilter,
  locationFilter = 'all'
}: TodaysActivityProps) {
  const [selectedOwner, setSelectedOwner] = useState<string>(ownerFilter || 'all');
  const [selectedSource, setSelectedSource] = useState<string>(sourceFilter || 'all');

  const { data, isLoading, refetch } = useDedupedQuery({
    queryKey: ['hubspot-today-activity', selectedOwner, selectedSource, locationFilter],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('hubspot-live-query', {
        body: { query: 'today_activity' }
      });
      if (error) throw error;
      return data;
    },
    staleTime: Infinity, // Real-time updates via useVitalState
  });

  // Fetch owners for filter dropdown
  const { data: ownersData } = useDedupedQuery({
    queryKey: ['hubspot-owners-filter'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('hubspot-live-query', {
        body: { query: 'owners' }
      });
      if (error) throw error;
      return data;
    },
    staleTime: 300000, // Cache for 5 minutes
  });

  // Filter data
  let filteredContacts = data?.new_contacts || [];
  let filteredDeals = data?.new_deals || [];

  if (selectedOwner !== 'all') {
    filteredContacts = filteredContacts.filter((c: any) => c.owner_id === selectedOwner);
    filteredDeals = filteredDeals.filter((d: any) => d.owner_id === selectedOwner);
  }

  if (selectedSource !== 'all') {
    filteredContacts = filteredContacts.filter((c: any) =>
      c.source?.toLowerCase().includes(selectedSource.toLowerCase())
    );
  }

  if (locationFilter === 'premium') {
    const premiumLocations = ['marina', 'downtown', 'difc', 'jbr', 'arabian ranches', 'jumeirah'];
    filteredContacts = filteredContacts.filter((c: any) =>
      premiumLocations.some(loc => c.city?.toLowerCase().includes(loc))
    );
  } else if (locationFilter === 'standard') {
    const premiumLocations = ['marina', 'downtown', 'difc', 'jbr', 'arabian ranches', 'jumeirah'];
    filteredContacts = filteredContacts.filter((c: any) =>
      !premiumLocations.some(loc => c.city?.toLowerCase().includes(loc))
    );
  }

  // Calculate metrics
  const totalContacts = filteredContacts.length;
  const unassignedContacts = filteredContacts.filter((c: any) => !c.owner_id).length;
  const totalDeals = filteredDeals.length;
  const totalDealValue = filteredDeals.reduce((sum: number, d: any) => sum + (d.amount || 0), 0);
  const premiumContacts = filteredContacts.filter((c: any) => {
    const premiumLocations = ['marina', 'downtown', 'difc', 'jbr', 'arabian ranches', 'jumeirah'];
    return premiumLocations.some(loc => c.city?.toLowerCase().includes(loc));
  }).length;

  // Get unique sources for filter
  const sources = Array.from(new Set(
    (data?.new_contacts || []).map((c: any) => c.source).filter(Boolean)
  ));

  if (isLoading && !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Today's Activity</CardTitle>
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
              Today's Activity
            </CardTitle>
            <CardDescription>
              {format(new Date(data?.date || new Date()), 'EEEE, MMMM d, yyyy')}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          <Select value={selectedOwner} onValueChange={setSelectedOwner}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by owner" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Owners</SelectItem>
              {(ownersData?.owners || []).map((owner: any) => (
                <SelectItem key={owner.id} value={owner.id}>
                  {owner.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedSource} onValueChange={setSelectedSource}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              {sources.map((source: string) => (
                <SelectItem key={source} value={source}>
                  {source}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Hero Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg border bg-muted/50">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">New Contacts</span>
            </div>
            <div className="text-2xl font-bold">{totalContacts}</div>
            {unassignedContacts > 0 && (
              <div className="text-xs text-red-500 mt-1">
                {unassignedContacts} unassigned
              </div>
            )}
          </div>

          <div className="p-4 rounded-lg border bg-muted/50">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">New Deals</span>
            </div>
            <div className="text-2xl font-bold">{totalDeals}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {totalDealValue.toLocaleString()} AED
            </div>
          </div>

          <div className="p-4 rounded-lg border bg-muted/50">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-purple-500" />
              <span className="text-sm text-muted-foreground">Premium Leads</span>
            </div>
            <div className="text-2xl font-bold">{premiumContacts}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {totalContacts > 0 ? Math.round((premiumContacts / totalContacts) * 100) : 0}% of total
            </div>
          </div>

          <div className="p-4 rounded-lg border bg-muted/50">
            <div className="flex items-center gap-2 mb-1">
              <Phone className="h-4 w-4 text-orange-500" />
              <span className="text-sm text-muted-foreground">Assignment Rate</span>
            </div>
            <div className="text-2xl font-bold">
              {totalContacts > 0 ? Math.round(((totalContacts - unassignedContacts) / totalContacts) * 100) : 0}%
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {totalContacts - unassignedContacts} assigned
            </div>
          </div>
        </div>

        {/* Recent Contacts Table */}
        <div>
          <h3 className="text-sm font-semibold mb-2">Recent Contacts</h3>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Location</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContacts.slice(0, 10).map((contact: any) => (
                  <TableRow key={contact.id}>
                    <TableCell className="font-medium">{contact.name}</TableCell>
                    <TableCell className="text-sm">{contact.email || '-'}</TableCell>
                    <TableCell className="text-sm">{contact.phone || '-'}</TableCell>
                    <TableCell>
                      {contact.owner_id ? (
                        <Badge variant="secondary">{contact.owner}</Badge>
                      ) : (
                        <Badge variant="destructive">Unassigned</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{contact.source || '-'}</TableCell>
                    <TableCell className="text-sm">{contact.city || '-'}</TableCell>
                  </TableRow>
                ))}
                {filteredContacts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-4">
                      No contacts found for today
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Recent Deals */}
        {filteredDeals.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-2">Recent Deals</h3>
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Deal Name</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Owner</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDeals.slice(0, 5).map((deal: any) => (
                    <TableRow key={deal.id}>
                      <TableCell className="font-medium">{deal.name}</TableCell>
                      <TableCell className="font-semibold text-green-600">
                        {deal.amount.toLocaleString()} AED
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{deal.stage}</Badge>
                      </TableCell>
                      <TableCell>{deal.owner}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

