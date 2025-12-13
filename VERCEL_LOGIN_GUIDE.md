# 🔐 Vercel Login Guide - macOS

## Option 1: Login via Browser (Easiest)

Since you're on Mac, the easiest way is to login via the browser:

1. **Open Terminal** and run:
```bash
export PATH=~/.npm-global/bin:$PATH
vercel login
```

2. When it shows a code like `VRGP-PPCZ`:
   - **Copy the code**
   - **Open your browser** and go to: **https://vercel.com/device**
   - **Paste the code** and press Enter
   - It will authenticate automatically

3. **Go back to terminal** and press Enter

## Option 2: Use Vercel Token (Alternative)

If browser login doesn't work:

1. **Get a Vercel Token**:
   - Go to: https://vercel.com/account/tokens
   - Click "Create Token"
   - Name it "CLI Access"
   - Copy the token

2. **Login with token**:
```bash
export PATH=~/.npm-global/bin:$PATH
vercel login --token YOUR_TOKEN_HERE
```

## Option 3: Skip CLI - Use Dashboard

You can manage everything via Vercel Dashboard:
- **Environment Variables**: https://vercel.com/dashboard → client-vital-suite → Settings → Environment Variables
- **Deployments**: https://vercel.com/dashboard → client-vital-suite → Deployments

---

## After Login

Once logged in, run:
```bash
export PATH=~/.npm-global/bin:$PATH
cd /Users/milosvukovic/.cursor/worktrees/client-vital-suite-1/jux
vercel link
```

Then select your project: `client-vital-suite`

