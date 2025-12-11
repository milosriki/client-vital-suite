import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Send, Eye, Play, AlertTriangle, CheckCircle, Loader2, RefreshCw, ShoppingCart, UserPlus, FileText, Search, CreditCard, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

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
  const [emqEstimate, setEmqEstimate] = useState<number | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showLiveConfirm, setShowLiveConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState("");

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

  // Validation helpers
  const normalizePhoneUAE = (phone: string): string => {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('00971')) return digits.slice(2);
    if (digits.startsWith('971')) return digits;
    if (digits.startsWith('0')) return '971' + digits.slice(1);
    if (digits.startsWith('5')) return '971' + digits;
    return digits;
  };

  const validateFields = (): string[] => {
    const errors: string[] = [];
    
    // Email required
    if (!email || !email.includes('@')) {
      errors.push("Valid email is required");
    }
    
    // Phone validation - UAE format
    const normalizedPhone = normalizePhoneUAE(phone);
    if (!normalizedPhone.match(/^971\d{9}$/)) {
      errors.push("Phone must be UAE format: 971XXXXXXXXX (12 digits)");
    }
    
    // Value validation
    if (!value || parseFloat(value) <= 0) {
      errors.push("Value must be greater than 0");
    }
    
    // Currency must be AED uppercase
    const currency = "AED";
    if (currency !== currency.toUpperCase()) {
      errors.push("Currency must be uppercase AED");
    }
    
    // Test mode requires test_event_code
    if (mode === "test" && useTestCode && !testCode) {
      errors.push("Test mode requires test_event_code");
    }
    
    return errors;
  };

  const hashSHA256 = async (input: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(input.toLowerCase().trim());
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const calculateEMQ = (hashedPayload: any): number => {
    let score = 0;
    const maxScore = 10;
    
    // fbp = 3 points
    if (hashedPayload.user_data.fbp) score += 3;
    
    // email = 3 points
    if (hashedPayload.user_data.em) score += 3;
    
    // phone = 2 points
    if (hashedPayload.user_data.ph) score += 2;
    
    // first_name + last_name = 1 point
    if (hashedPayload.user_data.fn && hashedPayload.user_data.ln) score += 1;
    
    // city/country = 1 point
    if (hashedPayload.user_data.ct || hashedPayload.user_data.country) score += 1;
    
    return Math.round((score / maxScore) * 10);
  };

  const handlePreflight = async () => {
    const errors = validateFields();
    setValidationErrors(errors);
    
    if (errors.length > 0) {
      toast({
        title: "Validation Failed",
        description: `${errors.length} error(s) found. Check form.`,
        variant: "destructive",
      });
      return;
    }

    setProgress(20);
    
    // Create hashed payload
    const normalizedPhone = normalizePhoneUAE(phone);
    
    const hashedPayload = {
      event_name: "Purchase",
      event_time: Math.floor(Date.now() / 1000),
      event_id: `TEST_${Date.now()}`,
      event_source_url: "https://ptdfitness.com",
      action_source: "website",
      user_data: {
        em: await hashSHA256(email),
        ph: await hashSHA256(normalizedPhone),
        fn: email.split('@')[0] ? await hashSHA256(email.split('@')[0]) : null,
        ct: await hashSHA256("dubai"),
        country: await hashSHA256("ae"),
        fbp: fbp || null,
        fbc: fbc || null,
        external_id: email,
      },
      custom_data: {
        currency: "AED",
        value: parseFloat(value),
        content_name: "Test Purchase",
        content_category: "Fitness Program",
      },
      test_event_code: useTestCode ? testCode : undefined,
    };

    // Remove null values
    Object.keys(hashedPayload.user_data).forEach(key => {
      if (!hashedPayload.user_data[key]) {
        delete hashedPayload.user_data[key];
      }
    });

    setPayload(hashedPayload);
    setProgress(60);
    
    // Calculate EMQ
    const emq = calculateEMQ(hashedPayload);
    setEmqEstimate(emq);
    setProgress(100);
    
    toast({
      title: "Preflight Complete",
      description: `EMQ Estimate: ${emq}/10 - Payload ready for review`,
    });
  };

  const handleSimulate = async () => {
    if (!payload) {
      toast({
        title: "Run Preflight First",
        description: "Generate payload before simulating",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setProgress(30);
    
    // Log to automation_logs in Supabase
    try {
      const { error } = await supabase
        .from('automation_logs')
        .insert({
          action_type: 'capi_simulate',
          mode,
          payload,
          status: 'simulated',
        });

      if (error) throw error;

      setProgress(100);
      console.log("Simulated send:", payload);
      
      toast({
        title: "Simulation Complete",
        description: "Event logged to automation_logs (no external call)",
      });
    } catch (error) {
      console.error('Simulation error:', error);
      toast({
        title: "Simulation Error",
        description: error instanceof Error ? error.message : "Failed to log simulation",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setTimeout(() => setProgress(0), 1000);
    }
  };

  const handleSend = async () => {
    if (!payload) {
      toast({
        title: "Run Preflight First",
        description: "Generate and validate payload before sending",
        variant: "destructive",
      });
      return;
    }

    const errors = validateFields();
    if (errors.length > 0) {
      setValidationErrors(errors);
      toast({
        title: "Validation Failed",
        description: "Fix errors before sending",
        variant: "destructive",
      });
      return;
    }

    // Live mode confirmation
    if (mode === "live") {
      setShowLiveConfirm(true);
      return;
    }

    await executeSend();
  };

  const executeSend = async () => {
    setIsLoading(true);
    setProgress(20);

    try {
      const normalizedPhone = normalizePhoneUAE(phone);
      
      const eventData = {
        event_name: "Purchase",
        event_time: Math.floor(Date.now() / 1000),
        event_id: `ORD_${Date.now()}`,
        event_source_url: "https://ptdfitness.com/checkout",
        action_source: "website",
        user_data: {
          email,
          phone: normalizedPhone,
          fbp: fbp || undefined,
          fbc: fbc || undefined,
        },
        custom_data: {
          currency: "AED",
          value: parseFloat(value),
          content_name: "Test Purchase",
          content_category: "Fitness Program",
        },
        test_event_code: useTestCode ? testCode : undefined,
      };

      setProgress(50);

      const { data, error } = await supabase.functions.invoke('send-to-stape-capi', {
        body: { eventData, mode }
      });

      setProgress(80);

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      setProgress(100);

      toast({
        title: "Event Sent Successfully",
        description: `Purchase event sent via Stape CAPI in ${mode} mode`,
      });

      // Refetch recent events
      refetch();
      
      // Reset form
      setEmail("");
      setPhone("");
      setValue("");
      setFbp("");
      setFbc("");
      setPayload(null);
      setEmqEstimate(null);
      setValidationErrors([]);
    } catch (error) {
      console.error('CAPI send error:', error);
      toast({
        title: "Send Failed",
        description: error instanceof Error ? error.message : "Failed to send event",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setShowLiveConfirm(false);
      setConfirmText("");
      setTimeout(() => setProgress(0), 1000);
    }
  };

  const sendStandardEvent = async (eventName: string, value?: number) => {
    if (!email || !phone) {
      toast({
        title: "Missing Data",
        description: "Email and phone are required for all events",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const normalizedPhone = normalizePhoneUAE(phone);
      const eventData = {
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: `${eventName}_${Date.now()}`,
        event_source_url: "https://ptdfitness.com",
        action_source: "website",
        user_data: {
          email,
          phone: normalizedPhone,
          fbp: fbp || undefined,
          fbc: fbc || undefined,
        },
        custom_data: value ? {
          currency: "AED",
          value: value,
        } : undefined,
        test_event_code: useTestCode ? testCode : undefined,
      };

      const { data, error } = await supabase.functions.invoke('send-to-stape-capi', {
        body: { eventData, mode }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      toast({
        title: `${eventName} Event Sent`,
        description: `Successfully sent to Meta CAPI in ${mode} mode`,
      });

      refetch();
    } catch (error) {
      console.error('Event send error:', error);
      toast({
        title: "Send Failed",
        description: error instanceof Error ? error.message : "Failed to send event",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const syncHubSpotContacts = async (lifecycleStage: string) => {
    setIsLoading(true);
    setProgress(20);
    
    try {
      toast({
        title: "Syncing HubSpot Contacts",
        description: `Fetching ${lifecycleStage} contacts...`,
      });

      setProgress(50);

      const { data, error } = await supabase.functions.invoke('sync-hubspot-to-capi', {
        body: { 
          lifecycle_stage: lifecycleStage,
          mode 
        }
      });

      if (error) throw error;

      setProgress(100);

      toast({
        title: "Sync Complete",
        description: `Synced ${data.events_synced || 0} contacts from HubSpot`,
      });

      refetch();
    } catch (error) {
      console.error('HubSpot sync error:', error);
      toast({
        title: "Sync Failed",
        description: error instanceof Error ? error.message : "Failed to sync HubSpot contacts",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setTimeout(() => setProgress(0), 1000);
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="quick-send" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="quick-send">Standard Events</TabsTrigger>
          <TabsTrigger value="hubspot-sync">HubSpot Sync</TabsTrigger>
          <TabsTrigger value="advanced">Advanced Test</TabsTrigger>
        </TabsList>

        {/* Standard Events Quick Send */}
        <TabsContent value="quick-send" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Quick Send Standard Events</CardTitle>
              <CardDescription>
                Send standard Meta events with pre-filled data. Perfect Meta CAPI format.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quick-email">Email</Label>
                  <Input
                    id="quick-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="client@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quick-phone">Phone (971...)</Label>
                  <Input
                    id="quick-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="971501234567"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quick-fbp">FBP (optional)</Label>
                  <Input
                    id="quick-fbp"
                    value={fbp}
                    onChange={(e) => setFbp(e.target.value)}
                    placeholder="fb.1.1234567890.1234567890"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quick-fbc">FBC (optional)</Label>
                  <Input
                    id="quick-fbc"
                    value={fbc}
                    onChange={(e) => setFbc(e.target.value)}
                    placeholder="fb.1.1234567890.AbCdEf"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="quick-test-code"
                  checked={useTestCode}
                  onCheckedChange={(checked) => setUseTestCode(checked as boolean)}
                />
                <Label htmlFor="quick-test-code" className="text-sm">
                  Use test_event_code (for test mode)
                </Label>
              </div>

              {useTestCode && (
                <div className="space-y-2">
                  <Label htmlFor="quick-test-code-input">Test Event Code</Label>
                  <Input
                    id="quick-test-code-input"
                    value={testCode}
                    onChange={(e) => setTestCode(e.target.value)}
                    placeholder="TEST12345"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Button
                  onClick={() => sendStandardEvent("Purchase", parseFloat(value) || 5000)}
                  disabled={isLoading || !email || !phone}
                  className="w-full"
                >
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Purchase
                </Button>
                <Button
                  onClick={() => sendStandardEvent("Lead")}
                  disabled={isLoading || !email || !phone}
                  variant="outline"
                  className="w-full"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Lead
                </Button>
                <Button
                  onClick={() => sendStandardEvent("CompleteRegistration")}
                  disabled={isLoading || !email || !phone}
                  variant="outline"
                  className="w-full"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Registration
                </Button>
                <Button
                  onClick={() => sendStandardEvent("InitiateCheckout", parseFloat(value) || 3000)}
                  disabled={isLoading || !email || !phone}
                  variant="outline"
                  className="w-full"
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Checkout
                </Button>
                <Button
                  onClick={() => sendStandardEvent("Schedule")}
                  disabled={isLoading || !email || !phone}
                  variant="outline"
                  className="w-full"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Schedule
                </Button>
                <Button
                  onClick={() => sendStandardEvent("ViewContent")}
                  disabled={isLoading || !email || !phone}
                  variant="outline"
                  className="w-full"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="quick-value">Default Value (AED) for Purchase/Checkout</Label>
                <Input
                  id="quick-value"
                  type="number"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="5000"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* HubSpot Sync */}
        <TabsContent value="hubspot-sync" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sync HubSpot Contacts</CardTitle>
              <CardDescription>
                Pull contacts by lifecycle stage, enrich with Stripe, and send to Meta CAPI
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertDescription>
                  This will fetch contacts from HubSpot, enrich with Stripe data, and send to Meta in perfect CAPI format.
                  Events are queued in capi_events_enriched for batch processing.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Button
                  onClick={() => syncHubSpotContacts("customer")}
                  disabled={isLoading}
                  className="w-full"
                >
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Customers
                </Button>
                <Button
                  onClick={() => syncHubSpotContacts("opportunity")}
                  disabled={isLoading}
                  variant="outline"
                  className="w-full"
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Opportunities
                </Button>
                <Button
                  onClick={() => syncHubSpotContacts("lead")}
                  disabled={isLoading}
                  variant="outline"
                  className="w-full"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Leads
                </Button>
                <Button
                  onClick={() => syncHubSpotContacts("marketingqualifiedlead")}
                  disabled={isLoading}
                  variant="outline"
                  className="w-full"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  MQLs
                </Button>
                <Button
                  onClick={() => syncHubSpotContacts("salesqualifiedlead")}
                  disabled={isLoading}
                  variant="outline"
                  className="w-full"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  SQLs
                </Button>
                <Button
                  onClick={() => syncHubSpotContacts("subscriber")}
                  disabled={isLoading}
                  variant="outline"
                  className="w-full"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Subscribers
                </Button>
              </div>

              {progress > 0 && (
                <div className="space-y-2">
                  <Progress value={progress} className="h-2" />
                  <p className="text-xs text-muted-foreground text-center">
                    Syncing... {progress}%
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Advanced Test (Original Form) */}
        <TabsContent value="advanced" className="space-y-4">
          {/* Live Mode Confirmation Dialog */}
      <Dialog open={showLiveConfirm} onOpenChange={setShowLiveConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Confirm LIVE Mode Send
            </DialogTitle>
            <DialogDescription>
              You are about to send a LIVE event to Meta CAPI. This will affect production data and attribution.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <Alert>
              <AlertDescription>
                <strong>Event Summary:</strong>
                <ul className="mt-2 space-y-1 text-sm">
                  <li>• Email: {email}</li>
                  <li>• Phone: {normalizePhoneUAE(phone)}</li>
                  <li>• Value: {value} AED</li>
                  <li>• EMQ Score: {emqEstimate}/10</li>
                </ul>
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="confirm-deploy">Type "DEPLOY" to confirm</Label>
              <Input
                id="confirm-deploy"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DEPLOY"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLiveConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={confirmText !== "DEPLOY"}
              onClick={executeSend}
            >
              Confirm Send to LIVE
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Progress Bar */}
      {progress > 0 && (
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground text-center">
            Processing... {progress}%
          </p>
        </div>
      )}

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Validation Errors:</strong>
            <ul className="mt-2 space-y-1">
              {validationErrors.map((error, idx) => (
                <li key={idx}>• {error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Send Test Purchase */}
      <Card>
        <CardHeader>
          <CardTitle>Send Test Purchase Event</CardTitle>
          <CardDescription>
            Meta CAPI event with full validation, hashing, and EMQ scoring
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

            <div className="flex gap-2 flex-wrap">
              <Button 
                variant="outline" 
                onClick={handlePreflight}
                disabled={isLoading}
              >
                <Eye className="h-4 w-4 mr-2" />
                Preflight Check
              </Button>
              <Button 
                variant="outline" 
                onClick={handleSimulate}
                disabled={!payload || isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Simulate Send
              </Button>
              <Button 
                onClick={handleSend} 
                disabled={!payload || isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Send to CAPI
              </Button>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => refetch()}
                disabled={isLoading}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

          {/* Payload Preview with EMQ */}
          {payload && (
            <div className="space-y-3">
              {emqEstimate !== null && (
                <Alert className={emqEstimate >= 8 ? "border-green-500/50 bg-green-500/10" : emqEstimate >= 6 ? "border-yellow-500/50 bg-yellow-500/10" : "border-red-500/50 bg-red-500/10"}>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Event Match Quality (EMQ): {emqEstimate}/10</strong>
                    <p className="text-xs mt-1">
                      {emqEstimate >= 8 && "Excellent - High match rate expected (50%+)"}
                      {emqEstimate >= 6 && emqEstimate < 8 && "Good - Moderate match rate (30-50%)"}
                      {emqEstimate < 6 && "Poor - Add more data points (fbp, phone, names)"}
                    </p>
                  </AlertDescription>
                </Alert>
              )}

              <div className="p-4 rounded-lg bg-muted border">
                <p className="text-sm font-medium mb-2">Hashed Payload Ready to Send:</p>
                <pre className="text-xs overflow-auto max-h-96">
                  {JSON.stringify(payload, null, 2)}
                </pre>
              </div>
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
        </TabsContent>
      </Tabs>

      {/* Progress Bar */}
      {progress > 0 && (
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground text-center">
            Processing... {progress}%
          </p>
        </div>
      )}

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
