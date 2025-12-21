# Client Vital Suite - Agentic Intelligence Platform

Welcome to the **Client Vital Suite** wiki! This is a comprehensive **Agentic AI Platform** for Personal Trainers Dubai (PTD), designed to automate business intelligence, client health tracking, and sales operations.

## Key Features

- **Agentic Core**: 53+ specialized AI agents running on Supabase Edge Functions
- **Live Dashboards**: Real-time React frontend for monitoring business health
- **Facebook Ads Integration**: Live ad spend, ROAS, and performance tracking
- **HubSpot Sync**: Two-way sync for contacts, deals, and activities
- **Stripe Intelligence**: Fraud detection and payout analysis
- **Voice Chat**: Talk directly to your business data using Web Speech API

## Quick Navigation

### Getting Started
- [[Quick-Start]] - Get up and running quickly
- [[Quick-Setup]] - Basic setup instructions
- [[Complete-Setup-Guide]] - Comprehensive setup guide
- [[Deployment-Guide]] - Full deployment instructions

### Architecture & System Design
- [[Architecture-Documentation]] - System architecture overview
- [[Database-Schema]] - Database structure and tables
- [[Data-Flow-Diagrams]] - How data flows through the system
- [[API-Reference]] - API documentation

### AI Agents
- [[Agent-Capabilities]] - What the AI agents can do
- [[Agent-Orchestration]] - How agents work together
- [[AI-System-Explained]] - Deep dive into the AI system
- [[Smart-Agent-Architecture]] - Smart agent design

### Integrations
- [[HubSpot-Master-Guide]] - Complete HubSpot integration guide
- [[Stripe-API-Architecture]] - Stripe integration details
- [[Webhook-Configuration]] - Setting up webhooks
- [[Meta-CAPI-Best-Practices]] - Facebook CAPI integration

### User Guides
- [[User-Guide]] - End user documentation
- [[PTD-User-Guide]] - PTD-specific user guide
- [[UI-Verification-Guide]] - UI testing and verification

### Operations & Maintenance
- [[Environment-Variables]] - Required environment variables
- [[Rollback-Procedures]] - How to rollback changes
- [[Manage-Secrets]] - Secret management guide

## Architecture Overview

### Frontend
- **Framework**: React + Vite + TypeScript
- **UI Library**: Shadcn/ui + Tailwind CSS
- **Hosting**: Vercel

### Backend (Supabase)
- **Database**: PostgreSQL with pgvector for AI memory
- **Edge Functions**: Deno/TypeScript serverless functions
- **Automation**: pg_cron handles all scheduled tasks

## Support

For issues with the AI agents, check the `function_logs` in Supabase.
