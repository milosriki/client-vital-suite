import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.14.0";

// CONFIGURATION
const STRIPE_KEY = Deno.env.get("STRIPE_API_KEY");

if (!STRIPE_KEY) {
    console.error("❌ ERROR: Please provide your Stripe API Key.");
    Deno.exit(1);
}

const stripe = new Stripe(STRIPE_KEY, {
    apiVersion: "2023-10-16",
});

console.log("🕵️‍♂️ STARTING DEEP STRIPE FORENSIC AUDIT (7-POINT CHECK)...");
console.log("===========================================================");

async function audit() {
    try {
        // 1. ALL PAYOUTS ANALYSIS (Grouped by Bank) - FULL HISTORY
        console.log("\n1. 🏦 HISTORICAL BANK ACCOUNT ANALYSIS (Fetching ALL history... this may take a moment)...");

        const bankAccounts: Record<string, { name: string, last4: string, total: number, count: number, first_seen: string, last_seen: string }> = {};
        let totalPayoutsChecked = 0;
        let firstPayoutCurrency = 'USD'; // Default currency, will be updated if payouts exist

        // Use auto-pagination to fetch ALL payouts
        for await (const p of stripe.payouts.list({ limit: 100, expand: ['data.destination'] })) {
            totalPayoutsChecked++;
            if (totalPayoutsChecked % 100 === 0) await Deno.stdout.write(new TextEncoder().encode(`.`)); // Progress indicator

            // Capture currency from the first payout
            if (totalPayoutsChecked === 1) {
                firstPayoutCurrency = p.currency.toUpperCase();
            }

            let bankKey = "Unknown";
            let bankName = "Unknown";
            let last4 = "????";

            if (p.destination) {
                if (typeof p.destination === 'string') {
                    bankKey = p.destination;
                } else if (p.destination.object === 'bank_account') {
                    bankKey = `${p.destination.bank_name}_${p.destination.last4}`;
                    bankName = p.destination.bank_name;
                    last4 = p.destination.last4;
                } else if (p.destination.object === 'card') {
                    bankKey = `${p.destination.brand}_${p.destination.last4}`;
                    bankName = `Card (${p.destination.brand})`;
                    last4 = p.destination.last4;
                }
            }

            if (!bankAccounts[bankKey]) {
                bankAccounts[bankKey] = {
                    name: bankName,
                    last4: last4,
                    total: 0,
                    count: 0,
                    first_seen: new Date(p.created * 1000).toISOString().split('T')[0],
                    last_seen: new Date(p.created * 1000).toISOString().split('T')[0]
                };
            }

            bankAccounts[bankKey].total += (p.amount / 100);
            bankAccounts[bankKey].count += 1;

            // Update dates
            const pDate = new Date(p.created * 1000).toISOString().split('T')[0];
            if (pDate < bankAccounts[bankKey].first_seen) bankAccounts[bankKey].first_seen = pDate;
            if (pDate > bankAccounts[bankKey].last_seen) bankAccounts[bankKey].last_seen = pDate;
        }
        console.log(`\n✅ Checked ${totalPayoutsChecked} payouts.`);

        // Print Summary of ALL Banks
        console.log("\n📊 SUMMARY OF ALL BANK ACCOUNTS USED:");
        Object.values(bankAccounts).forEach(bank => {
            console.log(`   🏦 ${bank.name} (****${bank.last4})`);
            console.log(`      - Total Received: ${bank.total.toFixed(2)} ${firstPayoutCurrency}`);
            console.log(`      - Payout Count: ${bank.count}`);
            console.log(`      - Active From: ${bank.first_seen} to ${bank.last_seen}`);
            console.log("      --------------------------------------------------");
        });

        // 2. ALL BALANCE TRANSACTIONS (Complete Money Trail)
        console.log("\n2. 💰 BALANCE TRANSACTIONS (Money Trail)...");
        // We'll fetch the last 100 for brevity in the console, but this API supports pagination
        const transactions = await stripe.balanceTransactions.list({ limit: 100 });
        transactions.data.forEach((t) => {
            if (['payout', 'transfer', 'adjustment'].includes(t.type)) {
                console.log(`   - ${new Date(t.created * 1000).toISOString().split('T')[0]}: ${t.type.toUpperCase()} | Amount: ${(t.amount / 100).toFixed(2)} | Net: ${(t.net / 100).toFixed(2)} | Desc: ${t.description || 'None'}`);
            }
        });

        // 3. ALL REFUNDS
        console.log("\n3. ↩️ ALL REFUNDS (Last 50)...");
        const refunds = await stripe.refunds.list({ limit: 50 });
        if (refunds.data.length === 0) console.log("   ✅ No refunds found.");
        refunds.data.forEach((r) => {
            console.log(`   - ${new Date(r.created * 1000).toISOString().split('T')[0]}: ${(r.amount / 100).toFixed(2)} ${r.currency.toUpperCase()} | Reason: ${r.reason || 'Requested by customer'}`);
        });

        // 4. ALL DISPUTES (Lost Money)
        console.log("\n4. ⚖️ ALL DISPUTES (Chargebacks)...");
        const disputes = await stripe.disputes.list({ limit: 50 });
        if (disputes.data.length === 0) console.log("   ✅ No disputes found.");
        disputes.data.forEach((d) => {
            console.log(`   - ${new Date(d.created * 1000).toISOString().split('T')[0]}: ${(d.amount / 100).toFixed(2)} ${d.currency.toUpperCase()} | Reason: ${d.reason} | Status: ${d.status}`);
        });

        // 5. FIND SPECIFIC CUSTOMERS (Abdallah)
        console.log("\n5. 🔍 SEARCHING FOR 'ABDALLAH'...");
        const search = await stripe.customers.search({
            query: "name~'abdallah' OR email~'abdallah'",
            limit: 100
        });
        if (search.data.length === 0) console.log("   ✅ No customers found matching 'Abdallah'.");
        else {
            for (const c of search.data) {
                console.log(`   👤 FOUND: ${c.name} (${c.email}) - ID: ${c.id}`);
                // Check payments for this customer
                const charges = await stripe.charges.list({ customer: c.id, limit: 5 });
                charges.data.forEach((ch) => {
                    console.log(`      - Charge: ${(ch.amount / 100).toFixed(2)} ${ch.currency.toUpperCase()} (${new Date(ch.created * 1000).toISOString().split('T')[0]})`);
                });
            }
        }

        // 6. NEGATIVE BALANCE EXPLANATION
        console.log("\n6. 📉 BALANCE ANALYSIS (Why is it negative?)...");
        const balance = await stripe.balance.retrieve();
        console.log(`   - Available: ${balance.available.map(b => `${(b.amount / 100).toFixed(2)} ${b.currency.toUpperCase()}`).join(", ")}`);
        console.log(`   - Pending: ${balance.pending.map(b => `${(b.amount / 100).toFixed(2)} ${b.currency.toUpperCase()}`).join(", ")}`);

        // 7. EXTERNAL ACCOUNTS
        console.log("\n7. 🏦 LINKED BANK ACCOUNTS (External Accounts)...");
        const account = await stripe.accounts.retrieve();
        if (account.external_accounts?.data) {
            account.external_accounts.data.forEach((bank: any) => {
                console.log(`   - [${bank.object.toUpperCase()}] ${bank.bank_name} ****${bank.last4} (${bank.currency}) - Status: ${bank.status}`);
            });
        } else {
            console.log("   ℹ️ Could not list external accounts directly (Check Payouts section above).");
        }

        // 8. PERSONS & VERIFICATION (Who is the 'Business Representative'?)
        console.log("\n8. 👤 CHECKING VERIFIED REPRESENTATIVES (The 'Paper Trail')...");
        // Note: listPersons requires the account ID to be passed if we are acting as platform, 
        // but for a standard account we list persons of the account itself.
        // However, listPersons is a method on 'accounts', usually used like stripe.accounts.listPersons('acct_id').
        // Since we are using the key directly, we might need to use the /v1/account/persons endpoint logic if the SDK wrapper differs.
        // Let's try listing persons for the current account.
        try {
            // For standard accounts, we can often just list persons. 
            // If this fails, we'll catch it.
            const persons = await stripe.accounts.listPersons(account.id, { limit: 10 });

            if (persons.data.length === 0) {
                console.log("   ℹ️ No specific persons listed (likely a single-owner account).");
            } else {
                persons.data.forEach((p) => {
                    console.log(`   🧑 NAME: ${p.first_name} ${p.last_name}`);
                    console.log(`      - Email: ${p.email}`);
                    console.log(`      - Role: ${p.relationship?.title || 'Owner/Rep'}`);
                    console.log(`      - Created: ${new Date(p.created * 1000).toISOString().split('T')[0]}`);
                    console.log(`      - Status: ${p.verification?.status}`);
                    if (p.verification?.document) {
                        console.log(`      - ID Document: ${p.verification.document.front ? 'Front Uploaded' : 'Missing'} / ${p.verification.document.back ? 'Back Uploaded' : 'Missing'}`);
                    }
                });
            }
        } catch (e) {
            console.log("   ℹ️ Could not list persons (API restriction or Standard account limitation).");
        }

        // 9. IP ADDRESS ANALYSIS (Who is controlling the account?)
        console.log("\n9. 🌍 CHECKING RECENT IP ACTIVITY (Last 50 Events)...");
        // Note: The 'events' endpoint doesn't always expose the request IP directly in the object,
        // but it's the best proxy we have for activity. 
        // Real IP logs are in the Dashboard > Developers > Logs.
        try {
            const events = await stripe.events.list({ limit: 50 });

            // We can't see the IP in the event object directly via standard API response,
            // but we can list the types of events happening.
            // To see IPs, you MUST look at Dashboard > Developers > Logs.
            console.log("   ℹ️ API does not expose Request IPs directly (Security Feature).");
            console.log("   ℹ️ listing recent ACTIVITY TYPES instead:");

            events.data.forEach((e) => {
                const date = new Date(e.created * 1000).toISOString().split('T')[0];
                console.log(`   - ${date}: ${e.type} (ID: ${e.id})`);
            });

            console.log("\n   🚨 TO SEE APPROVED IPs: Go to Stripe Dashboard > Developers > Logs");
            console.log("   Look for '200 OK' responses. The IP column shows who is approved/working.");

        } catch (e) {
            console.log("   ⚠️ Could not list events.");
        }

        // 10. FULL FINANCIAL RECONCILIATION (Where is the missing 2 Million?)
        console.log("\n10. 🧮 FULL FINANCIAL RECONCILIATION (Calculating every cent)...");

        let totalVolume = 0;
        let totalRefunds = 0;
        let totalStripeFees = 0;
        let totalPayouts = 0;
        let totalAdjustments = 0; // Chargebacks/Disputes

        // We need to iterate BALANCE TRANSACTIONS to get the true net flow
        // This is the source of truth for Stripe's ledger.
        console.log("   ⏳ Scanning ALL Balance Transactions (This is the most accurate ledger)...");
        let txCount = 0;

        for await (const txn of stripe.balanceTransactions.list({ limit: 100 })) {
            txCount++;
            if (txCount % 1000 === 0) await Deno.stdout.write(new TextEncoder().encode(`.`));

            const amt = txn.amount / 100;
            const fee = txn.fee / 100;

            if (txn.type === 'charge') {
                totalVolume += amt;
                totalStripeFees += fee;
            } else if (txn.type === 'refund') {
                totalRefunds += Math.abs(amt); // Refunds are negative in txn
                totalStripeFees += fee; // Fees are usually returned or partial
            } else if (txn.type === 'payout') {
                totalPayouts += Math.abs(amt); // Payouts are negative
            } else if (txn.type === 'adjustment' || txn.type === 'dispute') {
                totalAdjustments += Math.abs(amt);
            } else if (txn.type === 'stripe_fee') {
                totalStripeFees += Math.abs(amt);
            }
        }

        console.log(`\n\n   📊 FINANCIAL SUMMARY (Processed ${txCount} transactions):`);
        console.log(`   --------------------------------------------------`);
        console.log(`   💰 GROSS VOLUME (Sales):      ${totalVolume.toLocaleString()} AED`);
        console.log(`   ➖ REFUNDS (Returns):         -${totalRefunds.toLocaleString()} AED`);
        console.log(`   ➖ STRIPE FEES:               -${totalStripeFees.toLocaleString()} AED`);
        console.log(`   ➖ DISPUTES/ADJUSTMENTS:      -${totalAdjustments.toLocaleString()} AED`);
        console.log(`   --------------------------------------------------`);
        console.log(`   = NET AVAILABLE:              ${(totalVolume - totalRefunds - totalStripeFees - totalAdjustments).toLocaleString()} AED`);
        console.log(`   --------------------------------------------------`);
        console.log(`   🏦 TOTAL PAYOUTS SENT:        ${totalPayouts.toLocaleString()} AED`);
        console.log(`   --------------------------------------------------`);
        console.log(`   ❓ UNACCOUNTED DIFFERENCE:    ${((totalVolume - totalRefunds - totalStripeFees - totalAdjustments) - totalPayouts).toLocaleString()} AED`);

        if (((totalVolume - totalRefunds - totalStripeFees - totalAdjustments) - totalPayouts) > 1000) {
            console.log("\n   🚨 ALERT: SIGNIFICANT DISCREPANCY FOUND!");
            console.log("   If 'Unaccounted Difference' is positive, money is stuck in Stripe or was moved via hidden means.");
        }

    } catch (error: any) {
        console.error("\n❌ FATAL ERROR:", error.message);
    }
}

audit();
