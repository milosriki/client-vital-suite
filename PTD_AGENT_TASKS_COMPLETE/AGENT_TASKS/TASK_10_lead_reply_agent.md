# Task 10: Create Lead Reply Agent

## Context
Separate the lead reply logic into its own dedicated function for better scaling.

## Action
1. Create `supabase/functions/generate-lead-reply/index.ts`.
2. Move the "Phase 3" logic from `business-intelligence` to here.
3. Add logic to mark leads as `processing` so we don't double-reply.
4. Use `Deno.env.get('ANTHROPIC_API_KEY')` to generate personalized replies.
