import Stripe from 'stripe';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET_KEY) {
  console.error('❌ Error: STRIPE_SECRET_KEY is missing. Set it before running this script.');
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY);

async function forensicScan() {
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                   FULL FORENSIC SCAN - INSIDER THREAT                        ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');

  // 1. ALL REFUNDS
  console.log('=== ALL REFUNDS (Last 12 months) ===');
  const oneYearAgo = Math.floor(Date.now() / 1000) - 365 * 86400;
  const refunds = await stripe.refunds.list({ limit: 100, created: { gte: oneYearAgo } });
  console.log('Total refunds:', refunds.data.length);
  
  let totalRefunded = 0;
  for (const r of refunds.data) {
    totalRefunded += r.amount;
    const charge = await stripe.charges.retrieve(r.charge).catch(() => null);
    const customerEmail = typeof charge?.customer === 'object' ? charge.customer?.email : 'unknown';
    console.log(
      new Date(r.created * 1000).toISOString().split('T')[0],
      '|', (r.amount/100).toFixed(2), r.currency,
      '|', r.status,
      '| Customer:', customerEmail
    );
  }
  console.log('TOTAL REFUNDED:', (totalRefunded/100).toFixed(2));

  // 2. CONNECTED ACCOUNTS
  console.log('\n=== CONNECTED ACCOUNTS (Money siphon check) ===');
  const connected = await stripe.accounts.list({ limit: 50 });
  console.log('Total connected accounts:', connected.data.length);
  for (const acc of connected.data) {
    console.log('ID:', acc.id);
    console.log('Email:', acc.email);
    console.log('Type:', acc.type);
    console.log('Created:', new Date(acc.created * 1000).toISOString());
    console.log('Payouts Enabled:', acc.payouts_enabled);
    console.log('---');
  }

  // 3. TRANSFERS TO CONNECTED ACCOUNTS
  console.log('\n=== TRANSFERS TO CONNECTED ACCOUNTS ===');
  const transfers = await stripe.transfers.list({ limit: 100 });
  console.log('Total transfers:', transfers.data.length);
  let totalTransferred = 0;
  for (const t of transfers.data) {
    totalTransferred += t.amount;
    console.log(
      new Date(t.created * 1000).toISOString().split('T')[0],
      '|', (t.amount/100).toFixed(2), t.currency,
      '| To:', t.destination,
      '| Reversed:', t.reversed
    );
  }
  console.log('TOTAL TRANSFERRED:', (totalTransferred/100).toFixed(2));

  // 4. EXTERNAL BANK ACCOUNTS
  console.log('\n=== EXTERNAL BANK ACCOUNTS ===');
  const account = await stripe.accounts.retrieve();
  console.log('Main Account:', account.id);
  console.log('Email:', account.email);
  
  // 5. PERSONS (Team members with access)
  console.log('\n=== ACCOUNT PERSONS / TEAM MEMBERS ===');
  try {
    const persons = await stripe.accounts.listPersons(account.id, { limit: 100 });
    console.log('Total persons:', persons.data.length);
    for (const p of persons.data) {
      console.log('Person ID:', p.id);
      console.log('Name:', p.first_name, p.last_name);
      console.log('Email:', p.email);
      console.log('Relationship:', JSON.stringify(p.relationship));
      console.log('Created:', new Date(p.created * 1000).toISOString());
      console.log('---');
    }
  } catch (e) {
    console.log('Cannot list persons for standard accounts');
  }

  // 6. QUICK REFUNDS (same day as charge - suspicious)
  console.log('\n=== 🚨 QUICK REFUNDS (Refunded within 1 hour of charge) ===');
  for (const r of refunds.data) {
    try {
      const charge = await stripe.charges.retrieve(r.charge);
      const timeDiff = r.created - charge.created;
      if (timeDiff < 3600) { // Less than 1 hour
        console.log('⚠️ SUSPICIOUS:');
        console.log('  Charge:', charge.id, '| Created:', new Date(charge.created * 1000).toISOString());
        console.log('  Refund:', r.id, '| Created:', new Date(r.created * 1000).toISOString());
        console.log('  Time between:', Math.floor(timeDiff / 60), 'minutes');
        console.log('  Amount:', (r.amount/100).toFixed(2), r.currency);
        console.log('  ---');
      }
    } catch (e) {
      // Skip if charge not found
    }
  }

  // 7. LARGE REFUNDS (over 1000 AED)
  console.log('\n=== 🚨 LARGE REFUNDS (Over 1000) ===');
  for (const r of refunds.data) {
    if (r.amount > 100000) { // 1000 in cents
      console.log(
        new Date(r.created * 1000).toISOString().split('T')[0],
        '|', (r.amount/100).toFixed(2), r.currency,
        '|', r.id
      );
    }
  }

  // 8. PAYOUTS pattern analysis
  console.log('\n=== PAYOUT PATTERNS (Last 6 months) ===');
  const sixMonthsAgo = Math.floor(Date.now() / 1000) - 180 * 86400;
  const payouts = await stripe.payouts.list({ limit: 100, created: { gte: sixMonthsAgo } });
  console.log('Total payouts:', payouts.data.length);
  
  const instantPayouts = payouts.data.filter(p => p.method === 'instant');
  console.log('INSTANT payouts:', instantPayouts.length);
  for (const p of instantPayouts) {
    console.log('⚠️ INSTANT:', p.id, '|', (p.amount/100).toFixed(2), p.currency, '|', new Date(p.created * 1000).toISOString());
  }
}

forensicScan().catch(console.error);
