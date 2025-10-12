import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, CheckCircle, AlertCircle, Lightbulb } from "lucide-react";
import { format } from "date-fns";

interface Intervention {
  id: number;
  intervention_date: string;
  client_name: string | null;
  intervention_type: string;
  status: string;
  ai_recommendation: string | null;
  outcome: string | null;
  success_rating: number | null;
}

interface InterventionTrackerProps {
  interventions: Intervention[];
}

export const InterventionTracker = ({ interventions }: InterventionTrackerProps) => {
  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20">Completed</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20">Pending</Badge>;
      default:
        return <Badge className="bg-red-500/10 text-red-500 hover:bg-red-500/20">Failed</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Recent Interventions</span>
          <Badge variant="outline">{interventions.length} Total</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {interventions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No interventions recorded yet</p>
            </div>
          ) : (
            interventions.map((intervention) => (
              <div
                key={intervention.id}
                className="border rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(intervention.status)}
                    <div>
                      <p className="font-medium">{intervention.client_name || 'Unknown Client'}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(intervention.intervention_date), 'MMM dd, yyyy h:mm a')}
                      </p>
                    </div>
                  </div>
                  {getStatusBadge(intervention.status)}
                </div>

                <div className="mt-3 space-y-2">
                  <div className="flex items-center text-sm">
                    <span className="font-medium mr-2">Type:</span>
                    <Badge variant="secondary">{intervention.intervention_type}</Badge>
                  </div>

                  {intervention.ai_recommendation && (
                    <div className="flex items-start space-x-2 bg-primary/5 p-3 rounded-md">
                      <Lightbulb className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-primary mb-1">AI Recommendation</p>
                        <p className="text-xs text-muted-foreground">{intervention.ai_recommendation}</p>
                      </div>
                    </div>
                  )}

                  {intervention.outcome && (
                    <div className="text-xs">
                      <span className="font-medium">Outcome: </span>
                      <span className="text-muted-foreground">{intervention.outcome}</span>
                    </div>
                  )}

                  {intervention.success_rating && (
                    <div className="flex items-center text-xs">
                      <span className="font-medium mr-2">Success Rating:</span>
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <span
                            key={i}
                            className={`text-lg ${
                              i < intervention.success_rating! ? 'text-yellow-500' : 'text-gray-300'
                            }`}
                          >
                            ★
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};