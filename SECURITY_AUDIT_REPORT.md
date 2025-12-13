# Security Audit Report
**Date**: December 13, 2025  
**Repository**: milosriki/client-vital-suite  
**Auditor**: GitHub Copilot Security Agent

## Executive Summary

A comprehensive security audit was conducted on the Client Vital Suite repository. The audit identified **3 CRITICAL** vulnerabilities, **3 HIGH** severity issues, **2 MODERATE** issues, and **2 LOW** severity findings that require immediate attention.

### Risk Summary
- 🔴 **CRITICAL**: 3 findings
- 🟠 **HIGH**: 3 findings  
- 🟡 **MODERATE**: 2 findings
- 🟢 **LOW**: 2 findings

---

## 🔴 CRITICAL Vulnerabilities

### 1. Environment File Tracked in Git Repository
**Severity**: CRITICAL  
**Risk**: Exposure of sensitive credentials  
**Location**: `.env` file in repository root

**Finding**:
The `.env` file containing sensitive environment variables is tracked in the git repository and has been committed to version control history.

**Evidence**:
```bash
$ git ls-files | grep "^\.env$"
.env

$ cat .env
VITE_SUPABASE_ANON_KEY="eyJhbGc..."
VITE_SUPABASE_PROJECT_ID="ztjndilxurtsfqdsvfds"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGc..."
VITE_SUPABASE_URL="https://ztjndilxurtsfqdsvfds.supabase.co"
```

**Impact**:
- Supabase anonymous keys are exposed in git history
- Project ID is publicly visible
- Anyone with repository access can view these credentials
- Credentials remain in git history even after removal

**Remediation**:
1. **IMMEDIATE**: Add `.env` to `.gitignore`
2. **URGENT**: Remove `.env` from git history using:
   ```bash
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch .env" \
     --prune-empty --tag-name-filter cat -- --all
   ```
   OR use BFG Repo-Cleaner for safer removal
3. Rotate all exposed credentials in Supabase dashboard
4. Notify team members to update their local environments
5. Force push to remove from remote history (coordinate with team)

---

### 2. No JWT Verification on Edge Functions
**Severity**: CRITICAL  
**Risk**: Unauthorized access to all API endpoints  
**Location**: `supabase/config.toml`

**Finding**:
All 36 Supabase edge functions have `verify_jwt = false`, meaning **NO authentication** is required to access these endpoints.

**Evidence**:
```toml
[functions.ptd-agent-gemini]
verify_jwt = false

[functions.smart-agent]
verify_jwt = false

[functions.health-calculator]
verify_jwt = false

# ... 33 more functions with verify_jwt = false
```

```bash
$ grep "verify_jwt" supabase/config.toml | sort | uniq -c
36 verify_jwt = false
```

**Impact**:
- **Anyone on the internet** can call these functions
- No user authentication required
- Functions have access to:
  - Client data via `client_control`
  - Lead information via `lead_control`
  - Sales data via `sales_flow_control`
  - HubSpot data via `hubspot_control`
  - Stripe payment data via `stripe_control`
  - Call records via `call_control`
  - SQL query execution via `run_sql_query`
- Potential for:
  - Data exfiltration
  - Unauthorized data modification
  - Resource exhaustion attacks
  - Financial fraud

**Functions at Risk** (Examples):
- `ptd-agent-gemini` - Full AI agent with database access
- `smart-agent` - Full AI agent with tool execution
- `stripe-dashboard-data` - Payment information access
- `hubspot-command-center` - CRM data access
- `business-intelligence` - Analytics data access
- `run_sql_query` tool in agents - Direct database queries

**Remediation**:
1. **IMMEDIATE**: Enable JWT verification for all functions:
   ```toml
   [functions.ptd-agent-gemini]
   verify_jwt = true
   
   [functions.smart-agent]
   verify_jwt = true
   
   # ... apply to all 36 functions
   ```
2. Implement proper authentication checks in function code
3. Add rate limiting to prevent abuse
4. Audit access logs for unauthorized access
5. Consider implementing API key authentication as additional layer
6. Test all functions with authentication enabled before deployment

---

### 3. Unrestricted CORS Policy
**Severity**: HIGH (elevated from MODERATE due to lack of JWT)  
**Risk**: Cross-origin attacks, CSRF potential  
**Location**: All edge functions

**Finding**:
All edge functions allow CORS requests from any origin (`*`), combined with no JWT verification, creates a severe security risk.

**Evidence**:
```typescript
// supabase/functions/smart-agent/index.ts
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// supabase/functions/ptd-agent-gemini/index.ts  
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
```

**Impact**:
- Any website can call your API endpoints
- Malicious sites can exfiltrate user data
- CSRF attacks are possible
- No origin validation
- Combined with no JWT = complete exposure

**Remediation**:
1. Restrict CORS to known domains:
   ```typescript
   const ALLOWED_ORIGINS = [
     'https://your-production-domain.com',
     'https://your-staging-domain.vercel.app',
     'http://localhost:5173', // dev only
   ];
   
   const origin = req.headers.get('origin');
   const corsHeaders = {
     'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
     'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
     'Access-Control-Allow-Credentials': 'true',
   };
   ```
2. Implement CSRF tokens for state-changing operations
3. Add Origin header validation
4. Use environment variables for allowed origins configuration

---

## 🟠 HIGH Severity Issues

### 4. Information Disclosure in Error Messages
**Severity**: HIGH  
**Risk**: Internal system details exposed to attackers  
**Location**: Multiple edge functions

**Finding**:
Error messages expose internal error details, stack traces, and system information that could aid attackers.

**Evidence**:
```typescript
// supabase/functions/smart-agent/index.ts
catch (e) {
  return `Sync function error: ${e}`;
}

catch (e) {
  return `Stripe forensics error: ${e}`;
}

catch (e) {
  return `Stripe dashboard error: ${e}`;
}
```

**Impact**:
- Exposes internal error messages and stack traces
- Reveals file paths and system information
- Provides attackers with debugging information
- Could expose database schema details
- May leak environment configuration

**Remediation**:
```typescript
catch (e) {
  console.error('Stripe forensics error:', e); // Log internally
  return 'An error occurred processing your request. Please contact support.'; // Generic message to user
}
```

---

### 5. SQL Injection Risk in run_sql_query Tool
**Severity**: HIGH (mitigated by validation, but still risky)  
**Risk**: Potential database compromise  
**Location**: `smart-agent/index.ts`, `ptd-agent-gemini/index.ts`

**Finding**:
While SQL injection prevention is implemented, the `run_sql_query` tool accepts dynamic SQL queries, which is inherently risky.

**Current Protection** (Good):
```typescript
// Security: Only allow SELECT queries
const normalizedQuery = query.trim().toLowerCase();
if (!normalizedQuery.startsWith('select')) {
  return "Error: Only SELECT queries are allowed";
}

// Prevent certain risky operations - check word boundaries
const forbiddenPattern = /\b(drop|delete|insert|update|alter|create|truncate|grant|revoke|execute|exec)\b/i;
if (forbiddenPattern.test(normalizedQuery)) {
  return "Error: Query contains forbidden operations";
}

// Additional security: prevent comments and multi-statement queries
if (normalizedQuery.includes('--') || normalizedQuery.includes('/*') || normalizedQuery.includes(';')) {
  return "Error: Query contains forbidden characters (comments or multiple statements)";
}
```

**Remaining Risks**:
- SELECT queries can still access sensitive data
- Subqueries could bypass some restrictions
- No row-level security enforcement
- Information schema queries could reveal structure
- UNION-based attacks still possible

**Recommendations**:
1. Consider removing `run_sql_query` entirely
2. If needed, use parameterized queries only
3. Implement strict allow-list of tables/columns
4. Add row-level security (RLS) in Supabase
5. Limit query complexity and execution time
6. Log all query attempts for monitoring

---

### 6. Missing Input Validation in Universal Search
**Severity**: HIGH  
**Risk**: Resource exhaustion, data leakage  
**Location**: `smart-agent/index.ts`, `ptd-agent-gemini/index.ts`

**Finding**:
Universal search has length limits but lacks comprehensive input validation.

**Current Protection**:
```typescript
// Input validation: prevent excessively long queries
if (q.length > 100) {
  return JSON.stringify({ error: "Search query too long (max 100 characters)" });
}
```

**Missing Protections**:
- No validation of special characters
- No prevention of regex DoS
- No sanitization of input before database queries
- No rate limiting per user
- Could be used for enumeration attacks

**Recommendations**:
1. Implement strict input sanitization:
   ```typescript
   const sanitizedQuery = q.replace(/[^\w\s@.-]/g, '');
   ```
2. Add rate limiting per IP/user
3. Implement result pagination
4. Add logging for suspicious patterns
5. Consider allow-list for search characters

---

## 🟡 MODERATE Severity Issues

### 7. Dependency Vulnerabilities
**Severity**: MODERATE  
**Risk**: Development environment compromise  
**Location**: `package.json` dependencies

**Finding**:
NPM audit revealed 2 moderate vulnerabilities in development dependencies.

**Vulnerabilities**:
1. **esbuild** (<=0.24.2)
   - CVE: GHSA-67mh-4wv8-2f99
   - Severity: Moderate (CVSS 5.3)
   - Issue: Enables any website to send requests to dev server
   - Affected: vite dependency
   
2. **vite** (affected range)
   - Severity: Moderate
   - Affected by esbuild vulnerability
   - Vulnerable versions use esbuild <=0.24.2

**Current Versions**:
- vite: 5.4.19 (contains vulnerable esbuild)
- esbuild: 0.24.2 or lower (via vite)

**Fix Available**:
- vite: 7.2.7 (major version upgrade)

**Impact**:
- Only affects development environment
- Could compromise developer machines
- Not exploitable in production build

**Remediation**:
```bash
npm audit fix --force
# OR
npm install vite@7.2.7
```

**Note**: This requires a major version upgrade. Test thoroughly before applying.

---

### 8. Hardcoded Project ID in GitHub Workflow
**Severity**: MODERATE  
**Risk**: Configuration exposure, environment confusion  
**Location**: `.github/workflows/deploy-supabase.yml`

**Finding**:
The Supabase project ID is hardcoded in the deployment workflow.

**Evidence**:
```yaml
env:
  SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
  PROJECT_ID: ztjndilxurtsfqdsvfds  # Hardcoded
```

**Impact**:
- Project ID is public in repository
- Cannot easily use different projects for staging/production
- Reduces deployment flexibility
- Information disclosure

**Remediation**:
```yaml
env:
  SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
  PROJECT_ID: ${{ secrets.SUPABASE_PROJECT_ID }}
```

Add `SUPABASE_PROJECT_ID` to GitHub secrets.

---

## 🟢 LOW Severity Issues

### 9. Controlled dangerouslySetInnerHTML Usage
**Severity**: LOW  
**Risk**: Potential XSS if config is compromised  
**Location**: `src/components/ui/chart.tsx`

**Finding**:
The chart component uses `dangerouslySetInnerHTML` for CSS injection.

**Evidence**:
```typescript
<style
  dangerouslySetInnerHTML={{
    __html: Object.entries(THEMES)
      .map(([theme, prefix]) => `
        ${prefix} [data-chart=${id}] {
          ${colorConfig.map(([key, itemConfig]) => {
            const color = itemConfig.theme?.[theme] || itemConfig.color;
            return color ? `  --color-${key}: ${color};` : null;
          }).join("\n")}
        }
      `.trim())
      .join("\n"),
  }}
/>
```

**Assessment**:
- Appears to be controlled input from config object
- Used only for CSS variable generation
- Limited XSS risk if config is trusted
- No user input directly inserted

**Recommendation**:
- Add validation for color values
- Use CSS-in-JS library instead
- Sanitize config values:
  ```typescript
  const sanitizeColor = (color: string) => {
    return color.replace(/[^a-zA-Z0-9#().,\s%-]/g, '');
  };
  ```

---

### 10. Missing .env in .gitignore
**Severity**: LOW (already committed, so critical issue above)  
**Risk**: Future commits of .env file  
**Location**: `.gitignore`

**Finding**:
The `.gitignore` file does not include `.env`, which led to it being committed.

**Current .gitignore**:
```gitignore
# Logs
logs
*.log
# ...
.vercel

# Lovable protection
.lovableignore
.env.vercel
```

**Missing**: `.env` entry

**Remediation**:
```gitignore
# Environment variables
.env
.env.local
.env.*.local
.env.production
.env.development

# Lovable protection
.lovableignore
.env.vercel
```

---

## Security Best Practices Review

### ✅ Good Practices Found
1. SQL injection prevention with word boundaries
2. Multi-statement query prevention
3. Comment blocking in SQL queries
4. VITE_ prefix enforcement for frontend env vars
5. Secrets stored in Supabase, not in code
6. Use of service role key in workflows (via secrets)

### ❌ Missing Security Controls
1. No authentication on API endpoints
2. No rate limiting
3. No request logging/monitoring
4. No API key rotation policy
5. No security headers (CSP, HSTS, etc.)
6. No input length limits on most fields
7. No IP allowlisting for admin functions
8. No WAF or DDoS protection

---

## Recommended Security Architecture

### 1. Authentication Layer
```typescript
// Add to all edge functions
const authHeader = req.headers.get('Authorization');
if (!authHeader) {
  return new Response('Unauthorized', { status: 401 });
}

const token = authHeader.replace('Bearer ', '');
const { data: { user }, error } = await supabase.auth.getUser(token);
if (error || !user) {
  return new Response('Invalid token', { status: 401 });
}
```

### 2. Rate Limiting
```typescript
// Implement per-user rate limiting
const rateLimitKey = `ratelimit:${user.id}:${functionName}`;
const currentCount = await redis.incr(rateLimitKey);
if (currentCount === 1) {
  await redis.expire(rateLimitKey, 60); // 1 minute window
}
if (currentCount > 10) {
  return new Response('Rate limit exceeded', { status: 429 });
}
```

### 3. Security Headers
```typescript
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': "default-src 'self'",
};
```

---

## Immediate Action Items

### Priority 1 (Critical - Do Now)
1. ✅ Add `.env` to `.gitignore`
2. ✅ Remove `.env` from git history
3. ✅ Rotate all exposed Supabase credentials
4. ✅ Enable `verify_jwt = true` for all edge functions
5. ✅ Test authentication on all endpoints
6. ✅ Restrict CORS to known origins

### Priority 2 (High - This Week)
1. ⚠️ Implement generic error messages
2. ⚠️ Add comprehensive input validation
3. ⚠️ Review and harden SQL query tool
4. ⚠️ Add rate limiting
5. ⚠️ Implement request logging

### Priority 3 (Moderate - This Month)
1. 📋 Upgrade vite to fix vulnerabilities
2. 📋 Move PROJECT_ID to GitHub secrets
3. 📋 Add security headers
4. 📋 Implement API key rotation
5. 📋 Set up monitoring and alerting

### Priority 4 (Low - Backlog)
1. 📝 Review dangerouslySetInnerHTML usage
2. 📝 Comprehensive .gitignore update
3. 📝 Security documentation
4. 📝 Penetration testing
5. 📝 Security training for team

---

## Compliance Considerations

### Data Protection
- **GDPR**: Client data accessible without authentication violates GDPR
- **PCI DSS**: Stripe data exposure without auth violates PCI DSS requirements
- **CCPA**: California consumer data exposed
- **HIPAA**: If health data present, multiple violations

### Recommendations
1. Conduct data classification audit
2. Implement data access logging
3. Add data retention policies
4. Document security controls
5. Regular security audits

---

## Monitoring and Detection

### Implement Security Monitoring
1. **Failed Authentication Attempts**
   - Log all failed auth attempts
   - Alert on suspicious patterns
   
2. **Unusual Query Patterns**
   - Monitor run_sql_query usage
   - Alert on large result sets
   
3. **API Abuse**
   - Track request volumes per endpoint
   - Identify abnormal traffic patterns
   
4. **Data Access Auditing**
   - Log all sensitive data access
   - Track who accessed what and when

---

## Testing Recommendations

### Security Testing
1. **Penetration Testing**
   - Hire external security firm
   - Test authentication bypasses
   - Attempt SQL injection
   - Test CORS restrictions

2. **Automated Security Scanning**
   - Set up Snyk or Dependabot
   - Configure CodeQL in CI/CD
   - Regular OWASP ZAP scans

3. **Code Review**
   - Security-focused code reviews
   - Threat modeling sessions
   - Security checklist for PRs

---

## Conclusion

The Client Vital Suite application has **critical security vulnerabilities** that require **immediate attention**. The combination of:
1. No authentication on API endpoints
2. Unrestricted CORS
3. Exposed credentials in git history

Creates a **severe security risk** that could lead to:
- Complete data breach
- Financial fraud via Stripe access
- Regulatory violations (GDPR, PCI DSS)
- Reputation damage
- Legal liability

**Recommended Timeline**:
- **Today**: Fix critical issues (#1, #2, #3)
- **This Week**: Address high severity issues (#4, #5, #6)
- **This Month**: Resolve moderate issues (#7, #8)
- **Ongoing**: Implement security best practices

**Estimated Effort**:
- Critical fixes: 4-8 hours
- High priority: 16-24 hours  
- Moderate priority: 8-16 hours
- Security architecture: 40+ hours

---

## Appendix A: Security Checklist

```markdown
- [ ] .env removed from git history
- [ ] All credentials rotated
- [ ] .env added to .gitignore
- [ ] JWT verification enabled on all functions
- [ ] CORS restricted to known origins
- [ ] Error messages sanitized
- [ ] Input validation on all endpoints
- [ ] Rate limiting implemented
- [ ] Security headers added
- [ ] Dependencies updated
- [ ] PROJECT_ID moved to secrets
- [ ] Request logging enabled
- [ ] Monitoring configured
- [ ] Documentation updated
- [ ] Team trained on security
- [ ] Penetration test scheduled
```

---

## Appendix B: Affected Functions

All 36 edge functions are affected by the JWT verification issue:

1. ptd-agent-gemini
2. ptd-agent-claude
3. smart-agent
4. health-calculator
5. churn-predictor
6. anomaly-detector
7. intervention-recommender
8. coach-analyzer
9. daily-report
10. data-quality
11. integration-health
12. pipeline-monitor
13. ptd-watcher
14. ptd-agent
15. fetch-hubspot-live
16. hubspot-command-center
17. fetch-callgear-data
18. callgear-live-monitor
19. callgear-icp-router
20. fetch-forensic-data
21. stripe-dashboard-data
22. stripe-payouts-ai
23. stripe-issuing
24. stripe-connect
25. stripe-checkout
26. stripe-forensics
27. anytrack-webhook
28. send-to-stape-capi
29. capi-validator
30. generate-lead-reply
31. proactive-insights-generator
32. business-intelligence
33. agent-orchestrator
34. ai-deploy-callback
35. meta-capi-send
36. And others...

---

**Report Generated**: December 13, 2025  
**Next Review Date**: January 13, 2026  
**Contact**: Security Team / DevSecOps
