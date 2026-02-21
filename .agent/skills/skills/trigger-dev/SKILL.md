---
name: trigger-dev
description: "Trigger.dev expert for background jobs, AI workflows, and reliable async execution with excellent developer experience and TypeScript-first design. Use when: trigger.dev, trigger dev, background task, ai background job, long running task."
source: vibeship-spawner-skills (Apache 2.0)
---

# Trigger.dev Integration

You are a Trigger.dev expert who builds reliable background jobs with
exceptional developer experience. You understand that Trigger.dev bridges
the gap between simple queues and complex orchestration - it's "Temporal
made easy" for TypeScript developers.

You've built AI pipelines that process for minutes, integration workflows
that sync across dozens of services, and batch jobs that handle millions
of records. You know the power of built-in integrations and the importance
of proper task design.

## Capabilities

- trigger-dev-tasks
- ai-background-jobs
- integration-tasks
- scheduled-triggers
- webhook-handlers
- long-running-tasks
- task-queues
- batch-processing

## Patterns

### Basic Task Setup

Setting up Trigger.dev in a Next.js project

```typescript
import { task } from "@trigger.dev/sdk/v3";

export const helloWorldTask = task({
  id: "hello-world",
  // Set max duration to prevent runaway tasks
  maxDuration: 300, // 5 minutes
  run: async (payload: { name: string }, { ctx }) => {
    console.log(`Executing task for ${payload.name}`);
    
    // Do some work
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    return {
      message: `Hello ${payload.name}!`,
      completedAt: new Date().toISOString(),
    };
  },
});
```

### AI Task with OpenAI Integration

Using built-in OpenAI integration with automatic retries

```typescript
import { task } from "@trigger.dev/sdk/v3";
import { openai } from "@trigger.dev/openai";

export const generateContentTask = task({
  id: "generate-content",
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 10000,
  },
  run: async (payload: { prompt: string }) => {
    // The openai integration automatically handles rate limits and retries
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: payload.prompt }
      ],
    });

    return {
      content: response.choices[0]?.message?.content,
      usage: response.usage,
    };
  },
});
```

### Scheduled Task with Cron

Tasks that run on a schedule

```typescript
import { schedules } from "@trigger.dev/sdk/v3";

export const dailyReportTask = schedules.task({
  id: "daily-report",
  cron: "0 9 * * *", // Every day at 9:00 AM
  run: async (payload, { ctx }) => {
    console.log(`Running daily report for ${ctx.schedule.id}`);
    
    // Fetch data, generate report, send email...
    
    return { success: true };
  },
});
```

## Anti-Patterns

### ❌ Giant Monolithic Tasks

Don't put all your logic in a single massive task. It makes it hard to retry specific parts and debug failures.

```typescript
// ❌ BAD: Monolithic task
export const processOrder = task({
  id: "process-order",
  run: async (payload) => {
    await chargeCustomer(payload);
    await updateInventory(payload);
    await sendEmail(payload);
    await notifySlack(payload);
  }
});

// ✅ GOOD: Break into smaller tasks or use batchTrigger
export const processOrder = task({
  id: "process-order",
  run: async (payload) => {
    await chargeCustomer(payload);
    // Trigger subsequent tasks
    await updateInventoryTask.trigger(payload);
    await sendEmailTask.trigger(payload);
  }
});
```

### ❌ Ignoring Built-in Integrations

Don't write custom fetch wrappers for services that Trigger.dev already supports.

```typescript
// ❌ BAD: Custom fetch for OpenAI
const response = await fetch("https://api.openai.com/v1/chat/completions", { ... });

// ✅ GOOD: Use the official integration
import { openai } from "@trigger.dev/openai";
const response = await openai.chat.completions.create({ ... });
```

### ❌ No Logging

Don't rely on `console.log` alone. Use the logger provided by Trigger.dev for better observability.

```typescript
import { logger, task } from "@trigger.dev/sdk/v3";

export const myTask = task({
  id: "my-task",
  run: async (payload) => {
    // ✅ GOOD: Structured logging
    logger.info("Starting task", { payload });
    
    try {
      // ...
    } catch (error) {
      logger.error("Task failed", { error });
      throw error;
    }
  }
});
```

## ⚠️ Sharp Edges

| Issue | Severity | Solution |
|-------|----------|----------|
| Task timeout kills execution without clear error | critical | Configure explicit timeouts: `maxDuration: 300` |
| Non-serializable payload causes silent task failure | critical | Always use plain objects: `JSON.parse(JSON.stringify(data))` |
| Environment variables not synced to Trigger.dev cloud | critical | Sync env vars to Trigger.dev: `npx trigger.dev@latest env pull` |
| SDK version mismatch between CLI and package | high | Always update together: `npm i @trigger.dev/sdk@latest` |
| Task retries cause duplicate side effects | high | Use idempotency keys: `idempotencyKey: payload.id` |
| High concurrency overwhelms downstream services | high | Set queue concurrency limits: `queue: { concurrencyLimit: 5 }` |
| trigger.config.ts not at project root | high | Config must be at package root: Move `trigger.config.ts` to root |
| wait.for in loops causes memory issues | medium | Batch instead of individual waits: Use `batchTrigger` |

## Related Skills

Works well with: `nextjs-app-router`, `vercel-deployment`, `ai-agents-architect`, `llm-architect`, `email-systems`, `stripe-integration`
