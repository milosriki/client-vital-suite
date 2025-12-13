# 🚨 URGENT SECURITY FIXES REQUIRED

## ⚠️ CRITICAL - FIX IMMEDIATELY (TODAY)

### 1. Remove .env from Git History
```bash
# Step 1: Add .env to .gitignore
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore
echo ".env.*.local" >> .gitignore

# Step 2: Remove .env from git tracking
git rm --cached .env

# Step 3: Commit the change
git commit -m "Remove .env from tracking"

# Step 4: Remove from history (WARNING: This rewrites history)
# Option A: Using git filter-repo (recommended)
git filter-repo --path .env --invert-paths

# Option B: Using BFG Repo-Cleaner (safer)
# Download BFG from https://rtyley.github.io/bfg-repo-cleaner/
java -jar bfg.jar --delete-files .env
git reflog expire --expire=now --all && git gc --prune=now --aggressive

# Step 5: Force push (coordinate with team first!)
git push origin --force --all
```

**THEN IMMEDIATELY**:
- Rotate Supabase anonymous key in Supabase dashboard
- Update team members with new credentials
- Check if .env was ever pushed to public repository

---

### 2. Enable JWT Verification on ALL Edge Functions

**File**: `supabase/config.toml`

**Change**: Replace ALL instances of `verify_jwt = false` with `verify_jwt = true`

```bash
# Quick fix using sed
sed -i 's/verify_jwt = false/verify_jwt = true/g' supabase/config.toml

# Or manually edit supabase/config.toml
```

**Then verify**:
```bash
grep "verify_jwt = false" supabase/config.toml
# Should return nothing
```

**Deploy**:
```bash
supabase functions deploy --no-verify-jwt=false --project-ref ztjndilxurtsfqdsvfds
```

**Test each function** to ensure authentication works!

---

### 3. Restrict CORS to Known Origins

**Files to update**:
- `supabase/functions/smart-agent/index.ts`
- `supabase/functions/ptd-agent-gemini/index.ts`
- All other edge functions (36 total)

**Find**:
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
```

**Replace with**:
```typescript
// Get allowed origins from environment or use defaults
const ALLOWED_ORIGINS = Deno.env.get('ALLOWED_ORIGINS')?.split(',') || [
  'https://your-production-domain.com',
  'https://your-staging.vercel.app',
  'http://localhost:5173'
];

function getCorsHeaders(request: Request) {
  const origin = request.headers.get('origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) 
    ? origin 
    : ALLOWED_ORIGINS[0];
    
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true',
  };
}

// Then use in your function:
// const corsHeaders = getCorsHeaders(req);
```

**Set environment variable**:
```bash
supabase secrets set ALLOWED_ORIGINS="https://prod.com,https://staging.vercel.app" --project-ref ztjndilxurtsfqdsvfds
```

---

## 🔴 HIGH PRIORITY - FIX THIS WEEK

### 4. Sanitize Error Messages

**Files**: All edge functions with try/catch blocks

**Find**:
```typescript
catch (e) {
  return `Error: ${e}`;
}
```

**Replace with**:
```typescript
catch (e) {
  console.error('Operation failed:', e); // Log for debugging
  return JSON.stringify({ 
    error: 'An error occurred processing your request.' 
  });
}
```

**For development environment only**, you can include details:
```typescript
catch (e) {
  console.error('Operation failed:', e);
  
  const isDevelopment = Deno.env.get('ENVIRONMENT') === 'development';
  return JSON.stringify({ 
    error: isDevelopment 
      ? `Error: ${e instanceof Error ? e.message : String(e)}` 
      : 'An error occurred processing your request.',
    ...(isDevelopment && { stack: e instanceof Error ? e.stack : undefined })
  });
}
```

---

### 5. Add Input Validation to Universal Search

**Files**: 
- `supabase/functions/smart-agent/index.ts`
- `supabase/functions/ptd-agent-gemini/index.ts`

**Find the universal_search case and enhance**:
```typescript
case "universal_search": {
  const { query, search_type = "auto" } = args;
  const q = String(query).trim();
  
  // Enhanced input validation
  if (!q || q.length === 0) {
    return JSON.stringify({ error: "Search query cannot be empty" });
  }
  
  if (q.length > 100) {
    return JSON.stringify({ error: "Search query too long (max 100 characters)" });
  }
  
  // Sanitize input - remove potentially dangerous characters
  const sanitized = q.replace(/[^\w\s@.\-+]/g, '');
  if (sanitized !== q) {
    return JSON.stringify({ 
      error: "Search query contains invalid characters" 
    });
  }
  
  // Add rate limiting check (implement rate limiter)
  // const rateLimitOk = await checkRateLimit(user.id, 'universal_search');
  // if (!rateLimitOk) {
  //   return JSON.stringify({ error: "Rate limit exceeded. Try again later." });
  // }
  
  // Continue with existing logic...
}
```

---

### 6. Review SQL Query Tool

**Recommended**: Remove `run_sql_query` tool entirely OR severely restrict it.

**Option A: Remove it** (Recommended)
```typescript
// In tool definitions, remove run_sql_query tool completely
// Comment out or delete the tool definition and implementation
```

**Option B: Add strict table allowlist**
```typescript
case "run_sql_query": {
  const { query } = input;
  
  // Strict allowlist of tables
  const ALLOWED_TABLES = [
    'contacts',
    'enhanced_leads', 
    'call_records',
    'client_health_scores'
  ];
  
  const normalizedQuery = query.trim().toLowerCase();
  
  // Check if query only accesses allowed tables
  let hasAllowedTable = false;
  for (const table of ALLOWED_TABLES) {
    if (normalizedQuery.includes(`from ${table}`) || 
        normalizedQuery.includes(`join ${table}`)) {
      hasAllowedTable = true;
      break;
    }
  }
  
  if (!hasAllowedTable) {
    return JSON.stringify({ 
      error: "Query can only access approved tables" 
    });
  }
  
  // Existing security checks...
  if (!normalizedQuery.startsWith('select')) {
    return JSON.stringify({ error: "Only SELECT queries allowed" });
  }
  
  // Additional check: no information_schema or pg_catalog
  if (normalizedQuery.includes('information_schema') || 
      normalizedQuery.includes('pg_catalog')) {
    return JSON.stringify({ 
      error: "System table access denied" 
    });
  }
  
  // Rest of implementation...
}
```

---

## 🟡 MODERATE PRIORITY - FIX THIS MONTH

### 7. Update Dependencies

```bash
# Check current vulnerabilities
npm audit

# Update vite (major version - TEST THOROUGHLY)
npm install vite@7.2.7

# Or try auto-fix
npm audit fix

# Verify everything still works
npm run build
npm run dev
```

---

### 8. Move PROJECT_ID to GitHub Secrets

**Step 1**: Add secret to GitHub
1. Go to repository Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Name: `SUPABASE_PROJECT_ID`
4. Value: `ztjndilxurtsfqdsvfds`

**Step 2**: Update workflow file

**File**: `.github/workflows/deploy-supabase.yml`

**Change**:
```yaml
env:
  SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
  PROJECT_ID: ${{ secrets.SUPABASE_PROJECT_ID }}  # Changed from hardcoded value
```

---

## 🟢 LOW PRIORITY - Improvements

### 9. Update .gitignore

Add to `.gitignore`:
```gitignore
# Environment variables
.env
.env.local
.env.*.local
.env.development
.env.production
.env.test

# Secrets
*.key
*.pem
secrets.json

# Temporary files
/tmp/
*.tmp
*.temp
```

---

### 10. Add Security Headers

Create a new file: `supabase/functions/_shared/security-headers.ts`

```typescript
export const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY', 
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
};

export function addSecurityHeaders(headers: Record<string, string>) {
  return { ...headers, ...securityHeaders };
}
```

Then in each function:
```typescript
import { addSecurityHeaders } from '../_shared/security-headers.ts';

// When returning response:
return new Response(
  JSON.stringify(result),
  { 
    headers: addSecurityHeaders({
      'Content-Type': 'application/json',
      ...corsHeaders
    })
  }
);
```

---

## Testing Checklist

After making fixes:

```markdown
- [ ] Test authentication on all edge functions
- [ ] Verify CORS only allows known origins
- [ ] Confirm error messages don't leak info
- [ ] Test input validation on universal_search
- [ ] Verify SQL queries are restricted
- [ ] Check that .env is not in git history
- [ ] Confirm new .env is in .gitignore
- [ ] Test all frontend functionality still works
- [ ] Verify production deployment works
- [ ] Check monitoring/logging is working
```

---

## Quick Command Reference

```bash
# Check for exposed secrets
grep -r "sk_live" --exclude-dir=node_modules .
grep -r "pk_live" --exclude-dir=node_modules .

# Check JWT settings
grep "verify_jwt" supabase/config.toml

# Check CORS settings
grep -r "Access-Control-Allow-Origin" supabase/functions/

# Check if .env is tracked
git ls-files | grep .env

# Audit dependencies
npm audit

# Deploy functions with JWT
supabase functions deploy --project-ref ztjndilxurtsfqdsvfds

# Test a function with auth
curl -X POST https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/smart-agent \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

---

## Rollback Plan

If fixes break production:

1. **Immediate**: Disable JWT verification temporarily
   ```bash
   # In supabase/config.toml
   verify_jwt = false  # Only for affected functions
   
   supabase functions deploy --project-ref ztjndilxurtsfqdsvfds
   ```

2. **CORS issues**: Add wildcard temporarily (NOT RECOMMENDED)
   ```typescript
   'Access-Control-Allow-Origin': '*'  // TEMPORARY ONLY
   ```

3. **Git history**: If force push causes issues
   ```bash
   git reflog  # Find previous commit
   git reset --hard <commit-hash>
   ```

4. **Dependencies**: Revert package.json
   ```bash
   git checkout HEAD~1 package.json package-lock.json
   npm install
   ```

---

## Questions or Issues?

1. **Can't remove .env from history**: 
   - Use BFG Repo-Cleaner (safer)
   - Or accept it's exposed and rotate all credentials

2. **JWT breaks frontend**:
   - Ensure frontend sends Authorization header
   - Check Supabase client is authenticated
   - Verify token is valid

3. **CORS issues after fix**:
   - Add your actual domain to ALLOWED_ORIGINS
   - Check origin header in browser console
   - Verify environment variable is set

4. **Functions won't deploy**:
   - Check Supabase CLI is updated: `supabase --version`
   - Verify access token: `supabase login`
   - Check project ref is correct

---

**Last Updated**: December 13, 2025  
**Urgency**: CRITICAL - Fix items 1-3 TODAY  
**See**: SECURITY_AUDIT_REPORT.md for full details
