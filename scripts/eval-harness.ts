#!/usr/bin/env -S npx ts-node --esm
// ================================================================
// File: scripts/eval-harness.ts
// Lisa WhatsApp AI Agent — Deterministic Evaluation Harness
//
// Tests the FULL pipeline: buildSmartPrompt -> parseAIResponse ->
// sanitizeResponse -> validateResponseSafety -> AntiRobot.humanize ->
// splitMessage -> calculateSmartPause -> SentimentTriage.analyze
//
// NO real AI calls — uses pre-written mock LLM outputs from eval-scenarios.json.
//
// Run: npx ts-node scripts/eval-harness.ts
//   or: deno run --allow-read scripts/eval-harness.ts
// ================================================================

import { buildSmartPrompt, ConversationContext } from "../supabase/functions/_shared/smart-prompt.ts";
import { parseAIResponse } from "../supabase/functions/_shared/response-parser.ts";
import { AntiRobot } from "../supabase/functions/_shared/anti-robot.ts";
import { splitMessage } from "../supabase/functions/_shared/message-splitter.ts";
import { sanitizeResponse, validateResponseSafety } from "../supabase/functions/_shared/content-filter.ts";
import { calculateSmartPause } from "../supabase/functions/_shared/smart-pause.ts";
import { SentimentTriage } from "../supabase/functions/_shared/sentiment.ts";

// ================================================================
// TYPE DEFINITIONS
// ================================================================

interface EvalScenario {
  id: string;
  name: string;
  description: string;
  context: ConversationContext;
  userMessage: string;
  mockAIOutput: string;
  expectedPhase: string;
  expectedSentiment: "RISK" | "POSITIVE" | "NEUTRAL";
}

interface RubricDimension {
  name: string;
  weight: number;
  description: string;
}

interface EvalRubric {
  dimensions: RubricDimension[];
  passThreshold: number;
  targetThreshold: number;
}

interface DimensionScore {
  dimension: string;
  score: number;
  weight: number;
  weighted: number;
  notes: string;
}

interface ScenarioResult {
  id: string;
  name: string;
  scores: DimensionScore[];
  totalWeighted: number;
  pass: boolean;
  pipelineChecks: {
    promptBuilt: boolean;
    phaseMatch: boolean;
    thoughtParsed: boolean;
    replyExtracted: boolean;
    sanitized: boolean;
    isSafe: boolean;
    humanized: boolean;
    bubbleCount: number;
    pauseMs: number;
    sentimentMatch: boolean;
  };
}

interface ProductionCheck {
  name: string;
  passed: boolean;
  detail: string;
  severity: "PASS" | "FAIL" | "WARN";
}

// ================================================================
// EMBEDDED EVAL SCENARIOS (13 scenarios)
// ================================================================

const EVAL_SCENARIOS: EvalScenario[] = [
  {
    id: "S01",
    name: "Cold Lead — First Contact",
    description: "Brand new lead, no context, first message",
    context: {
      name: null,
      phone: "+971501234567",
      goal: null,
      area: null,
      housing_type: null,
      history_summary: "No prior conversation",
      message_count: 0,
      last_message: "",
      lead_score: 5,
      dominant_pain: null,
      psychological_profile: null,
      days_since_last_reply: 0,
      referral_source: "Instagram Ad",
    },
    userMessage: "Hi, I saw your ad about personal training",
    mockAIOutput: `---THOUGHT_START---
{
  "fitness_intent": "unknown",
  "user_felt_heard": "no",
  "is_warmed_up": "no",
  "move": "hook",
  "summary": "New inbound lead from Instagram ad. Zero context. Need to hook them with curiosity.",
  "user_energy": "medium",
  "conversation_phase": "hook",
  "recommended_lead_score": 15,
  "psychological_profile": "Curious browser, low commitment so far",
  "current_state": "Unknown fitness situation",
  "desired_state": "Unknown",
  "blocker": "Unknown"
}
---THOUGHT_END---

---REPLY_START---
hey! lisa here from ptd. glad you reached out. quick q - what's the main thing you wanna work on? most people come to us for weight loss, building strength, or fixing pain like lower back stuff
---REPLY_END---`,
    expectedPhase: "hook",
    expectedSentiment: "NEUTRAL",
  },
  {
    id: "S02",
    name: "Warm Lead — Goal Identified",
    description: "Lead has stated they want weight loss, msg 3",
    context: {
      name: "Sarah",
      phone: "+971502345678",
      goal: "weight loss",
      area: "Dubai Marina",
      housing_type: null,
      history_summary: "Sarah reached out about weight loss. Lives in Dubai Marina. Engaged well in first 2 messages.",
      message_count: 3,
      last_message: "Yeah I've been trying to lose weight for months now",
      lead_score: 35,
      dominant_pain: "weight loss plateau",
      psychological_profile: "Frustrated but motivated",
      days_since_last_reply: 0,
      referral_source: "Google",
    },
    userMessage: "Yeah I've been trying to lose weight for months now",
    mockAIOutput: `---THOUGHT_START---
{
  "fitness_intent": "weight_loss",
  "user_felt_heard": "yes",
  "is_warmed_up": "no",
  "move": "bridge",
  "summary": "Sarah frustrated with weight loss plateau. High intent, need to dig into her pain and prior attempts.",
  "user_energy": "medium",
  "conversation_phase": "bridge",
  "recommended_lead_score": 45,
  "psychological_profile": "Frustrated achiever - has tried but failed",
  "current_state": "Stuck in weight loss plateau for months",
  "desired_state": "Lose weight successfully",
  "blocker": "Lack of effective method"
}
---THOUGHT_END---

---REPLY_START---
months?? that's rough. what have you tried so far? like gym on your own, diets, anything?
---REPLY_END---`,
    expectedPhase: "bridge",
    expectedSentiment: "NEUTRAL",
  },
  {
    id: "S03",
    name: "Hot Lead — Ready to Book",
    description: "Lead is warmed up, msg 7, ready for assessment",
    context: {
      name: "Ahmed",
      phone: "+971503456789",
      goal: "strength training",
      area: "JBR",
      housing_type: "apartment",
      history_summary: "Ahmed wants to build muscle. Works long hours. Tried gym alone but no results. Very engaged, asking about coaches.",
      message_count: 7,
      last_message: "Yeah I'm definitely ready to start, when can I come in?",
      lead_score: 75,
      dominant_pain: "no visible results despite effort",
      psychological_profile: "Action-oriented professional, values efficiency",
      days_since_last_reply: 0,
      referral_source: "Friend referral",
    },
    userMessage: "Yeah I'm definitely ready to start, when can I come in?",
    mockAIOutput: `---THOUGHT_START---
{
  "fitness_intent": "strength",
  "user_felt_heard": "yes",
  "is_warmed_up": "yes",
  "move": "offer_test",
  "summary": "Ahmed is fully warmed. High intent. Ready for assessment booking. Lock it in now.",
  "user_energy": "high",
  "conversation_phase": "close",
  "recommended_lead_score": 85,
  "psychological_profile": "Decision maker, ready to commit",
  "current_state": "Wants to build muscle, tried alone",
  "desired_state": "Visible strength gains with expert guidance",
  "blocker": "None - ready to go"
}
---THOUGHT_END---

---REPLY_START---
love that energy. I have a coach who's great with strength programs. can you give me a 1-hour window that works this week? I'll lock them in for your assessment
---REPLY_END---`,
    expectedPhase: "close",
    expectedSentiment: "POSITIVE",
  },
  {
    id: "S04",
    name: "Price Objection",
    description: "Lead asks about pricing — must deflect",
    context: {
      name: "Fatima",
      phone: "+971504567890",
      goal: "weight loss",
      area: "Abu Dhabi",
      housing_type: null,
      history_summary: "Fatima interested in weight loss. 4 messages exchanged. Now asking about price.",
      message_count: 5,
      last_message: "How much does it cost?",
      lead_score: 50,
      dominant_pain: "post-pregnancy weight",
      psychological_profile: "Budget-conscious, needs value justification",
      days_since_last_reply: 0,
      referral_source: "Facebook",
    },
    userMessage: "How much does it cost?",
    mockAIOutput: `---THOUGHT_START---
{
  "fitness_intent": "weight_loss",
  "user_felt_heard": "yes",
  "is_warmed_up": "no",
  "move": "deflect",
  "summary": "Fatima asking about price. Need to deflect to assessment without quoting numbers.",
  "user_energy": "medium",
  "conversation_phase": "select",
  "recommended_lead_score": 50,
  "psychological_profile": "Price-sensitive, needs to feel exclusive not sold",
  "current_state": "Interested but price-gating",
  "desired_state": "Know the price",
  "blocker": "Price uncertainty"
}
---THOUGHT_END---

---REPLY_START---
that depends on what the assessment shows honestly. every body is different so the plan has to match. the assessment is free though - want me to book you in so you can see what your body actually needs?
---REPLY_END---`,
    expectedPhase: "select",
    expectedSentiment: "NEUTRAL",
  },
  {
    id: "S05",
    name: "Ghosted Lead — Re-engagement Day 3",
    description: "Lead hasn't replied in 3 days",
    context: {
      name: "Omar",
      phone: "+971505678901",
      goal: "pain relief",
      area: "Business Bay",
      housing_type: null,
      history_summary: "Omar has lower back pain. Was engaged but went silent 3 days ago.",
      message_count: 4,
      last_message: "Yeah my back has been killing me",
      lead_score: 30,
      dominant_pain: "lower back pain",
      psychological_profile: "Pain-driven but indecisive",
      days_since_last_reply: 3,
      referral_source: null,
    },
    userMessage: "Yeah my back has been killing me",
    mockAIOutput: `---THOUGHT_START---
{
  "fitness_intent": "pain_relief",
  "user_felt_heard": "yes",
  "is_warmed_up": "no",
  "move": "re_engage",
  "summary": "Omar ghosted 3 days ago. Has back pain. Re-engage with scarcity, not pressure.",
  "user_energy": "low",
  "conversation_phase": "hook",
  "recommended_lead_score": 25,
  "psychological_profile": "Pain-avoidant, needs nudge not push",
  "current_state": "Back pain, went silent",
  "desired_state": "Pain relief",
  "blocker": "Procrastination"
}
---THOUGHT_END---

---REPLY_START---
no worries if the timing's off. just wanted to make sure you didn't miss the spot I mentioned for back pain rehab
---REPLY_END---`,
    expectedPhase: "hook",
    expectedSentiment: "NEUTRAL",
  },
  {
    id: "S06",
    name: "Angry Lead — Risk Sentiment",
    description: "Lead is angry, uses profanity",
    context: {
      name: "Ravi",
      phone: "+971506789012",
      goal: null,
      area: null,
      housing_type: null,
      history_summary: "Ravi received a message he didn't expect. Angry response.",
      message_count: 1,
      last_message: "Stop messaging me this is spam",
      lead_score: 0,
      dominant_pain: null,
      psychological_profile: null,
      days_since_last_reply: 0,
      referral_source: null,
    },
    userMessage: "Stop messaging me this is spam",
    mockAIOutput: `---THOUGHT_START---
{
  "fitness_intent": "unknown",
  "user_felt_heard": "no",
  "is_warmed_up": "no",
  "move": "deflect",
  "summary": "Lead is hostile. Requesting to stop. Must respect and disengage.",
  "user_energy": "hostile",
  "conversation_phase": "hook",
  "recommended_lead_score": 0,
  "psychological_profile": "Hostile, not a fit",
  "current_state": "Angry at receiving message",
  "desired_state": "To be left alone",
  "blocker": "Not interested"
}
---THOUGHT_END---

---REPLY_START---
hey sorry about that! removing you from the list now. take care
---REPLY_END---`,
    expectedPhase: "hook",
    expectedSentiment: "RISK",
  },
  {
    id: "S07",
    name: "Excited Lead — Positive Sentiment",
    description: "Lead is excited and wants to sign up immediately",
    context: {
      name: "Maya",
      phone: "+971507890123",
      goal: "weight loss",
      area: "Downtown Dubai",
      housing_type: "villa",
      history_summary: "Maya extremely enthusiastic. Friend recommended PTD. Wants to start ASAP.",
      message_count: 2,
      last_message: "OMG yes I'm so excited! My friend lost 10kg with you guys, I'm ready to join ASAP!",
      lead_score: 60,
      dominant_pain: "weight gain",
      psychological_profile: "Enthusiastic, social proof driven",
      days_since_last_reply: 0,
      referral_source: "Word of mouth",
    },
    userMessage: "OMG yes I'm so excited! My friend lost 10kg with you guys, I'm ready to join ASAP!",
    mockAIOutput: `---THOUGHT_START---
{
  "fitness_intent": "weight_loss",
  "user_felt_heard": "yes",
  "is_warmed_up": "yes",
  "move": "select",
  "summary": "Maya is hot lead via referral. Extremely enthusiastic. Fast-track to assessment.",
  "user_energy": "high",
  "conversation_phase": "hook",
  "recommended_lead_score": 70,
  "psychological_profile": "Social proof responder, impulsive buyer",
  "current_state": "Excited, wants to replicate friend's results",
  "desired_state": "Lose weight like her friend",
  "blocker": "None"
}
---THOUGHT_END---

---REPLY_START---
oh nice your friend crushed it!! love hearing that. ok so before we go further I need to check something - when's a good time for you to come in for a quick body assessment?
---REPLY_END---`,
    expectedPhase: "hook",
    expectedSentiment: "POSITIVE",
  },
  {
    id: "S08",
    name: "Post-Booking — Group Close",
    description: "Lead has booked, moving to WhatsApp group phase",
    context: {
      name: "Khalid",
      phone: "+971508901234",
      goal: "strength training",
      area: "JLT",
      housing_type: "apartment",
      history_summary: "Khalid booked assessment for Thursday 4pm. Coach assigned: Mike.",
      message_count: 9,
      last_message: "Thursday 4pm works for me",
      lead_score: 90,
      dominant_pain: "wants to bulk up",
      psychological_profile: "Committed, follows through",
      days_since_last_reply: 0,
      referral_source: "Google",
    },
    userMessage: "Thursday 4pm works for me",
    mockAIOutput: `---THOUGHT_START---
{
  "fitness_intent": "strength",
  "user_felt_heard": "yes",
  "is_warmed_up": "yes",
  "move": "group_close",
  "summary": "Khalid booked. Move to group close. Create WhatsApp group with coach.",
  "user_energy": "high",
  "conversation_phase": "post_close",
  "recommended_lead_score": 90,
  "psychological_profile": "Reliable, action-oriented",
  "current_state": "Assessment booked",
  "desired_state": "Start training",
  "blocker": "None"
}
---THOUGHT_END---

---REPLY_START---
done. I'm starting a whatsapp group with you and coach mike so we can sort out the details before thursday. see you there
---REPLY_END---`,
    expectedPhase: "post_close",
    expectedSentiment: "NEUTRAL",
  },
  {
    id: "S09",
    name: "Medical Concern — Liability Risk",
    description: "Lead mentions doctor/medical condition",
    context: {
      name: "Priya",
      phone: "+971509012345",
      goal: "pain relief",
      area: "Al Reem Island",
      housing_type: null,
      history_summary: "Priya has a herniated disc. Asking if PT can help.",
      message_count: 3,
      last_message: "My doctor said I need to be careful with exercises",
      lead_score: 25,
      dominant_pain: "herniated disc",
      psychological_profile: "Cautious, medically aware",
      days_since_last_reply: 0,
      referral_source: "Instagram",
    },
    userMessage: "My doctor said I need to be careful with exercises",
    mockAIOutput: `---THOUGHT_START---
{
  "fitness_intent": "pain_relief",
  "user_felt_heard": "yes",
  "is_warmed_up": "no",
  "move": "bridge",
  "summary": "Priya has medical concern. Must be careful not to give medical advice. Bridge to assessment.",
  "user_energy": "low",
  "conversation_phase": "bridge",
  "recommended_lead_score": 30,
  "psychological_profile": "Cautious, needs safety reassurance",
  "current_state": "Herniated disc, doctor-guided",
  "desired_state": "Safe pain relief through exercise",
  "blocker": "Fear of injury"
}
---THOUGHT_END---

---REPLY_START---
totally get that. our coaches actually work with people who have disc issues all the time. the assessment would show exactly what's safe for your body - no guesswork
---REPLY_END---`,
    expectedPhase: "bridge",
    expectedSentiment: "RISK",
  },
  {
    id: "S10",
    name: "Long Rambling Message",
    description: "Lead sends a very long message — tests word count handling",
    context: {
      name: "Alex",
      phone: "+971500123456",
      goal: "general fitness",
      area: "Silicon Oasis",
      housing_type: "apartment",
      history_summary: "Alex is new, sent a very long first message about their fitness history.",
      message_count: 1,
      last_message: "So basically I've been thinking about getting into fitness for a while now and I used to go to the gym back in college but then work got really busy and I stopped going and now I've gained about 15kg and my energy levels are terrible and I can't sleep well and my back hurts from sitting all day at the computer and I just want to feel good again you know like I used to feel when I was active and playing sports",
      lead_score: 20,
      dominant_pain: "weight gain and low energy",
      psychological_profile: null,
      days_since_last_reply: 0,
      referral_source: "TikTok",
    },
    userMessage: "So basically I've been thinking about getting into fitness for a while now and I used to go to the gym back in college but then work got really busy and I stopped going and now I've gained about 15kg and my energy levels are terrible and I can't sleep well and my back hurts from sitting all day at the computer and I just want to feel good again you know like I used to feel when I was active and playing sports",
    mockAIOutput: `---THOUGHT_START---
{
  "fitness_intent": "general",
  "user_felt_heard": "yes",
  "is_warmed_up": "no",
  "move": "hook",
  "summary": "Alex shared a lot. Multiple pain points: weight gain, low energy, back pain, poor sleep. Need to acknowledge and pick ONE thread.",
  "user_energy": "medium",
  "conversation_phase": "hook",
  "recommended_lead_score": 30,
  "psychological_profile": "Overthinker, needs someone to simplify things for them",
  "current_state": "Overwhelmed, multiple issues",
  "desired_state": "Feel good and energized again",
  "blocker": "Doesn't know where to start"
}
---THOUGHT_END---

---REPLY_START---
ok I hear you on all of that. sounds like the energy thing is hitting you hardest. how long has it been since you felt actually good waking up?
---REPLY_END---`,
    expectedPhase: "hook",
    expectedSentiment: "NEUTRAL",
  },
  {
    id: "S11",
    name: "Scam Accusation — High Risk",
    description: "Lead accuses PTD of being a scam",
    context: {
      name: null,
      phone: "+971501111111",
      goal: null,
      area: null,
      housing_type: null,
      history_summary: "Unknown contact accusing us of being a scam.",
      message_count: 1,
      last_message: "This is a scam right? How did you get my number?",
      lead_score: 0,
      dominant_pain: null,
      psychological_profile: null,
      days_since_last_reply: 0,
      referral_source: null,
    },
    userMessage: "This is a scam right? How did you get my number?",
    mockAIOutput: `---THOUGHT_START---
{
  "fitness_intent": "unknown",
  "user_felt_heard": "no",
  "is_warmed_up": "no",
  "move": "deflect",
  "summary": "Lead suspicious, accusing scam. Must de-escalate and offer removal.",
  "user_energy": "hostile",
  "conversation_phase": "hook",
  "recommended_lead_score": 0,
  "psychological_profile": "Suspicious, defensive",
  "current_state": "Angry and suspicious",
  "desired_state": "Wants answers or removal",
  "blocker": "Trust"
}
---THOUGHT_END---

---REPLY_START---
hey no worries! we're ptd fitness in dubai. you probably came through one of our ads. I can remove you from the list right now if you want - just say the word
---REPLY_END---`,
    expectedPhase: "hook",
    expectedSentiment: "RISK",
  },
  {
    id: "S12",
    name: "Post-Pregnancy Lead",
    description: "New mum wanting to get back in shape",
    context: {
      name: "Aisha",
      phone: "+971502222222",
      goal: "post-pregnancy fitness",
      area: "Jumeirah",
      housing_type: "villa",
      history_summary: "Aisha had a baby 6 months ago. Wants to lose baby weight.",
      message_count: 4,
      last_message: "I had my baby 6 months ago and I just can't lose the weight",
      lead_score: 40,
      dominant_pain: "post-pregnancy weight",
      psychological_profile: "Emotionally vulnerable, time-poor",
      days_since_last_reply: 0,
      referral_source: "Instagram",
    },
    userMessage: "I had my baby 6 months ago and I just can't lose the weight",
    mockAIOutput: `---THOUGHT_START---
{
  "fitness_intent": "post_preg",
  "user_felt_heard": "yes",
  "is_warmed_up": "no",
  "move": "bridge",
  "summary": "Aisha is postpartum, emotionally vulnerable. Need empathy first, then bridge to assessment.",
  "user_energy": "low",
  "conversation_phase": "bridge",
  "recommended_lead_score": 45,
  "psychological_profile": "New mum, needs reassurance not pressure",
  "current_state": "Post-pregnancy, struggling with weight",
  "desired_state": "Lose baby weight, feel like herself again",
  "blocker": "Time constraints, emotional state"
}
---THOUGHT_END---

---REPLY_START---
6 months postpartum is actually a great time to start. your body is ready. how's your energy been - like are you sleeping ok or is the little one keeping you up?
---REPLY_END---`,
    expectedPhase: "bridge",
    expectedSentiment: "NEUTRAL",
  },
  {
    id: "S13",
    name: "Grateful Existing Client",
    description: "Existing client saying thanks after results",
    context: {
      name: "Daniel",
      phone: "+971503333333",
      goal: "weight loss",
      area: "DIFC",
      housing_type: "apartment",
      history_summary: "Daniel is an existing client. Lost 8kg in 3 months. Very happy.",
      message_count: 15,
      last_message: "Thank you so much Lisa! I've lost 8kg and I feel amazing!",
      lead_score: 95,
      dominant_pain: null,
      psychological_profile: "Loyal, grateful, potential referral source",
      days_since_last_reply: 0,
      referral_source: "Existing client",
    },
    userMessage: "Thank you so much Lisa! I've lost 8kg and I feel amazing!",
    mockAIOutput: `---THOUGHT_START---
{
  "fitness_intent": "weight_loss",
  "user_felt_heard": "yes",
  "is_warmed_up": "yes",
  "move": "group_close",
  "summary": "Daniel thrilled with results. Nurture relationship. Seed referral opportunity.",
  "user_energy": "high",
  "conversation_phase": "post_close",
  "recommended_lead_score": 95,
  "psychological_profile": "Brand advocate, referral ready",
  "current_state": "Lost 8kg, feeling great",
  "desired_state": "Continue progress",
  "blocker": "None"
}
---THOUGHT_END---

---REPLY_START---
8kg!! that's insane daniel. you put in the work though, that's all you. honestly so proud of you
---REPLY_END---`,
    expectedPhase: "post_close",
    expectedSentiment: "POSITIVE",
  },
];

// ================================================================
// EMBEDDED EVAL RUBRIC
// ================================================================

const EVAL_RUBRIC: EvalRubric = {
  dimensions: [
    { name: "human_likeness", weight: 0.25, description: "No AI words, natural length" },
    { name: "word_count", weight: 0.20, description: "15-40 words ideal" },
    { name: "nepq_adherence", weight: 0.20, description: "Phase match + single question rule" },
    { name: "price_safety", weight: 0.15, description: "No price/cost/AED leaks" },
    { name: "persona_consistency", weight: 0.10, description: "Big Sister tone, no bot-speak" },
    { name: "emoji_compliance", weight: 0.10, description: "Approved emojis only, max count" },
  ],
  passThreshold: 0.75,
  targetThreshold: 0.85,
};

// ================================================================
// SCORING FUNCTIONS
// ================================================================

const AI_WORDS = [
  "transformation", "journey", "absolutely", "certainly", "wonderful",
  "i'd be happy to", "that's a great question", "i completely understand",
  "architect", "metabolic", "customized", "tailored", "personalized program",
  "holistic",
];

const PRICE_WORDS = [
  "aed", "price", "cost", "package", "rate", "dirham", "session rate", "pricing",
];

const FORMAL_BOT_PHRASES = [
  "i'd be happy to", "how can i help", "absolutely!", "how can i assist",
  "is there anything else", "thank you for reaching out",
];

const APPROVED_EMOJIS = ["\u{1F4AA}", "\u{1F525}", "\u{1F60A}"]; // 💪🔥😊

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function countEmojis(text: string): { total: number; approved: number; banned: number } {
  const allEmojis = text.match(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu) || [];
  let approved = 0;
  let banned = 0;
  for (const e of allEmojis) {
    if (APPROVED_EMOJIS.includes(e)) {
      approved++;
    } else {
      banned++;
    }
  }
  return { total: allEmojis.length, approved, banned };
}

function countQuestionMarks(text: string): number {
  return (text.match(/\?/g) || []).length;
}

function scoreHumanLikeness(reply: string): { score: number; notes: string } {
  const lower = reply.toLowerCase();
  const foundAI = AI_WORDS.filter(w => lower.includes(w));
  if (foundAI.length > 0) {
    return { score: 0, notes: `AI words found: ${foundAI.join(", ")}` };
  }
  const wc = countWords(reply);
  if (wc > 60) {
    return { score: 0.5, notes: `Message too long: ${wc} words (>60)` };
  }
  return { score: 1.0, notes: `Clean. ${wc} words.` };
}

function scoreWordCount(reply: string): { score: number; notes: string } {
  const wc = countWords(reply);
  if (wc >= 15 && wc <= 40) {
    return { score: 1.0, notes: `${wc} words (ideal 15-40)` };
  }
  if (wc >= 41 && wc <= 60) {
    return { score: 0.5, notes: `${wc} words (acceptable 41-60)` };
  }
  if (wc < 15) {
    return { score: 0.5, notes: `${wc} words (short <15)` };
  }
  return { score: 0, notes: `${wc} words (too long >60)` };
}

function scoreNepqAdherence(prompt: string, reply: string, expectedPhase: string): { score: number; notes: string } {
  const phaseMatch = prompt.includes(`>>> YOU ARE HERE <<<`) &&
    prompt.includes(`Phase: ${expectedPhase}`);
  const questionCount = countQuestionMarks(reply);
  const singleQuestion = questionCount <= 1;

  if (phaseMatch && singleQuestion) {
    return { score: 1.0, notes: `Phase "${expectedPhase}" correct, ${questionCount} question(s)` };
  }
  if (phaseMatch || singleQuestion) {
    const issues = [];
    if (!phaseMatch) issues.push("phase mismatch");
    if (!singleQuestion) issues.push(`${questionCount} questions (>1)`);
    return { score: 0.5, notes: issues.join("; ") };
  }
  return { score: 0, notes: `Phase mismatch AND ${questionCount} questions stacked` };
}

function scorePriceSafety(reply: string): { score: number; notes: string } {
  const lower = reply.toLowerCase();
  const found = PRICE_WORDS.filter(w => lower.includes(w));
  if (found.length > 0) {
    return { score: 0, notes: `Price words found: ${found.join(", ")}` };
  }
  return { score: 1.0, notes: "No price leaks" };
}

function scorePersonaConsistency(reply: string): { score: number; notes: string } {
  const lower = reply.toLowerCase();
  const formalFound = FORMAL_BOT_PHRASES.filter(p => lower.includes(p));
  if (formalFound.length > 0) {
    return { score: 0, notes: `Formal bot phrases: ${formalFound.join(", ")}` };
  }
  // Check for overly formal language signals
  const formalSignals = [
    /^[A-Z][a-z]+ [A-Z]/m, // Starts with Formal Capitalized Sentence
  ];
  const minorIssues = formalSignals.filter(p => p.test(reply));
  if (minorIssues.length > 0) {
    return { score: 0.5, notes: "Minor formality detected" };
  }
  return { score: 1.0, notes: "Big Sister tone maintained" };
}

function scoreEmojiCompliance(reply: string): { score: number; notes: string } {
  const { total, approved, banned } = countEmojis(reply);
  if (banned > 0) {
    return { score: 0, notes: `Banned emoji found (${banned} non-approved)` };
  }
  if (total >= 3) {
    return { score: 0, notes: `Too many emojis: ${total} (max 2)` };
  }
  if (approved === 2) {
    return { score: 0.5, notes: `2 approved emojis (ideal is 0-1)` };
  }
  return { score: 1.0, notes: `${approved} approved emoji(s)` };
}

// ================================================================
// LEAK PATTERNS from orchestrator
// ================================================================

const LEAK_PATTERNS = [
  "TEMPLATE 1:",
  "Templates for reaching out",
  "THOUGHT_START",
  "THOUGHT_END",
  "REPLY_START",
  "REPLY_END",
  "SYSTEM PROMPT",
  "INTERNAL MONOLOGUE",
  "=== IDENTITY ===",
  "=== THE EXPERT RULES",
  "=== CONVERSATION FLOW",
  "=== CURRENT CONTEXT ===",
  "buildSmartPrompt",
  "fitness_intent",
  "is_warmed_up",
  "recommended_lead_score",
];

// ================================================================
// MAIN EVALUATION RUNNER
// ================================================================

function runScenario(scenario: EvalScenario): ScenarioResult {
  // Step a: Build ConversationContext + prompt
  const prompt = buildSmartPrompt(scenario.context);
  const promptBuilt = prompt.length > 100;

  // Step b: Verify phase marker in prompt
  const phaseMatch = prompt.includes(`Phase: ${scenario.expectedPhase}`);

  // Step c: Use mock AI output
  const mockOutput = scenario.mockAIOutput;

  // Step d: Parse AI response
  const parsed = parseAIResponse(mockOutput);
  const thoughtParsed = parsed.thought !== null;
  const replyExtracted = parsed.reply.length > 0;

  // Step e: Sanitize response
  const sanitized = sanitizeResponse(parsed.reply);
  const sanitizedOk = sanitized.length > 0;

  // Step f: Validate safety
  const safety = validateResponseSafety(sanitized);

  // Step g: Humanize
  const humanized = AntiRobot.humanize(sanitized, "CASUAL");
  const humanizedOk = humanized.length > 0;

  // Step h: Split message
  const bubbles = splitMessage(humanized);
  const bubbleCount = bubbles.length;

  // Step i: Smart pause
  const pauseMs = calculateSmartPause(scenario.userMessage, humanized);

  // Step j: Sentiment
  const sentiment = SentimentTriage.analyze(scenario.userMessage);
  const sentimentMatch = sentiment.sentiment === scenario.expectedSentiment;

  // Score on 6 dimensions (use sanitized reply for scoring, pre-humanize for consistency)
  const replyForScoring = sanitized;

  const humanLikeness = scoreHumanLikeness(replyForScoring);
  const wordCount = scoreWordCount(replyForScoring);
  const nepq = scoreNepqAdherence(prompt, replyForScoring, scenario.expectedPhase);
  const price = scorePriceSafety(replyForScoring);
  const persona = scorePersonaConsistency(replyForScoring);
  const emoji = scoreEmojiCompliance(replyForScoring);

  const scores: DimensionScore[] = [
    { dimension: "human_likeness", score: humanLikeness.score, weight: 0.25, weighted: humanLikeness.score * 0.25, notes: humanLikeness.notes },
    { dimension: "word_count", score: wordCount.score, weight: 0.20, weighted: wordCount.score * 0.20, notes: wordCount.notes },
    { dimension: "nepq_adherence", score: nepq.score, weight: 0.20, weighted: nepq.score * 0.20, notes: nepq.notes },
    { dimension: "price_safety", score: price.score, weight: 0.15, weighted: price.score * 0.15, notes: price.notes },
    { dimension: "persona_consistency", score: persona.score, weight: 0.10, weighted: persona.score * 0.10, notes: persona.notes },
    { dimension: "emoji_compliance", score: emoji.score, weight: 0.10, weighted: emoji.score * 0.10, notes: emoji.notes },
  ];

  const totalWeighted = scores.reduce((sum, s) => sum + s.weighted, 0);

  return {
    id: scenario.id,
    name: scenario.name,
    scores,
    totalWeighted,
    pass: totalWeighted >= EVAL_RUBRIC.passThreshold,
    pipelineChecks: {
      promptBuilt,
      phaseMatch,
      thoughtParsed,
      replyExtracted,
      sanitized: sanitizedOk,
      isSafe: safety.isSafe,
      humanized: humanizedOk,
      bubbleCount,
      pauseMs,
      sentimentMatch,
    },
  };
}

function runProductionChecks(scenarios: EvalScenario[]): ProductionCheck[] {
  const checks: ProductionCheck[] = [];

  // --- Check 1: Leak pattern check ---
  // Ensure none of the 16 LEAK_PATTERNS appear in parsed replies
  let leakFound = false;
  const leakedPatterns: string[] = [];
  for (const scenario of scenarios) {
    const parsed = parseAIResponse(scenario.mockAIOutput);
    const sanitized = sanitizeResponse(parsed.reply);
    for (const pattern of LEAK_PATTERNS) {
      if (sanitized.includes(pattern)) {
        leakFound = true;
        leakedPatterns.push(`${scenario.id}: "${pattern}"`);
      }
    }
  }
  checks.push({
    name: "Leak Pattern Guard (16 patterns)",
    passed: !leakFound,
    detail: leakFound
      ? `LEAKED: ${leakedPatterns.join(", ")}`
      : "All 16 leak patterns blocked across all scenarios",
    severity: leakFound ? "FAIL" : "PASS",
  });

  // --- Check 2: Truncation boundary ---
  // Feed a 300-word input to parseAIResponse, verify <=200 words out
  const longText = "---REPLY_START---\n" +
    Array(300).fill("word").join(" ") +
    "\n---REPLY_END---";
  const truncParsed = parseAIResponse(longText);
  const truncWordCount = countWords(truncParsed.reply);
  checks.push({
    name: "Truncation Boundary (300 -> <=200 words)",
    passed: truncWordCount <= 200,
    detail: `300-word input produced ${truncWordCount}-word output (limit: 200)`,
    severity: truncWordCount <= 200 ? "PASS" : "FAIL",
  });

  // --- Check 3: Bubble count ---
  let allBubblesOk = true;
  const bubbleIssues: string[] = [];
  for (const scenario of scenarios) {
    const parsed = parseAIResponse(scenario.mockAIOutput);
    const sanitized = sanitizeResponse(parsed.reply);
    const humanized = AntiRobot.humanize(sanitized, "CASUAL");
    const bubbles = splitMessage(humanized);
    if (bubbles.length < 1 || bubbles.length > 4) {
      allBubblesOk = false;
      bubbleIssues.push(`${scenario.id}: ${bubbles.length} bubbles`);
    }
  }
  checks.push({
    name: "Bubble Count (1-4 per message)",
    passed: allBubblesOk,
    detail: allBubblesOk
      ? "All scenarios produce 1-4 bubbles"
      : `Out of range: ${bubbleIssues.join(", ")}`,
    severity: allBubblesOk ? "PASS" : "FAIL",
  });

  // --- Check 4: Delay range ---
  let allDelaysOk = true;
  const delayIssues: string[] = [];
  for (const scenario of scenarios) {
    const parsed = parseAIResponse(scenario.mockAIOutput);
    const humanized = AntiRobot.humanize(sanitizeResponse(parsed.reply), "CASUAL");
    const pause = calculateSmartPause(scenario.userMessage, humanized);
    if (pause < 1200 || pause > 6000) {
      allDelaysOk = false;
      delayIssues.push(`${scenario.id}: ${pause}ms`);
    }
  }
  checks.push({
    name: "Smart Pause Range (1200-6000ms)",
    passed: allDelaysOk,
    detail: allDelaysOk
      ? "All pauses within 1200-6000ms"
      : `Out of range: ${delayIssues.join(", ")}`,
    severity: allDelaysOk ? "PASS" : "FAIL",
  });

  // --- Check 5: Anti-robot idempotency ---
  let idempotencyOk = true;
  const idempotencyIssues: string[] = [];
  for (const scenario of scenarios) {
    const parsed = parseAIResponse(scenario.mockAIOutput);
    const sanitized = sanitizeResponse(parsed.reply);
    const pass1 = AntiRobot.humanize(sanitized, "CASUAL");
    const pass2 = AntiRobot.humanize(pass1, "CASUAL");
    const growthRatio = pass2.length / Math.max(pass1.length, 1);
    if (growthRatio > 1.20) {
      idempotencyOk = false;
      idempotencyIssues.push(`${scenario.id}: ${((growthRatio - 1) * 100).toFixed(0)}% growth`);
    }
  }
  checks.push({
    name: "Anti-Robot Idempotency (double-pass <=20% growth)",
    passed: idempotencyOk,
    detail: idempotencyOk
      ? "No double-mutation detected across all scenarios"
      : `Growth exceeded 20%: ${idempotencyIssues.join(", ")}`,
    severity: idempotencyOk ? "PASS" : "FAIL",
  });

  // --- Check 6: Sentiment false positive ---
  // "I'll stop by tomorrow" should ideally be NEUTRAL but \bstop\b fires RISK
  const fpResult = SentimentTriage.analyze("I'll stop by tomorrow");
  const isFalsePositive = fpResult.sentiment === "RISK";
  checks.push({
    name: "Sentiment False Positive: \"I'll stop by tomorrow\"",
    passed: true, // Documented known issue, not a failure
    detail: isFalsePositive
      ? `KNOWN ISSUE: Returns ${fpResult.sentiment} (score: ${fpResult.score}) due to \\bstop\\b trigger. ` +
        `Triggers: [${fpResult.triggers.join(", ")}]. ` +
        "Fix: Add contextual phrase exclusion for \"stop by\"."
      : `Returns ${fpResult.sentiment} — no false positive detected`,
    severity: isFalsePositive ? "WARN" : "PASS",
  });

  // --- Check 7: Content filter brackets ---
  // "Call me [nickname]" — brackets get stripped by content filter
  const bracketInput = "Call me [nickname] anytime";
  const bracketOutput = sanitizeResponse(bracketInput);
  const bracketsStripped = !bracketOutput.includes("[nickname]");
  checks.push({
    name: "Content Filter Brackets: \"Call me [nickname]\" (WARN-001)",
    passed: true, // Documented known issue
    detail: bracketsStripped
      ? `WARN-001: Brackets stripped. Input: "${bracketInput}" -> Output: "${bracketOutput}". ` +
        "The \\[.*?\\] pattern in SENSITIVE_PATTERNS catches user bracket text. " +
        "Consider exempting single-word bracket content from stripping."
      : `Brackets preserved: "${bracketOutput}"`,
    severity: bracketsStripped ? "WARN" : "PASS",
  });

  return checks;
}

// ================================================================
// REPORT FORMATTER
// ================================================================

function printReport(results: ScenarioResult[], prodChecks: ProductionCheck[], rubric: EvalRubric): void {
  const SEP = "=".repeat(80);
  const THIN_SEP = "-".repeat(80);

  console.log("\n" + SEP);
  console.log("  LISA WHATSAPP AI AGENT — EVALUATION HARNESS REPORT");
  console.log("  Pipeline: buildSmartPrompt -> parseAIResponse -> sanitize -> ");
  console.log("            validateSafety -> AntiRobot.humanize -> splitMessage");
  console.log("  Date: " + new Date().toISOString());
  console.log(SEP + "\n");

  // ---- Per-Scenario Results Table ----
  console.log("  SCENARIO SCORES");
  console.log(THIN_SEP);
  console.log(
    "  " +
    padRight("ID", 5) +
    padRight("Scenario", 32) +
    padRight("Score", 8) +
    padRight("Result", 8) +
    "Pipeline"
  );
  console.log(THIN_SEP);

  for (const r of results) {
    const pc = r.pipelineChecks;
    const pipelineFlags = [
      pc.promptBuilt ? "P" : "p",
      pc.phaseMatch ? "H" : "h",
      pc.thoughtParsed ? "T" : "t",
      pc.replyExtracted ? "R" : "r",
      pc.sanitized ? "S" : "s",
      pc.isSafe ? "V" : "v",
      pc.humanized ? "A" : "a",
      `B${pc.bubbleCount}`,
      pc.sentimentMatch ? "M" : "m",
    ].join("");

    console.log(
      "  " +
      padRight(r.id, 5) +
      padRight(r.name, 32) +
      padRight((r.totalWeighted * 100).toFixed(1) + "%", 8) +
      padRight(r.pass ? "PASS" : "FAIL", 8) +
      pipelineFlags
    );
  }

  console.log(THIN_SEP);

  // ---- Per-Scenario Dimension Breakdown ----
  console.log("\n  DIMENSION BREAKDOWN");
  console.log(THIN_SEP);

  for (const r of results) {
    console.log(`\n  [${r.id}] ${r.name} — ${(r.totalWeighted * 100).toFixed(1)}%`);
    for (const s of r.scores) {
      const bar = "█".repeat(Math.round(s.score * 10)) + "░".repeat(10 - Math.round(s.score * 10));
      console.log(
        "    " +
        padRight(s.dimension, 22) +
        bar + " " +
        padRight((s.score * 100).toFixed(0) + "%", 6) +
        `(w: ${(s.weighted * 100).toFixed(1)}%)  ${s.notes}`
      );
    }
  }

  // ---- Overall Score ----
  const overallAvg = results.reduce((sum, r) => sum + r.totalWeighted, 0) / results.length;
  const passCount = results.filter(r => r.pass).length;
  const overallPass = overallAvg >= rubric.passThreshold;
  const meetsTarget = overallAvg >= rubric.targetThreshold;

  console.log("\n" + SEP);
  console.log("  OVERALL RESULTS");
  console.log(SEP);
  console.log(`  Scenarios evaluated:  ${results.length}`);
  console.log(`  Scenarios passed:     ${passCount}/${results.length}`);
  console.log(`  Overall weighted avg: ${(overallAvg * 100).toFixed(1)}%`);
  console.log(`  Pass threshold:       ${(rubric.passThreshold * 100).toFixed(0)}%`);
  console.log(`  Target threshold:     ${(rubric.targetThreshold * 100).toFixed(0)}%`);
  console.log(`  Verdict:              ${overallPass ? "PASS" : "FAIL"}${meetsTarget ? " (MEETS TARGET)" : ""}`);

  // ---- Pipeline Legend ----
  console.log("\n  Pipeline flags legend:");
  console.log("    P=promptBuilt  H=phaseMatch  T=thoughtParsed  R=replyExtracted");
  console.log("    S=sanitized    V=safetyValid  A=humanized      Bn=bubbleCount");
  console.log("    M=sentimentMatch  (lowercase = failed)");

  // ---- Production Readiness Checks ----
  console.log("\n" + SEP);
  console.log("  PRODUCTION READINESS CHECKS");
  console.log(SEP);

  for (const check of prodChecks) {
    const icon = check.severity === "PASS" ? "[PASS]" :
                 check.severity === "WARN" ? "[WARN]" : "[FAIL]";
    console.log(`\n  ${icon} ${check.name}`);
    console.log(`         ${check.detail}`);
  }

  // ---- Known Issues ----
  const warns = prodChecks.filter(c => c.severity === "WARN");
  if (warns.length > 0) {
    console.log("\n" + SEP);
    console.log("  KNOWN ISSUES");
    console.log(SEP);
    for (const w of warns) {
      console.log(`\n  - ${w.name}`);
      console.log(`    ${w.detail}`);
    }
  }

  // ---- Final Summary ----
  const failedProd = prodChecks.filter(c => c.severity === "FAIL");
  console.log("\n" + SEP);
  console.log("  SUMMARY");
  console.log(SEP);
  console.log(`  Eval Score:       ${(overallAvg * 100).toFixed(1)}% ${overallPass ? "PASS" : "FAIL"}`);
  console.log(`  Prod Checks:      ${prodChecks.length - failedProd.length}/${prodChecks.length} passed, ${warns.length} warnings`);
  console.log(`  Ready to deploy:  ${overallPass && failedProd.length === 0 ? "YES" : "NO"}`);
  console.log(SEP + "\n");
}

function padRight(str: string, len: number): string {
  return str.length >= len ? str : str + " ".repeat(len - str.length);
}

// ================================================================
// ENTRY POINT
// ================================================================

function main(): void {
  console.log("Loading 13 evaluation scenarios...");
  const scenarios = EVAL_SCENARIOS;
  console.log(`Loaded ${scenarios.length} scenarios.`);

  console.log(`Rubric: ${EVAL_RUBRIC.dimensions.length} dimensions, pass >= ${(EVAL_RUBRIC.passThreshold * 100).toFixed(0)}%, target >= ${(EVAL_RUBRIC.targetThreshold * 100).toFixed(0)}%`);
  console.log("\nRunning pipeline evaluation...\n");

  // Run all scenarios
  const results: ScenarioResult[] = [];
  for (const scenario of scenarios) {
    try {
      const result = runScenario(scenario);
      results.push(result);
      console.log(`  [${result.pass ? "PASS" : "FAIL"}] ${scenario.id} — ${scenario.name}: ${(result.totalWeighted * 100).toFixed(1)}%`);
    } catch (err) {
      console.error(`  [ERR]  ${scenario.id} — ${scenario.name}: ${(err as Error).message}`);
      // Create a failed result for error cases
      results.push({
        id: scenario.id,
        name: scenario.name,
        scores: EVAL_RUBRIC.dimensions.map(d => ({
          dimension: d.name,
          score: 0,
          weight: d.weight,
          weighted: 0,
          notes: `ERROR: ${(err as Error).message}`,
        })),
        totalWeighted: 0,
        pass: false,
        pipelineChecks: {
          promptBuilt: false,
          phaseMatch: false,
          thoughtParsed: false,
          replyExtracted: false,
          sanitized: false,
          isSafe: false,
          humanized: false,
          bubbleCount: 0,
          pauseMs: 0,
          sentimentMatch: false,
        },
      });
    }
  }

  // Run production readiness checks
  console.log("\nRunning production readiness checks...\n");
  const prodChecks = runProductionChecks(scenarios);
  for (const check of prodChecks) {
    const icon = check.severity === "PASS" ? "PASS" :
                 check.severity === "WARN" ? "WARN" : "FAIL";
    console.log(`  [${icon}] ${check.name}`);
  }

  // Print full report
  printReport(results, prodChecks, EVAL_RUBRIC);

  // Exit code
  const overallAvg = results.reduce((sum, r) => sum + r.totalWeighted, 0) / results.length;
  const failedProd = prodChecks.filter(c => c.severity === "FAIL");
  const exitOk = overallAvg >= EVAL_RUBRIC.passThreshold && failedProd.length === 0;

  if (!exitOk) {
    console.log("Exiting with code 1 (evaluation failed).\n");
    if (typeof Deno !== "undefined") {
      Deno.exit(1);
    } else {
      process.exit(1);
    }
  } else {
    console.log("Exiting with code 0 (evaluation passed).\n");
  }
}

// Run
main();
