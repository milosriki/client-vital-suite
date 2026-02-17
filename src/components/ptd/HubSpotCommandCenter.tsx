import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDedupedQuery } from '@/hooks/useDedupedQuery';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  RefreshCw,
  Shield,
  AlertTriangle,
  Users,
  Activity,
  LogIn,
  Download,
  Trash2,
  UserX,
  Clock,
  Search,
  TrendingUp,
  Eye,
  ChevronRight,
} from 'lucide-react';

interface HubSpotCommandCenterProps {
  mode: 'test' | 'live';
}

interface OverviewData {
  totals: {
    totalLogins: number;
    totalExports: number;
    totalSecurityEvents: number;
    totalContactCreations: number;
    totalContactDeletions: number;
    totalStatusChanges: number;
    highRiskUsers: number;
    usersWithAnomalies: number;
  };
  summaries: any[];
  recentLogins: any[];
  recentSecurity: any[];
  riskyChanges: any[];
  timestamp: string;
}

interface UserDetail {
  userEmail: string;
  totalRiskScore: number;
  anomalies: string[];
  summaries: any[];
  logins: any[];
  security: any[];
  contactChanges: any[];
}

export default function HubSpotCommandCenter({ mode }: HubSpotCommandCenterProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch overview data
  const { data: overview, isLoading: overviewLoading, refetch: refetchOverview } = useDedupedQuery({
    queryKey: ['hubspot-command-center', 'overview', mode],
    queryFn: async (): Promise<OverviewData> => {
      const { data, error } = await supabase.functions.invoke('hubspot-command-center', {
        body: { action: 'overview', mode }
      });
      if (error) throw error;
      return data;
    },
    staleTime: 30000, // Cache for 30s instead of always refetching
    dedupeIntervalMs: 1000, // Prevent duplicate calls within 1s
  });

  // Fetch user detail when selected
  const { data: userDetail, isLoading: userLoading } = useDedupedQuery({
    queryKey: ['hubspot-command-center', 'user-detail', selectedUser],
    queryFn: async (): Promise<UserDetail> => {
      const { data, error } = await supabase.functions.invoke('hubspot-command-center', {
        body: { action: 'user-detail', userEmail: selectedUser }
      });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedUser,
    dedupeIntervalMs: 1000,
  });

  // Fetch risky contacts
  const { data: riskyContacts, refetch: refetchRisky } = useDedupedQuery({
    queryKey: ['hubspot-command-center', 'risky-contacts', mode],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('hubspot-command-center', {
        body: { action: 'risky-contacts', minRiskScore: 3, mode }
      });
      if (error) throw error;
      return data;
    },
    staleTime: 30000,
    dedupeIntervalMs: 1000,
  });

  const handleFullSync = async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('hubspot-command-center', {
        body: { action: 'full-sync', mode }
      });
      if (error) throw error;
      toast.success(`Sync completed! Logins: ${data.results.logins.synced}, Security: ${data.results.security.synced}`);
      refetchOverview();
    } catch (error: any) {
      toast.error('Sync failed: ' + error.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAggregate = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('hubspot-command-center', {
        body: { action: 'aggregate', mode }
      });
      if (error) throw error;
      toast.success(`Aggregated ${data.aggregated} user summaries for ${data.date}`);
      refetchOverview();
    } catch (error: any) {
      toast.error('Aggregation failed: ' + error.message);
    }
  };

  const getRiskBadge = (score: number) => {
    if (score >= 15) return <Badge variant="destructive">Critical ({score})</Badge>;
    if (score >= 10) return <Badge className="bg-orange-500">High ({score})</Badge>;
    if (score >= 5) return <Badge className="bg-yellow-500 text-black">Medium ({score})</Badge>;
    return <Badge variant="secondary">Low ({score})</Badge>;
  };

  const filteredSummaries = (overview?.summaries || []).filter(s =>
    !searchTerm || s.user_email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-orange-500" />
            HubSpot Command Center
          </h2>
          <p className="text-muted-foreground">
            Monitor user activity, detect anomalies, and track lead risks
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleAggregate}>
            <TrendingUp className="h-4 w-4 mr-2" />
            Recompute Summaries
          </Button>
          <Button onClick={handleFullSync} disabled={isSyncing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync from HubSpot'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">
            <Activity className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="users">
            <Users className="h-4 w-4 mr-2" />
            Users
          </TabsTrigger>
          <TabsTrigger value="lead-risk">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Lead Risk
          </TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-4">
          {overviewLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2">
                      <LogIn className="h-5 w-5 text-blue-500" />
                      <div>
                        <p className="text-2xl font-bold">{overview?.totals?.totalLogins || 0}</p>
                        <p className="text-sm text-muted-foreground">Total Logins</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2">
                      <Download className="h-5 w-5 text-orange-500" />
                      <div>
                        <p className="text-2xl font-bold">{overview?.totals?.totalExports || 0}</p>
                        <p className="text-sm text-muted-foreground">Exports</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2">
                      <Trash2 className="h-5 w-5 text-red-500" />
                      <div>
                        <p className="text-2xl font-bold">{overview?.totals.totalContactDeletions || 0}</p>
                        <p className="text-sm text-muted-foreground">Deletions</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2">
                      <UserX className="h-5 w-5 text-purple-500" />
                      <div>
                        <p className="text-2xl font-bold">{overview?.totals.highRiskUsers || 0}</p>
                        <p className="text-sm text-muted-foreground">High Risk Users</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Activity */}
              <div className="grid md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <LogIn className="h-4 w-4" />
                      Recent Logins
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {(overview?.recentLogins || []).slice(0, 10).map((login: any, i: number) => (
                        <div key={i} className="flex items-center justify-between text-sm border-b pb-2">
                          <div>
                            <p className="font-medium">{login.user_email || 'Unknown'}</p>
                            <p className="text-muted-foreground text-xs">
                              {login.ip_address} • {login.location}
                            </p>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {login.occurred_at ? new Date(login.occurred_at).toLocaleString() : 'N/A'}
                          </span>
                        </div>
                      ))}
                      {(!overview?.recentLogins || overview.recentLogins.length === 0) && (
                        <p className="text-muted-foreground text-sm text-center py-4">No recent logins</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Security Events
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {(overview?.recentSecurity || []).slice(0, 10).map((event: any, i: number) => (
                        <div key={i} className="flex items-center justify-between text-sm border-b pb-2">
                          <div>
                            <p className="font-medium">{event.user_email || 'Unknown'}</p>
                            <Badge variant="outline" className="text-xs">{event.event_type}</Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {event.occurred_at ? new Date(event.occurred_at).toLocaleString() : 'N/A'}
                          </span>
                        </div>
                      ))}
                      {(!overview?.recentSecurity || overview.recentSecurity.length === 0) && (
                        <p className="text-muted-foreground text-sm text-center py-4">No security events</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* User Summaries Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    User Activity Summary
                  </CardTitle>
                  <CardDescription>Last 7 days aggregated by user</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-center">Logins</TableHead>
                        <TableHead className="text-center">Exports</TableHead>
                        <TableHead className="text-center">Deletions</TableHead>
                        <TableHead className="text-center">Status Changes</TableHead>
                        <TableHead>Risk Score</TableHead>
                        <TableHead>Anomalies</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSummaries.slice(0, 20).map((summary: any) => (
                        <TableRow
                          key={summary.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setSelectedUser(summary.user_email)}
                        >
                          <TableCell className="font-medium">{summary.user_email || 'Unknown'}</TableCell>
                          <TableCell>{summary.summary_date}</TableCell>
                          <TableCell className="text-center">{summary.logins}</TableCell>
                          <TableCell className="text-center">{summary.exports}</TableCell>
                          <TableCell className="text-center">{summary.contact_deletions}</TableCell>
                          <TableCell className="text-center">{summary.status_changes}</TableCell>
                          <TableCell>{getRiskBadge(summary.risk_score)}</TableCell>
                          <TableCell>
                            {(summary.anomaly_flags || []).length > 0 ? (
                              <Badge variant="destructive" className="text-xs">
                                {summary.anomaly_flags.length} flags
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">None</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* USERS TAB */}
        <TabsContent value="users" className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            {/* User List */}
            <Card className="md:col-span-1">
              <CardHeader>
                <CardTitle className="text-lg">Users by Risk</CardTitle>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredSummaries.map((summary: any) => (
                    <div
                      key={summary.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedUser === summary.user_email ? 'bg-primary/10 border-primary' : 'hover:bg-muted/50'
                        }`}
                      onClick={() => setSelectedUser(summary.user_email)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{summary.user_email || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">{summary.summary_date}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {getRiskBadge(summary.risk_score)}
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* User Detail */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  User Detail
                </CardTitle>
                <CardDescription>
                  {selectedUser || 'Select a user to view details'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!selectedUser ? (
                  <p className="text-muted-foreground text-center py-12">
                    Click on a user from the list to see their activity
                  </p>
                ) : userLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="h-6 w-6 animate-spin" />
                  </div>
                ) : userDetail ? (
                  <div className="space-y-4">
                    {/* Risk Summary */}
                    <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Risk Score</p>
                        <p className="text-3xl font-bold">{userDetail.totalRiskScore}</p>
                      </div>
                      {userDetail.anomalies.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {userDetail.anomalies.map((a, i) => (
                            <Badge key={i} variant="destructive" className="text-xs">{a}</Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Recent Activity */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-medium mb-2">Recent Logins ({userDetail.logins.length})</h4>
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {userDetail.logins.slice(0, 5).map((l: any, i: number) => (
                            <p key={i} className="text-xs text-muted-foreground">
                              {l.occurred_at ? new Date(l.occurred_at).toLocaleString() : 'N/A'} • {l.ip_address}
                            </p>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h4 className="font-medium mb-2">Security Events ({userDetail.security.length})</h4>
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {userDetail.security.slice(0, 5).map((s: any, i: number) => (
                            <p key={i} className="text-xs text-muted-foreground">
                              {s.event_type} • {s.occurred_at ? new Date(s.occurred_at).toLocaleString() : 'N/A'}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Contact Changes */}
                    <div>
                      <h4 className="font-medium mb-2">Contact Changes ({userDetail.contactChanges.length})</h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {userDetail.contactChanges.slice(0, 10).map((c: any, i: number) => (
                          <div key={i} className="flex items-center justify-between text-sm border-b pb-2">
                            <div>
                              <span className="font-medium">{c.contact_email || c.contact_id}</span>
                              <Badge variant="outline" className="ml-2 text-xs">{c.event_type}</Badge>
                              {c.property_name && (
                                <span className="text-muted-foreground ml-2">
                                  {c.property_name}: {c.old_value || '(empty)'} → {c.new_value || '(empty)'}
                                </span>
                              )}
                            </div>
                            {getRiskBadge(c.risk_score)}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* LEAD RISK TAB */}
        <TabsContent value="lead-risk" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                High-Risk Contact Changes
              </CardTitle>
              <CardDescription>
                Contacts with suspicious activity (risk score ≥ 3)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date/Time</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Event Type</TableHead>
                    <TableHead>Property Change</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead>Reasons</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(riskyContacts?.changes || []).map((change: any) => (
                    <TableRow key={change.id}>
                      <TableCell className="text-sm">
                        {change.occurred_at ? new Date(change.occurred_at).toLocaleString() : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{change.contact_email || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">{change.contact_id}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{change.event_type}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {change.property_name ? (
                          <span>
                            <strong>{change.property_name}:</strong>{' '}
                            {change.old_value || '(empty)'} → {change.new_value || '(empty)'}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{change.user_email || 'Unknown'}</TableCell>
                      <TableCell>{getRiskBadge(change.risk_score)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(change.risk_reasons || []).map((r: string, i: number) => (
                            <Badge key={i} variant="secondary" className="text-xs">{r}</Badge>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!riskyContacts?.changes || riskyContacts.changes.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No high-risk contact changes detected
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}