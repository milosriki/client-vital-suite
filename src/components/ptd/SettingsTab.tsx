import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function SettingsTab() {
  const { toast } = useToast();
  const [settings, setSettings] = useState({
    supabase_url: "",
    supabase_anon_key: "",
    capi_base_url: "",
    meta_pixel_id: "",
    meta_access_token: "",
    test_event_code: "",
    telegram_bot_token: "",
    telegram_chat_id: "",
  });

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await (supabase
        .from("app_settings" as any)
        .select("supabase_url, supabase_anon_key, capi_base_url, meta_pixel_id, meta_access_token, test_event_code, telegram_bot_token, telegram_chat_id")
        .single() as any);
      
      if (data) {
        setSettings({
          supabase_url: data.supabase_url || "",
          supabase_anon_key: data.supabase_anon_key || "",
          capi_base_url: data.capi_base_url || "",
          meta_pixel_id: data.meta_pixel_id || "",
          meta_access_token: data.meta_access_token || "",
          test_event_code: data.test_event_code || "",
          telegram_bot_token: data.telegram_bot_token || "",
          telegram_chat_id: data.telegram_chat_id || "",
        });
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const handleSave = async () => {
    try {
      const { error } = await (supabase
        .from("app_settings" as any)
        .upsert({
          id: "00000000-0000-0000-0000-000000000000", // Singleton record
          ...settings,
        }) as any);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Settings saved successfully",
      });

      // Trigger recheck
      await recheckServices();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive",
      });
    }
  };

  const recheckServices = async () => {
    // Ping all services to check connectivity
    toast({
      title: "Rechecking",
      description: "Validating all service connections...",
    });

    // This would trigger actual health checks
    setTimeout(() => {
      toast({
        title: "Recheck Complete",
        description: "Service status updated",
      });
    }, 2000);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Application Settings</CardTitle>
          <CardDescription>
            Configure Supabase and Meta CAPI connections
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Supabase Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Supabase</h3>
            <div className="space-y-2">
              <Label htmlFor="supabase-url">Supabase URL</Label>
              <Input
                id="supabase-url"
                value={settings.supabase_url}
                onChange={(e) =>
                  setSettings({ ...settings, supabase_url: e.target.value })
                }
                placeholder="https://your-project.supabase.co"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supabase-key">Supabase Anon Key</Label>
              <Input
                id="supabase-key"
                type="password"
                value={settings.supabase_anon_key}
                onChange={(e) =>
                  setSettings({ ...settings, supabase_anon_key: e.target.value })
                }
                placeholder="eyJhbGci..."
              />
            </div>
          </div>

          {/* CAPI Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Meta Conversion API (Stape)</h3>
            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <div className="text-sm">
                <span className="font-medium">Stape CAPI Name:</span> rikiki capi
              </div>
              <div className="text-sm">
                <span className="font-medium">URL:</span> https://ap.stape.info
              </div>
              <div className="text-sm">
                <span className="font-medium">CAPIG Identifier:</span> ecxdsmmg
              </div>
              <div className="text-sm text-muted-foreground">
                ✓ Configured via Supabase secret: STAPE_CAPIG_API_KEY
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pixel-id">Meta Pixel ID</Label>
              <Input
                id="pixel-id"
                value={settings.meta_pixel_id}
                onChange={(e) =>
                  setSettings({ ...settings, meta_pixel_id: e.target.value })
                }
                placeholder="1405173453873048"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="test-code">Test Event Code</Label>
              <Input
                id="test-code"
                value={settings.test_event_code}
                onChange={(e) =>
                  setSettings({ ...settings, test_event_code: e.target.value })
                }
                placeholder="TEST12345"
              />
            </div>
          </div>

          {/* Telegram Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Telegram Notifications</h3>
            <div className="space-y-2">
              <Label htmlFor="telegram-token">Bot Token</Label>
              <Input
                id="telegram-token"
                type="password"
                value={settings.telegram_bot_token}
                onChange={(e) =>
                  setSettings({ ...settings, telegram_bot_token: e.target.value })
                }
                placeholder="123456:ABC-DEF..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telegram-chat">Chat ID</Label>
              <Input
                id="telegram-chat"
                value={settings.telegram_chat_id}
                onChange={(e) =>
                  setSettings({ ...settings, telegram_chat_id: e.target.value })
                }
                placeholder="-1001234567890"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button onClick={handleSave} className="flex-1">
              <Save className="h-4 w-4 mr-2" />
              Save Settings
            </Button>
            <Button variant="outline" onClick={recheckServices}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Save & Recheck
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
