# 🧪 AUDIT EXAMPLES: Common Errors & Fixes

This document provides concrete examples of common issues found during code audits and how to fix them.

---

## 1. UI: Unhandled Async Click Error

**❌ BAD:**
```tsx
const handleClick = async () => {
  setLoading(true);
  await apiCall(); // If this fails, loading stays true forever!
  setLoading(false);
};
```

**✅ GOOD:**
```tsx
const handleClick = async () => {
  setLoading(true);
  try {
    await apiCall();
    toast.success("Done!");
  } catch (error) {
    console.error(error);
    toast.error("Failed to execute action.");
  } finally {
    setLoading(false); // Spinner stops even on error
  }
};
```

---

## 2. API: Silent JSON Parse Failure

**❌ BAD:**
```typescript
// If response is not JSON (e.g. 500 HTML error), this crashes
const data = await response.json(); 
```

**✅ GOOD:**
```typescript
const text = await response.text();
let data;
try {
  data = JSON.parse(text);
} catch {
  // Handle non-JSON response gracefully
  throw new Error(`Invalid server response: ${text.slice(0, 100)}`);
}
```

---

## 3. Database: Mismatched Enum Constraint

**❌ BAD:**
*Database:* `CHECK (agent_type IN ('analyst', 'advisor'))`
*Code:* `agent_type: 'smart_agent'`

**Result:** `new row for relation "agent_context" violates check constraint`

**✅ GOOD:**
Ensure code constants match DB constraints exactly.
```typescript
// Code
const AGENT_TYPE = 'analyst'; 

// Database Migration
ALTER TABLE agent_context 
ADD CONSTRAINT agent_type_check 
CHECK (agent_type IN ('analyst', 'advisor', 'watcher'));
```

---

## 4. Edge Function: Missing Headers

**❌ BAD:**
```typescript
// Proxying to Supabase Edge Function
fetch('https://.../functions/v1/my-func', {
  method: 'POST',
  body: JSON.stringify(payload) 
  // Missing Authorization! 401 Unauthorized
})
```

**✅ GOOD:**
```typescript
fetch('https://.../functions/v1/my-func', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    // Some functions also need apikey
    'apikey': SUPABASE_ANON_KEY 
  },
  body: JSON.stringify(payload)
})
```

---

## 5. React: Stale Closure / Missing Dependency

**❌ BAD:**
```tsx
useEffect(() => {
  const timer = setInterval(() => {
    console.log(count); // 'count' is always initial value (0)
  }, 1000);
  return () => clearInterval(timer);
}, []); // Missing 'count' dependency
```

**✅ GOOD:**
```tsx
useEffect(() => {
  const timer = setInterval(() => {
    // Use functional update or include dependency
    setCount(c => c + 1); 
  }, 1000);
  return () => clearInterval(timer);
}, []); 
```

---

## 6. Security: Leaking Secrets in Logs

**❌ BAD:**
```typescript
console.log("Environment vars:", process.env); 
// Dumps OPENAI_API_KEY, DB URLs, etc. to Vercel logs!
```

**✅ GOOD:**
```typescript
console.log("Environment check:", {
  hasOpenAI: !!process.env.OPENAI_API_KEY,
  hasDbUrl: !!process.env.DATABASE_URL
});
```

---

## 7. Performance: Unbounded List Rendering

**❌ BAD:**
```tsx
// Renders 10,000 items at once -> Browser freezes
{allItems.map(item => <ListItem item={item} />)}
```

**✅ GOOD:**
Use virtualization or pagination.
```tsx
// Pagination
{visibleItems.map(item => <ListItem key={item.id} item={item} />)}
<Button onClick={loadMore}>Load More</Button>
```

