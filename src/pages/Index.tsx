import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleFixWorkflows = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("fix-n8n-workflows");
      
      if (error) throw error;
      
      toast({
        title: "Workflows Fixed",
        description: (
          <pre className="mt-2 w-full rounded-md bg-slate-950 p-4 overflow-auto max-h-96">
            <code className="text-white text-xs">{JSON.stringify(data, null, 2)}</code>
          </pre>
        ),
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fix workflows",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">Welcome to Your Blank App</h1>
        <p className="text-xl text-muted-foreground mb-6">Start building your amazing project here!</p>
        <Button onClick={handleFixWorkflows} disabled={loading}>
          {loading ? "Fixing Workflows..." : "Fix N8N Workflows"}
        </Button>
      </div>
    </div>
  );
};

export default Index;
