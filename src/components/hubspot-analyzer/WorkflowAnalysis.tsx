import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export const WorkflowAnalysis = () => {
  // In a real scenario, this would accept props with data fetched from the DB
  // Since we don't have a workflows table yet, we'll keep the structure but make it ready for data
  const workflowCategories = [
    { name: "Deal Stage Management", total: 0, active: 0, percentage: 0 },
    { name: "Follow-up & Nurture", total: 0, active: 0, percentage: 0 },
    { name: "Tracking & Accountability", total: 0, active: 0, percentage: 0 },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Workflow Analysis</CardTitle>
          <CardDescription>
            Workflow performance and activity status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {workflowCategories.map((category, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="font-medium">{category.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {category.active} of {category.total} active (
                      {category.percentage}%)
                    </div>
                  </div>
                  <Badge variant="secondary">{category.percentage}%</Badge>
                </div>
                <Progress value={category.percentage} />
              </div>
            ))}
            <div className="text-center text-muted-foreground py-4">
              No workflow data found in database. Please sync HubSpot workflows.
            </div>
          </div>
        </CardContent>
      </Card>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Sync Required</AlertTitle>
        <AlertDescription>
          Workflow data is currently missing. Please run the HubSpot sync to
          populate this view.
        </AlertDescription>
      </Alert>
    </div>
  );
};
