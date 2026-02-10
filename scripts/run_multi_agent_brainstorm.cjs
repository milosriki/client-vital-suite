// scripts/run_multi_agent_brainstorm.cjs
require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

// Support multiple env var names for the key
const googleKey =
  process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY;

if (!googleKey) {
  console.warn("⚠️  WARNING: Google API Key missing. Running in MOCK MODE.");
}

const SYSTEM_PROMPTS = {
  DESIGNER: `You are the **Lead Designer** for "Lisa", an AI Appointment Setter. 
  GOAL: Create a "Smart Cool" vocabulary and setup to achieve >20% conversion (Top 1% benchmark).
  STYLE: High status, "Big Sister", low pressure, high competence.
  OUTPUT: A list of 5 "Power Phrases" and 1 "Golden Setup" (the perfect flow).`,

  SKEPTIC: `You are the **Skeptic**. Your job is to TEAR APART the Designer's ideas.
  Assume they will sound robotic, cringe, or "salesy".
  Point out where the "Cool" sounds "Try-hard".
  OUTPUT: 3 Brutal Critiques.`,

  ADVOCATE: `You are the **User Advocate**. You represent the tired, skeptical lead.
  Does this feel like a human? Does it feel safe?
  OUTPUT: 1 specific adjustment to make it feel more "Real".`,

  INTEGRATOR: `You are the **Integrator**.
  Review the Design, the Critique, and the Advocacy.
  DECIDE on the Final Verson.
  OUTPUT: The improved 5 Power Phrases and Golden Setup, incorporating the feedback.`,
};

async function callGemini(systemPrompt, userContent) {
  if (!googleKey) {
    // Mock Mode
    if (systemPrompt.includes("Lead Designer"))
      return JSON.stringify({
        phrases: ["Let's get this sorted.", "big vision.", "fair enough."],
        setup: "Ask about sleep first.",
      });
    if (systemPrompt.includes("Skeptic"))
      return "Critique: 'Let's get this sorted' sounds British/Old.";
    if (systemPrompt.includes("User Advocate"))
      return "Feedback: Make it shorter.";
    return JSON.stringify({
      final_phrases: [
        "I've got you.",
        "Beast mode or survival mode?",
        "Fair play.",
      ],
      final_setup: "The Lifestyle Audit approach.",
    });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${googleKey}`;

  const payload = {
    contents: [
      {
        parts: [{ text: systemPrompt }, { text: `CONTEXT:\n${userContent}` }],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
    },
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error(`Gemini Error: ${response.status}`);
    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  } catch (e) {
    console.error("Gemini Call Failed:", e);
    return "{}";
  }
}

async function runBrainstorm() {
  console.log("🧠 Starting Multi-Agent Brainstorming Session...");

  // Round 1: Design
  console.log("\n--- 1. DESIGNER ---");
  const design = await callGemini(
    SYSTEM_PROMPTS.DESIGNER,
    "Context: We need to beat the top 1% human setters (12% conversion). We need >20%.",
  );
  console.log(design);

  // Round 2: Critique
  console.log("\n--- 2. SKEPTIC ---");
  const critique = await callGemini(
    SYSTEM_PROMPTS.SKEPTIC,
    `Proposed Design:\n${design}`,
  );
  console.log(critique);

  // Round 3: Advocacy
  console.log("\n--- 3. USER ADVOCATE ---");
  const feedback = await callGemini(
    SYSTEM_PROMPTS.ADVOCATE,
    `Proposed Design:\n${design}\n\nCritique:\n${critique}`,
  );
  console.log(feedback);

  // Round 4: Integration
  console.log("\n--- 4. INTEGRATOR (Final Decision) ---");
  const finalResult = await callGemini(
    SYSTEM_PROMPTS.INTEGRATOR,
    `Reference Material:\nDesign: ${design}\nCritique: ${critique}\nAdvocacy: ${feedback}`,
  );
  console.log(finalResult);
}

runBrainstorm();
