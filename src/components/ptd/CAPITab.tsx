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
  const [useTestCode, setUseTestCode] = useState(true);
  const [payload, setPayload] = useState<any>(null);

  // Fetch recent CAPI events
  const { data: events } = useQuery({
    queryKey: ["capi-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("capi_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const handlePreflight = () => {
    const testPayload = {
      event_name: "Purchase",
      event_time: Math.floor(Date.now() / 1000),
      user_data: {
        em: email ? hashSHA256(email) : undefined,
        ph: phone ? hashSHA256(phone) : undefined,
      },
      custom_data: {
        currency: "AED",
        value: parseFloat(value),
      },
      fbp,
      fbc,
      test_event_code: useTestCode ? "TEST12345" : undefined,
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
    try {
      // Call backend CAPI endpoint
      const response = await fetch(`${window.location.origin}/api/events/purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          value: parseFloat(value),
          currency: "AED",
          userData: { emails: [email], phones: [phone] },
          fbp,
          fbc,
        }),
      });

      if (!response.ok) throw new Error("Failed to send event");
      
      toast({
        title: "Success",
        description: `Event sent to CAPI (${mode} mode)`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send event",
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
              Use test_event_code (required in test mode)
            </Label>
          </div>

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
