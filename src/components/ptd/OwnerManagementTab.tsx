import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Search } from "lucide-react";
import { useDedupedQuery } from "@/hooks/useDedupedQuery";

export function OwnerManagementTab() {
  const [contactId, setContactId] = useState("");
  const [newOwnerId, setNewOwnerId] = useState("");
  const [oldOwnerId, setOldOwnerId] = useState("");
  const [reason, setReason] = useState("MANUAL_REASSIGNMENT");
  const [maxReassignments, setMaxReassignments] = useState(50);
  const [slaMinutes, setSlaMinutes] = useState(20);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Fetch owners for dropdown
  const { data: ownersData } = useDedupedQuery({
    queryKey: ["hubspot-owners-management"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("hubspot-live-query", {
        body: { query: "owners" }
      });
      if (error) throw error;
      return data;
    },
    staleTime: 300000, // Cache for 5 minutes
  });

  // Search contacts
  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    setIsSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke("hubspot-live-query", {
        body: {
          query: "search",
          search_term: searchTerm,
          limit: 20,
        }
      });
      if (error) throw error;
      setSearchResults(data?.contacts || []);
    } catch (error: any) {
      toast({
        title: "Search Failed",
        description: error.message || "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const reassignMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("hubspot-live-query", {
        body: {
          query: "reassign",
          contact_id: contactId,
          new_owner_id: newOwnerId,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Reassignment failed");
      return data;
    },
    onSuccess: (data) => {
      toast({ 
        title: "Owner reassigned", 
        description: `Contact ${data.contact_id} → ${data.new_owner_name || data.new_owner_id}` 
      });
      setContactId("");
      setNewOwnerId("");
    },
    onError: (err: any) => {
      toast({ title: "Reassignment failed", description: err?.message || "Unknown error", variant: "destructive" });
    },
  });

  const autoReassignMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("auto-reassign-leads", {
        body: {
          max_reassignments: maxReassignments,
          sla_minutes: slaMinutes,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Auto reassignment failed");
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Auto reassignment complete",
        description: `${data.summary?.reassigned || 0} reassigned, ${data.summary?.skipped || 0} skipped`,
      });
    },
    onError: (err: any) => {
      toast({ title: "Auto reassignment failed", description: err?.message || "Unknown error", variant: "destructive" });
    },
  });

  // Note: reassignment_log table may need to be created in Supabase
  // For now, we'll skip this query to avoid type errors
  const { data: reassignmentLog } = useDedupedQuery({
    queryKey: ["reassignment-log"],
    queryFn: async () => {
      // Try to fetch from reassignment_log if it exists
      try {
        const { data, error } = await (supabase as any)
          .from("reassignment_log")
          .select("contact_id, old_owner_id, new_owner_id, reason, reassigned_at")
          .order("reassigned_at", { ascending: false })
          .limit(20);
        if (error) return [];
        return data || [];
      } catch {
        return [];
      }
    },
    staleTime: 30_000,
  });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Manual Owner Reassignment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Contact Search */}
          <div className="space-y-1">
            <Label>Search Contact</Label>
            <div className="flex gap-2">
              <Input 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, email, or phone..."
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button onClick={handleSearch} disabled={isSearching} size="icon">
                <Search className="h-4 w-4" />
              </Button>
            </div>
            {searchResults.length > 0 && (
              <div className="border rounded-lg p-2 max-h-40 overflow-y-auto space-y-1 mt-2">
                {searchResults.map((contact: any) => (
                  <div
                    key={contact.id}
                    className="p-2 hover:bg-muted rounded cursor-pointer"
                    onClick={() => {
                      setContactId(contact.id);
                      setSearchTerm(contact.name);
                      setSearchResults([]);
                    }}
                  >
                    <div className="font-medium">{contact.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {contact.email} • {contact.phone}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label>Contact ID (HubSpot ID)</Label>
            <Input value={contactId} onChange={(e) => setContactId(e.target.value)} placeholder="123456 or search above" />
          </div>
          <div className="space-y-1">
            <Label>New Owner</Label>
            <Select value={newOwnerId} onValueChange={setNewOwnerId}>
              <SelectTrigger>
                <SelectValue placeholder="Select owner" />
              </SelectTrigger>
              <SelectContent>
                {(ownersData?.owners || []).map((owner: any) => (
                  <SelectItem key={owner.id} value={owner.id}>
                    {owner.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Reason</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <Button 
            onClick={() => reassignMutation.mutate()} 
            disabled={reassignMutation.isPending || !contactId || !newOwnerId}
            className="w-full"
          >
            {reassignMutation.isPending ? "Reassigning..." : "Reassign Owner"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Auto Reassign (SLA Breach)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>Max Reassignments</Label>
            <Input
              type="number"
              value={maxReassignments}
              onChange={(e) => setMaxReassignments(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1">
            <Label>SLA Minutes</Label>
            <Input
              type="number"
              value={slaMinutes}
              onChange={(e) => setSlaMinutes(Number(e.target.value))}
            />
          </div>
          <Button onClick={() => autoReassignMutation.mutate()} disabled={autoReassignMutation.isPending}>
            {autoReassignMutation.isPending ? "Running..." : "Run Auto Reassign"}
          </Button>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Recent Reassignments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(reassignmentLog || []).length === 0 && <p className="text-sm text-muted-foreground">No reassignment history found.</p>}
          <div className="space-y-1">
            {(reassignmentLog || []).map((row: any, idx: number) => (
              <div key={idx} className="flex justify-between text-sm border-b border-border pb-1">
                <div>
                  <div className="font-medium">Contact {row.contact_id}</div>
                  <div className="text-muted-foreground">{row.reason}</div>
                </div>
                <div className="text-right text-muted-foreground">
                  <div>{row.old_owner_id || '—'} → {row.new_owner_id}</div>
                  <div>{new Date(row.reassigned_at).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default OwnerManagementTab;