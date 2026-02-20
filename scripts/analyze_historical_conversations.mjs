import fs from 'fs';

const SUPABASE_URL = "https://ztjndilxurtsfqdsvfds.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0am5kaWx4dXJ0c2ZxZHN2ZmRzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDEyMDYwNywiZXhwIjoyMDY5Njk2NjA3fQ.1YKDkcl8EQ6eRG1y_-LaIfd03tEJffYNCVEyTrUuNCY";
const GEMINI_API_KEY = "AIzaSyDtyoadQ7oGOrJnNFuH_M9WZjHZ65iivsw";

async function fetchMemories() {
  console.log("Fetching historical conversations from database...");
  const res = await fetch(SUPABASE_URL + "/rest/v1/agent_memory?select=thread_id,role,content,created_at&order=created_at.desc&limit=1000", {
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": "Bearer " + SUPABASE_KEY
    }
  });
  
  if (!res.ok) {
    throw new Error("Failed to fetch memories: " + await res.text());
  }
  
  return await res.json();
}

async function analyzeWithGemini(transcriptText) {
  console.log("Sending " + transcriptText.length + " characters of transcript data to Gemini 2.5 Flash for deep pattern analysis...");
  
  const prompt = [
    "You are an elite AI Conversation Architect.",
    "I am providing you with a raw dump of recent conversation transcripts between users and our AI WhatsApp setter, LISA.",
    "",
    "These transcripts contain both successful flows and drop-offs.",
    "Your task is to analyze these 1000+ message interactions and identify EXACTLY why and where LISA loses clients.",
    "",
    "Look for:",
    "1. Behavioral friction (is she too pushy, too robotic, or asking too many questions?)",
    "2. Price objection handling (how do people react when she drops the 3k-4k range, and does her pivot work?)",
    "3. Tone and Status (does she maintain high-status empathetic detachment, or does she sound like a desperate customer service bot?)",
    "4. Specific drop-off points (at what specific stage of the script do users stop replying?)",
    "",
    "Based on your analysis, write a comprehensive Markdown report structured as follows:",
    "# LISA Historical Failure Analysis & Training Directives",
    "## 1. Primary Drop-Off Patterns",
    "## 2. Friction Points Identified",
    "## 3. Success Signatures (What works well)",
    "## 4. Re-Training Directives (Exact changes to make to her prompt/behavior)",
    "",
    "Raw Transcripts:",
    "====================",
    transcriptText,
    "===================="
  ].join("\n");

  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: 8000, temperature: 0.2 }
  };

  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + GEMINI_API_KEY, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "Analysis failed.";
}

async function main() {
  try {
    const data = await fetchMemories();
    
    // Group by thread
    const threads = {};
    for (const msg of data) {
      if (!threads[msg.thread_id]) threads[msg.thread_id] = [];
      threads[msg.thread_id].push(msg);
    }
    
    // Filter and sort
    let transcriptText = "";
    let validConvos = 0;
    
    for (const [threadId, msgs] of Object.entries(threads)) {
      if (msgs.length < 2) continue; // Skip orphan messages
      validConvos++;
      
      // Messages are desc, sort them asc for reading
      msgs.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      
      transcriptText += "\n--- THREAD: " + threadId + " ---\n";
      for (const m of msgs) {
        transcriptText += "[" + m.role.toUpperCase() + "]: " + m.content + "\n";
      }
    }
    
    console.log("Processed " + validConvos + " valid conversations.");
    
    const analysisReport = await analyzeWithGemini(transcriptText);
    
    const outputPath = "/Users/milosvukovic/client-vital-suite/LISA_HISTORICAL_FAILURE_ANALYSIS.md";
    fs.writeFileSync(outputPath, analysisReport);
    
    console.log("Analysis complete. Wrote report to " + outputPath);
  } catch (err) {
    console.error("Fatal Error:", err);
  }
}

main();
