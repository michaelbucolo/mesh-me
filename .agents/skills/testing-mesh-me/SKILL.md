# Testing mesh.me

## Local Dev Setup

1. Run `npm run dev` from `/home/ubuntu/mesh.me/mesh-app` to start the Next.js dev server on port 3000
2. The app uses a local SQLite database at `dev.db` (via Prisma + libSQL)
3. The Vercel preview deployment connects to the production Turso database — test accounts from the local seed won't work there

## Test Accounts

- Seeded test users: `alexcreates`, `mayamusic`, `jordandev`, `lunawrites`, `samfilms` and others
- Default password for all seed accounts: see `prisma/seed.ts` for the plaintext value used in bcrypt hashing
- The app redirects authenticated users from `/login` to `/feed` automatically
- If already logged in from a previous session, navigating to `localhost:3000` will load the app directly

## Navigation Architecture

### Sidebar (Desktop — `src/components/layout/sidebar.tsx`)
- 4 core nav items: The Mesh (`/mesh`), Feed (`/feed`), Notifications (`/notifications`), Profile (`/profile/{username}`)
- "Need something?" hint box directs users to Meshi command center
- Admin link visible only for admin users
- User section at bottom with avatar, name, logout

### Mobile Nav (`src/components/layout/mobile-nav.tsx`)
- Matches sidebar: 4 tabs (Mesh, Feed, Alerts, Profile)
- Test mobile by resizing browser window below `lg` breakpoint (~1024px)

### Meshi Command Center (`src/components/meshi/meshi-float.tsx`)
- Click the floating Meshi mascot in bottom-right corner to open
- 3 sections: Quick Actions, Navigate, Settings & More
- All navigation uses Next.js `router.push()` for client-side transitions
- Menu should close cleanly before navigating (uses `closeAll()` pattern)
- Test scrolling on short viewports — menu has `max-h-[70vh]` with `overflow-y-auto`

## Key Pages to Test

### Feed (`/feed`)
- Header: "Feed" title + inline icon toggle bar (5 layout options)
- Layouts: timeline, grid, reels, compact, cards — click icons to switch
- Layout preference persists in localStorage (`meshFeedLayout`)
- Post composer at top with media/tag/community attachment options

### Mesh (`/mesh`)
- Canvas-based visualization — may take a moment to render
- Compact filter pills at top (Everything, People, Communities, Interests, Posts)
- Icon-only Search and Footprint buttons in top-right

### Explore (`/explore`)
- Simple header: "Explore" + subtitle
- Sections: Trending tags, People you might vibe with, Trending posts, Rising communities

### Settings (`/settings`)
- Accessible via Meshi command center → Settings
- Multiple tabs: Profile, Interests & Links, Customize, Privacy & Safety, etc.

## Devin Secrets Needed

- `GITHUB_USERNAME` / `GITHUB_PASSWORD` — for GitHub access and PR creation
- `BUSINESS_EMAIL` / `BUSINESS_EMAIL_PASSWORD` — for Google/OAuth related testing
- Turso database credentials may be needed for production database testing
- Vercel token may be needed for deployment operations

## Common Issues

- The Vercel preview URL uses production Turso DB, so local seed data won't exist there. Test locally against `localhost:3000` for seeded data.
- If the dev server isn't running, start it with `npm run dev` in the mesh-app directory
- The `1 Issue` badge in bottom-left of the app is a Next.js dev mode indicator, not a bug
- Meshi mascot might not appear immediately on page load — it has an animation entrance delay
