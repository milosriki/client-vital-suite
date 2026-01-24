import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Database } from "lucide-react";
import { AlertTitle, AlertDescription, Alert } from "@/components/ui/alert";

interface PropertyCategory {
  category: string;
  count: number;
  usage: string;
  quality: string;
}

interface PropertyAuditProps {
  categories: PropertyCategory[];
  totalProperties: number;
}

export const PropertyAudit = ({
  categories,
  totalProperties,
}: PropertyAuditProps) => {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Property Audit</CardTitle>
          <CardDescription>
            {totalProperties} properties analyzed across all objects
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {categories.map((cat, index) => (
              <div
                key={index}
                className="flex items-center justify-between border-b pb-3 last:border-0"
              >
                <div className="space-y-1">
                  <div className="font-medium">{cat.category}</div>
                  <div className="text-sm text-muted-foreground">
                    {cat.count} properties · {cat.usage} usage
                  </div>
                </div>
                <Badge
                  variant={
                    cat.quality === "Good"
                      ? "default"
                      : cat.quality === "Medium"
                        ? "secondary"
                        : "destructive"
                  }
                >
                  {cat.quality}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Alert>
        <Database className="h-4 w-4" />
        <AlertTitle>Data Quality Issues</AlertTitle>
        <AlertDescription>
          Analysis shows potential duplicate properties and unused fields.
          Recommend running a cleanup job.
        </AlertDescription>
      </Alert>
    </div>
  );
};
