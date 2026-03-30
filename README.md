# mesh.me

A next-generation social identity platform built with Next.js, TypeScript, Tailwind CSS, Prisma, and PostgreSQL.

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
- **Database:** PostgreSQL / SQLite (dev)
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
