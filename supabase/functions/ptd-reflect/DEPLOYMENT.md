# PTD Reflection Agent - Deployment Guide

## Pre-Deployment Checklist

### 1. Environment Variables
Ensure these are set in your Supabase project:

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-xxxxx      # Claude API key (Sonnet 4 access)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxxxx     # For database access

# Optional (for fallback/testing)
OPENAI_API_KEY=sk-xxxxx             # If using embeddings
```

**Verify:**
```bash
# In Supabase Dashboard
Settings → Edge Functions → Secrets

# Or via CLI
supabase secrets list
```

### 2. Database Prerequisites

Ensure these tables/functions exist:

**Tables:**
- `client_health_scores` - For fact verification
- `contacts` - For client lookups
- `leads` - For lead data
- `deals` - For deal information

**Functions:**
- `get_zone_distribution(target_date)` - For zone verification

**Test Query:**
```sql
-- Test if tables are accessible
SELECT COUNT(*) FROM client_health_scores;

-- Test if RPC function exists
SELECT * FROM get_zone_distribution('2025-12-10');
```

### 3. Base PTD Agent

The reflection agent depends on `ptd-agent` function:

```bash
# Verify PTD agent is deployed
supabase functions list | grep ptd-agent

# Test PTD agent
curl -X POST https://your-project.supabase.co/functions/v1/ptd-agent \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "Test", "session_id": "test"}'
```

## Deployment Steps

### Option 1: Supabase CLI (Recommended)

```bash
# 1. Navigate to project directory
cd /home/user/client-vital-suite

# 2. Login to Supabase
supabase login

# 3. Link to your project
supabase link --project-ref your-project-ref

# 4. Deploy the function
supabase functions deploy ptd-reflect

# 5. Verify deployment
supabase functions list | grep ptd-reflect

# 6. Check logs
supabase functions logs ptd-reflect --tail
```

### Option 2: Manual Upload (Supabase Dashboard)

```bash
# 1. Package the function
cd supabase/functions
zip -r ptd-reflect.zip ptd-reflect/

# 2. In Supabase Dashboard:
#    - Go to Edge Functions
#    - Click "Deploy a new function"
#    - Upload ptd-reflect.zip
#    - Set environment variables

# 3. Test via Dashboard UI
```

### Option 3: CI/CD (GitHub Actions)

```yaml
# .github/workflows/deploy-functions.yml
name: Deploy Edge Functions

on:
  push:
    branches: [main]
    paths:
      - 'supabase/functions/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - uses: supabase/setup-cli@v1
        with:
          version: latest

      - name: Deploy ptd-reflect
        run: |
          supabase functions deploy ptd-reflect \
            --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
```

## Post-Deployment Verification

### 1. Health Check

```bash
# Test basic invocation
curl -X POST https://your-project.supabase.co/functions/v1/ptd-reflect \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "critique_only",
    "query": "Test query",
    "initial_response": "This is a test response.",
    "max_iterations": 1,
    "quality_threshold": 80
  }'

# Expected response:
{
  "success": true,
  "final_response": "...",
  "iterations": 0 or 1,
  "metadata": {
    "initial_score": 50-70,
    "final_score": 70-90,
    "response_time_ms": 5000-15000
  }
}
```

### 2. Full Mode Test

```bash
curl -X POST https://your-project.supabase.co/functions/v1/ptd-reflect \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "full",
    "query": "How many clients are in RED zone?",
    "context": {
      "session_id": "deployment_test"
    },
    "max_iterations": 2,
    "quality_threshold": 80
  }'

# Should call PTD agent + reflect
# Check logs for full flow
```

### 3. Performance Baseline

Run test suite to establish baseline metrics:

```bash
# Make test script executable
chmod +x supabase/functions/ptd-reflect/test-commands.sh

# Run tests (update SUPABASE_URL and KEY in script first)
./supabase/functions/ptd-reflect/test-commands.sh

# Expected results:
# - Test 1: ~5-10s response time
# - Test 2: Quality gain +10-30%
# - Test 3: Fact checks present
# - Test 4: Score ≥90% with 3 iterations
```

### 4. Error Handling Test

```bash
# Test with invalid input
curl -X POST https://your-project.supabase.co/functions/v1/ptd-reflect \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "full",
    "query": ""
  }'

# Expected: {"success": false, "error": "Either 'query' or 'initial_response' is required"}
```

## Monitoring Setup

### 1. Supabase Dashboard

Monitor in real-time:
- **Edge Functions → ptd-reflect → Logs**
- Watch for:
  - `[PTD Reflect] Initial score: X%`
  - `[PTD Reflect] Quality gain: +X%`
  - Errors or timeouts

### 2. Custom Analytics

Add tracking in your app:

```typescript
// Track reflection metrics
const trackReflection = (result: any) => {
  analytics.track('reflection_completed', {
    initial_score: result.metadata.initial_score,
    final_score: result.metadata.final_score,
    quality_gain: result.total_quality_gain,
    iterations: result.iterations,
    response_time_ms: result.metadata.total_time_ms
  })
}
```

### 3. Alerts

Set up alerts for:
- **High Error Rate**: >5% of requests failing
- **Slow Responses**: >30s response time
- **Low Quality Gain**: <5% average improvement
- **Fact Check Failures**: >20% unverified claims

## Performance Tuning

### 1. Optimize for Speed

If responses are too slow:

```typescript
// Reduce iterations
{
  max_iterations: 1,  // Instead of 2
  quality_threshold: 75  // Instead of 80
}

// Expected: ~8-12s instead of 15-20s
// Trade-off: -10% quality gain
```

### 2. Optimize for Quality

If quality isn't high enough:

```typescript
// Increase iterations and threshold
{
  max_iterations: 3,
  quality_threshold: 90
}

// Expected: ~25-35s response time
// Benefit: +35-45% quality gain
```

### 3. Adaptive Configuration

Use different settings based on query type:

```typescript
const getReflectionConfig = (query: string) => {
  // High-stakes queries (interventions, recommendations)
  if (query.match(/intervention|recommend|critical|urgent/i)) {
    return {
      max_iterations: 2,
      quality_threshold: 85
    }
  }

  // Standard queries
  return {
    max_iterations: 1,
    quality_threshold: 75
  }
}
```

## Cost Estimation

### Claude API Costs

Based on Claude Sonnet 4 pricing:

**Per Request (average):**
- Initial critique: ~2000 tokens input + 500 output = $0.006
- Improvement generation: ~3000 input + 2000 output = $0.015
- Re-critique: ~4000 input + 500 output = $0.010

**Total per reflection (2 iterations):** ~$0.031

**Monthly costs (volume-based):**
- 100 queries/day: ~$93/month
- 500 queries/day: ~$465/month
- 1000 queries/day: ~$930/month

**Optimization:**
- Use `mode: "critique_only"` when possible (skip PTD agent call)
- Cache responses for identical queries
- Set `max_iterations: 1` for non-critical queries

## Rollback Procedure

If issues occur:

### Option 1: Quick Rollback (Disable)

```bash
# Delete the function
supabase functions delete ptd-reflect

# Or in Dashboard: Edge Functions → ptd-reflect → Delete
```

### Option 2: Route Around (Frontend)

```typescript
// Feature flag in your app
const USE_REFLECTION = process.env.NEXT_PUBLIC_USE_REFLECTION === 'true'

const getResponse = async (query: string) => {
  if (USE_REFLECTION) {
    // Use reflection agent
    return await supabase.functions.invoke('ptd-reflect', { ... })
  } else {
    // Fallback to base agent
    return await supabase.functions.invoke('ptd-agent', { ... })
  }
}
```

### Option 3: Redeploy Previous Version

```bash
# If using Git for versioning
git checkout previous-commit
supabase functions deploy ptd-reflect
```

## Troubleshooting

### Issue: "ANTHROPIC_API_KEY not configured"

**Solution:**
```bash
# Set the secret
supabase secrets set ANTHROPIC_API_KEY=sk-ant-xxxxx

# Verify
supabase secrets list

# Redeploy function
supabase functions deploy ptd-reflect
```

### Issue: "Claude API timeout"

**Causes:**
- Network issues
- Claude API overload
- Query too complex

**Solutions:**
1. Reduce `max_iterations` to 1
2. Increase timeout in code (currently 45s)
3. Implement retry logic in frontend

### Issue: "PTD agent error: ..."

**Causes:**
- Base PTD agent not deployed
- PTD agent failing

**Solutions:**
1. Test base agent independently
2. Use `mode: "critique_only"` to bypass
3. Check PTD agent logs

### Issue: Low quality gains (<10%)

**Causes:**
- Initial response already high quality
- Critique not identifying issues
- Threshold too low

**Solutions:**
1. Raise quality_threshold to 85-90
2. Increase max_iterations to 3
3. Review critique prompts for specificity

### Issue: High response times (>30s)

**Causes:**
- Too many iterations
- Complex fact verification
- Claude API slowness

**Solutions:**
1. Reduce max_iterations to 1
2. Skip fact verification for speed
3. Use caching for repeated queries

## Gradual Rollout Strategy

### Phase 1: Internal Testing (Week 1)
- Deploy to staging environment
- Test with internal team only
- Gather baseline metrics
- Fix critical bugs

### Phase 2: Beta Users (Week 2-3)
- Enable for 10% of users (feature flag)
- Monitor error rates and quality gains
- Collect user feedback
- Optimize based on usage patterns

### Phase 3: Full Rollout (Week 4+)
- Gradually increase to 50%, then 100%
- Continue monitoring metrics
- A/B test vs base agent
- Iterate on prompts based on data

## Success Metrics

Track these KPIs post-deployment:

| Metric                    | Target       | Alert If      |
|---------------------------|--------------|---------------|
| Average Quality Gain      | +20%         | <10%          |
| Average Final Score       | 85%          | <75%          |
| Average Response Time     | 15s          | >30s          |
| Error Rate                | <2%          | >5%           |
| Fact Check Pass Rate      | >90%         | <80%          |
| Early Stop Rate           | >60%         | <40%          |
| User Satisfaction         | >4.5/5       | <4.0/5        |

## Next Steps After Deployment

1. ✅ Monitor logs for first 24 hours
2. ✅ Collect quality metrics baseline
3. ✅ Gather user feedback on improvements
4. ✅ A/B test against base agent
5. ✅ Optimize prompts based on critique patterns
6. ✅ Implement caching for common queries
7. ✅ Create dashboard for quality metrics
8. ✅ Train team on when to use reflection vs base

## Support & Maintenance

**Ongoing:**
- Review logs weekly for errors
- Monitor API costs vs budget
- Update critique prompts based on feedback
- Retrain on successful patterns

**Quarterly:**
- Benchmark against new Claude models
- Optimize threshold/iteration configs
- Review and update fact verification logic
- Analyze ROI (quality gain vs cost)

---

**Deployment Date:** _____________
**Deployed By:** _____________
**Version:** 1.0.0
**Status:** ☐ Staging  ☐ Production
