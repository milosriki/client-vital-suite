import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Plus, Save, Trash2, RefreshCw } from "lucide-react";

interface EventMappingTabProps {
  mode: "test" | "live";
}

const META_STANDARD_EVENTS = [
  "PageView",
  "ViewContent",
  "Search",
  "AddToCart",
  "AddToWishlist",
  "InitiateCheckout",
  "AddPaymentInfo",
  "Purchase",
  "Lead",
  "CompleteRegistration",
  "Contact",
  "CustomizeProduct",
  "Donate",
  "FindLocation",
  "Schedule",
  "StartTrial",
  "SubmitApplication",
  "Subscribe",
];

export default function EventMappingTab({ mode }: EventMappingTabProps) {
  const queryClient = useQueryClient();
  const [newHubSpotEvent, setNewHubSpotEvent] = useState("");
  const [newMetaEvent, setNewMetaEvent] = useState("Lead");
  const [editingId, setEditingId] = useState<string | null>(null);

  // Fetch event mappings
  const { data: mappings, isLoading } = useQuery({
    queryKey: ["event-mappings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_mappings")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Toggle event active status
  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("event_mappings")
        .update({ is_active })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-mappings"] });
      toast({
        title: "Success",
        description: "Event mapping updated",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update mapping",
        variant: "destructive",
      });
    },
  });

  // Add new event mapping
  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("event_mappings")
        .insert({
          hubspot_event_name: newHubSpotEvent.toLowerCase().replace(/\s+/g, ''),
          meta_event_name: newMetaEvent,
          is_active: true,
          event_parameters: { currency: "AED" },
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-mappings"] });
      setNewHubSpotEvent("");
      setNewMetaEvent("Lead");
      toast({
        title: "Success",
        description: "Event mapping added",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add mapping",
        variant: "destructive",
      });
    },
  });

  // Delete event mapping
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("event_mappings")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-mappings"] });
      toast({
        title: "Success",
        description: "Event mapping deleted",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete mapping",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-6">
      {/* Add New Event Mapping */}
      <Card>
        <CardHeader>
          <CardTitle>Add Event Mapping</CardTitle>
          <CardDescription>
            Map HubSpot lifecycle events to Meta Conversions API standard events
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="hubspot-event">HubSpot Event Name</Label>
              <Input
                id="hubspot-event"
                placeholder="e.g., marketingqualifiedlead"
                value={newHubSpotEvent}
                onChange={(e) => setNewHubSpotEvent(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="meta-event">Meta Standard Event</Label>
              <Select value={newMetaEvent} onValueChange={setNewMetaEvent}>
                <SelectTrigger id="meta-event">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {META_STANDARD_EVENTS.map((event) => (
                    <SelectItem key={event} value={event}>
                      {event}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                onClick={() => addMutation.mutate()}
                disabled={!newHubSpotEvent || addMutation.isPending}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Mapping
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Event Mappings Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Event Mappings</CardTitle>
              <CardDescription>
                Configure which HubSpot events are sent to Meta CAPI
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["event-mappings"] })}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading mappings...</div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>HubSpot Event</TableHead>
                    <TableHead>Meta Event</TableHead>
                    <TableHead>Parameters</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mappings?.map((mapping: any) => (
                    <TableRow key={mapping.id}>
                      <TableCell className="font-medium">
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {mapping.hubspot_event_name}
                        </code>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{mapping.meta_event_name}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {JSON.stringify(mapping.event_parameters)}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={mapping.is_active}
                          onCheckedChange={(checked) =>
                            toggleMutation.mutate({ id: mapping.id, is_active: checked })
                          }
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteMutation.mutate(mapping.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mode Indicator */}
      <Card className="bg-muted/50">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant={mode === "test" ? "secondary" : "default"}>
                {mode.toUpperCase()} MODE
              </Badge>
              <span className="text-sm text-muted-foreground">
                {mode === "test" 
                  ? "Events will use test_event_code for validation"
                  : "Events will be sent to production Meta CAPI"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
