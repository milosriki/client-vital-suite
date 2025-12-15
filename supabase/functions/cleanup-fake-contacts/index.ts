import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Delete fake contacts with @email.com domain
    const { data: deletedEmailCom, error: error1 } = await supabase
      .from("contacts")
      .delete()
      .ilike("email", "%@email.com")
      .select("id, email");

    // Delete test@ contacts from before 2023
    const { data: deletedTest, error: error2 } = await supabase
      .from("contacts")
      .delete()
      .ilike("email", "test%@%")
      .lt("created_at", "2023-01-01")
      .select("id, email");

    // Delete @example.com contacts
    const { data: deletedExample, error: error3 } = await supabase
      .from("contacts")
      .delete()
      .ilike("email", "%@example.com")
      .select("id, email");

    // Delete specific known fake contacts
    const { data: deletedSpecific, error: error4 } = await supabase
      .from("contacts")
      .delete()
      .in("email", [
        "test123@gmail.com",
        "test@fb.com",
        "test@marko.com"
      ])
      .select("id, email");

    const totalDeleted = 
      (deletedEmailCom?.length || 0) + 
      (deletedTest?.length || 0) + 
      (deletedExample?.length || 0) + 
      (deletedSpecific?.length || 0);

    const result = {
      success: true,
      deleted: {
        email_com: deletedEmailCom || [],
        test_prefix: deletedTest || [],
        example_com: deletedExample || [],
        specific: deletedSpecific || [],
      },
      total_deleted: totalDeleted,
      errors: [error1, error2, error3, error4].filter(Boolean),
    };

    console.log("Cleanup result:", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    console.error("Cleanup error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
