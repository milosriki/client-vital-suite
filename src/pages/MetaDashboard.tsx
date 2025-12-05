import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Activity, ShoppingCart, RefreshCw, Heart } from 'lucide-react';
import { toast } from 'sonner';

export default function MetaDashboard() {
  const [loading, setLoading] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, any>>({});
  
  // Form states
  const [testEmail, setTestEmail] = useState('test@ptdfitness.com');
  const [testValue, setTestValue] = useState('500');
  const [backfillUrl, setBackfillUrl] = useState('');
  const [healthWebhookUrl, setHealthWebhookUrl] = useState('');
  
  const API_BASE = import.meta.env.VITE_META_CAPI_URL || 'http://localhost:3000';

  const handleHealthCheck = async () => {
    setLoading('health');
    try {
      const response = await fetch(`${API_BASE}/health`);
      const data = await response.json();
      setResults({ ...results, health: data });
      toast.success('Health check completed');
    } catch (error: any) {
      toast.error(`Health check failed: ${error.message}`);
      setResults({ ...results, health: { error: error.message } });
    } finally {
      setLoading(null);
    }
  };

  const handleTestPurchase = async () => {
    setLoading('purchase');
    try {
      const response = await fetch(`${API_BASE}/api/events/Purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_time: Math.floor(Date.now() / 1000),
          event_id: `test_${Date.now()}`,
          user_data: {
            email: testEmail,
            external_id: `test_client_${Date.now()}`
          },
          custom_data: {
            currency: 'AED',
            value: parseFloat(testValue),
            content_name: 'Test Purchase from Dashboard'
          }
        })
      });
      
      const data = await response.json();
      setResults({ ...results, purchase: data });
      
      if (response.ok) {
        toast.success('Test purchase sent successfully');
      } else {
        toast.error('Test purchase failed');
      }
    } catch (error: any) {
      toast.error(`Purchase failed: ${error.message}`);
      setResults({ ...results, purchase: { error: error.message } });
    } finally {
      setLoading(null);
    }
  };

  const handleTriggerBackfill = async () => {
    if (!backfillUrl) {
      toast.error('Please enter backfill webhook URL');
      return;
    }
    
    setLoading('backfill');
    try {
      const response = await fetch(backfillUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          trigger: 'backfill', 
          timestamp: Date.now() 
        })
      });
      
      const data = await response.json();
      setResults({ ...results, backfill: data });
      
      if (response.ok) {
        toast.success('Backfill triggered successfully');
      } else {
        toast.error('Backfill trigger failed');
      }
    } catch (error: any) {
      toast.error(`Backfill failed: ${error.message}`);
      setResults({ ...results, backfill: { error: error.message } });
    } finally {
      setLoading(null);
    }
  };

  const handleHealthWebhook = async () => {
    if (!healthWebhookUrl) {
      toast.error('Please enter health webhook URL');
      return;
    }
    
    setLoading('healthWebhook');
    try {
      const response = await fetch(healthWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          trigger: 'health_check', 
          timestamp: Date.now() 
        })
      });
      
      const data = await response.json();
      setResults({ ...results, healthWebhook: data });
      
      if (response.ok) {
        toast.success('Health webhook triggered successfully');
      } else {
        toast.error('Health webhook failed');
      }
    } catch (error: any) {
      toast.error(`Health webhook failed: ${error.message}`);
      setResults({ ...results, healthWebhook: { error: error.message } });
    } finally {
      setLoading(null);
    }
  };

  const ResultDisplay = ({ result }: { result: any }) => {
    if (!result) return null;
    
    return (
      <div className="mt-4 p-4 bg-muted rounded-lg border">
        <pre className="text-xs overflow-auto max-h-64">
          {JSON.stringify(result, null, 2)}
        </pre>
      </div>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Meta CAPI Proxy Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Timezone: Asia/Dubai | Currency: AED
        </p>
      </div>

      {/* Health Check */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Activity className="h-6 w-6 text-primary" />
          <h2 className="text-xl font-semibold">Health Check</h2>
        </div>
        <Button 
          onClick={handleHealthCheck} 
          disabled={loading === 'health'}
        >
          {loading === 'health' ? 'Checking...' : 'Run Health Check'}
        </Button>
        <ResultDisplay result={results.health} />
      </Card>

      {/* Test Purchase */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <ShoppingCart className="h-6 w-6 text-primary" />
          <h2 className="text-xl font-semibold">Send Test Purchase</h2>
        </div>
        <div className="space-y-4">
          <div>
            <Label htmlFor="test-email">Email</Label>
            <Input 
              id="test-email"
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="test@ptdfitness.com"
            />
          </div>
          <div>
            <Label htmlFor="test-value">Value (AED)</Label>
            <Input 
              id="test-value"
              type="number"
              value={testValue}
              onChange={(e) => setTestValue(e.target.value)}
              placeholder="500"
            />
          </div>
          <Button 
            onClick={handleTestPurchase} 
            disabled={loading === 'purchase'}
          >
            {loading === 'purchase' ? 'Sending...' : 'Send Test Purchase'}
          </Button>
        </div>
        <ResultDisplay result={results.purchase} />
      </Card>

      {/* Backfill */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <RefreshCw className="h-6 w-6 text-primary" />
          <h2 className="text-xl font-semibold">Trigger Backfill</h2>
        </div>
        <div className="space-y-4">
          <div>
            <Label htmlFor="backfill-url">Backfill Webhook URL</Label>
            <Input 
              id="backfill-url"
              type="url"
              value={backfillUrl}
              onChange={(e) => setBackfillUrl(e.target.value)}
              placeholder="https://your-webhook.com/backfill"
            />
          </div>
          <Button 
            onClick={handleTriggerBackfill} 
            disabled={loading === 'backfill'}
          >
            {loading === 'backfill' ? 'Triggering...' : 'Trigger Backfill'}
          </Button>
        </div>
        <ResultDisplay result={results.backfill} />
      </Card>

      {/* Health Webhook */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Heart className="h-6 w-6 text-primary" />
          <h2 className="text-xl font-semibold">Run Health Check</h2>
        </div>
        <div className="space-y-4">
          <div>
            <Label htmlFor="health-webhook-url">Health Webhook URL</Label>
            <Input 
              id="health-webhook-url"
              type="url"
              value={healthWebhookUrl}
              onChange={(e) => setHealthWebhookUrl(e.target.value)}
              placeholder="https://your-webhook.com/health"
            />
          </div>
          <Button 
            onClick={handleHealthWebhook} 
            disabled={loading === 'healthWebhook'}
          >
            {loading === 'healthWebhook' ? 'Running...' : 'Run Health Webhook'}
          </Button>
        </div>
        <ResultDisplay result={results.healthWebhook} />
      </Card>
    </div>
  );
}
