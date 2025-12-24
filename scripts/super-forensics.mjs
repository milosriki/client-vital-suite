import Anthropic from '@anthropic-ai/sdk';
import Stripe from 'stripe';
import readline from 'readline';
import fs from 'fs';

// Load keys from environment (never hardcode secrets)
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

if (!STRIPE_KEY) {
  console.error("❌ Error: STRIPE_SECRET_KEY is missing. Please set it in your environment.");
  process.exit(1);
}

if (!ANTHROPIC_KEY) {
  console.error("❌ Error: ANTHROPIC_API_KEY is missing. Please set it in your environment.");
  process.exit(1);
}

const stripe = new Stripe(STRIPE_KEY);
const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log("\n🕵️  SUPER-FORENSICS: Local LLM + Direct Stripe API Access");
console.log("=======================================================");
console.log("Capabilities: Trace Payouts, Check Bank Changes, Audit Logs (Live Stripe Data)");
console.log("Type 'exit' to quit.\n");

const tools = [
  {
    name: "list_stripe_events",
    description: "List raw Stripe events to find changes (e.g., 'payout.updated', 'account.external_account.created'). Note: Only goes back 30 days.",
    input_schema: {
      type: "object",
      properties: {
        types: { type: "array", items: { type: "string" }, description: "Event types to filter by" },
        limit: { type: "number", description: "Max results (default 20)" }
      },
      required: ["types"]
    }
  },
  {
    name: "list_payouts",
    description: "List payouts to trace money movement. Goes back indefinitely.",
    input_schema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max results (default 20)" },
        status: { type: "string", description: "Filter by status (paid, pending, etc.)" },
        arrival_date_start: { type: "number", description: "Unix timestamp for start date" },
        arrival_date_end: { type: "number", description: "Unix timestamp for end date" }
      }
    }
  },
  {
    name: "get_account_details",
    description: "Get details of the current Stripe account, including external bank accounts.",
    input_schema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "search_charges",
    description: "Search for specific charges or refunds.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query (e.g. 'amount>1000')" },
        limit: { type: "number" }
      },
      required: ["query"]
    }
  }
];

let messages = [
  { role: "system", content: "You are a Forensic Accountant AI. You have DIRECT access to the Stripe API via tools. Your goal is to trace money, find deleted wallets, and identify suspicious activity. When asked to trace, use 'list_payouts' and 'list_stripe_events' to build a timeline. Always show IDs, Dates, and Amounts." }
];

async function chat() {
  rl.question('You: ', async (input) => {
    if (input.toLowerCase() === 'exit') {
      rl.close();
      return;
    }

    messages.push({ role: "user", content: input });

    try {
      console.log("Thinking...");
      
      let currentResponse = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20240620",
        max_tokens: 4096,
        messages: messages.filter(m => m.role !== 'system'),
        system: messages[0].content,
        tools: tools
      });

      // Handle tool calls loop
      while (currentResponse.stop_reason === "tool_use") {
        const toolUse = currentResponse.content.find(c => c.type === "tool_use");
        if (toolUse) {
          console.log(`🛠️  Calling Tool: ${toolUse.name}`, toolUse.input);
          
          let toolResult = "";
          try {
            if (toolUse.name === "list_stripe_events") {
              const res = await stripe.events.list({ 
                types: toolUse.input.types, 
                limit: toolUse.input.limit || 20 
              });
              toolResult = JSON.stringify(res.data);
            } else if (toolUse.name === "list_payouts") {
              const params = { limit: toolUse.input.limit || 20, expand: ['data.destination'] };
              if (toolUse.input.status) params.status = toolUse.input.status;
              if (toolUse.input.arrival_date_start) params.arrival_date = { gte: toolUse.input.arrival_date_start };
              const res = await stripe.payouts.list(params);
              toolResult = JSON.stringify(res.data);
            } else if (toolUse.name === "get_account_details") {
              const res = await stripe.accounts.retrieve();
              const ext = await stripe.accounts.listExternalAccounts(res.id);
              toolResult = JSON.stringify({ account: res, external_accounts: ext.data });
            } else if (toolUse.name === "search_charges") {
              const res = await stripe.charges.search({ query: toolUse.input.query, limit: toolUse.input.limit || 20 });
              toolResult = JSON.stringify(res.data);
            }
          } catch (e) {
            toolResult = `Error: ${e.message}`;
          }

          messages.push({ role: "assistant", content: currentResponse.content });
          messages.push({
            role: "user",
            content: [
              {
                type: "tool_result",
                tool_use_id: toolUse.id,
                content: toolResult
              }
            ]
          });

          console.log("   -> Tool executed. Analyzing results...");
          currentResponse = await anthropic.messages.create({
            model: "claude-3-5-sonnet-20240620",
            max_tokens: 4096,
            messages: messages.filter(m => m.role !== 'system'),
            system: messages[0].content,
            tools: tools
          });
        }
      }

      const text = currentResponse.content.find(c => c.type === "text")?.text;
      console.log(`\nAgent: ${text}\n`);
      messages.push({ role: "assistant", content: text });

    } catch (error) {
      console.error("\nError:", error.message);
    }

    chat();
  });
}

chat();
