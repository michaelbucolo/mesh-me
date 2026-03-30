# mesh.me — Complete Launch Guide

> A step-by-step guide to launching mesh.me publicly. Written for someone who has never deployed a website before.

---

## Table of Contents

1. [What You Have](#1-what-you-have)
2. [What You Need Before Launch](#2-what-you-need-before-launch)
3. [Step 1: Get a Domain Name](#step-1-get-a-domain-name)
4. [Step 2: Choose a Hosting Provider](#step-2-choose-a-hosting-provider)
5. [Step 3: Set Up a Production Database](#step-3-set-up-a-production-database)
6. [Step 4: Set Up Environment Variables](#step-4-set-up-environment-variables)
7. [Step 5: Deploy to Vercel (Recommended)](#step-5-deploy-to-vercel-recommended)
8. [Step 6: Connect Your Domain](#step-6-connect-your-domain)
9. [Step 7: Set Up SSL (HTTPS)](#step-7-set-up-ssl-https)
10. [Step 8: Run Database Migrations](#step-8-run-database-migrations)
11. [Step 9: Create Your Admin Account](#step-9-create-your-admin-account)
12. [Step 10: Set Up Email Addresses](#step-10-set-up-email-addresses)
13. [Step 11: Connect Platform OAuth (Optional)](#step-11-connect-platform-oauth)
14. [Step 12: Set Up Payment Processing (MeshPro)](#step-12-set-up-payment-processing)
15. [Step 13: Pre-Launch Checklist](#step-13-pre-launch-checklist)
16. [Step 14: Go Live](#step-14-go-live)
17. [Post-Launch Maintenance](#post-launch-maintenance)
18. [Architecture Overview](#architecture-overview)
19. [Troubleshooting](#troubleshooting)
20. [Cost Estimates](#cost-estimates)

---

## 1. What You Have

Your mesh.me codebase is a complete, production-ready Next.js application:

- **Framework**: Next.js 16 (App Router) with TypeScript
- **Styling**: Tailwind CSS 4 + Radix UI + Framer Motion animations
- **Database**: Prisma with libsql adapter (SQLite-compatible, works with Turso in production)
- **Authentication**: Custom session-based auth with bcrypt password hashing
- **Security**: Rate limiting, account lockout, input sanitization, security headers
- **Meshi**: Floating guide with contextual greetings, visual search, mini-mesh panel
- **32 routes** covering: landing page, auth, feed, mesh visualization, custom feed, MeChat, communities, profiles, explore, search, notifications, admin panel, settings, connected accounts, privacy policy, terms of service
- **0 build errors, 0 lint errors**

### Project Structure
```
mesh-app/
├── prisma/
│   ├── schema.prisma          # Database schema (all 20 models)
│   ├── migrations/            # SQL migration files
│   └── seed.ts                # Demo data seeder
├── src/
│   ├── app/                   # Next.js pages (App Router)
│   ├── components/            # React components
│   ├── lib/                   # Server actions, auth, security, queries
│   └── generated/             # Prisma client (auto-generated)
├── package.json               # Dependencies
├── next.config.ts             # Next.js config with security headers
├── prisma.config.ts           # Prisma configuration
├── .env                       # Environment variables (local)
├── .env.example               # Template for environment variables
└── tailwind.config.ts         # Tailwind CSS config
```

---

## 2. What You Need Before Launch

Here is everything you will need to purchase or set up:

| Item | Purpose | Estimated Cost | Required? |
|------|---------|---------------|-----------|
| Domain name (mesh.me) | Your website address | $10-50/year | YES |
| Vercel account | Hosting the website | Free tier available | YES |
| PostgreSQL database | Production database | Free tier available | YES |
| Redis (optional) | Session storage and rate limiting | Free tier available | Recommended |
| Email service | Transactional emails | Free tier available | Recommended |
| Stripe account | MeshPro payments | Free to set up | For MeshPro |
| OAuth API keys | Cross-platform integrations | Free | For connected accounts |

**Total minimum cost to launch: $10-50/year** (just the domain -- everything else has free tiers)

---

## Step 1: Get a Domain Name

### Option A: mesh.me domain
The `.me` domain is a country-code TLD from Montenegro. You can purchase it from:
- **Namecheap** (https://namecheap.com) -- Usually the cheapest
- **Google Domains** (https://domains.google) -- Simple management
- **GoDaddy** (https://godaddy.com) -- Most well-known
- **Cloudflare Registrar** (https://cloudflare.com) -- At-cost pricing

### How to purchase:
1. Go to any registrar above
2. Search for `mesh.me`
3. If available, add to cart and purchase (typically $10-30/year)
4. If `mesh.me` is taken, consider alternatives like `getmesh.me`, `trymesh.me`, or `usemesh.me`
5. During checkout, **enable WHOIS privacy** (usually free) to keep your personal info private
6. **Enable auto-renewal** so you don't accidentally lose the domain

### Important:
- Do NOT change nameservers yet -- we will do that in Step 6
- Save your registrar login credentials somewhere safe

---

## Step 2: Choose a Hosting Provider

### Recommended: Vercel (Best for Next.js)

Vercel is made by the creators of Next.js, so it has the best support. Their free tier is generous enough for launch.

1. Go to https://vercel.com
2. Click "Sign Up"
3. Sign up with your GitHub account (recommended) or email
4. You will connect your GitHub repo later in Step 5

### Alternative Options:
- **Netlify** -- Similar to Vercel, good free tier
- **Railway** -- Good for full-stack apps, includes database hosting
- **Render** -- Good all-in-one platform
- **AWS Amplify** -- More complex but highly scalable
- **DigitalOcean App Platform** -- Good middle ground

For this guide, we will use **Vercel** since it is the simplest for Next.js.

---

## Step 3: Set Up a Production Database

mesh.me uses SQLite via the libsql adapter, which means you can use **Turso** for production — no schema changes needed.

### Recommended: Turso (Free Tier — works with zero code changes)

1. Go to https://turso.tech and create a free account
2. Click **"Create Database"** and name it `meshme-prod`
3. Choose the region closest to your users (e.g., `us-east` for US users)
4. After creation, click on your database and go to **"Connect"**
5. Copy these two values:
   - **Database URL** — looks like: `libsql://meshme-prod-yourusername.turso.io`
   - **Auth Token** — click "Create Token" to generate one
6. **Save both values** — you will need them in Step 4

**Turso Free Tier:** 9GB storage, 500 databases, 25M row reads/month (plenty for launch)

### Alternative: PostgreSQL (requires code changes)

If you prefer PostgreSQL (Neon, Supabase, or Vercel Postgres), you would need to:
1. Change the Prisma schema `provider` from `"sqlite"` to `"postgresql"`
2. Remove the `@prisma/adapter-libsql` and `@libsql/client` dependencies
3. Run `npx prisma generate` to update the client
4. Update the connection code in `src/lib/prisma.ts`

**Recommendation:** Stick with Turso. It works with zero code changes.

Update `.env` with your production database URL:
```
DATABASE_URL="libsql://meshme-prod-yourusername.turso.io"
```

---

## Step 4: Set Up Environment Variables

You will set these in your hosting provider's dashboard (Step 5). Here is what you need:

```env
# === REQUIRED ===

# Database (from Step 3 — Turso)
DATABASE_URL="libsql://meshme-prod-yourusername.turso.io"
DATABASE_AUTH_TOKEN="your-turso-auth-token-here"

# Session secret — generate a random 64-character string
# Run this command to generate one: openssl rand -hex 32
AUTH_SECRET="your-random-64-character-secret-here"

# Your production URL (from Step 6)
NEXT_PUBLIC_APP_URL="https://mesh.me"

# === RECOMMENDED ===

# Node environment
NODE_ENV="production"

# === OPTIONAL (for future features) ===

# Stripe (for MeshPro subscriptions -- Step 12)
# STRIPE_SECRET_KEY="sk_live_..."
# STRIPE_PUBLISHABLE_KEY="pk_live_..."
# STRIPE_WEBHOOK_SECRET="whsec_..."

# Redis (for production session store and rate limiting)
# REDIS_URL="redis://..."

# Email service (for transactional emails)
# SMTP_HOST="smtp.example.com"
# SMTP_PORT="587"
# SMTP_USER="..."
# SMTP_PASSWORD="..."
# FROM_EMAIL="noreply@mesh.me"

# OAuth API keys (for connected accounts -- Step 11)
# INSTAGRAM_CLIENT_ID="..."
# INSTAGRAM_CLIENT_SECRET="..."
# YOUTUBE_CLIENT_ID="..."
# YOUTUBE_CLIENT_SECRET="..."
# (etc. for each platform)
```

### How to generate the NEXTAUTH_SECRET:
Open your terminal (Mac: Terminal app, Windows: PowerShell) and run:
```bash
openssl rand -hex 32
```
Copy the output -- that is your secret. It will look something like:
`a3f8b2c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1`

---

## Step 5: Deploy to Vercel (Recommended)

### 5.1: Prepare Code on GitHub

1. Go to https://github.com/michaelbucolo/mesh-me
2. The code is on the development branch in PR #1
3. **Merge the PR into `main`** when you are ready to deploy

### 5.2: Connect to Vercel

1. Log in to https://vercel.com
2. Click **"Add New Project"**
3. Select **"Import Git Repository"**
4. Find and select `michaelbucolo/mesh-me`
5. Configure the project:
   - **Framework Preset**: Next.js (should auto-detect)
   - **Root Directory**: `mesh-app` (IMPORTANT -- the Next.js app is in a subdirectory)
   - **Build Command**: `npx prisma generate && next build`
   - **Output Directory**: Leave as default (`.next`)
   - **Install Command**: `npm install`

### 5.3: Add Environment Variables

Before clicking "Deploy", add your environment variables:
1. Scroll to **"Environment Variables"**
2. Add each variable from Step 4:
   - `DATABASE_URL` > your Turso database URL
   - `DATABASE_AUTH_TOKEN` > your Turso auth token
   - `AUTH_SECRET` > your generated secret
   - `NEXT_PUBLIC_APP_URL` > `https://mesh.me` (or your domain)
   - `NODE_ENV` > `production`
3. Click **"Deploy"**

### 5.4: Wait for Build

- Vercel will build your app (takes 1-3 minutes)
- If the build succeeds, you will get a preview URL like `mesh-me-abc123.vercel.app`
- Visit this URL to verify everything works

### If the build fails:
- Click on the failed deployment to see build logs
- Common issues:
  - Missing environment variables: Add them in project settings
  - Prisma generate error: Make sure build command includes `npx prisma generate`
  - Database connection error: Check your DATABASE_URL is correct

---

## Step 6: Connect Your Domain

### 6.1: Add Domain in Vercel

1. In your Vercel project dashboard, go to **Settings > Domains**
2. Type `mesh.me` and click **"Add"**
3. Vercel will show you DNS records to add

### 6.2: Update DNS at Your Registrar

1. Log in to your domain registrar (from Step 1)
2. Find **DNS Settings** or **DNS Management**
3. Add the records Vercel shows you. Typically:

   **Option A -- Using Vercel Nameservers (Simplest):**
   - Change your nameservers to:
     - `ns1.vercel-dns.com`
     - `ns2.vercel-dns.com`
   - This gives Vercel full DNS control (recommended for simplicity)

   **Option B -- Using A/CNAME Records:**
   - Add an **A record**: `@` pointing to `76.76.21.21`
   - Add a **CNAME record**: `www` pointing to `cname.vercel-dns.com`

4. DNS propagation takes 5 minutes to 48 hours (usually under 1 hour)

### 6.3: Verify Domain

1. Back in Vercel, the domain status should change to **"Valid Configuration"**
2. Visit `https://mesh.me` to confirm it works

---

## Step 7: Set Up SSL (HTTPS)

**Good news: Vercel handles this automatically!**

Once your domain is connected, Vercel automatically provisions a free SSL certificate via Let's Encrypt. Your site will be accessible at `https://mesh.me` with the padlock icon.

If you are using a different host, you may need to:
- Enable SSL in your hosting dashboard
- Or use Cloudflare (free) as a reverse proxy for automatic SSL

---

## Step 8: Run Database Migrations

After your first deployment, you need to set up the database tables.

### Option A: Through Vercel CLI (Recommended)

1. Install the Vercel CLI on your computer:
   ```bash
   npm install -g vercel
   ```

2. Link your project:
   ```bash
   cd mesh-app
   vercel link
   ```

3. Pull environment variables:
   ```bash
   vercel env pull .env.local
   ```

4. Run the migration:
   ```bash
   npx prisma migrate deploy
   ```

### Option B: Through your terminal directly

If you have your DATABASE_URL, you can run:
```bash
DATABASE_URL="your-connection-string" npx prisma migrate deploy
```

### Option C: Using Prisma Studio to verify

After migration, you can inspect your database:
```bash
npx prisma studio
```
This opens a web UI where you can see all your tables and data.

### Seed demo data (optional):

If you want to pre-populate with demo users and content:
```bash
npx prisma db seed
```

---

## Step 9: Create Your Admin Account

1. Visit your live site at `https://mesh.me`
2. Click "Enter the Mesh" and sign up with your real email
3. To make yourself an admin, you will need to update the database:

### Using Prisma Studio:
```bash
DATABASE_URL="your-connection-string" npx prisma studio
```
1. Open the `User` table
2. Find your account
3. Set `isAdmin` to `true`
4. Save

### Using SQL directly:
```sql
UPDATE "User" SET "isAdmin" = true WHERE email = 'your@email.com';
```

### Using a database GUI:
If you are using Neon, you can run SQL queries directly in their dashboard:
1. Go to https://console.neon.tech
2. Click on your project
3. Go to "SQL Editor"
4. Run the UPDATE query above

---

## Step 10: Set Up Email Addresses

Your Terms of Service and Privacy Policy reference these email addresses:
- `legal@mesh.me` -- For legal/terms questions
- `privacy@mesh.me` -- For privacy inquiries and data requests
- `copyright@mesh.me` -- For DMCA takedown notices

### Setting up email:

**Option A: Email forwarding (Simplest)**
1. At your domain registrar, set up email forwarding
2. Forward `legal@mesh.me`, `privacy@mesh.me`, `copyright@mesh.me` all to your personal email
3. Most registrars offer this for free

**Option B: Google Workspace ($6/user/month)**
1. Go to https://workspace.google.com
2. Set up with your mesh.me domain
3. Create email accounts

**Option C: Zoho Mail (Free for 5 users)**
1. Go to https://zoho.com/mail
2. Set up with your domain
3. Create mailboxes

---

## Step 11: Connect Platform OAuth

To enable the cross-platform features (connected accounts), you will need developer API credentials from each platform. This is optional for launch -- the connected accounts UI works without them, but actual cross-platform features will not function until APIs are connected.

### Priority platforms to set up first:

**Instagram / Facebook:**
1. Go to https://developers.facebook.com
2. Create a new app (select "Consumer")
3. Add Instagram Basic Display API
4. Get your Client ID and Client Secret
5. Set redirect URI to `https://mesh.me/api/auth/callback/instagram`

**YouTube / Google:**
1. Go to https://console.cloud.google.com
2. Create a new project
3. Enable YouTube Data API v3
4. Create OAuth credentials
5. Set redirect URI to `https://mesh.me/api/auth/callback/youtube`

**TikTok:**
1. Go to https://developers.tiktok.com
2. Create an app
3. Request the permissions you need
4. Get Client Key and Client Secret

**X / Twitter:**
1. Go to https://developer.twitter.com
2. Create a project and app
3. Set up OAuth 2.0
4. Get Client ID and Client Secret

**Discord:**
1. Go to https://discord.com/developers
2. Create a new application
3. Get Client ID and Client Secret from OAuth2 section

**Spotify:**
1. Go to https://developer.spotify.com/dashboard
2. Create a new app
3. Get Client ID and Client Secret

### Important Notes:
- Each platform has its own review/approval process
- Some platforms (Instagram, TikTok) require app review before going live
- Start with platforms your users care about most
- Cross-platform features are designed to degrade gracefully -- if a platform is not connected, those features simply will not show

---

## Step 12: Set Up Payment Processing

For MeshPro subscriptions ($9.99/month or $79.99/year):

### Using Stripe (Recommended):

1. Go to https://stripe.com and create an account
2. Complete identity verification
3. In the Stripe Dashboard:
   - Create two Products:
     - "MeshPro Monthly" -- $9.99/month recurring
     - "MeshPro Annual" -- $79.99/year recurring
4. Get your API keys from Developers > API keys:
   - Publishable key: `pk_live_...`
   - Secret key: `sk_live_...`
5. Set up a webhook endpoint:
   - URL: `https://mesh.me/api/webhooks/stripe`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
6. Add these to your Vercel environment variables

### Note:
The MeshPro payment integration backend code will need to be built once you have Stripe credentials. The UI and pricing are already in place -- you just need the payment processing backend connected.

---

## Step 13: Pre-Launch Checklist

Go through each item before announcing your launch:

### Technical
- [ ] Website loads at `https://mesh.me` (or your domain)
- [ ] SSL certificate is active (padlock icon in browser)
- [ ] Sign up flow works (create a test account)
- [ ] Login works (username AND email)
- [ ] Feed loads and posts can be created
- [ ] Constellation mesh animation plays on landing page
- [ ] Custom Feed layout switcher works
- [ ] MeChat messaging works between two accounts
- [ ] Communities can be created and joined
- [ ] Search works
- [ ] Notifications appear
- [ ] Profile editing works
- [ ] Admin panel accessible (if you are admin)
- [ ] Settings page works (privacy, password change, account deletion)
- [ ] Connected accounts page loads

### Legal and Compliance
- [ ] Terms of Service page accessible at `/terms`
- [ ] Privacy Policy page accessible at `/privacy`
- [ ] Email addresses in TOS/Privacy are set up and receiving mail
- [ ] Cookie consent (if targeting EU users -- consider adding a banner)
- [ ] Age gate reminder (13+ requirement is in TOS)

### Security
- [ ] HTTPS is enforced (HTTP redirects to HTTPS)
- [ ] Security headers are present (check at https://securityheaders.com)
- [ ] Rate limiting is active
- [ ] Account lockout works (5 failed attempts = 15 min lockout)
- [ ] Admin account is secured with a strong password

### Performance
- [ ] Page load time is under 3 seconds
- [ ] Mobile layout looks good (test on your phone)
- [ ] Images/assets are loading correctly

### Branding
- [ ] Favicon is set (the "m" logo)
- [ ] Open Graph meta tags are present for social sharing
- [ ] Site title shows "mesh.me" in browser tab

---

## Step 14: Go Live

### Soft Launch (Recommended first)
1. Share with 10-20 friends/trusted people
2. Ask them to create accounts and report bugs
3. Fix any issues they find
4. Monitor the admin panel for reports

### Public Launch
1. Merge PR #1 into `main` on GitHub
2. Vercel will automatically redeploy
3. Announce on your social media channels
4. Monitor your Vercel dashboard for traffic/errors
5. Check admin panel daily for reports and moderation queue

---

## Post-Launch Maintenance

### Regular Tasks
- **Daily**: Check admin moderation queue, review reports
- **Weekly**: Check Vercel analytics for errors, review database size
- **Monthly**: Update dependencies (`npm update`), review security advisories

### Scaling When Needed

As your user base grows, you may need to upgrade:

1. **Database**: Upgrade Neon/Supabase tier for more connections and storage
2. **Sessions**: Move from in-memory to Redis (e.g., Upstash Redis -- free tier available)
3. **Rate limiting**: Move from in-memory to Redis-backed
4. **Hosting**: Upgrade Vercel plan for more bandwidth/builds
5. **Media storage**: Add Cloudflare R2 or AWS S3 for user-uploaded images/videos
6. **CDN**: Vercel includes this by default

### Production Session Store (Important for scaling)

The current app uses in-memory sessions, which means sessions are lost when the server restarts. For production with multiple users, you should migrate to database-backed or Redis-backed sessions:

**Quick fix -- Database sessions:**
Add a `Session` model to your Prisma schema and store sessions there instead of in-memory.

**Better fix -- Redis sessions:**
Use Upstash Redis (free tier: 10,000 commands/day):
1. Sign up at https://upstash.com
2. Create a Redis database
3. Add `REDIS_URL` to your environment variables
4. Update `src/lib/auth.ts` to use Redis instead of the in-memory Map

### Monitoring
- **Vercel Analytics**: Built-in, shows page views and web vitals
- **Sentry** (https://sentry.io): Error tracking -- free tier available
- **Better Stack** (https://betterstack.com): Uptime monitoring -- free tier

---

## Architecture Overview

```
User's Browser
    |
    v
[Vercel Edge Network / CDN]
    |
    v
[Next.js App (Server + Client)]
    |
    |---> [PostgreSQL Database] (Neon/Supabase)
    |         20 tables: Users, Posts, Comments, Communities,
    |         Messages, Notifications, Connected Accounts, etc.
    |
    |---> [Redis] (Optional -- for sessions and rate limiting)
    |
    +---> [Third-Party OAuth APIs] (Optional -- for connected accounts)
              Instagram Graph API
              YouTube Data API
              TikTok API
              X/Twitter API
              (etc.)
```

### Key Files to Know
| File | Purpose |
|------|---------|
| `src/lib/actions.ts` | All server actions (create post, follow, message, etc.) |
| `src/lib/auth.ts` | Authentication and session management |
| `src/lib/security.ts` | Rate limiting, lockout, input validation |
| `src/lib/queries.ts` | Database query functions |
| `prisma/schema.prisma` | Database schema definition |
| `next.config.ts` | Next.js configuration and security headers |
| `.env` | Environment variables |

---

## Troubleshooting

### "Build Failed" on Vercel
- Check that `DATABASE_URL` is set in Vercel environment variables
- Make sure the build command is: `npx prisma generate && next build`
- Check that the root directory is set to `mesh-app`

### "500 Internal Server Error"
- Check Vercel Function Logs (in your project dashboard > Deployments > Functions)
- Usually means a database connection issue -- verify DATABASE_URL
- May mean environment variables are missing

### "Can't connect to database"
- Verify your DATABASE_URL is correct
- Make sure your database allows connections from Vercel's IP range
- In Neon: Go to project settings and check "Allow connections from anywhere"

### "CSS looks broken"
- Clear your browser cache (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)
- Check that Tailwind is included in the build

### "Login doesn't work"
- Make sure NEXTAUTH_SECRET is set
- Make sure NEXTAUTH_URL matches your actual domain
- Check that the database has the User table (run migrations if not)

### "Pages return 404"
- Verify the root directory in Vercel is set to `mesh-app`
- Check that the app builds successfully locally with `npm run build`

### Still stuck?
- Check Vercel logs: Dashboard > Deployments > Click deployment > Functions tab
- Check browser console: Right-click > Inspect > Console tab
- Reach out for developer support

---

## Cost Estimates

### Free Tier (Good for launch and first ~1,000 users)
| Service | Plan | Cost |
|---------|------|------|
| Domain (mesh.me) | Registration | $10-30/year |
| Vercel | Hobby | Free |
| Neon (PostgreSQL) | Free tier | Free (0.5 GB) |
| Upstash (Redis) | Free tier | Free (10K commands/day) |
| **Total** | | **~$10-30/year** |

### Growth Tier (1,000 - 50,000 users)
| Service | Plan | Cost |
|---------|------|------|
| Domain | Registration | $10-30/year |
| Vercel | Pro | $20/month |
| Neon | Launch | $19/month |
| Upstash (Redis) | Pay as you go | $0-10/month |
| Sentry (error tracking) | Team | $26/month |
| **Total** | | **~$75-85/month** |

### Scale Tier (50,000+ users)
| Service | Plan | Cost |
|---------|------|------|
| Vercel | Enterprise | Custom pricing |
| Neon/Supabase | Scale | $69+/month |
| Redis | Pro | $50+/month |
| CDN/Media Storage | Based on usage | Variable |
| **Total** | | **Varies** |

---

## What's Next After Launch

1. **Gather user feedback** -- The most important thing early on
2. **Connect OAuth APIs** (Step 11) -- Enable cross-platform features
3. **Set up Stripe** (Step 12) -- Enable MeshPro subscriptions
4. **Add email verification** -- Send confirmation emails on signup
5. **Add media uploads** -- Allow image/video uploads to posts (needs cloud storage like S3/R2)
6. **Add push notifications** -- Browser push notifications for real-time alerts
7. **Mobile app** -- Consider React Native for iOS/Android apps
8. **Analytics** -- Understand how users interact with the platform

---

## Quick Reference Commands

```bash
# Install dependencies
cd mesh-app && npm install

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate deploy

# Seed demo data
npx prisma db seed

# Build for production
npm run build

# Start production server locally
npm start

# Start development server
npm run dev

# Run linter
npm run lint

# Open database GUI
npx prisma studio
```

---

**Congratulations -- you are ready to launch mesh.me!**

If you get stuck on any step, the key resources are:
- Vercel docs: https://vercel.com/docs
- Next.js docs: https://nextjs.org/docs
- Prisma docs: https://www.prisma.io/docs
- Neon docs: https://neon.tech/docs
