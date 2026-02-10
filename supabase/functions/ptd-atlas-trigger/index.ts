import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ATLAS_FUNCTION_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1/ptd-agent-atlas`;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

console.log("🚀 Atlas Trigger Service Started");

serve(async (req) => {
  try {
    const payload = await req.json();

    // 1. Validate Webhook Payload (INSERT on agent_tasks)
    if (
      !payload.record ||
      payload.type !== "INSERT" ||
      payload.table !== "agent_tasks"
    ) {
      console.log("⚠️ Invalid trigger payload or not an INSERT event", payload);
      return new Response("Ignored", { status: 200 });
    }

    const task = payload.record;
    console.log(
      `⚡ Triggering Atlas for Task ID: ${task.id} (Type: ${task.task_type})`,
    );

    // 2. Call ptd-agent-atlas asynchronously (Fire & Forget strategy for webhook speed)
    // We pass the task details directly so Atlas knows what to do
    const atlasPayload = {
      message: `TASK_TRIGGER:${task.id}`, // Special instruction for Atlas
      context: {
        source: "agent_task_trigger",
        taskId: task.id,
        taskType: task.task_type,
        payload: task.payload,
      },
    };

    // We don't await the full result here to keep the DB webhook fast
    fetch(ATLAS_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify(atlasPayload),
    }).catch((err) => console.error("❌ Failed to invoke Atlas:", err));

    return new Response(JSON.stringify({ queued: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("❌ Trigger Error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
});
