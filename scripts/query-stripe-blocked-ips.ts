/**
 * Query Stripe for blocked IPs through the agentic system
 * Note: Stripe doesn't expose blocked IPs directly via API
 * This script uses the PTD agent to query fraud/security data
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://ztjndilxurtsfqdsvfds.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ SUPABASE_SERVICE_ROLE_KEY is required");
  console.log("Set it as: export SUPABASE_SERVICE_ROLE_KEY=your_key");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function queryBlockedIPs() {
  console.log("🔍 Querying Stripe for blocked IPs through agentic system...\n");

  try {
    // Query 1: Use the agent to check Stripe fraud/security data
    console.log("📡 Querying PTD Agent for Stripe blocked IPs...");
    const agentResponse = await supabase.functions.invoke("ptd-agent-gemini", {
      body: {
        message: "Check Stripe for any blocked IP addresses. Look for fraud alerts, security restrictions, or IP-based blocks. Also check Radar rules and any IP restrictions in account settings.",
        thread_id: "stripe-ip-check"
      }
    });

    if (agentResponse.error) {
      console.error("❌ Agent error:", agentResponse.error);
      return;
    }

    console.log("\n🤖 Agent Response:");
    console.log("=" .repeat(80));
    console.log(agentResponse.data?.response || JSON.stringify(agentResponse.data, null, 2));
    console.log("=" .repeat(80));

    // Query 2: Direct Stripe forensics call for fraud data
    console.log("\n\n📡 Running Stripe fraud scan to detect IP-related blocks...");
    const forensicsResponse = await supabase.functions.invoke("stripe-forensics", {
      body: {
        action: "full-audit",
        days: 90
      }
    });

    if (forensicsResponse.error) {
      console.error("❌ Forensics error:", forensicsResponse.error);
    } else {
      console.log("\n🔒 Stripe Security Audit Results:");
      console.log("=" .repeat(80));
      
      const data = forensicsResponse.data;
      
      if (data?.anomalies) {
        console.log(`\n⚠️  Found ${data.anomalies.length} security anomalies:`);
        data.anomalies.forEach((anomaly: any, index: number) => {
          console.log(`\n${index + 1}. ${anomaly.type} (${anomaly.severity})`);
          console.log(`   Message: ${anomaly.message}`);
          if (anomaly.details) {
            console.log(`   Details:`, JSON.stringify(anomaly.details, null, 2));
          }
        });
      }

      if (data?.securityScore !== undefined) {
        console.log(`\n🛡️  Security Score: ${data.securityScore}/100`);
      }

      // Check for IP-related events
      if (data?.events) {
        const ipRelatedEvents = data.events.filter((e: any) => 
          e.type?.includes('radar') || 
          e.type?.includes('fraud') ||
          e.type?.includes('blocked') ||
          e.data?.object?.outcome?.type === 'blocked'
        );
        
        if (ipRelatedEvents.length > 0) {
          console.log(`\n🚫 Found ${ipRelatedEvents.length} IP/fraud-related events:`);
          ipRelatedEvents.slice(0, 10).forEach((event: any) => {
            console.log(`   - ${event.type} (${new Date(event.created * 1000).toLocaleString()})`);
            if (event.data?.object?.outcome) {
              console.log(`     Outcome: ${JSON.stringify(event.data.object.outcome)}`);
            }
          });
        }
      }

      console.log("\n" + "=" .repeat(80));
    }

    // Query 3: Check Stripe Dashboard data for restrictions
    console.log("\n\n📡 Checking Stripe account restrictions...");
    const dashboardResponse = await supabase.functions.invoke("stripe-dashboard-data", {
      body: {}
    });

    if (dashboardResponse.error) {
      console.error("❌ Dashboard data error:", dashboardResponse.error);
    } else {
      console.log("\n📊 Account Status:");
      console.log("=" .repeat(80));
      console.log(JSON.stringify(dashboardResponse.data, null, 2));
      console.log("=" .repeat(80));
    }

    console.log("\n\n💡 IMPORTANT NOTES:");
    console.log("=" .repeat(80));
    console.log("1. Stripe doesn't expose blocked IPs directly via API");
    console.log("2. To see IP addresses, check: Stripe Dashboard > Developers > Logs");
    console.log("3. For Radar rules and IP blocks, check: Stripe Dashboard > Radar > Rules");
    console.log("4. IP restrictions may be in: Stripe Dashboard > Settings > Security");
    console.log("=" .repeat(80));

  } catch (error: any) {
    console.error("❌ Error:", error.message);
    console.error(error);
  }
}

// Run the query
queryBlockedIPs();
