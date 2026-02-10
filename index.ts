import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { unifiedAI } from "../_shared/unified-ai-client.ts";
import { apiSuccess, apiError } from "../_shared/api-response.ts";
import { corsHeaders } from "../_shared/error-handler.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

const AUDIT_PROMPT = `
You are ATLAS, the Executive Brain of PTD Fitness.
Your job is to AUDIT the performance of LISA, our Frontline Booking Agent.

**THE 10-SKILL RUBRIC:**
1.  **Contextual Memory**: Did she ask for info she should have known?
2.  **Strategic Booking**: Did she propose a time when buying signals were present?
3.  **Data Enrichment**: Did she capture key info (goals, injuries) silently?
4.  **Emotional Intelligence**: Did she match the user's energy?
5.  **Objection Handling**: Did she turn "No" into "Not yet"?
6.  **Handoff Mastery**: Did she hand off to Atlas for Business/Finance queries?
7.  **Multi-Modal**: Did she handle voice/images well (if applicable)?
8.  **Proactive Nurture**: Was the follow-up timely?
9.  **Compliance**: Did she AVOID making business decisions (Refunds/Strategy)?
10. **Tone**: Was she "Big Sister" (Supportive but Firm), not "Salesy"?

**TASK:**
Analyze the provided conversation history.
1. Give a **Score (0-100)**.
2. Identify the **Top Weakness**.
3. Create a **Short Lesson** (Max 2 sentences) for Lisa to memorize.

**OUTPUT JSON:**
{
  "score": 85,
  "weakness": "Strategic Booking",
  "lesson": "When a user says they are 'ready to start', immediately offer a specific time slot (e.g., 'I have 4pm open'). Do not ask generic questions.",
  "analysis": "Lisa handled the objection well but missed the buying signal in the last message."
}
`;

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { limit = 5 } = await req.json();

    // 1. Fetch recent interactions (ungraded)
    // In a real implementation, we'd filter by 'graded: false' or check a separate 'audits' table.
    // For now, we grab the last N.
    const { data: interactions, error } = await supabase
      .from("whatsapp_interactions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    if (!interactions || interactions.length === 0) {
      return apiSuccess({ message: "No interactions to audit" });
    }

    const auditResults = [];

    // 2. Audit each interaction (or group by phone_number for conversation context)
    // Grouping by phone number to get full context is better.
    const conversations: Record<string, any[]> = {};
    interactions.forEach((i: any) => {
      if (!conversations[i.phone_number]) conversations[i.phone_number] = [];
      conversations[i.phone_number].push(i);
    });

    for (const [phone, msgs] of Object.entries(conversations)) {
      // Sort messages by time
      const history = msgs.sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );

      const transcript = history
        .map((m: any) => `User: ${m.message_text}\nLisa: ${m.response_text}`)
        .join("\n---\n");

      // 3. Ask Atlas (Gemini 3) to Grade
      const result = await unifiedAI.chat(
        [
          { role: "system", content: AUDIT_PROMPT },
          { role: "user", content: `TRANSCRIPT FOR ${phone}:\n${transcript}` },
        ],
        { jsonMode: true, model: "gemini-3-flash-preview" },
      );

      const grading = JSON.parse(result.content);

      // 4. Store the Lesson (Feedback Loop)
      // Storing in 'agent_knowledge' or a dedicated 'agent_lessons' table.
      // Using 'agent_knowledge' with a specific tag for now.
      const lessonEntry = {
        category: "learning",
        subcategory: "skill_improvement",
        title: `Improvement: ${grading.weakness}`,
        content: grading.lesson,
        structured_data: {
          score: grading.score,
          source_interaction: msgs[msgs.length - 1].id,
          grading_model: result.model,
        },
        source: "atlas_audit",
      };

      await supabase.from("agent_knowledge").insert(lessonEntry);

      auditResults.push({ phone, grading });
    }

    return apiSuccess({ audits: auditResults });
  } catch (err) {
    return apiError("INTERNAL_ERROR", (err as Error).message, 500);
  }
});
