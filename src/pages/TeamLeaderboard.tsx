import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Phone, CheckCircle, TrendingUp, Target, Award, Star, Zap, Clock, DollarSign, Users } from 'lucide-react';
import { useDedupedQuery } from "@/hooks/useDedupedQuery";
import { format, startOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';

export default function TeamLeaderboard() {
  // Fetch real-time business metrics from daily_business_metrics table
  const { data: dailyMetrics } = useDedupedQuery({
    queryKey: ['daily-business-metrics-leaderboard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_business_metrics')
        .select('*')
        .order('date', { ascending: false })
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    }
  });

  const { data: teamData, isLoading } = useDedupedQuery({
    queryKey: ['team-leaderboard'],
    queryFn: async () => {
      const thisMonth = format(startOfMonth(new Date()), 'yyyy-MM-dd');

      // 1. Fetch Setter Performance (Call records + Leads set)
      const { data: calls, error: callError } = await supabase
        .from('call_records')
        .select('hubspot_owner_id, call_status, duration_seconds')
        .gte('started_at', thisMonth);

      const { data: setLeads, error: leadError } = await supabase
        .from('leads')
        .select('owner_id, status')
        .neq('owner_id', null);

      // 2. Fetch Coach Performance (Deals closed + Revenue) - using real-time data from deals table
      const { data: deals, error: dealError } = await supabase
        .from('deals')
        .select('closer_id, deal_value, cash_collected, status, deal_name')
        .gte('close_date', thisMonth);

      // 3. Fetch Staff Names - fallback to contacts if staff table doesn't exist
      const { data: staff, error: staffError } = await supabase
        .from('staff')
        .select('id, name, role, hubspot_owner_id');

      // If staff table doesn't exist, create a basic staff list from unique owners
      const staffList = staff || [];
      
      if (staffError || staffList.length === 0) {
        // Fallback: get unique owners from contacts
        const { data: contacts } = await supabase
          .from('contacts')
          .select('owner_id, owner_name')
          .not('owner_id', 'is', null)
          .limit(100);
        
        const uniqueOwners = new Map();
        contacts?.forEach(c => {
          if (c.owner_id && !uniqueOwners.has(c.owner_id)) {
            uniqueOwners.set(c.owner_id, {
              id: c.owner_id,
              name: c.owner_name || c.owner_id,
              role: 'setter',
              hubspot_owner_id: c.owner_id
            });
          }
        });
        staffList.push(...Array.from(uniqueOwners.values()));
      }

      if (callError || leadError || dealError) throw new Error("Data fetch error");

      const staffMap = Object.fromEntries(staffList.map(s => [s.hubspot_owner_id || s.id, s]) || []);

      const performance: Record<string, any> = {};

      // Initialize performance for all staff
      staffList.forEach(s => {
        performance[s.name] = { 
          name: s.name, 
          role: s.role, 
          calls: 0, 
          bookings: 0, 
          revenue: 0, 
          cashCollected: 0,
          closed: 0,
          points: 0 
        };
      });

      // Aggregate Setter Stats
      calls?.forEach(c => {
        const person = staffMap[c.hubspot_owner_id || ''];
        if (person) {
          performance[person.name].calls += 1;
          performance[person.name].points += 1; // 1pt per call
        }
      });

      setLeads?.forEach(l => {
        const person = staffMap[l.owner_id || ''];
        if (person && (l.status === 'appointment_set' || l.status === 'appointment_held')) {
          performance[person.name].bookings += 1;
          performance[person.name].points += 10; // 10pts per booking
        }
      });

      // Aggregate Coach Stats with real-time revenue from deals
      deals?.forEach(d => {
        const person = staffMap[d.closer_id || ''];
        if (person && d.status === 'closed') {
          performance[person.name].closed += 1;
          performance[person.name].revenue += parseFloat(String(d.deal_value) || '0');
          performance[person.name].cashCollected += parseFloat(String(d.cash_collected) || '0');
          performance[person.name].points += 50; // 50pts per close
        }
      });

      return Object.values(performance).sort((a, b) => b.points - a.points);
    }
  });

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Team Performance War Room</h1>
          <p className="text-muted-foreground">Monthly Rankings: Setters vs. Coaches Performance</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-yellow-500/10 rounded-full border border-yellow-500/20">
          <Award className="h-4 w-4 text-yellow-500" />
          <span className="text-sm font-bold text-yellow-500">Season: January 2026</span>
        </div>
      </div>

            {/* Real-time Business Metrics Summary */}
            {dailyMetrics && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-card/50 border-border/50">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Today's Revenue</span>
                      <DollarSign className="h-4 w-4 text-green-400" />
                    </div>
                    <div className="text-2xl font-bold font-mono text-green-400">
                      AED {(dailyMetrics.total_revenue_booked || 0).toLocaleString()}
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-card/50 border-border/50">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Deals Closed</span>
                      <Target className="h-4 w-4 text-purple-400" />
                    </div>
                    <div className="text-2xl font-bold font-mono">{dailyMetrics.total_deals_closed || 0}</div>
                  </CardContent>
                </Card>
                <Card className="bg-card/50 border-border/50">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Calls Made</span>
                      <Phone className="h-4 w-4 text-blue-400" />
                    </div>
                    <div className="text-2xl font-bold font-mono">{dailyMetrics.total_calls_made || 0}</div>
                  </CardContent>
                </Card>
                <Card className="bg-card/50 border-border/50">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">New Leads</span>
                      <Users className="h-4 w-4 text-amber-400" />
                    </div>
                    <div className="text-2xl font-bold font-mono">{dailyMetrics.total_leads_new || 0}</div>
                  </CardContent>
                </Card>
              </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Top 3 Podium */}
        <div className="xl:col-span-1 space-y-4">
          <Card className="bg-gradient-to-br from-primary/20 via-card to-card border-primary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                MVP Leaderboard
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {(teamData || []).slice(0, 3).map((member: any, index) => (
                <div key={member.name} className="flex items-center gap-4 p-4 rounded-xl bg-muted/30 border border-border/50 relative overflow-hidden">
                  <div className="text-2xl font-bold text-muted-foreground/50 w-6">#{index + 1}</div>
                  <Avatar className="h-12 w-12 border-2 border-primary/20">
                    <AvatarFallback>{member.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-bold">{member.name}</p>
                    <p className="text-xs text-muted-foreground uppercase tracking-widest">{member.role}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-mono font-bold text-primary">{member.points}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Points</p>
                  </div>
                  {index === 0 && <Zap className="absolute -right-2 -top-2 h-12 w-12 text-primary/10 rotate-12" />}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Detailed Stats Table */}
        <div className="xl:col-span-2">
          <Card className="border-border/50 bg-card/80 backdrop-blur-sm h-full">
            <CardHeader>
              <CardTitle>Full Team Breakdown</CardTitle>
              <CardDescription>Comprehensive activity and outcome tracking</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="text-right">Calls</TableHead>
                      <TableHead className="text-right">Bookings</TableHead>
                      <TableHead className="text-right">Closed</TableHead>
                      <TableHead className="text-right font-bold text-green-400">Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-10">Loading Warriors...</TableCell></TableRow>
                    ) : teamData?.map((m: any) => (
                      <TableRow key={m.name} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="font-medium">{m.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn(
                            "text-[10px] uppercase",
                            m.role === 'setter' ? "border-blue-500/50 text-blue-400" : "border-purple-500/50 text-purple-400"
                          )}>
                            {m.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">{m.calls}</TableCell>
                        <TableCell className="text-right font-mono">{m.bookings}</TableCell>
                        <TableCell className="text-right font-mono">{m.closed}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-green-400">
                          AED {m.revenue.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
