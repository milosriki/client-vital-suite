import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Send, Eye, Play } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface CAPITabProps {
  mode: "test" | "live";
}

export default function CAPITab({ mode }: CAPITabProps) {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [value, setValue] = useState("");
  const [fbp, setFbp] = useState("");
  const [fbc, setFbc] = useState("");
  const [useTestCode, setUseTestCode] = useState(mode === "test");
  const [testCode, setTestCode] = useState("TEST12345");
  const [payload, setPayload] = useState<any>(null);

  // Fetch recent CAPI events
  const { data: events, refetch } = useQuery({
    queryKey: ["capi-events", mode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("capi_events")
        .select("*")
        .eq("mode", mode)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const handlePreflight = () => {
    const testPayload = {
      event_name: "Purchase",
      user_data: {
        email,
        phone,
        fbp,
        fbc,
      },
      custom_data: {
        currency: "AED",
        value: parseFloat(value),
      },
      test_event_code: useTestCode ? testCode : undefined,
    };
    setPayload(testPayload);
    toast({
      title: "Preflight Check",
      description: "Payload generated. Review below before sending.",
    });
  };

  const handleSimulate = () => {
    console.log("Simulated send:", payload);
    toast({
      title: "Simulation Complete",
      description: "Event logged locally (no external call)",
    });
  };

  const handleSend = async () => {
    const eventData: any = {
      event_name: "Purchase",
      user_data: {
        email,
        phone,
        fbp,
        fbc,
      },
      custom_data: {
        currency: "AED",
        value: parseFloat(value) || 0,
      },
    };

    if (useTestCode) {
      eventData.test_event_code = testCode;
    }

    try {
      const { data, error } = await supabase.functions.invoke('send-to-stape-capi', {
        body: { eventData, mode }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      toast({
        title: "Event Sent via Stape CAPI",
        description: `Purchase event sent successfully in ${mode} mode`,
      });

      // Refetch recent events
      refetch();
    } catch (error) {
      console.error('CAPI send error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send event",
        variant: "destructive",
      });
    }
  };

  const hashSHA256 = (str: string) => {
    // Simple hash placeholder - in production use crypto.subtle
    return `hashed_${str}`;
  };

  return (
    <div className="space-y-6">
      {/* Send Test Purchase */}
      <Card>
        <CardHeader>
          <CardTitle>Send Test Purchase</CardTitle>
          <CardDescription>
            Test CAPI event sending with validation and preflight checks
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="client@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone (971...)</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="971501234567"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="value">Value (AED)</Label>
              <Input
                id="value"
                type="number"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="5000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fbp">FBP (optional)</Label>
              <Input
                id="fbp"
                value={fbp}
                onChange={(e) => setFbp(e.target.value)}
                placeholder="fb.1.1234567890.1234567890"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fbc">FBC (optional)</Label>
              <Input
                id="fbc"
                value={fbc}
                onChange={(e) => setFbc(e.target.value)}
                placeholder="fb.1.1234567890.AbCdEf"
              />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="test-code"
                checked={useTestCode}
                onCheckedChange={(checked) => setUseTestCode(checked as boolean)}
              />
              <Label htmlFor="test-code" className="text-sm">
                Use test_event_code (for test mode)
              </Label>
            </div>

            {useTestCode && (
              <div className="space-y-2">
                <Label htmlFor="test-code-input">Test Event Code</Label>
                <Input
                  id="test-code-input"
                  value={testCode}
                  onChange={(e) => setTestCode(e.target.value)}
                  placeholder="TEST12345"
                />
              </div>
            )}

            <div className="flex gap-2">
            <Button variant="outline" onClick={handlePreflight}>
              <Eye className="h-4 w-4 mr-2" />
              Preflight
            </Button>
            <Button variant="outline" onClick={handleSimulate}>
              <Play className="h-4 w-4 mr-2" />
              Simulate Send
            </Button>
            <Button onClick={handleSend} disabled={mode === "live" && !useTestCode}>
              <Send className="h-4 w-4 mr-2" />
              Send to CAPI
            </Button>
          </div>

          {/* Payload Preview */}
          {payload && (
            <div className="mt-4 p-4 rounded-lg bg-muted">
              <p className="text-sm font-medium mb-2">Payload Preview:</p>
              <pre className="text-xs overflow-auto">
                {JSON.stringify(payload, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Events */}
      <Card>
        <CardHeader>
          <CardTitle>Recent CAPI Events</CardTitle>
          <CardDescription>Last 50 events from Supabase</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event Name</TableHead>
                  <TableHead>Event Time</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events?.map((event: any) => (
                  <TableRow key={event.id}>
                    <TableCell className="font-medium">{event.event_name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(event.event_time).toLocaleString()}
                    </TableCell>
                    <TableCell>{event.currency}</TableCell>
                    <TableCell>{event.value_aed}</TableCell>
                    <TableCell className="text-xs">{event.email || "-"}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          event.status === "success"
                            ? "bg-green-500/10 text-green-500"
                            : "bg-yellow-500/10 text-yellow-500"
                        }
                      >
                        {event.status || "pending"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
