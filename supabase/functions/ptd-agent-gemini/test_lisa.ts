import { UnifiedAIClient } from "../_shared/unified-ai-client.ts";
import { buildSystemPrompt } from "../_shared/unified-lisa-prompt.ts";
import { tools } from "../_shared/tool-definitions.ts";

const client = new UnifiedAIClient();

const lisaTools = tools.filter(t => 
  ["check_capacity", "location_control", "sales_flow_control", "lead_control", "get_success_stories", "hubspot_control"].includes(t.name)
);

const runTest = async (testName: string, userInput: string) => {
  console.log(`\n========================================`);
  console.log(`🧪 TEST: ${testName}`);
  console.log(`🗣️ USER: ${userInput}`);
  
  const now = new Date();
  const gstFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Dubai',
    weekday: 'long',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  const currentGSTTime = gstFormatter.format(now);

  const context = {
    relevant_knowledge: [
      { content: "PTD Ultimate Package: 4000 AED/month. Includes elite coaching, nutrition, and 24/7 access." },
      { content: "We cover Dubai Marina, Downtown, and JVC." }
    ],
    currentGSTTime
  };
  
  const systemPrompt = buildSystemPrompt(context) + `\nLIVE NOW (GST): ${currentGSTTime}`;
  
  try {
    const response = await client.chat([
      { role: "system", content: systemPrompt },
      { role: "user", content: userInput }
    ], {
      agentType: "lisa",
      tools: lisaTools,
      max_tokens: 300
    });

    console.log(`\n🤖 LISA (Tool Calls):`, response.tool_calls || 'None');
    console.log(`🤖 LISA (Response):\n${response.content}`);
  } catch (err) {
    console.error(`❌ ERROR:`, err);
  }
};

const main = async () => {
  // Test 1: Vendor Bouncer
  await runTest(
    "Vendor Shield (B2B Spam)", 
    "Hi Lisa, I run an SEO and marketing agency for fitness brands in Dubai. Are you the owner? I can help you guys get 50 more leads a month."
  );

  // Test 2: Organic Package Conversation
  await runTest(
    "Multi-Part Package Query", 
    "Hey! What are your package prices? And do you have trainers that can come to my gym in Business Bay?"
  );

  // Test 3: Capacity Checking before Booking
  await runTest(
    "Booking 'Tomorrow at 4pm' trap", 
    "I want to book an assessment for tomorrow at 4pm. Let's do it."
  );
};

main();
