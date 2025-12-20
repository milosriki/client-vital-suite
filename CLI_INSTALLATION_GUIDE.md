# 🛠️ CLI Installation Guide for Claude/Browser/Agent

**Complete setup for interacting with your PTD system via CLI**

---

## 1. Install Required CLI Tools

### macOS (Terminal)

```bash
# Install Homebrew (if not installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js & npm
brew install node

# Install Vercel CLI
npm install -g vercel

# Install Supabase CLI
brew install supabase/tap/supabase

# Install jq (JSON processor)
brew install jq

# Install curl (usually pre-installed)
brew install curl
```

### Windows (PowerShell as Admin)

```powershell
# Install Chocolatey (if not installed)
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Install Node.js
choco install nodejs

# Install Vercel CLI
npm install -g vercel

# Install Supabase CLI
choco install supabase

# Install jq
choco install jq

# Install curl
choco install curl
```

### Linux (Ubuntu/Debian)

```bash
# Update packages
sudo apt update

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Vercel CLI
npm install -g vercel

# Install Supabase CLI
brew install supabase/tap/supabase
# OR via npm:
npm install -g supabase

# Install jq
sudo apt install jq

# Install curl
sudo apt install curl
```

---

## 2. Login to Services

### Vercel Login

```bash
vercel login
# Follow the browser prompt to authenticate
```

### Supabase Login

```bash
supabase login
# Follow the browser prompt to authenticate
```

---

## 3. Set Environment Variables

Create a `.env` file or export these:

```bash
# Your Supabase project
export SUPABASE_URL="https://ztjndilxurtsfqdsvfds.supabase.co"
export SUPABASE_ANON_KEY="your-anon-key"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# API Base URL
export API_BASE="https://client-vital-suite.vercel.app"
```

Or add to your shell profile (`~/.zshrc` or `~/.bashrc`):

```bash
echo 'export API_BASE="https://client-vital-suite.vercel.app"' >> ~/.zshrc
source ~/.zshrc
```

---

## 4. CLI Commands for Your System

### 🤖 Talk to Claude Agent

```bash
# Simple query
curl -X POST "$API_BASE/api/agent" \
  -H "Content-Type: application/json" \
  -d '{"message": "What clients are at risk of churning?"}' | jq

# With thread ID (conversation memory)
curl -X POST "$API_BASE/api/agent" \
  -H "Content-Type: application/json" \
  -d '{"message": "Tell me more about the top one", "thread_id": "my-conversation-1"}' | jq
```

### 🔍 Query Truth API (Data with Citations)

```bash
# Query health data
curl "$API_BASE/api/truth?query=show%20red%20zone%20clients" | jq

# Query ROI data
curl "$API_BASE/api/truth?query=ROI%20of%20Facebook%20campaigns" | jq

# Query specific email
curl "$API_BASE/api/truth?query=contact%20info&email=client@example.com" | jq

# POST with more options
curl -X POST "$API_BASE/api/truth" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Show me all deals closed this month",
    "limit": 100,
    "sources": ["deals", "contacts"]
  }' | jq
```

### 💾 Global Memory (Org-Wide)

```bash
# Store global memory
curl -X POST "$API_BASE/api/memory?global=true" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "company_goal_q1",
    "value": {"target": "100 new clients", "revenue": "$500k"},
    "type": "config"
  }' | jq

# Get global memory
curl "$API_BASE/api/memory?key=company_goal_q1&global=true" | jq

# Delete global memory
curl -X DELETE "$API_BASE/api/memory?key=company_goal_q1&global=true" | jq
```

### 🏢 Workspace Management

```bash
# Get workspace
curl "$API_BASE/api/workspace" | jq

# Update workspace
curl -X POST "$API_BASE/api/workspace" \
  -H "Content-Type: application/json" \
  -d '{
    "workspace_id": "default",
    "name": "PTD Fitness HQ",
    "access_level": "open"
  }' | jq
```

### 🔐 Session Management

```bash
# Create/get session
curl -X POST "$API_BASE/api/session" \
  -H "Content-Type: application/json" \
  -d '{"device_id": "my-macbook"}' | jq
```

### ✅ System Health Check

```bash
# Check all connections
curl "$API_BASE/api/system-check" | jq
```

---

## 5. Create Shell Aliases (Quick Commands)

Add to your `~/.zshrc` or `~/.bashrc`:

```bash
# PTD System Aliases
export PTD_API="https://client-vital-suite.vercel.app"

# Ask Claude agent
ptd-ask() {
  curl -s -X POST "$PTD_API/api/agent" \
    -H "Content-Type: application/json" \
    -d "{\"message\": \"$1\"}" | jq -r '.response // .error'
}

# Query truth
ptd-truth() {
  curl -s "$PTD_API/api/truth?query=$(echo $1 | sed 's/ /%20/g')" | jq
}

# Get red zone clients
ptd-redzone() {
  curl -s "$PTD_API/api/truth?query=red%20zone%20clients" | jq '.data.health_scores'
}

# Store global memory
ptd-remember() {
  curl -s -X POST "$PTD_API/api/memory?global=true" \
    -H "Content-Type: application/json" \
    -d "{\"key\": \"$1\", \"value\": \"$2\", \"type\": \"shared\"}" | jq
}

# Get global memory
ptd-recall() {
  curl -s "$PTD_API/api/memory?key=$1&global=true" | jq '.memory'
}

# System check
ptd-status() {
  curl -s "$PTD_API/api/system-check" | jq '{status: .status, env: .env.required, supabase: .supabase}'
}
```

Then reload:

```bash
source ~/.zshrc
```

### Usage after aliases:

```bash
# Ask Claude
ptd-ask "What clients are at risk?"

# Query truth
ptd-truth "show me ROI data"

# Get red zone clients
ptd-redzone

# Remember something globally
ptd-remember "weekly_target" "50 new leads"

# Recall global memory
ptd-recall "weekly_target"

# Check system status
ptd-status
```

---

## 6. Vercel CLI Commands

```bash
# Navigate to project
cd ~/client-vital-suite

# Deploy to preview
vercel

# Deploy to production
vercel --prod

# Check deployments
vercel ls

# View logs
vercel logs https://client-vital-suite.vercel.app

# Check environment variables
vercel env ls production

# Add environment variable
vercel env add MY_VAR production
```

---

## 7. Supabase CLI Commands

```bash
# Link to project
supabase link --project-ref ztjndilxurtsfqdsvfds

# Check status
supabase status

# Run migrations
supabase db push

# Deploy Edge Functions
supabase functions deploy health-calculator
supabase functions deploy ptd-agent-claude

# View logs
supabase functions logs health-calculator

# Run SQL
supabase db execute "SELECT * FROM contacts LIMIT 5"
```

---

## 8. One-Line Installer Script

Save this as `install-ptd-cli.sh` and run:

```bash
#!/bin/bash

echo "🚀 Installing PTD CLI Tools..."

# Check OS
if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS
  which brew || /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  brew install node supabase/tap/supabase jq curl
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  # Linux
  sudo apt update
  sudo apt install -y nodejs npm jq curl
fi

# Install global npm packages
npm install -g vercel

# Add aliases to shell
cat >> ~/.zshrc << 'EOF'

# PTD System Aliases
export PTD_API="https://client-vital-suite.vercel.app"

ptd-ask() {
  curl -s -X POST "$PTD_API/api/agent" \
    -H "Content-Type: application/json" \
    -d "{\"message\": \"$1\"}" | jq -r '.response // .error'
}

ptd-truth() {
  curl -s "$PTD_API/api/truth?query=$(echo $1 | sed 's/ /%20/g')" | jq
}

ptd-redzone() {
  curl -s "$PTD_API/api/truth?query=red%20zone%20clients" | jq '.data.health_scores'
}

ptd-remember() {
  curl -s -X POST "$PTD_API/api/memory?global=true" \
    -H "Content-Type: application/json" \
    -d "{\"key\": \"$1\", \"value\": \"$2\", \"type\": \"shared\"}" | jq
}

ptd-recall() {
  curl -s "$PTD_API/api/memory?key=$1&global=true" | jq '.memory'
}

ptd-status() {
  curl -s "$PTD_API/api/system-check" | jq '{status: .status, env: .env.required}'
}
EOF

source ~/.zshrc

echo "✅ Installation complete!"
echo ""
echo "Try these commands:"
echo "  ptd-ask 'What clients need attention?'"
echo "  ptd-truth 'show ROI data'"
echo "  ptd-status"
```

Run it:

```bash
chmod +x install-ptd-cli.sh
./install-ptd-cli.sh
```

---

## 9. Quick Reference Card

| Command | What it does |
|---------|--------------|
| `ptd-ask "question"` | Ask Claude agent |
| `ptd-truth "query"` | Query data with citations |
| `ptd-redzone` | Get at-risk clients |
| `ptd-remember "key" "value"` | Store global memory |
| `ptd-recall "key"` | Get global memory |
| `ptd-status` | Check system health |
| `vercel --prod` | Deploy to production |
| `supabase db push` | Push migrations |

---

## 10. API Endpoints Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/agent` | POST | Claude AI agent |
| `/api/truth` | GET/POST | Query data with citations |
| `/api/memory` | GET/POST/DELETE | Global & session memory |
| `/api/workspace` | GET/POST | Workspace management |
| `/api/session` | POST | Session management |
| `/api/system-check` | GET | Health check |

---

**You're all set!** 🎉

Use these CLI commands from any terminal to interact with your PTD system.

