# 📦 Install CLIs - Step by Step Guide

## Current Status
- ❌ Node.js/npm not installed
- ❌ Homebrew not installed
- ✅ Python available

## Option 1: Install Node.js First (Recommended)

### Step 1: Install Node.js
You need Node.js to use npm. Choose one method:

#### Method A: Download Installer (Easiest)
1. Go to: https://nodejs.org/
2. Download LTS version for macOS
3. Run the installer
4. Restart terminal

#### Method B: Install via nvm (Node Version Manager)
```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Restart terminal, then:
nvm install --lts
nvm use --lts
```

#### Method C: Install Homebrew First, Then Node
```bash
# Install Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Then install Node
brew install node
```

### Step 2: Verify Installation
```bash
node --version
npm --version
```

### Step 3: Install CLIs
```bash
# Install Supabase CLI
npm install -g supabase

# Install Vercel CLI
npm install -g vercel
```

### Step 4: Run Setup
```bash
cd /Users/milosvukovic/.cursor/worktrees/client-vital-suite-1/jux
./setup-connections.sh
```

---

## Option 2: Use Standalone Binaries (No Node Required)

### Supabase CLI - Standalone Binary
```bash
# Download for macOS
curl -L https://github.com/supabase/cli/releases/latest/download/supabase_darwin_amd64.tar.gz -o supabase.tar.gz
tar -xzf supabase.tar.gz
sudo mv supabase /usr/local/bin/
rm supabase.tar.gz

# Verify
supabase --version
```

### Vercel CLI - Requires Node.js
Vercel CLI requires Node.js, so Option 1 is needed.

---

## Option 3: Use Dashboards (No CLI Needed)

If you prefer not to install CLIs, you can manage everything via web dashboards:

### Supabase Dashboard
- **Secrets**: https://supabase.com/dashboard/project/ztjndilxurtsfqdsvfds/settings/functions
- **Functions**: https://supabase.com/dashboard/project/ztjndilxurtsfqdsvfds/functions
- **Database**: https://supabase.com/dashboard/project/ztjndilxurtsfqdsvfds/editor

### Vercel Dashboard
- **Env Vars**: https://vercel.com/dashboard → client-vital-suite → Settings → Environment Variables
- **Deployments**: https://vercel.com/dashboard → client-vital-suite → Deployments

---

## Quick Install Script

After installing Node.js, run:

```bash
# Install both CLIs
npm install -g supabase vercel

# Verify
supabase --version
vercel --version

# Run setup
cd /Users/milosvukovic/.cursor/worktrees/client-vital-suite-1/jux
./setup-connections.sh
```

---

## Recommended: Install Node.js First

**Easiest method**: Download Node.js installer from https://nodejs.org/

Then run:
```bash
npm install -g supabase vercel
./setup-connections.sh
```

---

**Which method would you like to use?** I recommend downloading Node.js installer for the easiest setup.

