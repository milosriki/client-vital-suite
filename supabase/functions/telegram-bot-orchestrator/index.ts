import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { unifiedAI } from "../_shared/unified-ai-client.ts";
import { corsHeaders } from "../_shared/cors.ts";

const BOT_TOKENS = {
  CRAW: Deno.env.get("TELEGRAM_BOT_TOKEN_CRAW"),
  SALES: Deno.env.get("TELEGRAM_BOT_TOKEN_SALES"),
  MARKETING: Deno.env.get("TELEGRAM_BOT_TOKEN_MARKETING"),
  EXPERT: Deno.env.get("TELEGRAM_BOT_TOKEN_EXPERT"),
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const botType = url.searchParams.get("bot"); // ?bot=craw, ?bot=sales, etc.
    const token = BOT_TOKENS[botType?.toUpperCase()];

    if (!token) {
      return new Response("Invalid bot type", { status: 400 });
    }

    const update = await req.json();
    const message = update.message;

    if (!message || !message.text) return new Response("ok");

    const chatId = message.chat.id;
    const text = message.text;
    const user = message.from.username || "Unknown";

    console.log(`[Telegram] ${botType} | User: ${user} | Msg: ${text}`);

    // Select Persona based on Bot Type
    let systemPrompt = "";
    let agentType = "default";

    switch (botType) {
      case "craw":
        systemPrompt = "You are CRAW, the Autonomous Developer. You help Milos build, fix, and architect the system. You have deep technical knowledge.";
        agentType = "default";
        break;
      case "sales":
        systemPrompt = "You are the Riki Sales Bot. You are a world-class closer using NEPQ methodology. You handle objections and close deals.";
        agentType = "lisa"; // Fast, high EQ
        break;
      case "marketing":
        systemPrompt = "You are the PTD Marketing Bot. You analyze ad spend, creative performance, and budget allocation. You are analytical and data-driven.";
        agentType = "atlas"; // Deep reasoning
        break;
      case "expert":
        systemPrompt = "You are Riki (Business Brain). You are the CEO's strategic advisor. You think in systems, revenue models, and long-term strategy.";
        agentType = "atlas"; // Deep reasoning
        break;
      default:
        systemPrompt = "You are a helpful PTD Fitness assistant.";
    }

    // Call Unified AI (Brain)
    const aiResponse = await unifiedAI.chat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: text }
      ],
      {
        agentType: agentType as any,
        temperature: 0.7,
        max_tokens: 1000
      }
    );

    // Send Reply via Telegram API
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: aiResponse.content,
        parse_mode: "Markdown"
      })
    });

    return new Response("ok", { headers: corsHeaders });

  } catch (err) {
    console.error("Telegram Error:", err);
    return new Response("error", { status: 500 });
  }
});
