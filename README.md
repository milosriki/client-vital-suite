# PTD Fitness Intelligence Platform

A comprehensive client health monitoring and business intelligence platform for PTD Fitness that combines real-time HubSpot data, Meta Conversions API integration, predictive analytics, and automated intervention systems.

## 📖 Documentation

- **[API Keys Configuration Guide](./API_KEYS_GUIDE.md)** - Complete guide for all API keys and environment variables
- **[Product Specification](./PRODUCT_SPEC.md)** - Full product features and architecture
- **[Meta CAPI Best Practices](./META_CAPI_BEST_PRACTICES.md)** - Meta Conversions API implementation guide
- **[PTD Setup Guide](./PTD_SETUP_GUIDE.md)** - Detailed setup instructions

## 🚀 Quick Start

### Prerequisites

- Node.js & npm - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)
- Supabase account - [Sign up](https://supabase.com/)
- HubSpot account with API access
- Meta Business account with Conversions API access

### Installation

```sh
# Step 1: Clone the repository
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory
cd <YOUR_PROJECT_NAME>

# Step 3: Install dependencies
npm install

# Step 4: Configure environment variables
cp .env.example .env
# Edit .env with your Supabase credentials

# Step 5: Start the development server
npm run dev
```

### Backend Server Setup

```sh
# Navigate to backend directory
cd backend

# Install backend dependencies
npm install

# Configure backend environment
cp .env.example .env
# Edit .env with your Meta CAPI credentials

# Start the backend server
node server.js
```

## 🔑 API Keys Required

For the dashboard to work fully, you need to configure:

### Frontend (.env)
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key
- `VITE_SUPABASE_PROJECT_ID` - Supabase project ID

### Backend (backend/.env)
- `FB_PIXEL_ID` - Meta Pixel ID
- `FB_ACCESS_TOKEN` - Meta Conversions API access token

### Supabase Edge Functions (Supabase Dashboard)
- `HUBSPOT_API_KEY` - HubSpot Private App token
- `STAPE_CAPIG_API_KEY` - Stape CAPI Gateway key
- `STRIPE_SECRET_KEY` - Stripe API key
- `ANTHROPIC_API_KEY` - (Optional) Claude AI key

**See [API_KEYS_GUIDE.md](./API_KEYS_GUIDE.md) for complete setup instructions.**

## 🛠️ Tech Stack

- **Frontend**: Vite, TypeScript, React, shadcn-ui, Tailwind CSS
- **Backend**: Supabase (PostgreSQL), Edge Functions (Deno)
- **Integrations**: HubSpot CRM, Meta Conversions API, Stripe

## Project info

**URL**: https://lovable.dev/projects/2849fe86-5874-418c-a421-d4e916c8a052

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/2849fe86-5874-418c-a421-d4e916c8a052) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/2849fe86-5874-418c-a421-d4e916c8a052) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
