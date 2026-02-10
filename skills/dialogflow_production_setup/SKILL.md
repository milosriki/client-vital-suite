---
name: Dialogflow Production Standard (Master Skill)
description: The complete enterprise standard for creating, deploying, and maintaining Dialogflow agents. Features IaC, CI/CD, and Generative AI patterns.
version: 2.0.0 (Maximized)
---

# Dialogflow Production Standard (Master Skill)

This skill is the **Single Source of Truth** for detailed, production-grade Dialogflow implementation. It integrates Infrastructure as Code (Terraform), robust Fulfillment patterns (Node.js), and automated testing (Botium).

## 🗂️ Skill Resources

| Resource           | Path                                                      | Description                                 |
| :----------------- | :-------------------------------------------------------- | :------------------------------------------ |
| **Infrastructure** | `skills/dialogflow_production_setup/terraform/main.tf`    | Terraform for scalable CX Agent setup.      |
| **Fulfillment**    | `skills/dialogflow_production_setup/fulfillment/index.ts` | The "5-Second Rule" fail-fast code pattern. |
| **Testing**        | `skills/dialogflow_production_setup/testing/botium.json`  | Automated conversation testing config.      |

---

## 1. Platform & Generative AI Strategy

**Decision Matrix**:

- **Use Dialogflow CX** for: "Persona" needs, Generators, visual flows, and enterprise scale.
- **Use Dialogflow ES** for: Legacy systems or simple command-response.

**Using Generators (The "Console Persona"):**
Instead of hardcoding text, use the Console's Generator feature with this prompt structure:

> "You are [Persona Name]. Your tone is [Adjective]. The user goal is [Goal]. Keep responses under [Length]."

## 2. The 5-Second Rule (Fulfillment)

Your webhook MUST respond in < 5 seconds.
**Protocol**:

1.  **Fail-Fast**: DB lookups have a 1.5s hard timeout.
2.  **Async**: Use `EdgeRuntime.waitUntil` (Supabase) or Cloud Tasks for CRM syncs.
3.  **Fallback**: Return a generic "friendly" response if DB fails, never crash.

> **See `fulfillment/index.ts` for the verified code pattern.**

## 3. DevOps & CI/CD

**Do not edit in Console manually for Production.**

**Workflow**:

1.  **Dev**: Edit in "Dev Agent" Console. Export JSON.
2.  **PR**: Commit JSON to Git.
3.  **Test**: CI runs `botium-cli run` against Staging.
4.  **Deploy**: Terraform applies the JSON to Production Agent.

> **See `terraform/main.tf` for the Infrastructure definition.**
