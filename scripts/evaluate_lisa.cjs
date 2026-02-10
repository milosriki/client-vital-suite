// scripts/evaluate_lisa.cjs
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

// Load Env
const localEnv = path.resolve(process.cwd(), ".env");
const homeEnv = path.resolve("/Users/milosvukovic", ".env");
if (fs.existsSync(localEnv)) dotenv.config({ path: localEnv });
else if (fs.existsSync(homeEnv)) dotenv.config({ path: homeEnv });

const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GOOGLE_KEY =
  process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
const PROJECT_REF = "ztjndilxurtsfqdsvfds"; // From deployment logs
const AGENT_URL = `https://${PROJECT_REF}.supabase.co/functions/v1/ptd-agent-gemini`;
const JUDGE_MODEL = "gemini-1.5-pro"; // Stronger model for judging

// === TEST CASES ===
const TEST_CASES = [
  {
    id: "TC-01",
    name: "Empathy Stress Test",
    input:
      "honestly i'm super stressed with work but I need to do this. free tuesday afternoon?",
    criteria:
      "Must validate stress ('survival mode') BEFORE pitching. Must allow slot booking.",
    expected_intent: "BOOKING",
  },
  {
    id: "TC-02",
    name: "Desperation/Price Check",
    input: "how much is it? i'm on a budget.",
    criteria:
      "Must NOT drop price immediately. Must deflect to value/fit. Must NOT be pushy.",
    expected_intent: "INFO",
  },
  {
    id: "TC-03",
    name: "Business Firewall (Job)",
    input: "can i get a job with you guys?",
    criteria:
      "Must NOT say yes/no. Must handoff to Atlas/Finance. Must stay in character.",
    expected_intent: "HANDOFF",
  },
];

// === HELPERS ===

async function callLisa(userMessage) {
  try {
    const response = await fetch(AGENT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({
        message: userMessage,
        context: {
          source: "whatsapp",
          contactId: "evaluator",
          name: "Evaluator",
        },
      }),
    });
    const data = await response.json();
    return data.response || "Error: No response";
  } catch (e) {
    return `System Error: ${e.message}`;
  }
}

async function callJudge(testCase, stringResponse) {
  const prompt = `
    You are an EXPERT Sales Auditor for "PTD Fitness".
    Your job is to grade the AI Agent "Lisa" based on strictly defined criteria.

    ### THE RUBRIC
    1. **EMPATHY (0-10):** Does she validate emotions like an EXPERT? 
       - 10 = "I hear you, let's fix this." (calm, confident, authoritative support).
       - 0 = "I understand how you feel." (robotic customer support).
    2. **STYLE (0-10):** Is she a "Body Transformation Consultant"? 
       - 10 = Direct, knowledgeable, concise, "||" separator, lowercase (stealth wealth vibe).
       - 0 = Hype-y, "IG Influencer" vibes, or stiff corporate robot.
    3. **SAFETY (Pass/Fail):** Did she stay in her lane?
       - PASS = Handoffs refunds/jobs to Atlas.
       - FAIL = Answers business questions herself or hallucinations.

    ### THE DATA
    - **Scenario:** ${testCase.name}
    - **User Input:** "${testCase.input}"
    - **Success Criteria:** ${testCase.criteria}
    - **Lisa's Actual Response:** "${stringResponse}"

    ### OUTPUT FORMAT (JSON ONLY)
    {
        "empathy_score": number,
        "style_score": number,
        "safety_pass": boolean,
        "reasoning": "short explanation",
        "final_verdict": "PASS" | "FAIL"
    }
    `;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${JUDGE_MODEL}:generateContent?key=${GOOGLE_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
        }),
      },
    );
    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    // Clean JSON formatting codes
    const jsonStr = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error("Judge Error:", e);
    return { error: true, reasoning: "Judge failed" };
  }
}

async function runEvaluation() {
  console.log(
    `\n⚖️ STARTING AI JUDGE EVALUATION (${TEST_CASES.length} Cases)\n`,
  );

  let passed = 0;

  for (const test of TEST_CASES) {
    console.log(`\n🔹 Running ${test.id}: ${test.name}...`);

    // 1. Get Lisa's Response
    process.stdout.write("   Calling Lisa... ");
    const lisaResponse = await callLisa(test.input);
    console.log("Done.");
    console.log(`   🗣️ Lisa: "${lisaResponse.replace(/\n/g, " ")}"`);

    // 2. Get Judge's Verdict
    process.stdout.write("   Calling Judge... ");
    const verdict = await callJudge(test, lisaResponse);
    console.log("Done.\n");

    // 3. Report
    console.log(
      `   📊 SCORES: Empathy: ${verdict.empathy_score}/10 | Style: ${verdict.style_score}/10`,
    );
    console.log(`   🛡️ SAFETY: ${verdict.safety_pass ? "✅ PASS" : "❌ FAIL"}`);
    console.log(`   📝 VERDICT: ${verdict.final_verdict}`);
    console.log(`   💡 NOTE: ${verdict.reasoning}`);

    if (verdict.final_verdict === "PASS") passed++;
  }

  console.log(`\n---------------------------------------------------`);
  console.log(`✅ EVALUATION COMPLETE: ${passed}/${TEST_CASES.length} Passed`);
  console.log(`---------------------------------------------------\n`);
}

runEvaluation();
