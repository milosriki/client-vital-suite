# Security Best Practices - PTD Client Vital Suite

## Overview
This document outlines security best practices for the Client Vital Suite application. All developers must follow these guidelines.

## 1. Authentication & Authorization

### Edge Functions
✅ **DO**:
- Always enable JWT verification: `verify_jwt = true` in `supabase/config.toml`
- Validate user authentication in function code
- Check user permissions before data access
- Use service role key only in backend, never in frontend

❌ **DON'T**:
- Never disable JWT verification in production
- Don't trust client-provided user IDs
- Don't bypass authentication for "convenience"

### Example
```typescript
// At the start of every edge function
const authHeader = req.headers.get('Authorization');
if (!authHeader) {
  return new Response('Unauthorized', { status: 401 });
}

const token = authHeader.replace('Bearer ', '');
const { data: { user }, error } = await supabase.auth.getUser(token);
if (error || !user) {
  return new Response('Invalid token', { status: 401 });
}

// Now use user.id for queries
```

---

## 2. Environment Variables & Secrets

### Frontend (Vite/React)
✅ **DO**:
- Use `VITE_` prefix for public variables
- Only expose necessary values to frontend
- Keep API keys out of frontend code

❌ **DON'T**:
- Never commit `.env` files
- Never use `SUPABASE_SERVICE_ROLE_KEY` in frontend
- Never hardcode secrets in code

### Backend (Edge Functions)
✅ **DO**:
- Use `Deno.env.get()` to read secrets
- Store secrets in Supabase Edge Function Secrets
- Rotate secrets regularly

❌ **DON'T**:
- Never log secrets
- Never return secrets in responses
- Never commit secrets to git

### Secret Management
```bash
# Set secrets (never commit these)
supabase secrets set OPENAI_API_KEY=sk-... --project-ref YOUR_PROJECT_ID
supabase secrets set STRIPE_SECRET_KEY=sk_live_... --project-ref YOUR_PROJECT_ID

# List secrets (values are hidden)
supabase secrets list --project-ref YOUR_PROJECT_ID
```

---

## 3. Input Validation & Sanitization

### Always Validate User Input
✅ **DO**:
- Validate length limits
- Sanitize special characters
- Check data types
- Use allowlists over denylists
- Validate on both client AND server

❌ **DON'T**:
- Never trust client input
- Don't use denylist-only validation
- Don't skip backend validation

### Example
```typescript
function validateEmail(email: string): boolean {
  if (!email || email.length > 254) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function sanitizeSearchQuery(query: string): string {
  // Remove all non-alphanumeric except common search chars
  return query.replace(/[^\w\s@.\-+]/g, '').slice(0, 100);
}

// Usage
const email = validateEmail(input.email) ? input.email : '';
const search = sanitizeSearchQuery(input.query);
```

---

## 4. SQL Injection Prevention

### Use Parameterized Queries
✅ **DO**:
- Use Supabase query builder (auto-escapes)
- Use parameterized queries for raw SQL
- Validate table/column names against allowlist

❌ **DON'T**:
- Never concatenate user input into SQL
- Don't allow arbitrary SQL queries
- Don't trust "sanitized" strings

### Example
```typescript
// ✅ GOOD - Using Supabase query builder
const { data } = await supabase
  .from('contacts')
  .select('*')
  .eq('email', userEmail);  // Auto-escaped

// ✅ GOOD - Parameterized query
const { data } = await supabase.rpc('get_user_data', {
  user_email: userEmail  // Parameterized
});

// ❌ BAD - String concatenation
const query = `SELECT * FROM contacts WHERE email = '${userEmail}'`;  // VULNERABLE!
```

### SQL Query Tool Restrictions
If implementing `run_sql_query`:
```typescript
// Strict validation
const ALLOWED_TABLES = ['contacts', 'enhanced_leads', 'call_records'];
const normalizedQuery = query.trim().toLowerCase();

// Only SELECT
if (!normalizedQuery.startsWith('select')) {
  throw new Error('Only SELECT queries allowed');
}

// Block dangerous operations
const forbidden = /\b(drop|delete|insert|update|alter|create|truncate|grant|revoke)\b/i;
if (forbidden.test(normalizedQuery)) {
  throw new Error('Forbidden SQL operation');
}

// Block comments and multi-statement
if (normalizedQuery.includes('--') || normalizedQuery.includes('/*') || normalizedQuery.includes(';')) {
  throw new Error('Comments and multi-statement queries not allowed');
}

// Check table allowlist
let validTable = false;
for (const table of ALLOWED_TABLES) {
  if (normalizedQuery.includes(`from ${table}`)) {
    validTable = true;
    break;
  }
}
if (!validTable) {
  throw new Error('Table not in allowlist');
}
```

---

## 5. CORS Configuration

### Restrict Origins
✅ **DO**:
- Maintain allowlist of trusted origins
- Use environment variables for configuration
- Return specific origin, not wildcard
- Enable credentials when needed

❌ **DON'T**:
- Never use `Access-Control-Allow-Origin: *` in production
- Don't allow untrusted origins
- Don't skip origin validation

### Example
```typescript
const ALLOWED_ORIGINS = Deno.env.get('ALLOWED_ORIGINS')?.split(',') || [
  'https://your-production-domain.com',
  'https://staging.vercel.app'
];

function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) 
    ? origin 
    : ALLOWED_ORIGINS[0];
    
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}
```

---

## 6. Error Handling

### Don't Leak Information
✅ **DO**:
- Log detailed errors server-side
- Return generic errors to client
- Use error codes, not messages
- Monitor error rates

❌ **DON'T**:
- Never expose stack traces to client
- Don't return database errors directly
- Don't reveal internal paths/structure

### Example
```typescript
try {
  // Operation that might fail
  const result = await riskyOperation();
  return result;
} catch (error) {
  // ✅ Log internally with full details
  console.error('Operation failed:', {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    timestamp: new Date().toISOString(),
    user: user?.id,
  });
  
  // ✅ Return generic error to client
  return new Response(
    JSON.stringify({ 
      error: 'An error occurred. Please try again or contact support.',
      code: 'OPERATION_FAILED'
    }),
    { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}
```

---

## 7. Rate Limiting

### Prevent Abuse
✅ **DO**:
- Implement rate limiting on all endpoints
- Use per-user and per-IP limits
- Return 429 status for rate limit exceeded
- Log rate limit violations

❌ **DON'T**:
- Don't allow unlimited requests
- Don't use only IP-based limiting (NAT issues)
- Don't ignore rate limit violations

### Example (Conceptual)
```typescript
// Using a rate limiter service/library
const rateLimitKey = `ratelimit:${user.id}:${functionName}`;
const limit = 10; // requests
const window = 60; // seconds

const allowed = await checkRateLimit(rateLimitKey, limit, window);
if (!allowed) {
  return new Response(
    JSON.stringify({ 
      error: 'Rate limit exceeded. Please try again later.',
      retryAfter: window 
    }),
    { 
      status: 429,
      headers: { 
        'Retry-After': String(window),
        'Content-Type': 'application/json'
      }
    }
  );
}
```

---

## 8. Security Headers

### Add Standard Security Headers
✅ **DO**:
- Add security headers to all responses
- Use CSP to prevent XSS
- Enable HSTS for HTTPS
- Prevent clickjacking with X-Frame-Options

### Example
```typescript
export const securityHeaders = {
  // Prevent MIME sniffing
  'X-Content-Type-Options': 'nosniff',
  
  // Prevent clickjacking
  'X-Frame-Options': 'DENY',
  
  // Enable XSS filter
  'X-XSS-Protection': '1; mode=block',
  
  // Enforce HTTPS
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  
  // Control referrer
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  
  // Content Security Policy
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
  
  // Permissions Policy
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
};

// Add to all responses
return new Response(data, {
  headers: { ...corsHeaders, ...securityHeaders }
});
```

---

## 9. XSS Prevention

### Frontend Security
✅ **DO**:
- Use React's JSX (auto-escapes)
- Sanitize HTML if needed
- Validate all user input
- Use Content Security Policy

❌ **DON'T**:
- Avoid `dangerouslySetInnerHTML`
- Never use `eval()` or `Function()`
- Don't insert user input into HTML directly

### Example
```typescript
// ✅ GOOD - React auto-escapes
function UserProfile({ name }: { name: string }) {
  return <div>{name}</div>;  // Safe
}

// ❌ BAD - Vulnerable to XSS
function UserProfile({ name }: { name: string }) {
  return <div dangerouslySetInnerHTML={{ __html: name }} />;  // DANGEROUS!
}

// ✅ OK - If you must use HTML, sanitize first
import DOMPurify from 'dompurify';

function UserProfile({ htmlContent }: { htmlContent: string }) {
  const clean = DOMPurify.sanitize(htmlContent);
  return <div dangerouslySetInnerHTML={{ __html: clean }} />;
}
```

---

## 10. Logging & Monitoring

### Log Security Events
✅ **DO**:
- Log authentication attempts (success/failure)
- Log authorization failures
- Log rate limit violations
- Log suspicious patterns
- Monitor for anomalies

❌ **DON'T**:
- Never log passwords or secrets
- Don't log sensitive PII unnecessarily
- Don't ignore security logs

### Example
```typescript
// Security event logging
function logSecurityEvent(event: {
  type: 'auth_failure' | 'rate_limit' | 'unauthorized' | 'suspicious';
  userId?: string;
  ip?: string;
  details?: Record<string, any>;
}) {
  console.log(JSON.stringify({
    ...event,
    timestamp: new Date().toISOString(),
    severity: 'security',
  }));
  
  // Optionally send to monitoring service
  // await monitoring.track(event);
}

// Usage
if (!user) {
  logSecurityEvent({
    type: 'auth_failure',
    ip: request.headers.get('x-forwarded-for') || 'unknown',
    details: { endpoint: 'smart-agent' }
  });
  return new Response('Unauthorized', { status: 401 });
}
```

---

## 11. Dependency Security

### Keep Dependencies Updated
✅ **DO**:
- Run `npm audit` regularly
- Update dependencies monthly
- Review CVEs for your stack
- Use Dependabot or Snyk

❌ **DON'T**:
- Don't ignore security warnings
- Don't use deprecated packages
- Don't skip major version updates indefinitely

### Commands
```bash
# Check for vulnerabilities
npm audit

# Fix automatically (test first!)
npm audit fix

# Check outdated packages
npm outdated

# Update specific package
npm install package@latest

# Use npm-check-updates for major versions
npx npm-check-updates -u
npm install
```

---

## 12. Git Security

### Prevent Secret Commits
✅ **DO**:
- Always use `.gitignore` for secrets
- Review changes before committing
- Use pre-commit hooks
- Scan for secrets in CI

❌ **DON'T**:
- Never commit `.env` files
- Don't commit API keys
- Don't commit private keys

### .gitignore Template
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
*.p12
*.pfx
secrets.json
credentials.json

# Temporary files
/tmp/
*.tmp
*.temp
*.swp
```

### Pre-commit Hook
Create `.git/hooks/pre-commit`:
```bash
#!/bin/bash

# Check for potential secrets
if git diff --cached --name-only | grep -E '\.(env|key|pem)$'; then
  echo "❌ Attempting to commit sensitive files!"
  exit 1
fi

# Scan for API keys
if git diff --cached | grep -E '(AKIA|sk_live|pk_live|ghp_)'; then
  echo "❌ Potential API key detected in changes!"
  exit 1
fi

exit 0
```

---

## 13. Code Review Checklist

Before merging any PR, verify:

- [ ] No hardcoded secrets or credentials
- [ ] Input validation on all user inputs
- [ ] Authentication/authorization checks present
- [ ] SQL queries use parameterized approach
- [ ] Error messages don't leak information
- [ ] CORS configured properly
- [ ] Rate limiting implemented (if needed)
- [ ] Security headers added
- [ ] Dependencies have no critical vulnerabilities
- [ ] Logs don't contain sensitive data
- [ ] Tests cover security scenarios

---

## 14. Incident Response

### If Security Issue Discovered

1. **Assess Severity**
   - Critical: Immediate data breach risk
   - High: Potential for exploitation
   - Medium: Security weakness
   - Low: Best practice violation

2. **Immediate Actions**
   - For Critical/High: Stop deployment
   - Document the issue
   - Notify security team
   - Create incident ticket

3. **Fix Process**
   - Create hotfix branch
   - Implement fix
   - Test thoroughly
   - Deploy ASAP
   - Monitor for exploitation

4. **Post-Incident**
   - Rotate compromised credentials
   - Audit access logs
   - Document lessons learned
   - Update security practices

---

## 15. Security Training

### Required Reading
- OWASP Top 10
- Supabase Security Best Practices
- This document

### Regular Activities
- Monthly security reviews
- Quarterly penetration testing
- Annual security training
- Stay updated on CVEs

---

## Resources

### Documentation
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Supabase Security](https://supabase.com/docs/guides/platform/security)
- [MDN Web Security](https://developer.mozilla.org/en-US/docs/Web/Security)

### Tools
- npm audit - Dependency scanning
- Snyk - Vulnerability management
- OWASP ZAP - Penetration testing
- CodeQL - Static analysis

### Internal Documents
- `SECURITY_AUDIT_REPORT.md` - Latest audit findings
- `SECURITY_FIXES_REQUIRED.md` - Urgent fixes needed
- `.env.example` - Environment variable template

---

## Questions?

Contact the security team or create an issue tagged with `security`.

**Remember**: Security is everyone's responsibility! 🔒

---

**Last Updated**: December 13, 2025  
**Version**: 1.0  
**Owner**: Security Team
