#!/usr/bin/env python3
"""
Phase 1 Security: Add verifyAuth to unauthed edge functions.
Strategy:
  1. Skip webhook functions (by name)
  2. Skip functions that already have 'verifyAuth'  
  3. Skip functions with existing custom auth (note them)
  4. For all others: add import + auth check after OPTIONS handler
"""

import os
import re
import sys

BASE = "/Users/milosvukovic/client-vital-suite/supabase/functions"

# These are webhooks - signature auth, leave alone
WEBHOOKS = {
    "anytrack-webhook",
    "calendly-webhook",
    "callgear-webhook",
    "hubspot-anytrack-webhook",
    "hubspot-webhook-receiver",
    "hubspot-webhook",
    "stripe-webhook",
}

# These have existing custom auth (not verifyAuth) — already protected, document only
CUSTOM_AUTH = {
    "master-sync",        # has verifyCronOrAuth() to support cron secret
    "meta-cross-validate",  # has manual Bearer check
    "dedup-contacts",     # has manual token check
}

IMPORT_LINE = 'import { verifyAuth } from "../_shared/auth-middleware.ts";\n'

AUTH_BLOCK = '''\
  // Security: Phase 1 Auth Lockdown
  try { verifyAuth(req); } catch (_e) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
'''

def add_auth(fn_name: str, filepath: str) -> str:
    """Returns a status string describing what was done."""
    with open(filepath, "r") as f:
        content = f.read()

    if "verifyAuth" in content:
        return f"SKIP (already has verifyAuth)"

    lines = content.split("\n")

    # --- Step 1: Add import after last import line ---
    last_import_idx = -1
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith("import ") or stripped.startswith("/// <reference"):
            last_import_idx = i
    
    if last_import_idx == -1:
        # No imports found, add at top
        last_import_idx = 0
        lines.insert(0, IMPORT_LINE.rstrip())
    else:
        lines.insert(last_import_idx + 1, IMPORT_LINE.rstrip())

    # Rejoin to work with content
    content = "\n".join(lines)

    # --- Step 2: Find the OPTIONS check and inject auth AFTER it ---
    # Common pattern: "OPTIONS" check returns a response on a single line
    # We look for: `if (req.method === "OPTIONS")` followed by return on same or next line
    
    # Pattern A: Single-line OPTIONS return: `if (req.method === "OPTIONS") return ...;`
    # Pattern B: Multi-line OPTIONS block: `if (req.method === "OPTIONS") {\n  return ...;\n}`
    
    # We find the position right after the OPTIONS response is complete
    # Look for the pattern and insert auth block after it
    
    # Strategy: find "OPTIONS" in the line, then find the next ";" or "}" that closes the return
    
    options_match = re.search(
        r'(if \(req\.method === ["\']OPTIONS["\']\)[^}]*(?:\{[^}]*\}|[^\n]*\n))',
        content,
        re.DOTALL
    )
    
    if options_match:
        # Insert auth block right after the OPTIONS block
        end = options_match.end()
        # Make sure we're after a newline
        content = content[:end] + "\n" + AUTH_BLOCK + content[end:]
    else:
        # No OPTIONS check found — inject at start of serve handler body
        # Find `serve(async (req) => {` or `Deno.serve(async (req) => {`
        serve_match = re.search(
            r'(?:Deno\.)?serve\(async \([^)]+\) => \{\n',
            content
        )
        if serve_match:
            end = serve_match.end()
            content = content[:end] + "\n" + AUTH_BLOCK + content[end:]
        else:
            return "ERROR: Could not find insertion point"

    with open(filepath, "w") as f:
        f.write(content)
    
    return "PATCHED"


results = {}

for fn_name in sorted(os.listdir(BASE)):
    fn_path = os.path.join(BASE, fn_name)
    index_path = os.path.join(fn_path, "index.ts")
    
    if not os.path.isfile(index_path):
        continue
    if fn_name.startswith("_") or fn_name == "node_modules":
        continue
    
    if fn_name in WEBHOOKS:
        results[fn_name] = "SKIP (webhook - uses signature auth)"
        continue
    
    if fn_name in CUSTOM_AUTH:
        results[fn_name] = "SKIP (has existing custom auth, already protected)"
        continue
    
    status = add_auth(fn_name, index_path)
    results[fn_name] = status
    print(f"  [{status:40}] {fn_name}")

print("\n=== SUMMARY ===")
patched = [k for k, v in results.items() if v == "PATCHED"]
skipped = [k for k, v in results.items() if "SKIP" in v]
errors = [k for k, v in results.items() if "ERROR" in v]
already = [k for k, v in results.items() if "already" in v]

print(f"Patched: {len(patched)}")
print(f"Already had verifyAuth: {len(already)}")
print(f"Skipped (webhooks/custom-auth): {len(skipped)}")
print(f"Errors: {len(errors)}")
if errors:
    for e in errors:
        print(f"  ERROR: {e} -> {results[e]}")

# Write results for later
import json
with open("/Users/milosvukovic/client-vital-suite/scripts/add-auth-results.json", "w") as f:
    json.dump(results, f, indent=2)
print("\nResults saved to scripts/add-auth-results.json")
