#!/usr/bin/env node
// Quick diagnostic script to fetch Stripe account details
// Run with: node scripts/stripe-account-check.mjs

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!STRIPE_SECRET_KEY) {
  console.log("❌ STRIPE_SECRET_KEY not set in environment");
  console.log("\nTo run this script:");
  console.log("1. Get your Stripe secret key from https://dashboard.stripe.com/apikeys");
  console.log("2. Run: STRIPE_SECRET_KEY=sk_live_xxx node scripts/stripe-account-check.mjs");
  process.exit(1);
}

async function fetchStripeData(endpoint, options = {}) {
  const url = new URL(`https://api.stripe.com/v1/${endpoint}`);
  if (options.expand) {
    options.expand.forEach((e, i) => url.searchParams.append(`expand[${i}]`, e));
  }
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
    }
  });
  
  return response.json();
}

async function main() {
  console.log("\n🔍 STRIPE ACCOUNT DIAGNOSTIC\n");
  console.log("=".repeat(60));

  // 1. Main Account
  console.log("\n📋 MAIN ACCOUNT:");
  const account = await fetchStripeData("account", { 
    expand: ["external_accounts", "settings.payouts"] 
  });
  
  if (account.error) {
    console.log("❌ Error:", account.error.message);
  } else {
    console.log(`   ID: ${account.id}`);
    console.log(`   Email: ${account.email || "N/A"}`);
    console.log(`   Country: ${account.country}`);
    console.log(`   Default Currency: ${account.default_currency}`);
    console.log(`   Charges Enabled: ${account.charges_enabled}`);
    console.log(`   Payouts Enabled: ${account.payouts_enabled}`);
    console.log(`   Type: ${account.type}`);
    
    if (account.business_profile) {
      console.log(`   Business Name: ${account.business_profile.name || "N/A"}`);
      console.log(`   Support Email: ${account.business_profile.support_email || "N/A"}`);
    }
    
    if (account.settings?.payouts?.schedule) {
      const schedule = account.settings.payouts.schedule;
      console.log(`   Payout Schedule: ${schedule.interval} (delay: ${schedule.delay_days} days)`);
    }
    
    if (account.external_accounts?.data) {
      console.log(`\n   💳 EXTERNAL ACCOUNTS (${account.external_accounts.data.length}):`);
      account.external_accounts.data.forEach((ea, i) => {
        if (ea.object === "bank_account") {
          console.log(`      ${i+1}. Bank: ${ea.bank_name} - ****${ea.last4} (${ea.currency.toUpperCase()})`);
          console.log(`         Status: ${ea.status}, Default: ${ea.default_for_currency}`);
        } else if (ea.object === "card") {
          console.log(`      ${i+1}. Card: ${ea.brand} ****${ea.last4}`);
        }
      });
    }
  }

  // 2. Balance
  console.log("\n💰 BALANCE:");
  const balance = await fetchStripeData("balance");
  if (balance.available) {
    balance.available.forEach(b => {
      console.log(`   Available: ${(b.amount/100).toFixed(2)} ${b.currency.toUpperCase()}`);
    });
  }
  if (balance.pending) {
    balance.pending.forEach(b => {
      console.log(`   Pending: ${(b.amount/100).toFixed(2)} ${b.currency.toUpperCase()}`);
    });
  }

  // 3. Connected Accounts
  console.log("\n🔗 CONNECTED ACCOUNTS:");
  const connectedAccounts = await fetchStripeData("accounts?limit=20");
  if (connectedAccounts.data) {
    console.log(`   Total: ${connectedAccounts.data.length}`);
    connectedAccounts.data.forEach((acc, i) => {
      console.log(`   ${i+1}. ${acc.id} - ${acc.email || acc.business_profile?.name || "N/A"}`);
      console.log(`      Type: ${acc.type}, Payouts: ${acc.payouts_enabled}, Charges: ${acc.charges_enabled}`);
    });
  } else {
    console.log("   No connected accounts or Connect not enabled");
  }

  // 4. Check specific account if provided
  const accountToCheck = process.argv[2];
  if (accountToCheck) {
    console.log(`\n🎯 SPECIFIC ACCOUNT: ${accountToCheck}`);
    const specificAccount = await fetchStripeData(`accounts/${accountToCheck}`, {
      expand: ["external_accounts", "settings.payouts"]
    });
    if (specificAccount.error) {
      console.log("❌ Error:", specificAccount.error.message);
    } else {
      console.log(`   Email: ${specificAccount.email || "N/A"}`);
      console.log(`   Business: ${specificAccount.business_profile?.name || "N/A"}`);
      console.log(`   Country: ${specificAccount.country}`);
      console.log(`   Payouts Enabled: ${specificAccount.payouts_enabled}`);
      
      if (specificAccount.external_accounts?.data) {
        console.log(`   External Accounts: ${specificAccount.external_accounts.data.length}`);
        specificAccount.external_accounts.data.forEach((ea, i) => {
          if (ea.object === "bank_account") {
            console.log(`      ${i+1}. Bank: ${ea.bank_name} - ****${ea.last4}`);
          }
        });
      }
    }
  }

  // 5. Recent Payouts
  console.log("\n📤 RECENT PAYOUTS:");
  const payouts = await fetchStripeData("payouts?limit=5");
  if (payouts.data && payouts.data.length > 0) {
    payouts.data.forEach((p, i) => {
      const date = new Date(p.arrival_date * 1000).toLocaleDateString();
      console.log(`   ${i+1}. ${(p.amount/100).toFixed(2)} ${p.currency.toUpperCase()} - ${p.status} (${date})`);
    });
  } else {
    console.log("   No recent payouts");
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ Diagnostic complete\n");
}

main().catch(console.error);
