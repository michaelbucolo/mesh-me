# mesh.me

Your World, Your Way.

mesh.me is a privacy-first social media platform and digital identity hub. It is designed to unify a user's posts, comments, likes, followers, messages, connected platforms, analytics, and privacy controls into one consumer-first experience.

See `docs/PRODUCT_VISION.md` and `docs/ENGINEERING_ROADMAP.md` for the product direction and phased implementation plan.

## Getting Started

```bash
npm install
npx prisma generate
npx prisma db push
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## Features

- **The Mesh** — Interactive constellation network visualization of your social graph
- **Custom Feed** — Universal scrolling feed with layout modes (Instagram/Twitter/TikTok/YouTube)
- **MeChat** — Unified messaging across platforms
- **Connected Accounts** — Link 16+ social platforms
- **Communities** — Create, join, and moderate community spaces
- **Smart Notifications** — Intelligent notification summaries
- **Expressive Profiles** — Rich identity with accent colors, interest tags, and customization
- **Admin Panel** — Moderation queue, user management, analytics
- **Security** — Rate limiting, account lockout, input sanitization, XSS prevention

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Database:** SQLite/libSQL via Prisma
- **ORM:** Prisma
- **Animation:** Framer Motion, HTML5 Canvas
- **UI:** Custom design system with glass morphism effects

## Architecture

- `src/app/` — Next.js App Router pages and API routes
- `src/components/` — Reusable UI components
- `src/lib/` — Server actions, queries, auth, utilities
- `prisma/` — Database schema and migrations

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

