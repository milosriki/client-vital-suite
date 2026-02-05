---
name: elite-sales-booking
description: >
  An advanced, stage-aware sales skill that uses Neuro-Emotional Persuasion Questioning (NEPQ)
  to guide high-ticket fitness leads from "Curiosity" to "Booking".
  It replaces stateless intent matching with a persistent Sales State Machine.
---

# Elite Sales Booking Skill (NEPQ Edition)

## Purpose

To transform the agent from a "reactive answering machine" into a "proactive consultant" that leads the conversation. It uses a **Stage-Aware** state machine to ensure the agent always knows _where_ it is in the sale.

## The Framework: NEPQ (Neuro-Emotional Persuasion Questioning)

This skill enforces a STRICT questioning sequence:

1.  **Connection**: Why are you here? (Build Rapport)
2.  **Situation**: What is your current state? (Gap Analysis)
3.  **Problem Awareness**: How does that feel? (Emotional Anchor)
4.  **Solution Awareness**: What do you want instead? (Future Pacing)
5.  **Consequence**: What happens if you don't change? (Urgency)
6.  **Close**: Book the call.

## Integration Guide

(See `scripts/install_skill.ts` for automated setup)

1.  **State Tracking**: Must store `sales_stage` in HubSpot `conversation_state` property.
2.  **Context Injection**: The current stage's "Goal" must be injected into the System Prompt.
3.  **Guardrails**: Never move to Stage N+1 until Stage N criteria are met.

## Usage

When this skill is active, the Orchestrator should:

1.  Read `current_stage` from Database/HubSpot.
2.  Retrieve the specific prompt for that stage from `sales_stages.json`.
3.  Process user input against the _Goal_ of the current stage.
4.  Update stage if Goal is met.
