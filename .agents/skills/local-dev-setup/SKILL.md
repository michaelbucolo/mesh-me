# mesh.me Local Development Setup

## Prerequisites
- Node.js 18+
- Working directory: `mesh-app/`

## Database Setup

### Critical: SQLite DB Path Resolution
The app uses `@prisma/adapter-libsql` which resolves `file:./dev.db` relative to the **working directory** (project root), NOT relative to the Prisma schema file location.

- `prisma db push` creates/updates `prisma/dev.db` (relative to schema location)
- The Next.js app and seed script both use `dev.db` at the project root
- **You must copy the schema to both locations** or the app will fail with "no such table" errors

```bash
# Correct setup sequence:
cd mesh-app
npx prisma db push          # Creates prisma/dev.db with schema
sqlite3 dev.db < <(sqlite3 prisma/dev.db .dump)  # Copy schema to root
npx tsx prisma/seed.ts       # Seeds root dev.db
```

### After Schema Changes
If new Prisma models are added (e.g., PlatformPost, SyncJob), you must:
1. Delete both `dev.db` and `prisma/dev.db`
2. Run `npx prisma db push` to create fresh schema
3. Copy schema to root: `sqlite3 dev.db < <(sqlite3 prisma/dev.db .dump)`
4. Run seed: `npx tsx prisma/seed.ts`
5. **Restart the dev server** - the Prisma client caches the DB connection

## Dev Server
```bash
npx next dev -p 3333
```
- Runs on http://localhost:3333
- Uses `.env.local` for configuration
- `DATABASE_URL="file:./dev.db"` in `.env.local`

## Test Accounts (from seed)
- Admin: `alexcreates` / `password123`
- User: `demouser` / `password123`
- User: `mayamusic` / `password123`

## Secrets Needed
No secrets required for local development. OAuth platform connections require platform-specific credentials stored as:
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- (and similar for other platforms)

## Common Issues
- **Port in use**: Run `fuser -k 3333/tcp` before starting dev server
- **Stale DB cache**: Restart dev server after any DB changes
- **Vercel preview errors**: If PR adds new Prisma models, the Vercel/Turso production DB may not have them. Test locally instead.
- **Seed script unique constraint**: If seed fails with unique constraint error, delete both `dev.db` files and start fresh
