/**
 * Devin API Data Extractor
 * Extracts all sessions, knowledge, and playbooks from your Devin account
 * 
 * Usage:
 *   DEVIN_API_KEY=your_key npx ts-node scripts/devin-extractor.ts
 *   
 * Or set in .env file:
 *   DEVIN_API_KEY=apk_user_xxx
 */

const DEVIN_API_BASE = "https://api.devin.ai/v1";

interface Session {
  session_id: string;
  title: string;
  status: string;
  status_enum: string;
  created_at: string;
  updated_at: string;
  requesting_user_email: string;
  pull_request?: { url: string };
  tags?: string[];
  playbook_id?: string;
}

interface SessionDetails {
  session_id: string;
  title: string;
  status_enum: string;
  structured_output?: any;
  conversation?: Array<{
    role: string;
    content: string;
    timestamp?: string;
  }>;
}

interface Knowledge {
  id: string;
  name: string;
  content: string;
  created_at: string;
}

interface Playbook {
  id: string;
  name: string;
  instructions: string;
  macro?: string;
}

class DevinExtractor {
  private apiKey: string;
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async fetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${DEVIN_API_BASE}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Devin API error (${response.status}): ${error}`);
    }

    return response.json();
  }

  /**
   * List all sessions with pagination
   */
  async listSessions(limit = 100, offset = 0): Promise<Session[]> {
    const data = await this.fetch<{ sessions: Session[] }>(
      `/sessions?limit=${limit}&offset=${offset}`
    );
    return data.sessions;
  }

  /**
   * Get all sessions (handles pagination)
   */
  async getAllSessions(): Promise<Session[]> {
    const allSessions: Session[] = [];
    let offset = 0;
    const limit = 100;
    
    console.log("📋 Fetching all Devin sessions...");
    
    while (true) {
      const sessions = await this.listSessions(limit, offset);
      if (sessions.length === 0) break;
      
      allSessions.push(...sessions);
      console.log(`   Fetched ${allSessions.length} sessions...`);
      
      if (sessions.length < limit) break;
      offset += limit;
    }
    
    return allSessions;
  }

  /**
   * Get detailed session info including conversation
   */
  async getSessionDetails(sessionId: string): Promise<SessionDetails> {
    return this.fetch<SessionDetails>(`/sessions/${sessionId}`);
  }

  /**
   * List all knowledge items
   */
  async listKnowledge(): Promise<Knowledge[]> {
    try {
      const data = await this.fetch<{ knowledge: Knowledge[] }>("/knowledge");
      return data.knowledge || [];
    } catch (e) {
      console.warn("⚠️ Could not fetch knowledge (may require different permissions)");
      return [];
    }
  }

  /**
   * List all playbooks
   */
  async listPlaybooks(): Promise<Playbook[]> {
    try {
      const data = await this.fetch<{ playbooks: Playbook[] }>("/playbooks");
      return data.playbooks || [];
    } catch (e) {
      console.warn("⚠️ Could not fetch playbooks (may require different permissions)");
      return [];
    }
  }

  /**
   * Extract everything and save to files
   */
  async extractAll(outputDir = "./devin-export") {
    const fs = await import("fs/promises");
    const path = await import("path");
    
    // Create output directory
    await fs.mkdir(outputDir, { recursive: true });
    
    console.log("\n🤖 DEVIN DATA EXTRACTOR");
    console.log("========================\n");

    // 1. Get all sessions
    const sessions = await this.getAllSessions();
    console.log(`✅ Found ${sessions.length} total sessions\n`);

    // Save sessions summary
    await fs.writeFile(
      path.join(outputDir, "sessions-summary.json"),
      JSON.stringify(sessions, null, 2)
    );

    // 2. Get detailed info for recent/important sessions
    console.log("📝 Fetching session details...");
    const sessionDetails: SessionDetails[] = [];
    
    // Get details for last 20 sessions (or all if fewer)
    const sessionsToFetch = sessions.slice(0, 20);
    for (const session of sessionsToFetch) {
      try {
        const details = await this.getSessionDetails(session.session_id);
        sessionDetails.push(details);
        console.log(`   ✓ ${session.title || session.session_id}`);
      } catch (e) {
        console.log(`   ✗ Failed: ${session.session_id}`);
      }
    }

    await fs.writeFile(
      path.join(outputDir, "sessions-detailed.json"),
      JSON.stringify(sessionDetails, null, 2)
    );

    // 3. Get knowledge base
    console.log("\n📚 Fetching knowledge base...");
    const knowledge = await this.listKnowledge();
    console.log(`✅ Found ${knowledge.length} knowledge items`);
    
    await fs.writeFile(
      path.join(outputDir, "knowledge.json"),
      JSON.stringify(knowledge, null, 2)
    );

    // 4. Get playbooks
    console.log("\n📖 Fetching playbooks...");
    const playbooks = await this.listPlaybooks();
    console.log(`✅ Found ${playbooks.length} playbooks`);
    
    await fs.writeFile(
      path.join(outputDir, "playbooks.json"),
      JSON.stringify(playbooks, null, 2)
    );

    // 5. Generate summary report
    const summary = {
      exported_at: new Date().toISOString(),
      stats: {
        total_sessions: sessions.length,
        sessions_by_status: this.groupBy(sessions, "status_enum"),
        detailed_sessions_fetched: sessionDetails.length,
        knowledge_items: knowledge.length,
        playbooks: playbooks.length,
      },
      recent_sessions: sessions.slice(0, 10).map(s => ({
        id: s.session_id,
        title: s.title,
        status: s.status_enum,
        created: s.created_at,
        pr: s.pull_request?.url,
      })),
    };

    await fs.writeFile(
      path.join(outputDir, "export-summary.json"),
      JSON.stringify(summary, null, 2)
    );

    // Print summary
    console.log("\n" + "=".repeat(50));
    console.log("📊 EXPORT SUMMARY");
    console.log("=".repeat(50));
    console.log(`Total Sessions: ${sessions.length}`);
    console.log(`Sessions by Status:`);
    for (const [status, count] of Object.entries(summary.stats.sessions_by_status)) {
      console.log(`  - ${status}: ${count}`);
    }
    console.log(`Knowledge Items: ${knowledge.length}`);
    console.log(`Playbooks: ${playbooks.length}`);
    console.log(`\n📁 Export saved to: ${outputDir}/`);
    console.log("=".repeat(50));

    return summary;
  }

  private groupBy(arr: any[], key: string): Record<string, number> {
    return arr.reduce((acc, item) => {
      const k = item[key] || "unknown";
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});
  }
}

// Main execution
async function main() {
  const apiKey = process.env.DEVIN_API_KEY;
  
  if (!apiKey) {
    console.error("❌ Error: DEVIN_API_KEY environment variable not set");
    console.error("\nUsage:");
    console.error("  DEVIN_API_KEY=apk_user_xxx npx ts-node scripts/devin-extractor.ts");
    console.error("\nOr add to .env file:");
    console.error("  DEVIN_API_KEY=apk_user_xxx");
    process.exit(1);
  }

  const extractor = new DevinExtractor(apiKey);
  
  try {
    await extractor.extractAll("./devin-export");
  } catch (error) {
    console.error("❌ Extraction failed:", error);
    process.exit(1);
  }
}

main();
