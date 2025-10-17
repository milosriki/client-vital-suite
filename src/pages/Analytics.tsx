import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw } from "lucide-react";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const Analytics = () => {
  // Fetch weekly patterns for trend analysis
  const { data: weeklyData, isLoading: weeklyLoading, refetch } = useQuery({
    queryKey: ['weekly-analytics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('weekly_patterns')
        .select('*')
        .order('week_start_date', { ascending: true })
        .limit(12);
      
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 5 * 60 * 1000,
  });

  // Fetch current client distribution
  const { data: clients, isLoading: clientsLoading } = useQuery({
    queryKey: ['clients-analytics'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('client_health_scores')
        .select('*')
        .eq('calculated_at::date', today);
      
      if (error) throw error;
      return data || [];
    },
  });

  // Prepare data for charts
  const trendData = weeklyData?.map(week => ({
    week: new Date(week.week_start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    avgScore: week.avg_health_score,
    red: week.red_clients,
    yellow: week.yellow_clients,
    green: week.green_clients,
    purple: week.purple_clients,
  })) || [];

  // Zone distribution for pie chart
  const zoneData = [
    { name: 'RED', value: clients?.filter(c => c.health_zone === 'RED').length || 0, color: '#ef4444' },
    { name: 'YELLOW', value: clients?.filter(c => c.health_zone === 'YELLOW').length || 0, color: '#eab308' },
    { name: 'GREEN', value: clients?.filter(c => c.health_zone === 'GREEN').length || 0, color: '#22c55e' },
    { name: 'PURPLE', value: clients?.filter(c => c.health_zone === 'PURPLE').length || 0, color: '#a855f7' },
  ];

  // Segment distribution
  const segmentData = clients?.reduce((acc: any[], client) => {
    const segment = client.client_segment || 'Unknown';
    const existing = acc.find(s => s.segment === segment);
    if (existing) {
      existing.count++;
      existing.avgScore += client.health_score || 0;
    } else {
      acc.push({ segment, count: 1, avgScore: client.health_score || 0 });
    }
    return acc;
  }, []).map(s => ({ ...s, avgScore: s.avgScore / s.count })) || [];

  const isLoading = weeklyLoading || clientsLoading;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold mb-2">Analytics</h1>
            <p className="text-muted-foreground">Trends and insights across your client base</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-96" />)}
          </div>
        ) : (
          <>
            {/* Trend Analysis */}
            <div className="grid grid-cols-1 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Average Health Score Trend</CardTitle>
                  <CardDescription>Weekly average health scores over the last 12 weeks</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="week" stroke="#9ca3af" />
                      <YAxis stroke="#9ca3af" domain={[0, 100]} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                        labelStyle={{ color: '#f3f4f6' }}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="avgScore" stroke="#3b82f6" strokeWidth={3} name="Avg Health Score" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Zone Distribution Over Time</CardTitle>
                  <CardDescription>Client distribution across health zones</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="week" stroke="#9ca3af" />
                      <YAxis stroke="#9ca3af" />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                        labelStyle={{ color: '#f3f4f6' }}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="red" stroke="#ef4444" strokeWidth={2} name="RED" />
                      <Line type="monotone" dataKey="yellow" stroke="#eab308" strokeWidth={2} name="YELLOW" />
                      <Line type="monotone" dataKey="green" stroke="#22c55e" strokeWidth={2} name="GREEN" />
                      <Line type="monotone" dataKey="purple" stroke="#a855f7" strokeWidth={2} name="PURPLE" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Segmentation */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Current Zone Distribution</CardTitle>
                  <CardDescription>Today's client distribution by health zone</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={zoneData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name}: ${value}`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {zoneData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Health Score by Segment</CardTitle>
                  <CardDescription>Average health scores across client segments</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={segmentData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="segment" stroke="#9ca3af" angle={-45} textAnchor="end" height={100} />
                      <YAxis stroke="#9ca3af" domain={[0, 100]} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                        labelStyle={{ color: '#f3f4f6' }}
                      />
                      <Bar dataKey="avgScore" fill="#3b82f6" name="Avg Health Score" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Segment Details */}
            <Card>
              <CardHeader>
                <CardTitle>Segment Summary</CardTitle>
                <CardDescription>Client count and average health by segment</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {segmentData.map(segment => (
                    <div key={segment.segment} className="p-4 border rounded-lg">
                      <p className="text-sm text-muted-foreground mb-2">{segment.segment}</p>
                      <p className="text-2xl font-bold">{segment.count} clients</p>
                      <p className="text-sm mt-2">
                        Avg Score: <span className="font-semibold">{segment.avgScore.toFixed(1)}</span>
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default Analytics;
