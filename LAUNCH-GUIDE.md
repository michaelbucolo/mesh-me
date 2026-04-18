# mesh.me Launch Guide

A practical guide for deploying mesh.me in a way that matches the current codebase.

## What this guide assumes

mesh.me is a Next.js app deployed from the **repository root**. It uses:

- Next.js App Router
- Prisma with the libsql adapter
- Turso or another libsql-compatible database
- Custom session auth in `src/lib/auth.ts`
- Connected account OAuth flows in `src/app/api/auth/[platform]/*`

## Quick architecture snapshot

- App root: repository root, not a subdirectory
- Production host: Vercel is the easiest target
- Database: Turso / libsql
- Health endpoint: `/api/health`
- Sitemap: `/sitemap.xml`
- Legal pages: `/privacy` and `/terms`
- Connected accounts: OAuth callback pattern is `/api/auth/<platform>/callback`

## Required environment variables

These are the minimum values needed for a real deployment:

```env
DATABASE_URL="libsql://your-db.turso.io"
DATABASE_AUTH_TOKEN="your-turso-token"
AUTH_SECRET="generate-a-long-random-secret"
NEXT_PUBLIC_APP_URL="https://mesh.me"
NODE_ENV="production"
```

### Generate the auth secret

```bash
openssl rand -hex 32
```

## Optional environment variables

These power connected accounts and billing. Leave blank until you are ready.

```env
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GITHUB_OAUTH_CLIENT_ID=""
GITHUB_OAUTH_CLIENT_SECRET=""
DISCORD_CLIENT_ID=""
DISCORD_CLIENT_SECRET=""
SPOTIFY_CLIENT_ID=""
SPOTIFY_CLIENT_SECRET=""
TWITTER_CLIENT_ID=""
TWITTER_CLIENT_SECRET=""
TWITCH_CLIENT_ID=""
TWITCH_CLIENT_SECRET=""
FACEBOOK_APP_ID=""
FACEBOOK_APP_SECRET=""
LINKEDIN_CLIENT_ID=""
LINKEDIN_CLIENT_SECRET=""
REDDIT_CLIENT_ID=""
REDDIT_CLIENT_SECRET=""
TIKTOK_CLIENT_KEY=""
TIKTOK_CLIENT_SECRET=""
PINTEREST_APP_ID=""
PINTEREST_APP_SECRET=""
SNAPCHAT_CLIENT_ID=""
SNAPCHAT_CLIENT_SECRET=""
STRIPE_SECRET_KEY=""
STRIPE_PUBLISHABLE_KEY=""
STRIPE_WEBHOOK_SECRET=""
```

## Recommended deployment path

### 1. Create the database

Use Turso unless you plan to refactor the data layer.

1. Create a new Turso database.
2. Copy the database URL.
3. Create an auth token.
4. Save both for Vercel.

### 2. Deploy to Vercel

1. Import `michaelbucolo/mesh-me` into Vercel.
2. Keep the **root directory as the repository root**.
3. Use the build command:

```bash
npx prisma generate && next build
```

4. Add the environment variables from above.
5. Deploy.

### 3. Verify the basic surface area

Check these after the first deployment:

- `/`
- `/privacy`
- `/terms`
- `/api/health`
- `/sitemap.xml`

## Domain and SSL

After Vercel deploys successfully:

1. Add `mesh.me` in Vercel Domains.
2. Point DNS to Vercel.
3. Set `NEXT_PUBLIC_APP_URL=https://mesh.me`.
4. Redeploy so canonical URLs and metadata use the live domain.

## Database migrations and seeding

Run migrations from the repository root.

```bash
npx prisma generate
npx prisma migrate deploy
```

Optional seed:

```bash
npx prisma db seed
```

## Create your admin account

1. Sign up normally on the live site.
2. Open Prisma Studio or your database UI.
3. Set your user record’s `isAdmin` field to `true`.

## Connected accounts and OAuth

mesh.me uses a shared OAuth system in `src/lib/oauth.ts` and `src/app/api/auth/[platform]/route.ts`.

### Important callback rule

The callback pattern is:

```text
https://mesh.me/api/auth/<platform>/callback
```

Examples:

```text
https://mesh.me/api/auth/youtube/callback
https://mesh.me/api/auth/github/callback
https://mesh.me/api/auth/discord/callback
```

This is the current code path. Do **not** register callbacks using `/api/auth/callback/<platform>` because that does not match the implementation.

### Google / YouTube setup

YouTube uses:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

It does **not** use `YOUTUBE_CLIENT_ID` or `YOUTUBE_CLIENT_SECRET` in the current code.

The YouTube scope currently requested is:

```text
https://www.googleapis.com/auth/youtube.readonly
```

To configure Google OAuth:

1. Create or open a Google Cloud project.
2. Enable **YouTube Data API v3**.
3. Configure the OAuth consent screen.
4. Create a web OAuth client.
5. Add these redirect URIs:

```text
http://localhost:3000/api/auth/youtube/callback
https://mesh.me/api/auth/youtube/callback
```

6. Put the client ID and secret into `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

### Why users may see “app hasn’t been verified”

If Google OAuth is still in **Testing**, only Google accounts listed as **Test users** can connect YouTube.

That means:

- The code can be correct
- The redirect URI can be correct
- Users can still be blocked because their Google account is not on the approved tester list

### Fastest fix for early testers

Add those users as **Test users** in Google Cloud.

### Fix for public launch

Move the Google app toward **Production** and complete any required Google verification for the requested scope.

## Feedback and monitoring

Before launch, confirm:

- `/feedback` loads
- `/api/feedback` accepts reports for signed-in users
- `/api/health` returns `ok: true`
- Vercel logs are clean during login, signup, and connected-account tests

## Launch checklist

### Product and trust

- Home page loads without errors
- Privacy policy is live
- Terms are live
- Feedback page is live
- Favicon and manifest are live
- Sitemap is live
- Health endpoint is live

### Auth and core product

- Signup works
- Login works with the expected identifiers
- Feed loads
- Mesh loads
- Search loads
- Notifications load
- Settings load
- Connected accounts page loads

### Connected accounts

- OAuth env vars are present only for platforms you actually want enabled
- Google redirect URI matches `/api/auth/youtube/callback`
- Test users are added while Google is in Testing
- Users understand some platforms may still be in limited rollout

### Deployment hygiene

- `.env.example` matches the real app
- `NEXT_PUBLIC_APP_URL` matches the live domain
- `npm run launch:check` passes
- Database is reachable from production

## Troubleshooting

### Vercel build fails

Check:

- Build command is `npx prisma generate && next build`
- Required env vars are present
- The project root is the repository root

### 500s in production

Check:

- `DATABASE_URL`
- `DATABASE_AUTH_TOKEN`
- Vercel function logs
- Whether the database was migrated

### Google / YouTube connect fails

Check, in this order:

1. `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` exist
2. YouTube Data API v3 is enabled
3. Redirect URI is exactly `/api/auth/youtube/callback`
4. The user is on the Google OAuth test-user list if the app is still in Testing

### Health checks fail

Check:

- `/api/health`
- Database connectivity
- Prisma client generation

## Useful commands

Run these from the repository root.

```bash
npm install
npx prisma generate
npm run dev
npm run build
npm run lint
npm run launch:check
npx prisma studio
```

## Final note

The biggest launch mistakes for this repo are not code issues. They are usually configuration drift:

- stale environment docs
- wrong OAuth callback URIs
- wrong Google env var names
- testing-mode Google apps blocking real users

If you keep the docs, env template, and OAuth setup aligned with the code, mesh.me becomes much easier to ship and debug.
