import * as fs from "fs";
import * as path from "path";

// Configuration
const KB_DIR = "/Users/milosvukovic/client-vital-suite/.agent/knowledge_base";
const OUTPUT_FILE = "knowledge_base.csv";

// Files to process
const SOURCE_FILES = [
  "MASTER_GUIDE.md",
  "AVATAR_SCRIPTS.md",
  "OBJECTION_HANDLING.md",
];

interface KnowledgeEntry {
  question: string;
  answer: string;
}

function parseMarkdownFile(filePath: string): KnowledgeEntry[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const entries: KnowledgeEntry[] = [];

  let currentSection = "";
  let currentScript = "";

  for (const line of lines) {
    const trimmed = line.trim();

    // Trigger/Header Detection (## )
    if (trimmed.startsWith("## ")) {
      // Save previous if exists
      if (currentSection && currentScript) {
        entries.push({
          question: currentSection,
          answer: cleanScript(currentScript),
        });
      }
      // Start new section
      currentSection = trimmed
        .replace("## ", "")
        .replace(/\(.*\)/, "")
        .trim();
      // e.g. "Too Expensive"
      currentScript = "";
      continue;
    }

    // Capture Trigger Phrases specifically if marked with **Trigger:** or similar
    // For simplicity, we assume the Header IS the primary trigger concept

    // Capture Blockquotes as the Answer/Script
    if (trimmed.startsWith(">")) {
      currentScript += trimmed.replace(">", "").trim() + " ";
    }
  }

  // Push final entry
  if (currentSection && currentScript) {
    entries.push({
      question: currentSection,
      answer: cleanScript(currentScript),
    });
  }

  return entries;
}

function cleanScript(script: string): string {
  // Replace double quotes with double-double quotes for CSV escaping
  return script.trim().replace(/"/g, '""');
}

function generateCSV() {
  console.log("🧠 Generating Dialogflow Knowledge Base CSV...");

  let allEntries: KnowledgeEntry[] = [];

  for (const file of SOURCE_FILES) {
    const fullPath = path.join(KB_DIR, file);
    if (!fs.existsSync(fullPath)) {
      console.warn(`⚠️ Warning: File not found: ${fullPath}`);
      continue;
    }

    console.log(`Processing ${file}...`);
    const entries = parseMarkdownFile(fullPath);
    allEntries = [...allEntries, ...entries];
  }

  // Generate CSV Content
  // Header: Question,Answer
  const headers = '"Question","Answer"';
  const csvRows = allEntries.map((e) => `"${e.question}","${e.answer}"`);

  const csvContent = [headers, ...csvRows].join("\n");

  fs.writeFileSync(OUTPUT_FILE, csvContent);
  console.log(
    `✅ Success! Generated ${OUTPUT_FILE} with ${allEntries.length} entries.`,
  );
  console.log(`\nSample Output:\n${csvRows.slice(0, 3).join("\n")}`);
}

generateCSV();
