import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const content = "We are Personal Trainers Dubai (PTD), a premier personal training company operating in Dubai and Abu Dhabi. We provide mobile personal training services, meaning we come to the client's location - whether it's their home, gym, or a park. We do not have a single physical gym where clients come to us; instead, we bring the gym and the trainer to them. We specialize in customized fitness plans, weight loss, muscle building, and overall health improvement.";

    // Insert into agent_knowledge directly
    const { data, error } = await supabase
      .from('agent_knowledge')
      .insert([
        {
          content: content,
          structured_data: { topics: ["about us", "locations", "services", "mobile training"] },
          source: 'core_business_context',
          category: 'general',
          title: 'About PTD Fitness'
        }
      ]);

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
