# Testing Connected Accounts / OAuth Feature

## Overview
The connected accounts page (`/connected-accounts`) allows users to link 16 social/content platforms. 13 use OAuth redirect flows, 3 use manual username entry (SoundCloud, Bluesky, Threads).

## Local Dev Setup

### Starting the Dev Server
```bash
npx next dev -p 3333
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

### From Meshi Command Center (recommended)
1. Click the Meshi mascot (purple blob) in bottom-right corner
2. Click "Connected Accounts" in the Navigate section

### Direct URL
Navigate to `http://localhost:3333/connected-accounts` (must be logged in)

## What You Can Test Without OAuth Credentials

### Manual Username Entry (SoundCloud, Bluesky, Threads)
1. Find the platform card — these show "Connect" buttons without OAuth badges
2. Click "Connect" -> inline form appears with "@" prefix input
3. Enter a username -> Click "Link"
4. Verify: Import dialog appears ("[Platform] Connected!") with import options (Posts, Likes, Comments, Followers)
5. Click "Skip for now" or "Import Selected"
6. Verify: Card shows "Connected" badge with @username and "Disconnect" button
7. Test disconnect: Click "Disconnect" -> verify card returns to "Connect" state

### Platform Counter
- Top of page shows "X of 16 platforms connected" with progress counter
- Updates in real-time when connecting/disconnecting

### Feature Cards
- Bottom of page has 3 feature cards: Unified Feed, MeChat, Cross-Interact

### OAuth Button Redirect Behavior
1. Click "Connect" on any OAuth platform
2. Without credentials configured, it redirects to `/api/auth/{platform}` which may show an error or redirect back
3. Verify: No raw JSON shown, no env var names leaked in error

## What Requires Real OAuth Credentials
Full OAuth flow testing (redirect -> authorize -> callback -> token exchange -> profile fetch) requires platform-specific API credentials set as environment variables. See `src/lib/oauth.ts` for the env var names each platform needs.

## All 16 Platforms
| Platform | Method | ID |
|----------|--------|----|
| Instagram | OAuth | instagram |
| YouTube | OAuth | youtube |
| TikTok | OAuth | tiktok |
| X/Twitter | OAuth | twitter |
| Twitch | OAuth | twitch |
| Spotify | OAuth | spotify |
| SoundCloud | Manual | soundcloud |
| LinkedIn | OAuth | linkedin |
| GitHub | OAuth | github |
| Discord | OAuth | discord |
| Snapchat | OAuth | snapchat |
| Pinterest | OAuth | pinterest |
| Reddit | OAuth | reddit |
| Facebook | OAuth | facebook |
| Threads | Manual | threads |
| Bluesky | Manual | bluesky |

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
