# Fix: "image media type is required" Error

## Problem
The application was experiencing a 400 error from OpenAI-compatible API endpoints:
```
Request Failed: 400 {"error":{"message":"image media type is required","code":"invalid_request_body"}}
```

Request ID: `09fb35a5-beea-4ea2-b7d1-4360115934f9`

## Root Cause
This error occurs when using OpenAI-compatible chat completion endpoints (such as Gemini's OpenAI-compatible endpoint at `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`) when message content fields are not properly formatted.

Specifically, the error is triggered when:
1. **Assistant messages with tool_calls** have `content: null` instead of an empty string
2. **Tool role messages** have empty or null content strings
3. Message content is structured as an array/object without proper type information

## Files Fixed
1. `supabase/functions/ptd-agent-gemini/index.ts`
2. `supabase/functions/smart-agent/index.ts`

## Changes Made

### 1. Assistant Message Content Fix
**Before:**
```typescript
messages.push({
  role: "assistant",
  content: message.content || null,  // ❌ null can cause error
  tool_calls: toolCalls
});
```

**After:**
```typescript
messages.push({
  role: "assistant",
  content: message.content || "",  // ✅ Empty string is safe
  tool_calls: toolCalls
});
```

### 2. Tool Result Content Fix
**Before:**
```typescript
return {
  role: "tool",
  tool_call_id: toolCall.id,
  content: result,  // ❌ Could be empty/whitespace
};
```

**After:**
```typescript
// Ensure content is always a non-empty string
const content = result && result.trim() ? result : "No data returned";
return {
  role: "tool",
  tool_call_id: toolCall.id,
  content: content,  // ✅ Always non-empty
};
```

## Why This Works
OpenAI's chat completion API (and compatible implementations) expect:
- Content in text messages should be a string type
- When content is null or empty in certain contexts (especially with tool calls), some implementations interpret this as multimodal content and expect proper type annotations
- By ensuring content is always a non-empty string, we avoid triggering the multimodal content validation path

## Testing
Verified that:
- ✅ Empty string results are replaced with "No data returned"
- ✅ Whitespace-only results are treated as empty
- ✅ Valid results pass through unchanged
- ✅ Null assistant content becomes empty string
- ✅ TypeScript syntax is correct

## Related Documentation
- OpenAI Chat Completions API: https://platform.openai.com/docs/api-reference/chat/create
- Tool/Function Calling: https://platform.openai.com/docs/guides/function-calling
- Google Gemini OpenAI Compatibility: https://ai.google.dev/gemini-api/docs/openai

## Future Considerations
Any new agent functions or modifications to existing agents should ensure:
1. All message content fields are strings (not null or undefined)
2. Tool result content is non-empty
3. Assistant message content with tool_calls uses empty string instead of null
