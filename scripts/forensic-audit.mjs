import Stripe from 'stripe';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET_KEY) {
  console.error('❌ Error: STRIPE_SECRET_KEY is missing. Set it before running this script.');
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY);

import fs from 'fs';
import util from 'util';

const logFile = fs.createWriteStream('forensic_report.txt', { flags: 'w' });
const logStdout = process.stdout;

console.log = function(d) {
  logFile.write(util.format(d) + '\n');
  logStdout.write(util.format(d) + '\n');
};

async function forensicAudit() {
  console.log('🕵️  STARTING DEEP FORENSIC AUDIT (50 STEPS TRACE) 🕵️');
  console.log('====================================================\n');
  console.log(`Report generated at: ${new Date().toISOString()}\n`);

  try {
    // 1. Check for bank account changes (external_account events)
    console.log('1️⃣  CHECKING BANK ACCOUNT CHANGES (Last 30 Days via Events API)...');
    const bankEvents = await stripe.events.list({
      types: ['account.external_account.created', 'account.external_account.updated', 'account.external_account.deleted'],
      limit: 100
    });
    
    if (bankEvents.data.length === 0) {
      console.log('   ✅ No bank account changes detected in the last 30 days.');
    } else {
      for (const e of bankEvents.data) {
        console.log(`   ⚠️  EVENT: ${e.type} at ${new Date(e.created * 1000).toISOString()}`);
        console.log(`       ID: ${e.id}`);
        // console.log(`       Data:`, JSON.stringify(e.data.object, null, 2));
      }
    }

    // 2. Review payout destination updates
    console.log('\n2️⃣  CHECKING PAYOUT DESTINATION UPDATES...');
    const payoutEvents = await stripe.events.list({
      types: ['payout.updated', 'payout.created'],
      limit: 100
    });
    
    const suspiciousPayoutUpdates = payoutEvents.data.filter(e => {
      const prev = e.data.previous_attributes;
      return prev && (prev.destination || prev.bank_account);
    });

    if (suspiciousPayoutUpdates.length === 0) {
      console.log('   ✅ No suspicious payout destination updates found.');
    } else {
      for (const e of suspiciousPayoutUpdates) {
        console.log(`   🚨 PAYOUT DESTINATION CHANGED: ${e.id} at ${new Date(e.created * 1000).toISOString()}`);
        console.log(`       Previous:`, e.data.previous_attributes);
        console.log(`       New:`, e.data.object.destination);
      }
    }

    // 3. Compare with expected destinations (List current external accounts)
    console.log('\n3️⃣  CURRENT EXTERNAL ACCOUNTS (Valid Destinations)...');
    const accounts = await stripe.accounts.listExternalAccounts(
      'acct_1IsQC1GJY406nXob', // Main account ID inferred from context
      { object: 'bank_account', limit: 10 }
    );
    
    for (const acc of accounts.data) {
      console.log(`   🏦 ${acc.bank_name} (Last4: ${acc.last4}) - Status: ${acc.status} - ID: ${acc.id}`);
    }

    // 4. Check for scheduled payout changes
    console.log('\n4️⃣  CHECKING PAYOUT SCHEDULE CHANGES...');
    const scheduleEvents = await stripe.events.list({
      type: 'account.updated', // Schedule changes often appear in account updates
      limit: 50
    });
    
    const scheduleChanges = scheduleEvents.data.filter(e => 
      e.data.previous_attributes && e.data.previous_attributes.payout_schedule
    );

    if (scheduleChanges.length === 0) {
      console.log('   ✅ No payout schedule changes detected.');
    } else {
      for (const e of scheduleChanges) {
        console.log(`   ⚠️  SCHEDULE CHANGED at ${new Date(e.created * 1000).toISOString()}`);
        console.log(`       From:`, e.data.previous_attributes.payout_schedule);
        console.log(`       To:`, e.data.object.payout_schedule);
      }
    }

    // 5. Identify team members
    console.log('\n5️⃣  TEAM MEMBERS (Who has access?)...');
    // Note: 'listPersons' is for Connect accounts. For the main account, we can't list dashboard users via API easily.
    // We will try to list persons if this is a Connect account, otherwise warn.
    try {
      const account = await stripe.accounts.retrieve();
      console.log(`   Account Type: ${account.type}`);
      if (account.type === 'custom' || account.type === 'express' || account.type === 'standard') {
         const persons = await stripe.accounts.listPersons(account.id, { limit: 20 });
         for (const p of persons.data) {
           console.log(`   👤 ${p.first_name} ${p.last_name} (${p.email}) - Role: ${p.relationship?.title || 'Unknown'}`);
         }
      } else {
        console.log('   ℹ️  Main Stripe Dashboard users cannot be listed via API. Please check "Team" settings in Dashboard.');
      }
    } catch (e) {
      console.log(`   Error listing team: ${e.message}`);
    }

    // 6. Suspicious Payouts (Date Range Analysis)
    console.log('\n6️⃣  SUSPICIOUS PAYOUTS ANALYSIS (2022-2023 Range)...');
    const start = 1640995200; // 2022-01-01
    const end = 1672531199;   // 2022-12-31
    
    const historicPayouts = await stripe.payouts.list({
      created: { gte: start, lte: end },
      limit: 100,
      expand: ['data.destination']
    });

    console.log(`   Found ${historicPayouts.data.length} payouts in 2022.`);
    for (const p of historicPayouts.data) {
      const dest = p.destination;
      const destInfo = typeof dest === 'object' ? `${dest.bank_name} (...${dest.last4})` : dest;
      console.log(`   💸 ${new Date(p.created * 1000).toISOString().split('T')[0]} | ${(p.amount/100).toFixed(2)} ${p.currency} | To: ${destInfo} | Status: ${p.status}`);
    }

  } catch (error) {
    console.error('\n❌ FATAL ERROR DURING AUDIT:', error.message);
  }
}

forensicAudit();
