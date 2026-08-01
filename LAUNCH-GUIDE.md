# mesh.me Launch Guide

This guide matches the current mesh.me codebase.

## Current deployment model

mesh.me is deployed from the repository root and uses:

- Next.js App Router
- Prisma with the libsql adapter
- Turso or another libsql-compatible database
- Custom session auth in `src/lib/auth.ts`
- OAuth routes in `src/app/api/auth/[platform]/*`

## Important production routes

- Home: `/`
- Privacy: `/privacy`
- Terms: `/terms`
- Health: `/api/health`
- Sitemap: `/sitemap.xml`
- Connected account callbacks: `/api/auth/<platform>/callback`

## Required environment variables

```env
DATABASE_URL="libsql://your-db.turso.io"
DATABASE_AUTH_TOKEN="your-turso-token"
AUTH_SECRET="generate-a-long-random-secret"
NEXT_PUBLIC_APP_URL="https://mesh.me"
NODE_ENV="production"
```

Generate the auth secret with:

```bash
openssl rand -hex 32
```

## Connecting accounts: the twelve platforms

Every Connect button on **One Account** is dark until its platform has both
halves of an OAuth setup. Nothing in the code can supply these — they come from
each platform's developer console.

**Half 1 — credentials on the deployment.** Set the pair, then redeploy:

| Platform | Client id variable | Secret variable |
| --- | --- | --- |
| Instagram | `INSTAGRAM_APP_ID` | `INSTAGRAM_APP_SECRET` |
| Facebook | `FACEBOOK_APP_ID` | `FACEBOOK_APP_SECRET` |
| X (Twitter) | `TWITTER_CLIENT_ID` | `TWITTER_CLIENT_SECRET` |
| Threads | `THREADS_CLIENT_ID` (falls back to `FACEBOOK_APP_ID`) | `THREADS_CLIENT_SECRET` |
| Snapchat | `SNAPCHAT_CLIENT_ID` | `SNAPCHAT_CLIENT_SECRET` |
| Reddit | `REDDIT_CLIENT_ID` | `REDDIT_CLIENT_SECRET` |
| LinkedIn | `LINKEDIN_CLIENT_ID` | `LINKEDIN_CLIENT_SECRET` |
| Pinterest | `PINTEREST_APP_ID` | `PINTEREST_APP_SECRET` |
| TikTok | `TIKTOK_CLIENT_KEY` | `TIKTOK_CLIENT_SECRET` |
| YouTube | `GOOGLE_CLIENT_ID` | `GOOGLE_CLIENT_SECRET` |
| Twitch | `TWITCH_CLIENT_ID` | `TWITCH_CLIENT_SECRET` |
| Discord | `DISCORD_CLIENT_ID` | `DISCORD_CLIENT_SECRET` |

**Half 2 — the callback URL registered with the provider.** In each developer
app, add this exact redirect URI:

```
https://www.meshs.me/api/auth/<platform>/callback
```

using the lowercase platform id: `instagram`, `facebook`, `twitter`, `threads`,
`snapchat`, `reddit`, `linkedin`, `pinterest`, `tiktok`, `youtube`, `twitch`,
`discord`. It is compared byte for byte — a trailing slash, `http` instead of
`https`, or a missing `www` is a rejected login.

Both halves are per platform and independent: configuring Discord alone makes
Discord connectable and changes nothing else. One Account lists the exact
missing variable names per platform, so it always says what is left to do.

## Other optional environment variables

```env
STRIPE_SECRET_KEY=""
STRIPE_PUBLISHABLE_KEY=""
STRIPE_WEBHOOK_SECRET=""
```

## Deploying

### 1. Create the database

Use Turso unless you plan to refactor the data layer.

### 2. Deploy to Vercel

Use the repository root as the project root.

Build command:

```bash
npx prisma generate && next build
```

### 3. Verify the basics

After deploy, confirm:

- `/`
- `/privacy`
- `/terms`
- `/api/health`
- `/sitemap.xml`

## Domain and SSL

After deployment:

1. Connect `mesh.me` to Vercel.
2. Set `NEXT_PUBLIC_APP_URL=https://mesh.me`.
3. Redeploy so metadata and canonical URLs use the real domain.

## Database migrations

Run from the repository root:

```bash
npx prisma generate
npx prisma migrate deploy
```

Optional seed:

```bash
npx prisma db seed
```

## Admin account

1. Create a normal account on the live site.
2. Open Prisma Studio or your database UI.
3. Set the user record’s `isAdmin` field to `true`.

## Connected accounts and OAuth

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

Do not use `/api/auth/callback/<platform>` because that does not match the implementation.

## Google and YouTube

YouTube uses:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

It does not use `YOUTUBE_CLIENT_ID` or `YOUTUBE_CLIENT_SECRET` in the current code.

The current YouTube scope is:

```text
https://www.googleapis.com/auth/youtube.readonly
```

Recommended redirect URIs:

```text
http://localhost:3000/api/auth/youtube/callback
https://mesh.me/api/auth/youtube/callback
```

## Why Google may block users

If the Google OAuth app is still in Testing, only accounts added as Test users can connect YouTube.

Fastest early fix:

- add affected users as Test users

Public launch fix:

- move the Google app toward Production and complete verification if required

## Launch checklist

### Trust and product

- Home page works
- Privacy page works
- Terms page works
- Feedback page works
- Health endpoint works
- Sitemap works

### Core app

- Signup works
- Login works
- Feed works
- Mesh works
- Search works
- Notifications work
- Settings work
- Connected accounts page works

### Connected accounts

- OAuth env vars are present only for enabled platforms
- Google redirect URI matches `/api/auth/youtube/callback`
- Test users are added while Google is in Testing

### Deployment hygiene

- `.env.example` matches the app
- `NEXT_PUBLIC_APP_URL` matches the live domain
- `npm run launch:check` passes
- Database is reachable from production

## Troubleshooting

### Build fails

Check:

- build command is `npx prisma generate && next build`
- required env vars exist
- project root is the repository root

### Production 500s

Check:

- `DATABASE_URL`
- `DATABASE_AUTH_TOKEN`
- Vercel logs
- whether migrations were run

### YouTube connect fails

Check, in order:

1. `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
2. YouTube Data API v3 is enabled
3. redirect URI is exactly `/api/auth/youtube/callback`
4. the user is on the Google OAuth test-user list if the app is still in Testing

## Useful commands

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

The biggest launch mistakes for this repo are configuration drift:

- stale environment docs
- wrong OAuth callback URIs
- wrong Google env var names
- testing-mode Google apps blocking real users

If the docs, env template, and OAuth setup stay aligned with the code, mesh.me becomes much easier to ship and debug.
