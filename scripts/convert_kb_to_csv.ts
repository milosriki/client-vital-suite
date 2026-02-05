import { dirname, fromFileUrl, join } from "https://deno.land/std/path/mod.ts";

const MARKDOWN_PATH = join(
  dirname(fromFileUrl(import.meta.url)),
  "../AGENT_KNOWLEDGE_BASE.md",
);
const OUTPUT_PATH = join(
  dirname(fromFileUrl(import.meta.url)),
  "../knowledge_base.csv",
);

async function parseMarkdown() {
  const text = await Deno.readTextFile(MARKDOWN_PATH);
  const lines = text.split("\n");

  const csvRows: string[] = [];
  csvRows.push('"Question","Answer"'); // Header

  // Hardcoded Gym Launch Objections (The "Human Sales Protocol")
  csvRows.push(
    '"That is too expensive","Totally get it. Budget matters. Honestly, the 12-week Hybrid plan is a steal & keeps costs down. Want to see the rates?"',
  );
  csvRows.push(
    "\"Can I think about it?\",\"Of course. But usually 'thinking about it' means you're not sure if it'll work. Is it the price or the time commitment?\"",
  );
  csvRows.push(
    '"Do you have a guarantee?","100%. If you follow the plan and don\'t see results, we work for free until you do. Fair enough?"',
  );
  csvRows.push(
    '"Where are you located?","We operate mostly online/hybrid, but our HQ is in Dubai. We have coaches all over. Where are you based?"',
  );
  csvRows.push(
    '"Who is Mark?","That\'s me! 👋 I\'m the Head Coach and Booking Manager here at PTD. I help you find the right plan."',
  );

  let currentAgent = "";
  let currentRole = "";

  for (const line of lines) {
    if (line.startsWith("### ")) {
      // New Agent Found
      // Format: ### 1. PTD-AGENT-GEMINI (Primary AI Assistant)
      const match = line.match(/### \d+\. ([\w-]+) \((.*)\)/);
      if (match) {
        currentAgent = match[1];
        const description = match[2];

        // Add "Who is X?" FAQ
        const answer =
          `${currentAgent} is our ${description}. It helps with fitness intelligence.`.replace(
            /"/g,
            '""',
          );
        csvRows.push(`"Who is ${currentAgent}?","${answer}"`);
        csvRows.push(`"What does ${currentAgent} do?","${answer}"`);
      }
    }
  }

  await Deno.writeTextFile(OUTPUT_PATH, csvRows.join("\n"));
  console.log(
    `✅ Converted KB to CSV: ${OUTPUT_PATH} (${csvRows.length} rows)`,
  );
}

parseMarkdown();
