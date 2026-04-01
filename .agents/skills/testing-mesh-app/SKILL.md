# Testing mesh.me Application

## Local Dev Setup

```bash
cd mesh-app
npm install
npx next dev -p 3333
```

The app runs at http://localhost:3333. Uses SQLite locally (dev.db in project root).

## Authentication for Testing

- The local dev DB has seed users (alexcreates, mayamusic, jordandev, lunawrites, samfilms)
- Passwords are bcrypt hashed. To reset a test user's password:
  ```bash
  node -e "const b=require('bcryptjs');console.log(b.hashSync('testpass123',12));"
  sqlite3 dev.db "UPDATE User SET passwordHash='<hash>' WHERE username='alexcreates';"
  ```
- Login flow: Go to /login -> enter username -> enter password -> redirects to /mesh
- The production site (meshme.vercel.app) uses Turso DB, not local SQLite
- **Important**: Vercel preview deployments may fail with server-side errors if the preview branch uses `file:./dev.db` (local SQLite) instead of Turso. Test locally when preview deployment has DB errors.
- **Authenticated redirect**: When already logged in, /login and /signup redirect to /mesh automatically.

## Devin Secrets Needed

- `GITHUB_USERNAME` / `GITHUB_PASSWORD` - For GitHub repo access and PR creation
- Turso credentials (DATABASE_URL, AUTH_TOKEN) - For production database access
- Vercel token - For production deployments

## Navigation Reference

### Sidebar (always visible on authenticated pages)
- The Mesh (/mesh)
- Feed (/feed)
- Notifications (/notifications) — shows badge count for unread
- Profile (/profile/{username})
- Admin (/admin) — only visible to admin users

### Meshi Command Center (click Meshi mascot bottom-right)
Opens a menu with organized sections:
- **Quick Actions**: Ask Meshi (chat), Create Post (/feed?compose=true), Search Mesh (/search)
- **Navigate**: Explore (/explore), Messages (/messages), Communities (/communities), Connected Accounts (/connected-accounts)
- **Settings & More**: Customize Meshi (/settings?tab=meshi), Settings (/settings), MeshPro (/meshpro), Send Feedback (/feedback), Full Chat with Meshi

## Key Testing Paths

### Feed (/feed)
- **Navigation**: Sidebar -> "Feed"
- **Layout switching**: 5 layout toggle icons in top-right of feed page (Timeline, Grid, Reels, Compact, Cards)
  - Timeline: Classic scrolling feed with PostCard components (has clickable links to post detail)
  - Grid: 3-column square tiles (Instagram style)
  - Reels: Full-screen snap-scroll cards (TikTok style) — note: posts are NOT directly clickable in this layout
  - Compact: Dense thread view (Reddit style) — entire row is clickable
  - Cards: Large card format (Facebook style)
- **Infinite scroll**: Scroll to bottom of feed. If fewer than 20 posts, shows "You've reached the end". If more, triggers IntersectionObserver to load next page via `/api/feed/paginated`.
- **Feed source tabs**: "For You" / "Following" / "Discover" — currently placeholder UI
- **Post composer**: At top of feed, "What's happening?" textarea with Post button

### Post Detail (/feed/[postId])
- **Navigation**: Click on a post card in Timeline or Cards layout, or click a grid tile/compact row
- **Features**:
  - Back arrow + "Back" button at top (uses router.back())
  - Author info: avatar, display name, @username, timestamp, community badge
  - Full post content with media gallery and tags
  - Engagement stats: "X likes . Y comments . Z reposts"
  - Action buttons: Like (heart toggle), Comment, Repost, Copy link, Bookmark
  - Comment section: textarea + send button, threaded replies
- **Like toggle**: Click heart icon — count increments/decrements.

### Profile (/profile/[username])
- **Navigation**: Sidebar -> "Profile" (resolves to `/profile/{currentUser.username}`)
- **Profile completeness meter**: Shows "Complete your profile" card with percentage and 8-item checklist:
  - Profile photo, Cover image, Bio, Location, Website, Interests (3+), Links, Connected platform
  - Hidden when profile is 100% complete
  - Progress bar animates with framer-motion
- **Profile tabs**: Posts, Media, About, Communities

### Notifications (/notifications)
- **Navigation**: Sidebar -> "Notifications" (has badge count)
- **Category tabs**: All, Likes, Comments, Follows, Messages, Reposts
- **Smart summary**: Appears when 3+ unread notifications
- **Mark all read**: Button in top-right

### Settings (/settings) — 14 Tabs
- **Navigation**: Meshi command center -> "Settings" or direct URL
- **Tab list**: Profile, Interests & Links, Customize, Alter Egos, Notifications, Privacy & Safety, Mesh Privacy, Security, Security Hub, Digital Footprint, Blocked Users, Achievements, Meshi (Beta), MeshPro
- **URL tab param**: /settings?tab={tabId} (e.g., /settings?tab=meshi)
- Key tabs to test:
  - **Profile**: Edit display name, bio, location, website, accent color, avatar/banner upload
  - **Customize**: Theme options (Midnight, Deep Ocean, Dark Violet, Charcoal), feed layout defaults
  - **Alter Egos**: Create/delete pseudo-accounts with username, display name, bio
  - **Mesh Privacy**: Visibility (Private/Friends/Public/Custom), Global Mesh opt-in
  - **Achievements**: Badge list with unlock status, active title selector
  - **Meshi (Beta)**: Expression picker (8 moods), Hat picker (7 hats), Color picker (8 colors), code redeemer
  - **MeshPro**: Pricing display with Monthly/Yearly toggle, Subscribe buttons

### MeshPro (/meshpro)
- **Navigation**: Meshi command center -> "MeshPro" or direct URL
- **Current status**: Payment button shows "Coming Soon" — no payment flow implemented yet
- **Pricing toggle**: Monthly ($4.99/mo) / Yearly ($3.33/mo billed $39.99/yr with 33% savings badge)
- **Feature grid**: 6 premium feature cards
- **Bottom section**: "mesh.me is free forever" with 8 free features

### Mesh Canvas (/mesh)
- **Navigation**: Sidebar -> "The Mesh" (first nav item)
- **Node types**: self (center), user, community, interest, post, platform
- **Filter tabs**: Everything, People, Communities, Interests, Posts
- **Interactions**:
  - Hover over node -> tooltip with details
  - Single-click user node -> profile preview panel
  - Double-click user node -> enters their mesh (multi-user exploration)
  - Scroll -> zoom in/out
  - Keyboard: R (reset view), L (toggle labels), 1-7 (filters), Cmd+K (search)
- **Stats bar**: Shows count of people, communities, interests, posts at bottom

### Search (/search)
- **Navigation**: Meshi command center -> "Search Mesh" or direct URL
- **Features**: Live search as you type, suggested searches (8 tags), recent searches with clear
- **Filter tabs**: All, People, Posts, Communities
- **Results**: Users with verified badges, posts with engagement stats, communities with member counts

### Explore (/explore)
- **Sections**: Trending Tags, People You Might Vibe With, Trending Posts, Rising Communities

### Messages/MeChat (/messages)
- **Features**: Thread list, search, New Chat button, individual thread view with message bubbles

### Communities (/communities)
- **Features**: Community cards with join/joined states, member/post counts, Create community button

### Feedback (/feedback)
- **Features**: 4 feedback types (Bug/Feature/Improvement/General), subject, page/feature dropdown, details, star rating, email

### Admin (/admin)
- **Features**: Stats cards (Total Users/Posts/Communities/Pending Reports), Growth analytics, Platform Health, User Management with Suspend buttons, Moderation Queue

### Public Pages (no auth required)
- / (landing) — redirects to /feed when authenticated
- /login — redirects to /mesh when authenticated
- /signup — redirects to /mesh when authenticated
- /about — mesh.me manifesto and principles
- /terms — Terms of Service
- /privacy — Privacy Policy

## Build & Lint

```bash
npm run lint
npx next build
```

## Database

- Prisma schema at `prisma/schema.prisma`
- After schema changes: `npx prisma generate` then `npx prisma migrate dev`
- ProfileInfo model stores Facebook-level fields with per-field JSON privacy
- Local dev DB has ~18 seed posts across multiple users and communities

## Common Issues

- If sqlite3 CLI is not installed: `sudo apt-get install -y sqlite3`
- Dev DB might not exist on fresh clone - run `npx prisma migrate dev` to create
- The canvas is rendered with Canvas 2D API, not a library - interactions are custom event handlers on the canvas element
- Preview deployments on Vercel may fail if DATABASE_URL points to local SQLite — use local dev server for testing in this case
- When testing in Reels layout, posts don't have direct click-through links — switch to Timeline or Compact layout to navigate to post detail pages
- Port 3333 may already be in use from a previous session — kill with `fuser -k 3333/tcp` before restarting
- The "1 Issue" badge in bottom-left of browser is a Next.js dev-mode indicator, not an app bug
