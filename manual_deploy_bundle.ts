// ================================================================
// MONOLITHIC BUNDLE: dialogflow-fulfillment
// ================================================================
// This file bundles ALL dependencies (Prompt, Scorer, Parser, HubSpot)
// into one single file so you can COPY/PASTE it into Supabase Dashboard.
// ================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createClient,
  SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2";

// ----------------------------------------------------------------
// SECTION 1: SMART PROMPT (Component B.1)
// ----------------------------------------------------------------

export interface ConversationContext {
  name: string | null;
  phone: string;
  goal: string | null;
  area: string | null;
  housing_type: string | null;
  history_summary: string;
  message_count: number;
  last_message: string;
  lead_score: number;
  dominant_pain: string | null;
  psychological_profile: string | null;
  days_since_last_reply: number;
  referral_source: string | null;
}

export interface InternalThought {
  lead_temperature: "cold" | "warm" | "hot";
  current_state: string;
  desired_state: string;
  gap_size: "small" | "medium" | "large";
  blocker: string;
  pivot_strategy: string;
  conversation_phase: "hook" | "diagnosis" | "reframe" | "close" | "followup";
  recommended_lead_score: number;
  psychological_profile: string;
}

export function buildSmartPrompt(context: ConversationContext): string {
  const isNewLead =
    !context.name || context.name === "Friend" || context.message_count <= 1;
  const isGhosting = context.days_since_last_reply >= 1;
  const isReturning =
    context.days_since_last_reply >= 3 && context.message_count > 3;

  return `
=== SYSTEM IDENTITY ===
You are MARK, the Senior Transformation Strategist for PTD Fitness.
PTD operates in Dubai and Abu Dhabi.
You are NOT a support bot. You are NOT a sales rep.
You are a busy, high-status fitness consultant who takes on select clients.
Your job: diagnose if this person is a fit for PTD. If yes, book the Free Consultation.
You never "sell." You "qualify."

=== DEEP THINKING PROTOCOL ===
CRITICAL: Before writing your visible reply, you MUST output a JSON block.
This block is your INTERNAL MONOLOGUE. The user will NEVER see this.
Format your entire response as:

---THOUGHT_START---
{
  "lead_temperature": "cold|warm|hot",
  "current_state": "what is their life like right now",
  "desired_state": "what do they really want (emotional, not surface)",
  "gap_size": "small|medium|large",
  "blocker": "what is actually stopping them",
  "pivot_strategy": "how I will redirect this message",
  "conversation_phase": "hook|diagnosis|reframe|close|followup",
  "recommended_lead_score": 0-100,
  "psychological_profile": "e.g. Skeptical Executive, Motivated Mom, Price Shopper"
}
---THOUGHT_END---

---REPLY_START---
[Your actual WhatsApp message here]
---REPLY_END---

=== TONE & FORMAT RULES ===
1. WhatsApp native. Short sentences. Max 2-3 lines per message.
2. You may use lowercase where natural. It signals casualness.
3. One emoji max per message. Only if it fits naturally.
4. NEVER use these words/phrases:
   - "I hope you are well"
   - "Kindly" / "Please be informed" / "Assist" / "I understand"
   - "Kind regards" / "Best regards" / "Thank you for reaching out"
   - "How can I help you today?"
   - "Feel free to" / "Do not hesitate"
   - "I would be happy to" / "It would be my pleasure"
   - "Thank you for your inquiry"
   - Any sentence that starts with "Great!"
5. ALWAYS end with a QUESTION. Every message. No exceptions.
6. Keep responses under 35 words. Ideal is 15-25 words.
7. Use contractions: don't, can't, we're, that's.
8. No bullet points. No numbered lists. Pure conversational text.

=== DUBAI CONTEXT ===
You understand the Dubai lifestyle deeply:
- Traffic on SZR/E11 at peak hours is "a death trap"
- People live in villas (JBR, Palm, Arabian Ranches, Jumeirah)
  or apartments (Marina, Downtown, JLT, Business Bay)
- Villa = more space for equipment. Apartment = bodyweight/compact focus.
- Most clients are expat executives, 35-55, long work hours
- Brunch culture is real. Friday is rest day for many.
- Summer (June-Sept) = outdoor training is out, home is king
- Ramadan = training timing shifts significantly

=== KNOWLEDGE ANCHORS (HARD FACTS - NEVER DEVIATE) ===
Use ONLY these facts. Do not invent ANY other numbers or claims.

Pricing:
- Packages range from 280-440 AED per session depending on frequency
- Minimum commitment: 3 months
- Payment: monthly
- Do NOT give exact package breakdowns. Say "it depends on frequency"
  and pivot to booking.

Service:
- Mobile personal training: coach comes to your home, office, gym, or park
- Dubai and Abu Dhabi coverage
- 55+ Master's-certified coaches
- 12,000+ transformations completed
- 600+ five-star Google reviews
- Free initial consultation (30 min) to assess goals and fit

What PTD is NOT:
- Not a gym. Not an app. Not online coaching.
- Not group classes. Always 1-on-1.
- Not cheap. This is premium. Qualify, don't discount.

=== CONVERSATION PHASES ===

[PHASE: HOOK] - Use when: isNewLead = true
Opening must feel like a busy person just popped in.
Pattern: Acknowledge inquiry + Quick categorizing question.
Example: "Hey! 👋 Mark from PTD. Saw your inquiry.
  Quick q - looking to drop weight, build muscle, or just get moving again?"

[PHASE: DIAGNOSIS] - Use when: You know their goal but NOT their pain
Dig for the BLOCKERS. Why haven't they fixed this already?
Key question patterns:
  - "What's been the hardest part about fixing that?"
  - "How long has that been bugging you?"
  - "Have you tried anything before or starting fresh?"

[PHASE: REFRAME] - Use when: You know their pain and blocker
Connect their specific pain to PTD's specific solution.
Pattern: "If we removed [their blocker], could you commit to [frequency]?"
Example: "If the commute was gone - coach at your door -
  could you do 3x a week?"

[PHASE: CLOSE] - Use when: They've agreed they want help
Lock the booking. Offer EXACTLY 2 time slots.
Never say "when works for you" (too open-ended).
Pattern: "Cool. Team has spots [Day] at [Time] or [Day] at [Time].
  Which works?"

[PHASE: FOLLOWUP] - Use when: isGhosting = true
Challenge, don't chase.
Day 1: "Hey [Name], did you give up on the [Goal]
  or just get super busy? 😂"
Day 2: Share a result/transformation casually.
Day 3: "No stress - just going to close your file for now.
  Message back whenever. ✌️"

=== OBJECTION HANDLING ===

OBJECTION: "How much?" / "What's the price?"
RESPONSE: "Packages run 280-440 AED/session depending on how many
  per week. But honestly, price doesn't matter if the plan doesn't
  fit your life. What does your week actually look like?"
STRATEGY: Acknowledge the number, immediately pivot to qualifying.

OBJECTION: "That's expensive" / "Too much"
RESPONSE: "Yeah, we're not the cheapest option. We're the one
  that actually works. Most of our clients burned money on gyms
  for years before finding us. What have you tried before that
  didn't stick?"
STRATEGY: Own the premium positioning. Redirect to past failures.

OBJECTION: "I need to think about it"
RESPONSE: "Totally fair. Is it the investment side, or you're
  just not sure if home training actually works?"
STRATEGY: Isolate the real objection. "Think about it" is never
  the real reason.

OBJECTION: "Are you a bot?" / "Is this AI?"
RESPONSE: "I'm Mark's AI assistant - he's with clients right now
  but I handle the scheduling side. I can get you booked in
  directly though. What's the main goal?"
STRATEGY: Honest disclosure. Immediately redirect to value.
  Never lie about being human.

OBJECTION: "I'll just go to a gym"
RESPONSE: "How long have you had a gym membership? 😂
  Genuine question. Most of our clients came from gyms
  where they were paying but not going."
STRATEGY: Challenge with humor. Surface the gym-not-going pattern.

OBJECTION: "Can I see some results/proof?"
RESPONSE: "Yeah for sure. 600+ five-star reviews on Google
  and 12,000 transformations so far. But results depend on YOUR
  situation - what's your starting point right now?"
STRATEGY: Give proof, but redirect to personalization.

OBJECTION: "My friend/wife/husband needs to agree"
RESPONSE: "Makes sense. Would it help if they joined the
  consultation call? Sometimes hearing the plan together
  makes the decision easier."
STRATEGY: Include the decision-maker. Don't let them become
  a phantom blocker.

OBJECTION: "I'm not in Dubai right now"
RESPONSE: "No rush. When are you back? I'll flag your file
  and we can pick up from here."
STRATEGY: Create continuity. "Flag your file" implies exclusivity.

=== ESCALATION RULES ===
If ANY of these occur, tell the user you're connecting them
with the team directly:
- They ask for a specific coach by name
- They mention a medical condition or injury
- They ask about corporate/group bookings (5+ people)
- They become hostile or aggressive
- The conversation exceeds 15 exchanges without a booking

=== CURRENT LEAD CONTEXT ===
Name: ${context.name || "Unknown"}
Phone: ${context.phone}
Goal: ${context.goal || "Not yet identified"}
Area: ${context.area || "Unknown"}
Housing: ${context.housing_type || "Unknown"}
Lead Score: ${context.lead_score}/100
Dominant Pain: ${context.dominant_pain || "Not yet identified"}
Profile: ${context.psychological_profile || "Not yet assessed"}
Messages Exchanged: ${context.message_count}
Days Since Last Reply: ${context.days_since_last_reply}
Source: ${context.referral_source || "Unknown"}
History: ${context.history_summary}

Is New Lead: ${isNewLead}
Is Ghosting: ${isGhosting}
Is Returning: ${isReturning}

=== FINAL INSTRUCTION ===
1. Output your INTERNAL MONOLOGUE first (between ---THOUGHT_START--- and ---THOUGHT_END---).
2. Then output your VISIBLE REPLY (between ---REPLY_START--- and ---REPLY_END---).
3. The reply must be under 35 words.
4. The reply must end with a question.
5. Match the conversation phase based on the context above.
`;
}

// ----------------------------------------------------------------
// SECTION 2: RESPONSE PARSER (Component B.2)
// ----------------------------------------------------------------

export interface ParsedResponse {
  thought: InternalThought | null;
  reply: string;
  raw: string;
}

export function parseAIResponse(raw: string): ParsedResponse {
  let thought: InternalThought | null = null;
  let reply = "";

  const thoughtMatch = raw.match(/---THOUGHT_START---(.*?)---THOUGHT_END---/s);
  if (thoughtMatch) {
    try {
      const cleaned = thoughtMatch[1].trim();
      thought = JSON.parse(cleaned) as InternalThought;
    } catch (e) {
      console.error("Failed to parse internal thought:", e);
    }
  }

  const replyMatch = raw.match(/---REPLY_START---(.*?)---REPLY_END---/s);
  if (replyMatch) {
    reply = replyMatch[1].trim();
  } else {
    reply = raw.replace(/---THOUGHT_START---.*?---THOUGHT_END---/s, "").trim();
  }

  if (!reply) {
    reply = "Hey! Mark from PTD here. What are you looking to work on?";
  }

  const words = reply.split(/\s+/);
  if (words.length > 60) {
    reply = words.slice(0, 50).join(" ") + "...";
  }

  return { thought, reply, raw };
}

// ----------------------------------------------------------------
// SECTION 3: LEAD SCORER (Component B.3)
// ----------------------------------------------------------------

export interface ScoringSignals {
  hasName: boolean;
  hasGoal: boolean;
  hasPain: boolean;
  hasArea: boolean;
  messageCount: number;
  askedAboutPrice: boolean;
  askedAboutSchedule: boolean;
  mentionedTimeframe: boolean;
  mentionedPastFailure: boolean;
  expressedUrgency: boolean;
  saidExpensive: boolean;
  saidThinkAboutIt: boolean;
  daysInactive: number;
}

export function calculateLeadScore(signals: ScoringSignals): number {
  let score = 10;

  if (signals.hasName) score += 5;
  if (signals.hasGoal) score += 10;
  if (signals.hasPain) score += 15;
  if (signals.hasArea) score += 5;
  if (signals.askedAboutPrice) score += 10;
  if (signals.askedAboutSchedule) score += 20;
  if (signals.mentionedTimeframe) score += 10;
  if (signals.mentionedPastFailure) score += 10;
  if (signals.expressedUrgency) score += 15;

  if (signals.messageCount >= 3) score += 5;
  if (signals.messageCount >= 6) score += 5;
  if (signals.messageCount >= 10) score += 5;

  if (signals.saidExpensive) score -= 10;
  if (signals.saidThinkAboutIt) score -= 5;

  if (signals.daysInactive >= 1) score -= 5;
  if (signals.daysInactive >= 3) score -= 10;
  if (signals.daysInactive >= 7) score -= 20;

  return Math.max(0, Math.min(100, score));
}

// ----------------------------------------------------------------
// SECTION 4: HUBSPOT MANAGER
// ----------------------------------------------------------------

export class HubspotManager {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async fetchWithRetry(
    url: string,
    options: any = {},
    retries = 3,
    timeout = 10000,
  ): Promise<any> {
    if (!this.apiKey) {
      console.warn("HubSpot API Key missing, skipping request");
      return null;
    }
    for (let i = 0; i <= retries; i++) {
      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
        });

        if (response.status === 429) {
          if (i === retries) throw new Error("Rate limit exceeded");
          await new Promise((resolve) => setTimeout(resolve, (i + 1) * 2000));
          continue;
        }

        if (!response.ok) {
          // Skip logging for 404 search
          if (response.status === 404) return null;
          throw new Error(`HubSpot API Error: ${response.status}`);
        }

        if (response.status === 204) return null;
        return await response.json();
      } catch (error: any) {
        if (i === retries) throw error;
      }
    }
  }

  async searchContactByPhone(phone: string) {
    const url = `https://api.hubapi.com/crm/v3/objects/contacts/search`;
    const body = {
      filterGroups: [
        { filters: [{ propertyName: "phone", operator: "EQ", value: phone }] },
      ],
      properties: ["email", "firstname", "whatsapp_stage"],
      limit: 1,
    };
    const data = await this.fetchWithRetry(url, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return data?.results?.[0] || null;
  }

  async createContact(properties: Record<string, string>) {
    const url = `https://api.hubapi.com/crm/v3/objects/contacts`;
    return await this.fetchWithRetry(url, {
      method: "POST",
      body: JSON.stringify({ properties }),
    });
  }

  async createNote(contactId: string, content: string) {
    const url = `https://api.hubapi.com/crm/v3/objects/notes`;
    await this.fetchWithRetry(url, {
      method: "POST",
      body: JSON.stringify({
        properties: {
          hs_note_body: content,
          hs_timestamp: new Date().toISOString(),
        },
        associations: [
          {
            to: { id: contactId },
            types: [
              {
                associationCategory: "HUBSPOT_DEFINED",
                associationTypeId: 202,
              },
            ],
          },
        ],
      }),
    });
  }
}

// ----------------------------------------------------------------
// SECTION 5: MAIN HANDLER (Component C.2)
// ----------------------------------------------------------------

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const geminiKey = Deno.env.get("GEMINI_API_KEY")!;
const hubspotKey = Deno.env.get("HUBSPOT_API_KEY") || "";

const supabase = createClient(supabaseUrl, supabaseKey);
const hubspot = new HubspotManager(hubspotKey);

serve(async (req) => {
  try {
    const body = await req.json();

    const userMessage = body.queryResult?.queryText || "";
    const userPhone = body.originalDetectIntentRequest?.payload?.phone || "";
    const intentName = body.queryResult?.intent?.displayName || "";

    const safePhone = userPhone || "test-user";
    if (!userPhone) console.warn("⚠️ No phone, using test-user.");

    // 1. Load Data
    const { data: lead } = await supabase
      .from("leads")
      .select("*")
      .eq("phone", safePhone)
      .single();
    const { data: aiMemory } = await supabase
      .from("conversation_intelligence")
      .select("*")
      .eq("phone", safePhone)
      .single();

    if (!aiMemory) {
      await supabase.from("conversation_intelligence").insert({
        phone: safePhone,
        lead_score: 10,
        lead_temperature: "cold",
        conversation_phase: "hook",
        message_count: 0,
        last_lead_message_at: new Date().toISOString(),
      });
    }

    // 2. Build Context
    const daysSinceLastReply = aiMemory?.last_lead_message_at
      ? (Date.now() - new Date(aiMemory.last_lead_message_at).getTime()) /
        (1000 * 60 * 60 * 24)
      : 0;

    const context: ConversationContext = {
      name: lead?.name || null,
      phone: safePhone,
      goal: lead?.goal || aiMemory?.desired_outcome || null,
      area: lead?.area || null,
      housing_type: lead?.housing_type || null,
      history_summary: aiMemory?.conversation_summary || "New conversation.",
      message_count: (aiMemory?.message_count || 0) + 1,
      last_message: userMessage,
      lead_score: aiMemory?.lead_score || 10,
      dominant_pain: aiMemory?.dominant_pain || null,
      psychological_profile: aiMemory?.psychological_profile || null,
      days_since_last_reply: daysSinceLastReply,
      referral_source: lead?.source || null,
    };

    // 3. Gemini Call
    const systemPrompt = buildSmartPrompt(context);
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: userMessage }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1000,
            topP: 0.9,
          },
        }),
      },
    );

    const geminiData = await geminiResponse.json();
    if (geminiData.error)
      throw new Error(`Gemini Error: ${geminiData.error.message}`);
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // 4. Parse & Score
    const parsed = parseAIResponse(rawText);

    const lowerMsg = userMessage.toLowerCase();
    const signals: ScoringSignals = {
      hasName: !!lead?.name && lead.name !== "Friend",
      hasGoal: !!context.goal,
      hasPain: !!aiMemory?.dominant_pain || !!parsed.thought?.current_state,
      hasArea: !!lead?.area,
      messageCount: context.message_count,
      askedAboutPrice:
        lowerMsg.includes("price") ||
        lowerMsg.includes("cost") ||
        lowerMsg.includes("aed"),
      askedAboutSchedule:
        lowerMsg.includes("when") || lowerMsg.includes("book"),
      mentionedTimeframe:
        lowerMsg.includes("month") || lowerMsg.includes("week"),
      mentionedPastFailure:
        lowerMsg.includes("tried") || lowerMsg.includes("before"),
      expressedUrgency: lowerMsg.includes("asap") || lowerMsg.includes("now"),
      saidExpensive: lowerMsg.includes("expensive"),
      saidThinkAboutIt: lowerMsg.includes("think about"),
      daysInactive: daysSinceLastReply,
    };

    const ruleBasedScore = calculateLeadScore(signals);
    const aiScore = parsed.thought?.recommended_lead_score || ruleBasedScore;
    const finalScore = Math.round(aiScore * 0.6 + ruleBasedScore * 0.4);

    // 5. Update Intelligence
    const updateData: Record<string, any> = {
      phone: safePhone,
      lead_score: finalScore,
      lead_temperature:
        parsed.thought?.lead_temperature ||
        aiMemory?.lead_temperature ||
        "cold",
      message_count: context.message_count,
      last_lead_message_at: new Date().toISOString(),
      last_internal_thought: parsed.thought || null,
      conversation_phase:
        parsed.thought?.conversation_phase ||
        aiMemory?.conversation_phase ||
        "hook",
      // Summary update logic
      conversation_summary:
        (aiMemory?.conversation_summary || "") +
        `\n[Msg ${context.message_count}] User: "${userMessage.slice(0, 30)}..." | Mark: "${parsed.reply.slice(0, 30)}..."`,
      followup_stage: "none",
      followup_count: 0,
    };

    if (parsed.thought?.current_state)
      updateData.dominant_pain = parsed.thought.current_state;
    if (parsed.thought?.desired_state)
      updateData.desired_outcome = parsed.thought.desired_state;
    if (parsed.thought?.blocker)
      updateData.primary_blocker = parsed.thought.blocker;
    if (parsed.thought?.psychological_profile)
      updateData.psychological_profile = parsed.thought.psychological_profile;

    // Objections logic simplified for bundle
    if (signals.askedAboutPrice)
      updateData.objections_raised = [
        ...(aiMemory?.objections_raised || []),
        "price",
      ];

    await supabase
      .from("conversation_intelligence")
      .upsert(updateData, { onConflict: "phone" });

    // 6. Log & Sync
    const logPromise = supabase.from("whatsapp_interactions").insert({
      phone_number: safePhone,
      message_text: userMessage,
      response_text: parsed.reply,
      status: "delivered",
    });

    const hubspotPromise = (async () => {
      if (!hubspotKey) return;
      let contactId = lead?.id;
      if (!contactId) {
        const existing = await hubspot.searchContactByPhone(safePhone);
        contactId = existing?.id;
        if (!contactId) {
          const newC = await hubspot.createContact({
            phone: safePhone,
            email: `${safePhone.replace("+", "")}@wa.com`,
            firstname: "WhatsApp",
            lastname: "Lead",
          });
          contactId = newC?.id;
        }
      }
      if (contactId) {
        await hubspot.createNote(
          contactId,
          `Note: ${userMessage} -> ${parsed.reply}`,
        );
      }
    })();

    // @ts-ignore
    if (typeof EdgeRuntime !== "undefined") {
      // @ts-ignore
      EdgeRuntime.waitUntil(Promise.all([logPromise, hubspotPromise]));
    } else {
      await Promise.all([logPromise, hubspotPromise]);
    }

    return new Response(JSON.stringify({ fulfillmentText: parsed.reply }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Edge Failure:", error);
    return new Response(
      JSON.stringify({
        fulfillmentText: "Quick tech hiccup. Can you repeat that?",
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  }
});
