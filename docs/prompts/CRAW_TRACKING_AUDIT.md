# 🕸️ CRAW AGENT MISSION: Complete Tracking & Database Pipeline Audit

> **Instructions for the User:** Copy the text below the line and paste it as a prompt to **CRAW**. It gives CRAW the exact variables, files, and logic it needs to map your entire system, find the mismatches between Facebook and HubSpot, and verify exactly which Supabase instance (Local vs Remote) is currently connected and processing webhooks.

---

**@CRAW:**

I need you to perform a deep architectural audit of the tracking and data pipeline in this repository (`client-vital-suite`). Our goal is to map exactly how leads pass from the frontend (GTM/Facebook Pixel) to our backend (Supabase) and finally to HubSpot. 

We are currently seeing a 12-15% discrepancy between Facebook conversions and HubSpot contacts. Your mission is to find the missing links.

### STEP 1: Map the Frontend Tracking (GTM & Pixel)
1. Scan `index.html` and any frontend conversion components (e.g., Lead Forms, Typeform wrappers).
2. Locate the Google Tag Manager implementation (`GTM-WRWPQTKB`).
3. Determine exactly when and where the Meta Pixel (`714927822471230`) fires a `Lead` or `Contact` event.
4. **🔴 CRITICAL MISMATCH CHECK:** Are we currently generating and passing a unique `event_id` in the frontend so that Facebook can deduplicate it against the backend server-side events?

### STEP 2: Map the Backend Data Flow (Supabase & Edge Functions)
1. Deep-read the Supabase Edge Functions (specifically look for any HubSpot webhook handlers, stripe webhooks, or Facebook Conversions API (CAPI) triggers).
2. Find where a lead's data is first received from the frontend (is it saved to a Supabase table first, or sent directly to HubSpot?).
3. **🔴 CRITICAL MISMATCH CHECK:** If we are firing Facebook CAPI from the backend, are we passing the SAME `event_id` that was generated on the frontend?

### STEP 3: Verify Supabase Connection State (Local vs Remote)
Our environment variables might be mixed up between local development and production.
1. Check `.env`, `.env.local`, and `supabase/config.toml`.
2. Determine exactly which Supabase URL and keys the frontend is currently using.
3. Determine exactly where the Edge Functions are deployed and pointing. 
4. **Answer explicitly:** "Are we currently connected to the LOCAL Supabase instance or the REMOTE production instance?"

### STEP 4: Output the Pipeline Map
Once your audit is complete, output a visual data pipeline map (using Markdown) showing exactly how a user click becomes a HubSpot Contact. 

Specifically, highlight the exact line numbers or files where:
1. The frontend misses an `event_id` for deduplication.
2. The server-side (if it exists) fails to match the frontend events.
3. The environment variables dictate the current Supabase connection.
