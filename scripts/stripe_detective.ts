import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.14.0";

// CONFIGURATION
const STRIPE_KEY = Deno.env.get("STRIPE_API_KEY");

if (!STRIPE_KEY) {
    console.error("❌ ERROR: Please provide your Stripe API Key.");
    console.error("Usage: STRIPE_API_KEY=sk_live_... deno run -A scripts/stripe_detective.ts");
    Deno.exit(1);
}

const stripe = new Stripe(STRIPE_KEY, {
    apiVersion: "2023-10-16",
});

console.log("🕵️‍♂️ STARTING STRIPE FORENSIC AUDIT...");
console.log("=======================================");

async function audit() {
    try {
        // 1. ACCOUNT CONFIGURATION (Where is the money going?)
        console.log("\n🔍 CHECKING ACCOUNT CONFIGURATION...");
        const account = await stripe.accounts.retrieve();
        console.log(`✅ Account ID: ${account.id}`);
        console.log(`✅ Business Name: ${account.business_profile?.name}`);
        console.log(`✅ Payout Schedule: ${JSON.stringify(account.payouts_enabled ? 'Enabled' : 'Disabled')}`);

        // Check External Accounts (Bank Accounts) - THIS IS CRITICAL
        // Note: Standard accounts might need to check 'payouts' endpoint if external_accounts is hidden
        if (account.external_accounts?.data) {
            console.log("\n🏦 LINKED BANK ACCOUNTS (Check these carefully!):");
            account.external_accounts.data.forEach((bank: any) => {
                console.log(`   - [${bank.bank_name}] *******${bank.last4} (${bank.currency}) - Status: ${bank.status}`);
            });
        } else {
            console.log("   ⚠️ Could not list external accounts directly (Permissions or Standard Account). Checking Payouts instead...");
        }

        // 2. WEBHOOKS (Is data being leaked?)
        console.log("\n📡 CHECKING WEBHOOKS (Hidden data leaks)...");
        const webhooks = await stripe.webhookEndpoints.list({ limit: 10 });
        if (webhooks.data.length === 0) {
            console.log("   ✅ No webhooks found (Clean).");
        } else {
            webhooks.data.forEach((wh) => {
                console.log(`   ⚠️ WEBHOOK FOUND: ${wh.url}`);
                console.log(`      - Status: ${wh.status}`);
                console.log(`      - Events: ${wh.enabled_events.join(", ")}`);
                console.log(`      - Created: ${new Date(wh.created * 1000).toISOString()}`);
            });
        }

        // 3. ISSUING CARDS (Direct theft vector)
        console.log("\n💳 CHECKING ISSUED CARDS (Virtual/Physical)...");
        try {
            const cards = await stripe.issuing.cards.list({ limit: 20, status: 'active' });
            if (cards.data.length === 0) {
                console.log("   ✅ No active issued cards found.");
            } else {
                cards.data.forEach((card) => {
                    console.log(`   🚨 ACTIVE CARD: **** ${card.last4} (${card.type})`);
                    console.log(`      - Cardholder: ${card.cardholder?.name}`);
                    console.log(`      - Spending Limit: ${JSON.stringify(card.spending_controls)}`);
                });
            }
        } catch (e) {
            console.log("   ℹ️ Issuing API not enabled or accessible (Good sign if you don't use it).");
        }

        // 3b. ISSUING TOKENS (Tokenized card theft - Apple/Google Pay wallets)
        console.log("\n🔐 CHECKING ISSUING TOKENS (Wallet Provisioning)...");
        try {
            // List ALL tokens including deleted/canceled ones
            const allTokens = await stripe.issuing.tokens.list({ 
                limit: 100,
            });
            
            if (allTokens.data.length === 0) {
                console.log("   ✅ No issuing tokens found.");
            } else {
                console.log(`   ⚠️ FOUND ${allTokens.data.length} TOKENS:`);
                
                // Group by status
                const byStatus: Record<string, any[]> = {};
                allTokens.data.forEach((token: any) => {
                    const status = token.status || 'unknown';
                    if (!byStatus[status]) byStatus[status] = [];
                    byStatus[status].push(token);
                });

                // Report by status
                Object.entries(byStatus).forEach(([status, tokens]) => {
                    const emoji = status === 'active' ? '🚨' : status === 'suspended' ? '⚠️' : '📝';
                    console.log(`\n   ${emoji} ${status.toUpperCase()} TOKENS (${tokens.length}):`);
                    
                    tokens.forEach((token: any) => {
                        const created = new Date(token.created * 1000).toISOString().split('T')[0];
                        const cardLast4 = token.card ? `****${typeof token.card === 'string' ? token.card.slice(-4) : '????'}` : 'N/A';
                        
                        console.log(`      - Token: ${token.id}`);
                        console.log(`        Card: ${cardLast4}`);
                        console.log(`        Created: ${created}`);
                        console.log(`        Status: ${token.status}`);
                        
                        // Network data (wallet type)
                        if (token.network_data) {
                            const walletType = token.network_data.wallet_provider?.type || 
                                              token.network_data.device?.type || 
                                              'Unknown wallet';
                            console.log(`        Wallet: ${walletType}`);
                        }
                        
                        // Device info
                        if (token.wallet_provider) {
                            console.log(`        Provider: ${token.wallet_provider}`);
                        }
                        
                        // Last used
                        if (token.last_four) {
                            console.log(`        Token Last4: ${token.last_four}`);
                        }
                    });
                });

                // Check for suspicious patterns
                const activeTokens = byStatus['active'] || [];
                const suspendedTokens = byStatus['suspended'] || [];
                const deletedTokens = byStatus['deleted'] || [];
                
                if (activeTokens.length > 5) {
                    console.log(`\n   🚨 ALERT: ${activeTokens.length} active tokens - review for unauthorized wallet provisioning!`);
                }
                if (deletedTokens.length > 0) {
                    console.log(`\n   📊 ${deletedTokens.length} deleted/canceled tokens found (evidence of past activity)`);
                }
            }
        } catch (e: any) {
            if (e.code === 'resource_missing' || e.type === 'invalid_request_error') {
                console.log("   ℹ️ Issuing Tokens API not enabled (Normal if not using Stripe Issuing).");
            } else {
                console.log(`   ⚠️ Could not list tokens: ${e.message}`);
            }
        }

        // 4. RECENT PAYOUTS (Follow the money)
        console.log("\n💸 CHECKING PAYOUT HISTORY (Last 100)...");
        const payouts = await stripe.payouts.list({ limit: 100, expand: ['data.destination'] });

        if (payouts.data.length === 0) {
            console.log("   ✅ No payouts found.");
        } else {
            payouts.data.forEach((payout: any) => {
                const date = new Date(payout.created * 1000).toISOString().split('T')[0];
                const amount = (payout.amount / 100).toFixed(2);
                let destinationInfo = "Unknown";

                if (payout.destination) {
                    if (typeof payout.destination === 'string') {
                        destinationInfo = `ID: ${payout.destination}`;
                    } else if (payout.destination.object === 'bank_account') {
                        destinationInfo = `🏦 BANK: ${payout.destination.bank_name} (****${payout.destination.last4})`;
                    } else if (payout.destination.object === 'card') {
                        destinationInfo = `💳 CARD: ${payout.destination.brand} (****${payout.destination.last4})`;
                    }
                }

                console.log(`   - ${date}: ${amount} ${payout.currency.toUpperCase()} -> ${destinationInfo} [Status: ${payout.status}]`);
            });
        }

        // 5. BALANCE CHECK
        console.log("\n💰 CHECKING BALANCE...");
        const balance = await stripe.balance.retrieve();
        console.log(`   - Available: ${balance.available.map(b => `${b.amount / 100} ${b.currency.toUpperCase()}`).join(", ")}`);
        console.log(`   - Pending: ${balance.pending.map(b => `${b.amount / 100} ${b.currency.toUpperCase()}`).join(", ")}`);

        // 6. CONNECT & TRANSFERS (Hidden money movement)
        console.log("\n🔗 CHECKING CONNECT TRANSFERS & DESTINATION CHARGES...");

        // Check for Transfers (Money sent to other Stripe accounts)
        const transfers = await stripe.transfers.list({ limit: 10 });
        if (transfers.data.length === 0) {
            console.log("   ✅ No direct transfers found.");
        } else {
            transfers.data.forEach((t) => {
                console.log(`   🚨 TRANSFER: ${t.amount / 100} ${t.currency.toUpperCase()} -> ${t.destination}`);
                console.log(`      - Date: ${new Date(t.created * 1000).toISOString()}`);
                console.log(`      - Description: ${t.description || 'None'}`);
            });
        }

        // Check for Connected Accounts (Is your platform connected to others?)
        // Note: This lists accounts YOU control. If someone connected YOUR account to THEIRS, 
        // you would see it in "Authorized Applications" in the dashboard, not here.
        try {
            const connectedAccounts = await stripe.accounts.list({ limit: 5 });
            if (connectedAccounts.data.length <= 1) { // 1 is usually your own account
                console.log("   ℹ️ No connected sub-accounts found (Standard setup).");
            } else {
                console.log("   ⚠️ CONNECTED ACCOUNTS FOUND (Check these):");
                connectedAccounts.data.forEach((acc) => {
                    if (acc.id !== account.id) {
                        console.log(`      - ${acc.id} (${acc.email || 'No email'}) - Type: ${acc.type}`);
                    }
                });
            }
        } catch (e) {
            console.log("   ℹ️ Could not list connected accounts (Requires Platform privileges).");
        }

        // 7. VERIFICATION DOCUMENTS (Who verified what?)
        console.log("\n📄 CHECKING VERIFICATION FILES (Who submitted ID?)...");
        try {
            const files = await stripe.files.list({ limit: 20, purpose: 'identity_document' });
            if (files.data.length === 0) {
                console.log("   ℹ️ No identity documents found via API.");
            } else {
                files.data.forEach((f) => {
                    console.log(`   📝 FILE: ${f.filename} (Type: ${f.type})`);
                    console.log(`      - Created: ${new Date(f.created * 1000).toISOString()}`);
                    console.log(`      - Purpose: ${f.purpose}`);
                    console.log(`      - ID: ${f.id}`);
                });
            }
        } catch (e) {
            console.log("   ⚠️ Could not list files (Permission denied).");
        }

        // 8. WEBHOOKS (Data Exfiltration)
        console.log("\n📡 CHECKING WEBHOOKS (Hidden data leaks)...");
        const webhooks = await stripe.webhookEndpoints.list({ limit: 10 });
        if (webhooks.data.length === 0) {
            console.log("   ✅ No webhooks found (Clean).");
        } else {
            webhooks.data.forEach((wh) => {
                console.log(`   ⚠️ WEBHOOK FOUND: ${wh.url}`);
                console.log(`      - Status: ${wh.status}`);
                console.log(`      - Events: ${wh.enabled_events.join(", ")}`);
                console.log(`      - Created: ${new Date(wh.created * 1000).toISOString()}`);
            });
        }

        // 6. TEAM MEMBERS (Who has access?)
        // Note: This often requires the highest level key and might fail with standard keys
        console.log("\n👥 CHECKING TEAM ACCESS...");
        try {
            // There isn't a direct public API for "List Team Members" for security reasons on standard keys.
            // We infer from Audit Logs if possible, or advise manual check.
            console.log("   ℹ️ Team member list requires Dashboard access. Please check Settings > Team.");
        } catch (e) { }

    } catch (error: any) {
        console.error("\n❌ FATAL ERROR DURING AUDIT:", error.message);
        if (error.code === 'resource_missing') {
            console.error("   (This usually means the API key doesn't have permission for this resource)");
        }
    }
}

audit();
