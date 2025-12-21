# Stripe Forensics Strategy & Detection Guide

This document outlines the strategy used by the `stripe-forensics` agent to detect financial anomalies, potential fraud, and money laundering patterns.

## 1. Detection Capabilities

The system now performs a **Full Forensic Audit** of your Stripe account, analyzing:

### A. Instant Payouts (High Risk)
*   **What we check:** Any payout with `method: 'instant'`.
*   **Why:** Fraudsters often use Instant Payouts to drain funds immediately before a chargeback hits.
*   **Strategy:** Flag ALL instant payouts for manual review if they exceed a certain threshold or occur after a spike in small transactions.

### B. Card Transfers ("On Card")
*   **What we check:** Payouts where the destination type is `card` (Debit/Credit) rather than a bank account.
*   **Why:** Transferring to a debit card is often faster and harder to reverse than a standard bank ACH/Wire.
*   **Strategy:** Monitor the ratio of Card Payouts vs. Bank Payouts. A sudden shift to Card Payouts is a red flag.

### C. Payout Velocity (Rapid Draining)
*   **What we check:** The number of payouts triggered in a single 24-hour period.
*   **Why:** Legitimate businesses usually pay out once a day or week. Multiple payouts in a day suggest an attempt to move money out as it comes in ("smurfing").
*   **Strategy:** Alert if daily payouts > 3.

### D. "Test-then-Drain" Pattern
*   **What we check:** A series of small transactions (<$10) followed immediately by large transactions (>$100) and a payout.
*   **Why:** Card testers verify stolen cards with small amounts before hitting the card for a large amount.
*   **Strategy:** The agent looks for this specific sequence in your transaction history.

## 2. Forensic Details to Review

When an anomaly is detected, the agent provides a JSON report. You should look for:

*   **`destinations`**: The last 4 digits and bank name of the payout destination. Check if these match your known bank accounts.
*   **`ip_address`**: (Available in `events-timeline`) The IP address where the payout was initiated.
    *   *Action:* Check if the IP is from a different country than your business.
*   **`user_agent`**: The device used to trigger the payout.
    *   *Action:* Look for changes (e.g., switching from Mac to Windows, or a mobile device).

## 3. Recommended Response Strategy

If the `stripe-forensics` agent flags an issue:

1.  **IMMEDIATE**: Pause Payouts in your Stripe Dashboard.
2.  **INVESTIGATE**:
    *   Run the `visa-approvals` action to see if specific cards are being targeted.
    *   Check the `events-timeline` for `payout.created` events and see *who* initiated them (API key vs Dashboard user).
3.  **VERIFY**: Call the bank associated with any suspicious payout destination.

## 4. How to Run the Audit

Trigger the agent via Supabase Edge Functions:

```bash
curl -X POST https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/stripe-forensics \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action": "full-audit"}'
```
