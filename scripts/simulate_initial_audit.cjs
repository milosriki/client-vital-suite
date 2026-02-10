// scripts/simulate_initial_audit.cjs
require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
// Support multiple env var names for the key
const googleKey =
  process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing Supabase Secrets in .env");
  process.exit(1);
}

if (!googleKey) {
  console.warn("⚠️  WARNING: Google API Key missing. Running in MOCK MODE.");
}

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

async function callGemini(text) {
  if (!googleKey) {
    console.log("   🤖 [Mock AI] Generating simulated grade...");
    await new Promise((r) => setTimeout(r, 500)); // Simulate latency
    // Return a random-ish result for variety
    const scores = [75, 82, 90, 65];
    const weaknesses = [
      "Proactive Nurture",
      "Strategic Booking",
      "Contextual Memory",
      "Tone",
    ];
    const lessons = [
      "Follow up faster next time.",
      "Offer a time slot immediately.",
      "Remember the user's name.",
      "Don't sound so robotic.",
    ];
    const idx = Math.floor(Math.random() * scores.length);

    return {
      score: scores[idx],
      weakness: weaknesses[idx],
      lesson: lessons[idx],
      analysis: "Mock analysis for testing data flow.",
    };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${googleKey}`;

  const payload = {
    contents: [
      {
        parts: [{ text: text }],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(
      `Gemini API Error: ${response.status} ${response.statusText}`,
    );
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!content) throw new Error("No content returned from Gemini");
  return JSON.parse(content);
}

async function runSimulation() {
  console.log("🚀 Starting Initial Skill Audit Simulation (No-Deps Mode)...");

  // 1. Fetch recent interactions
  const { data: interactions, error } = await supabase
    .from("whatsapp_interactions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Error fetching interactions:", error);
    return;
  }

  const conversations = {};
  interactions.forEach((i) => {
    if (!conversations[i.phone_number]) conversations[i.phone_number] = [];
    conversations[i.phone_number].push(i);
  });

  console.log(
    `Found ${Object.keys(conversations).length} active conversations to audit.`,
  );

  for (const [phone, msgs] of Object.entries(conversations)) {
    const history = msgs.sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    const transcript = history
      .map((m) => `User: ${m.message_text}\nLisa: ${m.response_text}`)
      .join("\n---\n");

    console.log(`\n👨‍🏫 Auditing conversation with ${phone}...`);

    try {
      const prompt = `${AUDIT_PROMPT}\n\nTRANSCRIPT FOR ${phone}:\n${transcript}`;
      const grading = await callGemini(prompt);

      console.log(
        `   📝 Score: ${grading.score}/100 | Weakness: ${grading.weakness}`,
      );
      console.log(`   💡 Lesson: "${grading.lesson}"`);

      // 3. Store Lesson
      const lessonEntry = {
        category: "learning",
        subcategory: "skill_improvement",
        title: `Improvement: ${grading.weakness}`,
        content: grading.lesson,
        structured_data: {
          score: grading.score,
          source_interaction: msgs[msgs.length - 1].id,
          grading_model: "gemini-1.5-flash-sim",
        },
        source: "atlas_audit_sim",
      };

      const { error: insertError } = await supabase
        .from("agent_knowledge")
        .insert(lessonEntry);
      if (insertError)
        console.error("   ❌ Failed to save lesson:", insertError);
      else console.log("   ✅ Lesson saved to Knowledge Base.");
    } catch (err) {
      console.error("   ❌ Audit failed:", err.message);
    }
  }
}

runSimulation();
