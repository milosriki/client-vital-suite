# PTD Reflection Agent - Frontend Integration Guide

How to integrate the PTD Reflection Agent into your React/Next.js application.

## Installation

No additional dependencies needed! Uses the existing Supabase client.

## Basic Setup

### 1. Create a Reflection Hook

```typescript
// hooks/useReflectionAgent.ts
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

interface ReflectionOptions {
  mode?: 'full' | 'critique_only'
  maxIterations?: number
  qualityThreshold?: number
}

export function useReflectionAgent() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<Error | null>(null)

  const reflect = async (
    query: string,
    context: any = {},
    options: ReflectionOptions = {}
  ) => {
    setLoading(true)
    setError(null)

    try {
      const { data, error: invokeError } = await supabase.functions.invoke(
        'ptd-reflect',
        {
          body: {
            mode: options.mode || 'full',
            query,
            context,
            max_iterations: options.maxIterations || 2,
            quality_threshold: options.qualityThreshold || 80
          }
        }
      )

      if (invokeError) throw invokeError

      setResult(data)
      return data
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error')
      setError(error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  return { reflect, loading, result, error }
}
```

### 2. Use in Component

```typescript
// components/SmartClientAnalysis.tsx
import { useReflectionAgent } from '@/hooks/useReflectionAgent'

export function SmartClientAnalysis({ clientEmail }: { clientEmail: string }) {
  const { reflect, loading, result } = useReflectionAgent()

  const analyzeClient = async () => {
    const data = await reflect(
      `Analyze ${clientEmail} and recommend intervention strategy`,
      { client_email: clientEmail },
      { qualityThreshold: 85 }
    )

    console.log('Quality Improvement:', `+${data.total_quality_gain}%`)
  }

  return (
    <div>
      <button onClick={analyzeClient} disabled={loading}>
        {loading ? 'Analyzing...' : 'Smart Analysis'}
      </button>

      {result && (
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm text-gray-500">
              Quality Score: {result.metadata.final_score}%
            </span>
            {result.total_quality_gain > 0 && (
              <span className="text-xs text-green-600">
                (+{result.total_quality_gain}% improvement)
              </span>
            )}
          </div>

          <div className="prose">
            {result.final_response}
          </div>

          {/* Show fact checks */}
          {result.fact_checks.length > 0 && (
            <div className="mt-4 text-sm">
              <h4 className="font-semibold">Fact Checks:</h4>
              {result.fact_checks.map((fc: any, i: number) => (
                <div key={i} className="flex items-start gap-2">
                  <span>{fc.verified ? '✅' : '❌'}</span>
                  <span>{fc.claim} ({fc.confidence}%)</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

## Advanced Integration Patterns

### Pattern 1: Progressive Enhancement

Show initial response immediately, then upgrade with reflection:

```typescript
export function ProgressiveSmartChat() {
  const [messages, setMessages] = useState<any[]>([])
  const { reflect } = useReflectionAgent()

  const sendMessage = async (query: string) => {
    // 1. Get fast initial response from base PTD agent
    const { data: initialData } = await supabase.functions.invoke('ptd-agent', {
      body: { query, session_id: 'chat_123' }
    })

    const messageId = Date.now()

    // 2. Show initial response immediately (fast!)
    setMessages(prev => [...prev, {
      id: messageId,
      query,
      response: initialData.response,
      quality: 'initial',
      loading: true
    }])

    // 3. Upgrade with reflection (slower but better)
    const reflectionData = await reflect(
      query,
      { session_id: 'chat_123' },
      { mode: 'critique_only', initial_response: initialData.response }
    )

    // 4. Replace with improved version
    setMessages(prev => prev.map(m =>
      m.id === messageId
        ? {
            ...m,
            response: reflectionData.final_response,
            quality: 'reflected',
            qualityScore: reflectionData.metadata.final_score,
            qualityGain: reflectionData.total_quality_gain,
            loading: false
          }
        : m
    ))
  }

  return (
    <div>
      {messages.map(msg => (
        <div key={msg.id} className="relative">
          {msg.loading && (
            <div className="absolute top-0 right-0 text-xs text-blue-500">
              Improving response...
            </div>
          )}

          <div className={msg.quality === 'reflected' ? 'border-l-4 border-green-500 pl-4' : ''}>
            {msg.response}
          </div>

          {msg.qualityGain > 0 && (
            <div className="text-xs text-green-600 mt-1">
              ✨ Improved by {msg.qualityGain}%
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
```

### Pattern 2: Quality-Gated Responses

Only show reflection for high-stakes queries:

```typescript
const CRITICAL_QUERIES = [
  'intervention',
  'recommend',
  'action plan',
  'critical',
  'urgent'
]

function shouldUseReflection(query: string): boolean {
  return CRITICAL_QUERIES.some(keyword =>
    query.toLowerCase().includes(keyword)
  )
}

export function SmartGatedChat() {
  const sendMessage = async (query: string) => {
    if (shouldUseReflection(query)) {
      // High-stakes: Use reflection (slower but better)
      return await supabase.functions.invoke('ptd-reflect', {
        body: { mode: 'full', query }
      })
    } else {
      // Simple query: Use base agent (faster)
      return await supabase.functions.invoke('ptd-agent', {
        body: { query }
      })
    }
  }

  // ... render
}
```

### Pattern 3: A/B Testing

Compare base agent vs reflection agent:

```typescript
export function ABTestReflection() {
  const [variant, setVariant] = useState<'base' | 'reflect'>(
    Math.random() > 0.5 ? 'base' : 'reflect'
  )

  const sendMessage = async (query: string) => {
    const startTime = Date.now()

    const endpoint = variant === 'reflect' ? 'ptd-reflect' : 'ptd-agent'
    const body = variant === 'reflect'
      ? { mode: 'full', query }
      : { query, session_id: 'test' }

    const { data } = await supabase.functions.invoke(endpoint, { body })

    const responseTime = Date.now() - startTime

    // Log to analytics
    logEvent('chat_response', {
      variant,
      query_length: query.length,
      response_time_ms: responseTime,
      quality_score: data.metadata?.final_score || null,
      quality_gain: data.total_quality_gain || null
    })

    return data
  }

  // ... render
}
```

### Pattern 4: Quality Dashboard

Show real-time quality metrics:

```typescript
export function QualityDashboard() {
  const [metrics, setMetrics] = useState({
    avgQualityGain: 0,
    avgFinalScore: 0,
    avgResponseTime: 0,
    totalQueries: 0
  })

  const { reflect } = useReflectionAgent()

  const trackQuery = async (query: string) => {
    const result = await reflect(query, {})

    setMetrics(prev => {
      const total = prev.totalQueries + 1
      return {
        avgQualityGain: (prev.avgQualityGain * prev.totalQueries + result.total_quality_gain) / total,
        avgFinalScore: (prev.avgFinalScore * prev.totalQueries + result.metadata.final_score) / total,
        avgResponseTime: (prev.avgResponseTime * prev.totalQueries + result.metadata.total_time_ms) / total,
        totalQueries: total
      }
    })
  }

  return (
    <div className="grid grid-cols-4 gap-4">
      <MetricCard
        label="Avg Quality Gain"
        value={`+${Math.round(metrics.avgQualityGain)}%`}
        trend="up"
      />
      <MetricCard
        label="Avg Final Score"
        value={`${Math.round(metrics.avgFinalScore)}%`}
      />
      <MetricCard
        label="Avg Response Time"
        value={`${Math.round(metrics.avgResponseTime / 1000)}s`}
      />
      <MetricCard
        label="Total Queries"
        value={metrics.totalQueries}
      />
    </div>
  )
}
```

## UI Components

### Quality Badge

```typescript
export function QualityBadge({ score }: { score: number }) {
  const color = score >= 90 ? 'green' : score >= 80 ? 'blue' : score >= 70 ? 'yellow' : 'red'

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-${color}-100 text-${color}-800`}>
      {score}% Quality
    </span>
  )
}
```

### Improvement Indicator

```typescript
export function ImprovementIndicator({ gain }: { gain: number }) {
  if (gain <= 0) return null

  return (
    <div className="flex items-center gap-1 text-sm text-green-600">
      <ArrowUpIcon className="w-4 h-4" />
      <span>+{gain}% improved</span>
    </div>
  )
}
```

### Critique Breakdown

```typescript
export function CritiqueBreakdown({ critique }: { critique: any }) {
  const dimensions = [
    { label: 'Completeness', value: critique.completeness, color: 'blue' },
    { label: 'Accuracy', value: critique.accuracy, color: 'green' },
    { label: 'Actionability', value: critique.actionability, color: 'purple' },
    { label: 'Confidence', value: critique.confidence, color: 'orange' }
  ]

  return (
    <div className="space-y-2">
      {dimensions.map(dim => (
        <div key={dim.label} className="flex items-center gap-2">
          <span className="text-sm w-24">{dim.label}</span>
          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full bg-${dim.color}-500`}
              style={{ width: `${dim.value}%` }}
            />
          </div>
          <span className="text-sm font-medium w-12 text-right">{dim.value}%</span>
        </div>
      ))}
    </div>
  )
}
```

## Performance Optimization

### Caching

```typescript
const responseCache = new Map<string, any>()

export function useCachedReflection() {
  const { reflect } = useReflectionAgent()

  const cachedReflect = async (query: string, context: any = {}) => {
    const cacheKey = `${query}:${JSON.stringify(context)}`

    if (responseCache.has(cacheKey)) {
      console.log('Cache hit!')
      return responseCache.get(cacheKey)
    }

    const result = await reflect(query, context)

    responseCache.set(cacheKey, result)

    // Clear cache after 5 minutes
    setTimeout(() => responseCache.delete(cacheKey), 5 * 60 * 1000)

    return result
  }

  return { reflect: cachedReflect }
}
```

### Debouncing

```typescript
import { useMemo } from 'react'
import debounce from 'lodash/debounce'

export function useDebouncedReflection() {
  const { reflect } = useReflectionAgent()

  const debouncedReflect = useMemo(
    () => debounce(reflect, 1000), // Wait 1s after typing stops
    [reflect]
  )

  return { reflect: debouncedReflect }
}
```

### Background Refresh

```typescript
export function useBackgroundReflection() {
  const [response, setResponse] = useState<string>('')
  const [quality, setQuality] = useState<number>(0)

  useEffect(() => {
    const interval = setInterval(async () => {
      // Re-reflect periodically to catch new data
      const result = await supabase.functions.invoke('ptd-reflect', {
        body: {
          mode: 'critique_only',
          query: 'Current query',
          initial_response: response
        }
      })

      if (result.data.metadata.final_score > quality) {
        setResponse(result.data.final_response)
        setQuality(result.data.metadata.final_score)
      }
    }, 60000) // Every minute

    return () => clearInterval(interval)
  }, [response, quality])

  return { response, quality }
}
```

## Error Handling

```typescript
export function ReflectionWithErrorBoundary() {
  const { reflect, loading, error } = useReflectionAgent()
  const [retryCount, setRetryCount] = useState(0)

  const handleReflect = async (query: string) => {
    try {
      await reflect(query)
      setRetryCount(0)
    } catch (err) {
      console.error('Reflection failed:', err)

      // Auto-retry up to 3 times
      if (retryCount < 3) {
        console.log(`Retrying... (${retryCount + 1}/3)`)
        setRetryCount(prev => prev + 1)
        setTimeout(() => handleReflect(query), 2000 * (retryCount + 1))
      }
    }
  }

  if (error && retryCount >= 3) {
    return (
      <ErrorFallback
        error={error}
        onRetry={() => {
          setRetryCount(0)
          handleReflect('last query')
        }}
      />
    )
  }

  // ... render
}
```

## Analytics Integration

```typescript
import { track } from '@/lib/analytics'

export function trackReflectionMetrics(result: any, query: string) {
  track('reflection_completed', {
    query_length: query.length,
    initial_score: result.metadata.initial_score,
    final_score: result.metadata.final_score,
    quality_gain: result.total_quality_gain,
    iterations: result.iterations,
    response_time_ms: result.metadata.total_time_ms,
    fact_checks_passed: result.fact_checks.filter((fc: any) => fc.verified).length,
    fact_checks_failed: result.fact_checks.filter((fc: any) => !fc.verified).length
  })
}
```

## Best Practices

### ✅ DO

- Use reflection for high-stakes decisions (interventions, recommendations)
- Show quality metrics to users to build trust
- Cache responses to avoid re-processing
- Track quality gains to measure impact
- Set appropriate thresholds (80% for most cases)

### ❌ DON'T

- Use reflection for simple lookups (overkill)
- Set quality_threshold above 95% (may never finish)
- Run reflection in tight loops (rate limits!)
- Ignore error states (always handle timeouts)
- Skip fact verification display (transparency matters)

## Next Steps

1. Add reflection to critical user flows
2. A/B test base vs reflection agent
3. Monitor quality metrics in production
4. Tune thresholds based on user feedback
5. Create specialized reflection prompts for different use cases

## Support

For issues or questions:
- Check function logs: `supabase functions logs ptd-reflect --tail`
- Review critique results to understand quality issues
- Adjust `max_iterations` and `quality_threshold` as needed
