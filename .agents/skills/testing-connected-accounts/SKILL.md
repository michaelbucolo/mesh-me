# Testing Connected Accounts / OAuth Feature

## Overview
The connected accounts page (`/connected-accounts`) allows users to link 16 social/content platforms. 7 use OAuth redirect flows (active), 3 use manual username entry (SoundCloud, Bluesky, Threads), and 6 are "Coming Soon" (Instagram, LinkedIn, Reddit, Facebook, Pinterest, Snapchat).

## Local Dev Setup

### Starting the Dev Server
```bash
npx next dev -p 3333
```
**Important**: The app runs on port 3333, not the default 3000. The `getBaseUrl()` function in `src/lib/oauth.ts` checks `NEXTAUTH_URL` env var first, then falls back to `localhost:3333`.

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

**Missing columns fix**: If specific columns are missing (e.g., `alterEgoId`, `accountLabel`), you can add them directly:
```bash
sqlite3 dev.db "ALTER TABLE ConnectedAccount ADD COLUMN alterEgoId TEXT;"
sqlite3 dev.db "ALTER TABLE ConnectedAccount ADD COLUMN accountLabel TEXT;"
```

**Multi-account constraint**: The old schema had `UNIQUE(userId, platform)` which prevents connecting multiple accounts per platform. If you hit this:
```bash
sqlite3 dev.db "DROP INDEX IF EXISTS ConnectedAccount_userId_platform_key;"
```
The code-level duplicate check uses `(userId, platform, platformUsername)` instead.

Restart the dev server after schema changes.

### Production DB (Turso)
When schema changes are made to `prisma/schema.prisma`, the production Turso DB also needs migration. Use the saved `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` secrets:
```javascript
const { createClient } = require('@libsql/client');
const client = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
await client.execute('ALTER TABLE ConnectedAccount ADD COLUMN columnName TEXT;');
```

## Navigating to the Feature

### New Account Flow
1. Go to `http://localhost:3333` → Click "Join the Mesh"
2. Complete signup: username → display name → email → privacy → password → phone (skip) → platform tiles (skip)
3. Click through Meshi onboarding guide (5-6 steps) and interest selection (pick 3+)
4. Once in the main app, click "Connected Accounts" in the sidebar under "MANAGE" section

### Existing Account
Navigate directly to `http://localhost:3333/connected-accounts` (must be logged in)

## What You Can Test Without OAuth Credentials

### Manual Username Entry (SoundCloud, Bluesky, Threads)
1. Find the platform card (no "OAuth" badge on Connect button)
2. Click "Connect" → inline form appears with "@ username" placeholder input
3. Enter a username → Click "Link"
4. Verify: Import dialog appears ("[Platform] Connected!") with privacy notice and import options (Posts & content, Likes & reactions, Comments, Followers & following)
5. Verify: Card shows "Connected" badge with "@username" text and Disconnect/Sync/Settings buttons

### Multi-Account Support
1. After connecting one SoundCloud account, the card shows "Disconnect" — cannot add duplicates of same username
2. If the unique constraint has been dropped, you can disconnect and reconnect with a different username
3. The POST endpoint checks `findFirst({ where: { userId, platform, platformUsername } })` for duplicate prevention

### Disconnect Flow
1. Click "Disconnect" button on a connected account card
2. DELETE `/api/connected-accounts/[id]` removes the account
3. Card reverts to showing "Connect" button
4. Counter updates (e.g., "0 of 10 platforms connected")

### OAuth Button Redirect Behavior
1. Click "Connect" on any OAuth platform (has "OAuth" badge + external link icon)
2. Without credentials configured, it redirects back to `/connected-accounts` with an error banner (e.g., "OAuth not configured for GitHub")
3. Verify: No raw JSON shown, no env var names leaked in error

## What Requires Real OAuth Credentials
Full OAuth flow testing (redirect → authorize → callback → token exchange → profile fetch) requires platform-specific API credentials set as environment variables. See `src/lib/oauth.ts` for the env var names each platform needs.

## Playwright Testing Pattern
```javascript
const { chromium } = require('playwright');
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

// Login (see testing-mesh-app SKILL for full login flow)
// ...

// Navigate to connected accounts
await page.goto('http://localhost:3333/connected-accounts', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

// Find a manual platform section and click Connect
const section = page.locator('div:has(> div > div > h3:has-text("SoundCloud"))').first();
await section.locator('button:has-text("Connect")').click();
await page.waitForTimeout(1000);

// Fill username and intercept API response
const inputs = await page.locator('input').all();
await inputs[inputs.length - 1].fill('myusername');
const [response] = await Promise.all([
  page.waitForResponse(r => r.url().includes('/api/connected-accounts') && r.request().method() === 'POST'),
  page.locator('button:has-text("Link")').click(),
]);
console.log('Status:', response.status()); // Should be 200
```

## Key Files
- `src/app/(app)/connected-accounts/page.tsx` — UI with platform cards, manual entry forms, import dialog
- `src/lib/oauth.ts` — OAuth configs, `getBaseUrl()`, callback URL generation
- `src/app/api/auth/[platform]/route.ts` — OAuth initiation, checks for clientId env var
- `src/app/api/auth/[platform]/callback/route.ts` — OAuth callback handler
- `src/app/api/connected-accounts/route.ts` — GET (list) and POST (manual linking) endpoints

## Devin Secrets Needed
- No secrets needed for manual linking tests
- For full OAuth testing, platform-specific client ID/secret env vars are needed (configured per-platform in `src/lib/oauth.ts`)
- `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` — for production database migrations
