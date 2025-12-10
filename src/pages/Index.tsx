import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Users, BarChart3, Settings } from "lucide-react";
import ProactiveInsightsPanel from "@/components/ProactiveInsightsPanel";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen bg-background p-6">
      <div className="max-w-7xl w-full mx-auto space-y-8">
        <div className="text-center">
          <h1 className="mb-4 text-4xl font-bold">PTD Intelligence Hub</h1>
          <p className="text-xl text-muted-foreground mb-8">
            Client health monitoring and coach performance analytics
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column - Navigation cards */}
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/overview')}>
              <CardHeader>
                <Activity className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Dashboard</CardTitle>
                <CardDescription>View client health scores and daily summary</CardDescription>
              </CardHeader>
            </Card>

            <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/clients')}>
              <CardHeader>
                <Users className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Clients</CardTitle>
                <CardDescription>Browse and search all clients</CardDescription>
              </CardHeader>
            </Card>

            <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/coaches')}>
              <CardHeader>
                <BarChart3 className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Coaches</CardTitle>
                <CardDescription>Coach performance metrics</CardDescription>
              </CardHeader>
            </Card>

            <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/ptd-control')}>
              <CardHeader>
                <Settings className="h-8 w-8 text-primary mb-2" />
                <CardTitle>PTD Control</CardTitle>
                <CardDescription>System settings and data management</CardDescription>
              </CardHeader>
            </Card>

            <div className="md:col-span-2 text-center">
              <Button onClick={() => navigate('/overview')} size="lg">
                Go to Dashboard
              </Button>
            </div>
          </div>

          {/* Right column - Proactive Insights */}
          <div className="lg:col-span-1">
            <ProactiveInsightsPanel />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
