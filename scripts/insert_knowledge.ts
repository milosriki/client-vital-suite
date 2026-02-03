
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  Deno.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function insertKnowledge() {
  const content = "We are Personal Trainers Dubai (PTD), a premier personal training company operating in Dubai and Abu Dhabi. We provide mobile personal training services, meaning we come to the client's location - whether it's their home, gym, or a park. We do not have a single physical gym where clients come to us; instead, we bring the gym and the trainer to them. We specialize in customized fitness plans, weight loss, muscle building, and overall health improvement.";
  
  const { data, error } = await supabase
    .from('knowledge_base')
    .insert([
      {
        content: content,
        metadata: { topics: ["about us", "locations", "services", "mobile training"] },
        source: 'core_business_context',
        category: 'general'
      }
    ]);

  if (error) {
    console.error("Error inserting knowledge:", error);
  } else {
    console.log("Successfully inserted core business context into knowledge_base.");
  }
}

insertKnowledge();
