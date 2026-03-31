# Testing Connected Accounts / OAuth Feature

## Overview
The connected accounts page (`/connected-accounts`) allows users to link 16 social/content platforms. 13 use OAuth redirect flows, 3 use manual username entry (SoundCloud, Bluesky, Threads).

## Local Dev Setup

### Starting the Dev Server
```bash
npx next dev -p 3000
```

### Database Setup (Critical)
The app uses SQLite locally. Before testing, ensure the database schema is synced:
```bash
# Check which dev.db the app uses
grep DATABASE_URL .env.local
# Typical value: file:./dev.db (root-level)

# Sync schema to the correct database
npx prisma db push
```

**Common issue**: `prisma db push` may target `prisma/dev.db` while the app reads from `./dev.db` (root). If you get SQLite errors about missing columns after signup, push to both:
```bash
npx prisma db push
DATABASE_URL="file:./dev.db" npx prisma db push
```
Restart the dev server after schema changes.

## Navigating to the Feature

### New Account Flow
1. Go to `http://localhost:3000` → Click "Join the Mesh"
2. Complete signup: username → display name → email → privacy → password → phone (skip) → platform tiles (skip)
3. Click through Meshi onboarding guide (5-6 steps) and interest selection (pick 3+)
4. Once in the main app, click "Connected Accounts" in the sidebar under "MORE" section

### Existing Account
Navigate directly to `http://localhost:3000/connected-accounts` (must be logged in)

## What You Can Test Without OAuth Credentials

### Manual Username Entry (SoundCloud, Bluesky, Threads)
1. Find the platform card (no "OAuth" badge, no external link icon on Connect button)
2. Click "Connect" → inline form appears with "@" prefix input
3. Enter a username → Click "Link"
4. Verify: Import dialog appears ("[Platform] Connected!"), success notification, counter updates, card shows "Connected" badge with username

### OAuth Button Redirect Behavior
1. Click "Connect" on any OAuth platform (has "OAuth" badge + external link icon)
2. Without credentials configured, it redirects back to `/connected-accounts` with an error banner (e.g., "OAuth not configured for GitHub")
3. Verify: No raw JSON shown, no env var names leaked in error

## What Requires Real OAuth Credentials
Full OAuth flow testing (redirect → authorize → callback → token exchange → profile fetch) requires platform-specific API credentials set as environment variables. See `src/lib/oauth.ts` for the env var names each platform needs.

## Key Files
- `src/app/(app)/connected-accounts/page.tsx` — UI with platform cards, manual entry forms
- `src/lib/oauth.ts` — OAuth configs, utility functions
- `src/app/api/auth/[platform]/route.ts` — OAuth initiation
- `src/app/api/auth/[platform]/callback/route.ts` — OAuth callback handler
- `src/app/api/connected-accounts/route.ts` — Manual linking POST endpoint

## Devin Secrets Needed
- No secrets needed for manual linking tests
- For full OAuth testing, platform-specific client ID/secret env vars are needed (configured per-platform in `src/lib/oauth.ts`)
- `GITHUB_USERNAME` and `GITHUB_PASSWORD` — for pushing to the repo
