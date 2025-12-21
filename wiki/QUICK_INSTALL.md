# ⚡ Quick Install Guide

## Current Situation
- ✅ Project has `package.json` (Node.js was used before)
- ❌ Node.js/npm not found in current PATH
- ✅ Need to install or locate Node.js

## 🚀 Fastest Solution

### Step 1: Install Node.js
**Easiest method** - Download and install:

1. Go to: **https://nodejs.org/**
2. Click **"Download Node.js (LTS)"** - the green button
3. Open the downloaded `.pkg` file
4. Follow the installer (click Next/Install)
5. **Restart your terminal** (or open a new terminal window)

### Step 2: Verify Installation
Open a **new terminal** and run:
```bash
node --version
npm --version
```

You should see version numbers like:
```
v20.x.x
10.x.x
```

### Step 3: Install CLIs
```bash
# Install Supabase CLI
npm install -g supabase

# Install Vercel CLI
npm install -g vercel

# Verify
supabase --version
vercel --version
```

### Step 4: Run Setup Script
```bash
cd /Users/milosvukovic/.cursor/worktrees/client-vital-suite-1/jux
./setup-connections.sh
```

---

## 🔄 Alternative: If Node.js is Already Installed

If Node.js is installed but not in PATH, try:

```bash
# Check common locations
/usr/local/bin/node --version
/opt/homebrew/bin/node --version
~/.nvm/versions/node/*/bin/node --version

# If found, add to PATH (add to ~/.zshrc):
export PATH="/path/to/node/bin:$PATH"
```

---

## 📝 After Installation

Once Node.js and CLIs are installed, I can help you:
1. ✅ Login to Supabase & Vercel
2. ✅ Link projects
3. ✅ Check current secrets/env vars
4. ✅ Set missing secrets/env vars
5. ✅ Verify everything is configured

---

## ⏭️ Next Steps

1. **Install Node.js** from https://nodejs.org/
2. **Restart terminal**
3. **Run**: `npm install -g supabase vercel`
4. **Run**: `./setup-connections.sh`

Then come back and I'll help you set everything up! 🚀

