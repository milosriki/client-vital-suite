import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  AlertCircle,
  Calendar,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { useDedupedQuery } from "@/hooks/useDedupedQuery";
import { getBusinessDate } from "@/lib/date-utils";

const SalesCoachTracker = () => {
  // Get current and previous month date ranges (Business Time)
  const currentMonthStart = startOfMonth(getBusinessDate());
  const currentMonthEnd = endOfMonth(getBusinessDate());
  const previousMonthStart = startOfMonth(subMonths(getBusinessDate(), 1));
  const previousMonthEnd = endOfMonth(subMonths(getBusinessDate(), 1));

  // Query for this month's sales (closed won deals)
  const { data: currentMonthSales, isLoading: loadingCurrent } =
    useDedupedQuery({
      queryKey: ["current-month-sales"],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("client_health_scores")
          .select("*")
          .gte("calculated_at", currentMonthStart.toISOString())
          .lte("calculated_at", currentMonthEnd.toISOString())
          .eq("health_zone", "GREEN")
          .order("calculated_at", { ascending: false })
          .limit(3);

        if (error) throw error;
        return data;
      },
    });

  // Query for previous month's sales
  const { data: previousMonthSales, isLoading: loadingPrevious } =
    useDedupedQuery({
      queryKey: ["previous-month-sales"],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("client_health_scores")
          .select("*")
          .gte("calculated_at", previousMonthStart.toISOString())
          .lte("calculated_at", previousMonthEnd.toISOString())
          .eq("health_zone", "GREEN")
          .order("calculated_at", { ascending: false })
          .limit(3);

        if (error) throw error;
        return data;
      },
    });

  // Query for coaches with no recent sessions
  const { data: inactiveCoaches, isLoading: loadingCoaches } = useDedupedQuery({
    queryKey: ["inactive-coaches"],
    queryFn: async () => {
      const thirtyDaysAgo = getBusinessDate();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from("coach_performance")
        .select("*")
        .order("report_date", { ascending: false });

      if (error) throw error;

      // Get unique coaches and find those with no recent activity
      const coachMap = new Map();
      data?.forEach((record) => {
        if (!coachMap.has(record.coach_name)) {
          coachMap.set(record.coach_name, record);
        }
      });

      // Filter coaches with low or no sessions
      const inactive = Array.from(coachMap.values()).filter(
        (coach) =>
          (coach.avg_sessions_per_client || 0) < 1 ||
          new Date(coach.report_date) < thirtyDaysAgo,
      );

      return inactive;
    },
  });

  // Calculate totals
  const currentMonthTotal =
    currentMonthSales?.reduce(
      (sum, sale) => sum + (sale.package_value_aed || 0),
      0,
    ) || 0;
  const previousMonthTotal =
    previousMonthSales?.reduce(
      (sum, sale) => sum + (sale.package_value_aed || 0),
      0,
    ) || 0;
  const percentageChange =
    previousMonthTotal > 0
      ? ((currentMonthTotal - previousMonthTotal) / previousMonthTotal) * 100
      : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Sales & Coach Activity Tracker</h1>
        <p className="text-muted-foreground">
          Live data from Supabase - Last 3 sales per month + inactive coaches
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              This Month Sales
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {currentMonthTotal.toLocaleString()} AED
            </div>
            <p className="text-xs text-muted-foreground">
              {currentMonthSales?.length || 0} top sales
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Previous Month
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {previousMonthTotal.toLocaleString()} AED
            </div>
            <p className="text-xs text-muted-foreground">
              {previousMonthSales?.length || 0} top sales
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Month Comparison
            </CardTitle>
            {percentageChange >= 0 ? (
              <TrendingUp className="h-4 w-4 text-success" />
            ) : (
              <TrendingDown className="h-4 w-4 text-destructive" />
            )}
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${percentageChange >= 0 ? "text-success" : "text-destructive"}`}
            >
              {percentageChange >= 0 ? "+" : ""}
              {percentageChange.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">vs previous month</p>
          </CardContent>
        </Card>
      </div>

      {/* Current Month Sales */}
      <Card>
        <CardHeader>
          <CardTitle>Top 3 Sales - This Month</CardTitle>
          <CardDescription>
            {format(currentMonthStart, "MMMM yyyy")} - Most recent high-value
            clients
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingCurrent ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading current month sales...
            </div>
          ) : currentMonthSales && currentMonthSales.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Coach</TableHead>
                  <TableHead>Package Value</TableHead>
                  <TableHead>Health Score</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentMonthSales.map((sale, index) => (
                  <TableRow key={sale.id}>
                    <TableCell className="font-medium">
                      {sale.firstname} {sale.lastname}
                      <div className="text-sm text-muted-foreground">
                        {sale.email}
                      </div>
                    </TableCell>
                    <TableCell>{sale.assigned_coach || "Unassigned"}</TableCell>
                    <TableCell className="font-bold text-success">
                      {(sale.package_value_aed || 0).toLocaleString()} AED
                    </TableCell>
                    <TableCell>
                      <Badge variant="default" className="bg-success">
                        {sale.health_score?.toFixed(0) || "N/A"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {format(
                        new Date(
                          sale.calculated_at || getBusinessDate().toISOString(),
                        ),
                        "MMM dd, yyyy",
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>No Sales Found</AlertTitle>
              <AlertDescription>
                No sales recorded for {format(currentMonthStart, "MMMM yyyy")}{" "}
                yet.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Previous Month Sales */}
      <Card>
        <CardHeader>
          <CardTitle>Top 3 Sales - Previous Month</CardTitle>
          <CardDescription>
            {format(previousMonthStart, "MMMM yyyy")} - Historical comparison
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingPrevious ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading previous month sales...
            </div>
          ) : previousMonthSales && previousMonthSales.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Coach</TableHead>
                  <TableHead>Package Value</TableHead>
                  <TableHead>Health Score</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previousMonthSales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell className="font-medium">
                      {sale.firstname} {sale.lastname}
                      <div className="text-sm text-muted-foreground">
                        {sale.email}
                      </div>
                    </TableCell>
                    <TableCell>{sale.assigned_coach || "Unassigned"}</TableCell>
                    <TableCell className="font-bold">
                      {(sale.package_value_aed || 0).toLocaleString()} AED
                    </TableCell>
                    <TableCell>
                      <Badge variant="default" className="bg-success">
                        {sale.health_score?.toFixed(0) || "N/A"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {format(
                        new Date(
                          sale.calculated_at || getBusinessDate().toISOString(),
                        ),
                        "MMM dd, yyyy",
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>No Sales Found</AlertTitle>
              <AlertDescription>
                No sales recorded for {format(previousMonthStart, "MMMM yyyy")}.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Inactive Coaches */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Coaches With No Recent Sessions
          </CardTitle>
          <CardDescription>
            Coaches with low activity or no sessions in the last 30 days
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingCoaches ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading coach activity...
            </div>
          ) : inactiveCoaches && inactiveCoaches.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Coach Name</TableHead>
                  <TableHead>Total Clients</TableHead>
                  <TableHead>Avg Sessions/Client</TableHead>
                  <TableHead>Last Report Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inactiveCoaches.map((coach) => (
                  <TableRow key={coach.id}>
                    <TableCell className="font-medium">
                      {coach.coach_name}
                    </TableCell>
                    <TableCell>{coach.total_clients || 0}</TableCell>
                    <TableCell>
                      <Badge variant="destructive">
                        {(coach.avg_sessions_per_client || 0).toFixed(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {coach.report_date
                        ? format(new Date(coach.report_date), "MMM dd, yyyy")
                        : "N/A"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="text-destructive border-destructive"
                      >
                        Inactive
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Alert className="border-success bg-success/10">
              <AlertCircle className="h-4 w-4 text-success" />
              <AlertTitle>All Coaches Active! 🎉</AlertTitle>
              <AlertDescription>
                All coaches have been active with sessions in the last 30 days.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SalesCoachTracker;
