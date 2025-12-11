# Vercel Deployment Guide

This document provides a comprehensive guide for deploying the Client Vital Suite application to Vercel.

> **⚠️ IMPORTANT:** This project uses Lovable for development. If Vercel is not updating with new changes, see [LOVABLE_VERCEL_SYNC_TROUBLESHOOTING.md](./LOVABLE_VERCEL_SYNC_TROUBLESHOOTING.md)

## Prerequisites

- Vercel account (sign up at [vercel.com](https://vercel.com))
- GitHub repository connected to Vercel
- Supabase project with required credentials
- Lovable project (https://lovable.dev/projects/2849fe86-5874-418c-a421-d4e916c8a052)

## Lovable + Vercel Integration Flow

This project uses **Lovable** as the primary development platform:

```
Lovable (Edit) → GitHub (main branch) → Vercel (Auto-deploy) → Production
```

**How it works:**
1. You make changes in Lovable
2. Lovable automatically commits and pushes to GitHub `main` branch
3. GitHub webhook triggers Vercel deployment
4. Vercel builds and deploys to production

**Typical deployment time:** 3-7 minutes from Lovable save to live update

## Automatic Deployment

This project is configured for automatic deployment to Vercel via GitHub integration with Lovable.

### Configuration Files

The following files ensure proper Vercel deployment:

1. **vercel.json** - Vercel configuration with:
   - Build settings (Vite framework)
   - SPA routing (rewrites all routes to index.html)
   - Asset caching headers
   - Environment variable placeholders

2. **.vercelignore** - Excludes unnecessary files from deployment:
   - node_modules, build artifacts
   - Backend directory (separate deployment)
   - Development and test files

3. **.gitignore** - Updated to exclude `.vercel` directory

## Environment Variables

Set these environment variables in the Vercel Dashboard (Project Settings > Environment Variables):

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL | `https://xxxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key | `eyJhbGciOiJIUzI1NiIs...` |

### Setting Environment Variables

1. Go to your Vercel project dashboard
2. Navigate to **Settings** > **Environment Variables**
3. Add each variable with its value
4. Select the appropriate environment(s): Production, Preview, Development
5. Click **Save**

## Deployment Steps

### Initial Setup

1. **Connect GitHub Repository**
   ```
   - Go to Vercel Dashboard
   - Click "Add New Project"
   - Import your GitHub repository: milosriki/client-vital-suite
   - Vercel will auto-detect the framework (Vite)
   ```

2. **Configure Build Settings** (auto-configured via vercel.json)
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

3. **Set Environment Variables**
   - Add `VITE_SUPABASE_URL`
   - Add `VITE_SUPABASE_ANON_KEY`

4. **Deploy**
   - Click "Deploy"
   - Vercel will build and deploy your application

### Continuous Deployment

Once set up, every push to your repository will trigger an automatic deployment:

- **Production**: Pushes to `main` branch
- **Preview**: Pushes to other branches (including PRs)

## Vercel Analytics

Vercel Analytics is already integrated in the application:

```typescript
// src/main.tsx
import { Analytics as VercelAnalytics } from "@vercel/analytics/react";

// Rendered in the app
<VercelAnalytics />
```

Analytics will automatically start tracking once deployed to Vercel.

## Build Optimization

The current build generates:
- Main bundle: ~1.3 MB (359 KB gzipped)
- CSS: ~76 KB (13 KB gzipped)

### Recommendations for Further Optimization

1. **Code Splitting**: Use dynamic imports for routes
   ```typescript
   const Dashboard = lazy(() => import('./pages/Dashboard'));
   ```

2. **Bundle Analysis**: Run `npm install -D rollup-plugin-visualizer` and analyze bundle size

3. **Manual Chunks**: Configure in `vite.config.ts`:
   ```typescript
   build: {
     rollupOptions: {
       output: {
         manualChunks: {
           'vendor': ['react', 'react-dom', 'react-router-dom'],
           'ui': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
         }
       }
     }
   }
   ```

## Verifying Deployment

After deployment:

1. **Check Build Status**: Verify the build completed successfully in Vercel Dashboard
2. **Test Routes**: Visit different routes to ensure SPA routing works
3. **Check Analytics**: Verify Vercel Analytics is tracking page views
4. **Environment Variables**: Test features that depend on Supabase connection

## Troubleshooting

> **📖 For Lovable-Vercel sync issues, see:** [LOVABLE_VERCEL_SYNC_TROUBLESHOOTING.md](./LOVABLE_VERCEL_SYNC_TROUBLESHOOTING.md)

### Vercel Not Updating After Lovable Changes

**Most Common Issue:** Changes made in Lovable aren't appearing on Vercel

**Quick Fixes:**
1. Verify Vercel is watching `main` branch (Settings → Git → Production Branch)
2. Check latest GitHub commit matches your Lovable change
3. Check Vercel Deployments tab for build status/errors
4. Ensure environment variables are set in Vercel dashboard

**Full Guide:** See [LOVABLE_VERCEL_SYNC_TROUBLESHOOTING.md](./LOVABLE_VERCEL_SYNC_TROUBLESHOOTING.md) for detailed steps

### Build Fails

- Check build logs in Vercel Dashboard
- Verify all dependencies are in `package.json`
- Ensure environment variables are set correctly

### Routes Return 404

- Verify `vercel.json` has the rewrite rule for SPA routing
- Check that `dist/index.html` exists in build output

### Environment Variables Not Working

- Ensure variables are prefixed with `VITE_`
- Redeploy after adding/changing environment variables
- Check that variables are set for the correct environment (Production/Preview)

### Supabase Connection Issues

- Verify `VITE_SUPABASE_URL` is correct
- Verify `VITE_SUPABASE_ANON_KEY` is valid
- Check Supabase dashboard for project status

## Backend Deployment

The backend (Meta Conversions API Proxy) should be deployed separately:

- Options: VPS, AWS, Vercel Serverless Functions, or Docker container
- See `backend/README.md` for detailed backend deployment instructions

## Custom Domain

To add a custom domain:

1. Go to Vercel Dashboard > Project > Settings > Domains
2. Click "Add Domain"
3. Enter your domain name
4. Follow DNS configuration instructions
5. Wait for DNS propagation (can take up to 48 hours)

## Support

For issues related to:
- **Vercel Platform**: [Vercel Support](https://vercel.com/support)
- **Application Issues**: Create an issue in the GitHub repository
- **Supabase Issues**: [Supabase Support](https://supabase.com/support)

## Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Vite Deployment Guide](https://vitejs.dev/guide/static-deploy.html)
- [Supabase Documentation](https://supabase.com/docs)
- [React Router on Vercel](https://vercel.com/guides/deploying-react-with-vercel)
