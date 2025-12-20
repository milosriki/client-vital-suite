# 🌐 Global Memory Usage Guide

**Global memory is shared across ALL devices/browsers** - perfect for in-house programs!

---

## 🚀 Quick Start

### Import Global Memory Functions
```typescript
import {
  storeGlobalMemory,
  getGlobalMemory,
  deleteGlobalMemory
} from '@/lib/serverMemory';
```

---

## 📝 Basic Usage

### Store Global Memory (All Devices Can Access)
```typescript
// Store data that all devices can see
await storeGlobalMemory('company_settings', {
  theme: 'dark',
  language: 'en',
  timezone: 'Asia/Dubai'
}, {
  type: 'config',
  expires_in: 365 * 24 * 60 * 60 // 1 year
});
```

### Get Global Memory
```typescript
// Any device can read this
const settings = await getGlobalMemory('company_settings');
console.log(settings[0].memory_value);
// { theme: 'dark', language: 'en', timezone: 'Asia/Dubai' }
```

### Delete Global Memory
```typescript
await deleteGlobalMemory('company_settings');
```

---

## 💡 Use Cases

### 1. Shared Configuration
```typescript
// Store company-wide settings
await storeGlobalMemory('app_config', {
  maintenance_mode: false,
  feature_flags: {
    new_dashboard: true,
    beta_features: false
  }
});
```

### 2. Shared Cache
```typescript
// Cache data for all devices (expires in 1 hour)
await storeGlobalMemory('api_cache', {
  last_updated: new Date().toISOString(),
  data: { /* cached data */ }
}, {
  type: 'cache',
  expires_in: 3600 // 1 hour
});
```

### 3. Cross-Device State
```typescript
// Track state that all devices share
await storeGlobalMemory('system_status', {
  last_sync: new Date().toISOString(),
  active_users: 42,
  server_load: 0.65
});
```

---

## 🔄 Comparison: Global vs Session Memory

| Feature | Global Memory | Session Memory |
|---------|--------------|----------------|
| **Scope** | All devices/browsers | Single browser session |
| **Use Case** | Company settings, shared cache | User preferences, conversation history |
| **Function** | `storeGlobalMemory()` | `storeMemory(sessionId, ...)` |
| **Table** | `global_memory` | `server_memory` |

---

## 📊 API Examples

### Store Global Memory
```bash
curl -X POST https://client-vital-suite.vercel.app/api/memory \
  -H "Content-Type: application/json" \
  -d '{
    "global": true,
    "key": "company_settings",
    "value": {"theme": "dark"},
    "type": "config"
  }'
```

### Get Global Memory
```bash
curl "https://client-vital-suite.vercel.app/api/memory?global=true&key=company_settings"
```

### Delete Global Memory
```bash
curl -X DELETE "https://client-vital-suite.vercel.app/api/memory?global=true&key=company_settings"
```

---

## ✅ Example: Full Workflow

```typescript
import { storeGlobalMemory, getGlobalMemory } from '@/lib/serverMemory';

// Device 1: Store global config
await storeGlobalMemory('shared_config', {
  company_name: 'PTD Fitness',
  default_language: 'en',
  features: ['dashboard', 'analytics']
});

// Device 2: Read the same config (different browser/device)
const config = await getGlobalMemory('shared_config');
console.log(config[0].memory_value);
// { company_name: 'PTD Fitness', default_language: 'en', ... }

// Device 3: Update the config
await storeGlobalMemory('shared_config', {
  company_name: 'PTD Fitness',
  default_language: 'ar', // Changed!
  features: ['dashboard', 'analytics', 'new_feature'] // Added!
});
// Now all devices see the updated config
```

---

## 🔒 Security Note

**Current**: RLS disabled on `global_memory` table (in-house use)  
**Later**: Can add authentication/authorization when needed

---

## 🎯 Key Points

1. ✅ **Global memory works NOW** - No security restrictions
2. ✅ **Shared across ALL devices** - Perfect for in-house programs
3. ✅ **Persistent** - Survives browser refresh/close
4. ✅ **Easy to use** - Simple API functions
5. ✅ **Type-safe** - Full TypeScript support

---

## 📚 Full API Reference

See `src/lib/serverMemory.ts` for complete function signatures and types.

