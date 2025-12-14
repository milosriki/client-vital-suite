#!/usr/bin/env -S deno run --allow-net --allow-env
/**
 * Query Visa Approvals and Capability Changes on Stripe Admin
 * 
 * This script queries the stripe-forensics function to detect:
 * - Manual Visa/capability approvals
 * - Account changes from unauthorized IPs
 * - Suspicious admin actions
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://ztjndilxurtsfqdsvfds.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY is required');
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function queryVisaApprovals() {
  console.log('🔍 Querying Stripe Forensics for Visa Approvals...\n');

  try {
    // Invoke stripe-forensics with focus on capability approvals
    const { data, error } = await supabase.functions.invoke('stripe-forensics', {
      body: {
        action: 'full-audit',
        days: 90, // Check last 90 days
        focus: 'capability-approvals' // Focus on Visa/capability changes
      }
    });

    if (error) {
      console.error('❌ Error:', error);
      return;
    }

    console.log('✅ Forensic Audit Complete\n');
    console.log('='.repeat(80));
    console.log('📊 VISA APPROVAL & CAPABILITY CHANGES REPORT');
    console.log('='.repeat(80));
    console.log('');

    // Filter for Visa/capability related anomalies
    const visaAnomalies = (data?.anomalies || []).filter((a: any) => 
      a.type === 'MANUAL_CAPABILITY_APPROVAL' ||
      a.type === 'UNAUTHORIZED_IP_ACCESS' ||
      a.message?.toLowerCase().includes('capability') ||
      a.message?.toLowerCase().includes('visa') ||
      a.message?.toLowerCase().includes('approval')
    );

    if (visaAnomalies.length === 0) {
      console.log('✅ No suspicious Visa approvals or capability changes detected.\n');
      console.log('📋 All capability changes appear to be legitimate.\n');
    } else {
      console.log(`🚨 Found ${visaAnomalies.length} suspicious Visa/capability events:\n`);
      
      visaAnomalies.forEach((anomaly: any, index: number) => {
        console.log(`${index + 1}. ${anomaly.type}`);
        console.log(`   Severity: ${anomaly.severity.toUpperCase()}`);
        console.log(`   Message: ${anomaly.message}`);
        console.log(`   Timestamp: ${new Date(anomaly.timestamp * 1000).toLocaleString()}`);
        
        if (anomaly.details) {
          console.log(`   Details:`);
          if (anomaly.details.requestId) {
            console.log(`     - Request ID: ${anomaly.details.requestId}`);
            console.log(`     - Check Dashboard > Developers > Logs > Request ${anomaly.details.requestId} for IP address`);
          }
          if (anomaly.details.capabilityId) {
            console.log(`     - Capability ID: ${anomaly.details.capabilityId}`);
          }
          if (anomaly.details.ipAddress) {
            console.log(`     - IP Address: ${anomaly.details.ipAddress}`);
            console.log(`     - ⚠️ This IP is NOT in your authorized whitelist!`);
          }
          if (anomaly.details.userId) {
            console.log(`     - User ID: ${anomaly.details.userId}`);
          }
          if (anomaly.details.adminAppName) {
            console.log(`     - Admin App: ${anomaly.details.adminAppName}`);
          }
        }
        console.log('');
      });
    }

    // Show IP extraction results
    if (data?.ipExtraction) {
      console.log('='.repeat(80));
      console.log('🌐 IP ADDRESS EXTRACTION RESULTS');
      console.log('='.repeat(80));
      console.log('');
      
      const unknownIPs = data.ipExtraction.unknownIPs || [];
      const authorizedIPs = data.ipExtraction.authorizedIPs || [];
      
      if (unknownIPs.length > 0) {
        console.log(`🚨 ${unknownIPs.length} Unknown IP addresses detected:\n`);
        unknownIPs.forEach((ip: any) => {
          console.log(`   - ${ip.ip} (${ip.count} events)`);
          console.log(`     First seen: ${new Date(ip.firstSeen * 1000).toLocaleString()}`);
          console.log(`     Last seen: ${new Date(ip.lastSeen * 1000).toLocaleString()}`);
          console.log(`     Events: ${ip.events?.join(', ') || 'N/A'}`);
          console.log('');
        });
      } else {
        console.log('✅ All IP addresses match your authorized whitelist.\n');
      }
      
      if (authorizedIPs.length > 0) {
        console.log(`✅ ${authorizedIPs.length} Authorized IP addresses:\n`);
        authorizedIPs.forEach((ip: string) => {
          console.log(`   - ${ip}`);
        });
        console.log('');
      }
    }

    // Show security score
    if (data?.securityScore !== undefined) {
      console.log('='.repeat(80));
      console.log(`🛡️ Security Score: ${data.securityScore}/100`);
      console.log('='.repeat(80));
      console.log('');
    }

    // Show summary
    console.log('='.repeat(80));
    console.log('📋 SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Anomalies: ${data?.anomalies?.length || 0}`);
    console.log(`Visa/Capability Issues: ${visaAnomalies.length}`);
    console.log(`Unknown IPs: ${data?.ipExtraction?.unknownIPs?.length || 0}`);
    console.log('');
    console.log('💡 Next Steps:');
    console.log('   1. Review each anomaly above');
    console.log('   2. Check Stripe Dashboard > Developers > Logs for request details');
    console.log('   3. Verify IP addresses match your authorized list');
    console.log('   4. If suspicious, rotate API keys immediately');
    console.log('   5. Check Stripe Dashboard > Settings > Team for unauthorized members');
    console.log('');

  } catch (err) {
    console.error('❌ Failed to query forensics:', err);
  }
}

// Run the query
queryVisaApprovals();
