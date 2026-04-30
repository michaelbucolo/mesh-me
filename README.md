# mesh.me

Your World, Your Way.

mesh.me is a privacy-first social media platform and digital identity hub designed to replace the daily need for the top communication and social media apps.

It unifies the most important parts of social media, messaging, creator analytics, communities, notifications, privacy controls, and digital identity into one consumer-first experience.

Instead of making users jump between YouTube, Instagram, TikTok, X, Threads, Facebook, Discord, Messenger, WhatsApp, Snapchat, Twitch, Reddit, and other platforms, mesh.me brings their digital world into one place.

**Your World, Your Way.**

See `docs/PROJECT_FOUNDATION.md`, `docs/BRAND_FOUNDATION.md`, `docs/DESIGN_SYSTEM.md`, `docs/PRODUCT_VISION.md`, and `docs/ENGINEERING_ROADMAP.md` for the project setup contract, brand system, UI foundation, product direction, and phased implementation plan.

## Testing and Troubleshooting

Use the built-in diagnostics before deploys and whenever a feature feels incomplete:

```bash
npm run foundation:check
npm run check
npm run verify
npm run diagnostics
npm run test:browser
```

`npm run foundation:check` verifies the required Next.js, TypeScript, Tailwind, Prisma, env-template, folder, and base-route foundation. `npm run diagnostics` checks the environment, database, source structure, HTTP routes, auth redirects, protected APIs, security headers, PWA metadata, and SEO metadata. `npm run test:browser` performs a real browser smoke test for the login/sign-up flow and authenticated app routes.

See `docs/TROUBLESHOOTING.md` for the full command guide and failure meanings.

## The Replacement Goal

mesh.me is being built with one massive product ambition:

> **Replace the daily need for the top communication and social media apps.**

The goal is not to copy every app feature one-for-one. The goal is to absorb the most important everyday behaviors from the world's biggest social, messaging, creator, community, and communication platforms into one unified privacy-first experience.

This is the right problem to solve at global scale. We Are Social and GWI reported in April 2026 that 96.7% of online adults use at least one social network or messenger service each month, with 93.8% using social networks and 93.6% using chat or messenger platforms monthly. Messaging is also fragmented across regional and use-case leaders such as WhatsApp, WeChat, Messenger, Telegram, Snapchat, Discord, Line, KakaoTalk, Viber, Signal, and Zalo.

Today, people constantly switch between separate apps for:

- Watching videos
- Posting photos
- Sharing short-form clips
- Sending messages
- Joining group chats
- Following creators
- Checking notifications
- Managing communities
- Viewing analytics
- Posting updates
- Sharing links
- Calling friends
- Saving memories
- Managing their public identity

mesh.me exists to bring those behaviors together.

Instead of opening 20 different apps to manage 20 different versions of yourself, mesh.me gives users one central place to see, control, customize, protect, and share their digital world.

### Apps mesh.me is designed to functionally replace

mesh.me is designed to replace the everyday need for apps across these categories:

#### Social feeds

- Instagram
- Facebook
- X/Twitter
- Threads
- Bluesky
- Pinterest

#### Video and creator platforms

- YouTube
- TikTok
- Twitch
- YouTube Shorts
- Instagram Reels

#### Messaging and calling

- Discord
- Facebook Messenger
- WhatsApp
- Telegram
- Signal
- Snapchat
- FaceTime-style calling
- Group chat apps

#### Communities and forums

- Discord servers
- Facebook Groups
- Reddit
- Creator fan communities
- Private friend groups

#### Creator dashboards

- YouTube Studio
- TikTok analytics
- Instagram insights
- Twitch creator tools
- Cross-platform analytics tools

#### Notification hubs

- Native app notifications
- Creator alerts
- Message notifications
- Comment notifications
- Follow notifications
- Livestream alerts
- Security alerts

mesh.me should become the place users open first.

### Replacement Philosophy

mesh.me should not feel like a clone of existing apps.

It should feel like the next step after them.

Each major platform solved one piece of the social internet:

- YouTube solved long-form video.
- TikTok solved short-form discovery.
- Instagram solved visual identity.
- X and Threads solved public conversation.
- Facebook solved family and group updates.
- Discord solved community chat.
- Messenger, WhatsApp, Telegram, Signal, and Snapchat solved private communication.
- Reddit solved topic-based communities.
- Twitch solved live creator interaction.

mesh.me brings these behaviors together inside one connected ecosystem.

The product should replace app-switching, not creator credit.

When content comes from another platform, mesh.me must clearly show the original source, creator, and platform. When APIs allow it, interactions should sync back to the original platform so creators still receive proper engagement.

mesh.me is not a content thief.

mesh.me is the user's universal interaction layer.

### The Top 20 Replacement Standard

Every major feature in mesh.me should be judged against this question:

> **Does this reduce the user's need to open another social or communication app?**

If the answer is yes, the feature supports the replacement goal.

The product should eventually replace the daily need for the top 20 communication and social apps by combining:

- Feed browsing
- Video discovery
- Messaging
- Group chats
- Communities
- Creator analytics
- Notifications
- Profiles
- Posting
- Cross-platform sharing
- Privacy controls
- Saved content
- Shared scrolling
- Voice and video calls
- Creator monetization
- Digital identity management

The goal is for users to think:

> "I don't need to check five apps. I'll just open mesh.me."

### Practical Replacement Layers

Because every external platform has different API rules, mesh.me should replace other apps in layers.

#### Layer 1: Native Replacement

Features mesh.me fully owns and controls:

- Mesh.me profiles
- Mesh.me posts
- Mesh.me Feed
- MeChat
- Communities
- Notifications
- Analytics
- Mesh Vault
- Meshi customization
- Privacy controls
- Mesh Pro

These features should work even if no external account is connected.

#### Layer 2: Connected Hub Replacement

Features powered by official integrations:

- Connected account display
- Imported posts
- Platform-labeled content
- External analytics where available
- External notifications where available
- External posting where available
- Interaction syncing where available

This reduces the need to open external apps.

#### Layer 3: Embedded Experience Replacement

For platforms that limit API access, mesh.me should still support:

- Link previews
- Rich embeds
- Saved references
- Shared content cards
- Manual organization
- Vault storage
- MeChat sharing
- Mesh visualization

This still makes mesh.me useful even when full syncing is unavailable.

#### Layer 4: Full Ecosystem Replacement

The long-term goal is for users to be able to live primarily inside mesh.me:

- Post from mesh.me
- Message from mesh.me
- Scroll from mesh.me
- Watch from mesh.me
- Analyze from mesh.me
- Manage privacy from mesh.me
- Join communities from mesh.me
- Save memories from mesh.me
- Control their identity from mesh.me

This is the final form of the product.

### Replacement Without Exploitation

mesh.me should replace major social and communication apps without inheriting their worst problems.

mesh.me should avoid:

- Ads
- Data selling
- Dark patterns
- Feed manipulation
- Addictive engagement loops
- Hidden privacy settings
- Corporate-feeling design
- Creator credit theft
- Confusing permissions
- Notification spam
- Algorithmic pressure

The product should feel like a cleaner, safer, more personal version of the social internet.

### Core Product Statement

mesh.me is the privacy-first social hub designed to replace the daily need for the top communication and social media apps.

It combines the feed, the profile, the inbox, the group chat, the creator dashboard, the notification center, the privacy dashboard, the saved-content archive, and the user's digital identity into one connected world.

**Your World, Your Way.**

Sources: [Digital 2026 Mid-Year Global Update Report][we-are-social-2026] and [Most Popular Messaging Apps (2026)][messaging-apps-2026].

## Getting Started

```bash
npm install
cp .env.example .env.local
npx prisma generate
npx prisma db push
npm run foundation:check
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## Features

- **The Mesh** - Interactive constellation network visualization of your social graph
- **Custom Feed** - Universal scrolling feed with layout modes (Instagram/Twitter/TikTok/YouTube)
- **MeChat** - Unified messaging across platforms
- **Connected Accounts** - Link 17+ OAuth platforms plus manual/API-limited platforms
- **Communities** - Create, join, and moderate community spaces
- **Smart Notifications** - Intelligent notification summaries
- **Expressive Profiles** - Rich identity with accent colors, interest tags, and customization
- **Admin Panel** - Moderation queue, user management, analytics
- **Security** - Rate limiting, account lockout, input sanitization, XSS prevention

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Database:** SQLite/libSQL via Prisma
- **ORM:** Prisma
- **Animation:** Framer Motion, HTML5 Canvas
- **UI:** Custom design system with glass morphism effects

## Architecture

- `src/app/` - Next.js App Router pages and API routes
- `src/components/` - Reusable UI components
- `src/lib/` - Server actions, queries, auth, utilities
- `prisma/` - Database schema and migrations

## Platform Authorization

OAuth providers are configured in `src/lib/oauth.ts`; connection diagnostics are exposed through `/api/auth/platforms` for signed-in users. Mesh.me stores provider tokens encrypted and mirrors granted OAuth scopes into `PlatformPermission` records so privacy controls can show what each connection is allowed to do.

Current OAuth connection coverage includes GitHub, Discord, Spotify, X/Twitter, Twitch, YouTube, Instagram, Facebook, LinkedIn, Reddit, TikTok, Pinterest, Snapchat, Threads, SoundCloud, Patreon, and Dribbble.

Platforms that do not expose a stable consumer OAuth flow are intentionally handled as manual/API-limited links until a safe official integration exists. That includes Bluesky, Apple Music, Mastodon, Substack, Medium, DEV, Behance, WhatsApp, Telegram, Signal, Line, Kakao, Viber, WeChat, Messenger, and Tumblr.

## Deploy on Vercel

The easiest way to deploy is via [Vercel](https://vercel.com).

## Launch Readiness

Before public release, run:

```bash
npm run launch:check
npm run roadmap:check
```

`launch:check` validates critical launch blockers and warns on non-blocking launch tasks.

`roadmap:check` measures engineering-roadmap implementation signals across all roadmap phases.

Use `PUBLIC_LAUNCH_MASTER_CHECKLIST.md` for a complete owner-based go-live checklist (1300+ lines).

[we-are-social-2026]: https://wearesocial.com/nl/blog/2026/04/digital-2026-mid-year-global-update-report/
[messaging-apps-2026]: https://explodingtopics.com/blog/messaging-apps-stats
