# Project Foundation

Mesh.me is already scaffolded as a production Next.js application. This document is the contract for the baseline project setup so future feature work does not drift from the core foundation.

## Stack

- Next.js 16 App Router in `src/app`
- React 19 and TypeScript with strict mode enabled
- Tailwind CSS v4 through `@tailwindcss/postcss`
- Prisma 7 with the libSQL adapter
- SQLite/libSQL development database at `file:./prisma/dev.db`
- App Router API routes under `src/app/api`
- Server auth helpers in `src/lib/auth.ts`
- Database client wiring in `src/lib/prisma.ts`
- Global request hardening and auth redirects in `src/proxy.ts`

## Required Setup Files

- `package.json` for scripts and dependencies
- `tsconfig.json` for strict TypeScript and `@/*` path aliases
- `next.config.ts` for Next.js, images, and security headers
- `postcss.config.mjs` for Tailwind CSS v4
- `eslint.config.mjs` for Next.js linting
- `prisma.config.ts` for Prisma CLI config
- `prisma/schema.prisma` for the social data model
- `.env.example` for all local and deployment environment keys

## Environment

Start from `.env.example` and create `.env.local`.

Required local keys:

- `DATABASE_URL`
- `AUTH_SECRET`
- `NEXT_PUBLIC_APP_URL`

Required production keys:

- `DATABASE_URL`
- `DATABASE_AUTH_TOKEN` when using hosted libSQL
- `AUTH_SECRET`
- `APP_DATA_ENCRYPTION_KEY`
- `NEXT_PUBLIC_APP_URL`

Optional integration keys live in `.env.example` for OAuth providers, adult verification, Turnstile, and Stripe.

## Database

The Prisma schema uses SQLite/libSQL and generates the client into `src/generated/prisma`.

Core commands:

```bash
npx prisma generate
npx prisma db push
npm run build
```

The production build runs `prisma generate` before `next build`, so a fresh deployment has a generated client before the app compiles.

## Folder Structure

```text
src/app/                  App Router pages, layouts, errors, metadata, API routes
src/app/(app)/            Authenticated product routes
src/app/api/              Route handlers for app APIs and integrations
src/components/           Product UI, layout, Mesh, Meshi, feed, settings
src/lib/                  Auth, Prisma, security, platform, Meshi, Stripe helpers
src/hooks/                Client hooks
src/generated/prisma/     Generated Prisma client output
prisma/                   Schema, migrations, local dev database, seed script
scripts/                  Diagnostics and release checks
docs/                     Product and engineering documentation
public/                   Static assets and app icons
```

## Base Routing

Public routes:

- `/`
- `/login`
- `/signup`
- `/reset-password`
- `/privacy`
- `/terms`
- `/trust`
- `/roadmap`
- `/vision`

Authenticated app routes:

- `/mesh`
- `/feed`
- `/messages`
- `/analytics`
- `/search`
- `/notifications`
- `/profile`
- `/settings`
- `/account/delete`

Core API routes:

- `/api/health`
- `/api/auth/logout`
- `/api/auth/platforms`
- `/api/feed`
- `/api/mesh`
- `/api/meshi/chat`
- `/api/messages`
- `/api/search`
- `/api/stripe/checkout`
- `/api/stripe/webhook`

## Validation

Run these before shipping foundation-sensitive changes:

```bash
npm run foundation:check
npm run lint
npm run build
```

`npm run check` includes the foundation check, launch readiness, roadmap readiness, diagnostics, and linting.
