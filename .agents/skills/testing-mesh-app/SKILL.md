# Testing mesh.me Application

## Local Dev Setup

```bash
cd mesh-me
npm install
npx next dev -p 3333
```

The app runs at http://localhost:3333 (port 3333 is used to avoid conflicts). Uses SQLite locally (dev.db in project root).

## Authentication for Testing

- The local dev DB has seed users (alexcreates, mayamusic, jordandev, lunawrites, samfilms)
- Passwords are bcrypt hashed. To reset a test user's password:
  ```bash
  node -e "const b=require('bcryptjs');console.log(b.hashSync('testpass123',12));"
  sqlite3 dev.db "UPDATE User SET passwordHash='<hash>' WHERE username='alexcreates';"
  ```
- Login flow: Go to /login → enter username → enter password → redirects to /mesh
- The production site (meshme.vercel.app) uses Turso DB, not local SQLite
- **Important**: Vercel preview deployments may fail with server-side errors if the preview branch uses `file:./dev.db` (local SQLite) instead of Turso. Test locally when preview deployment has DB errors.

## Devin Secrets Needed

- `GITHUB_USERNAME` / `GITHUB_PASSWORD` - For GitHub repo access and PR creation
- Turso credentials (DATABASE_URL, AUTH_TOKEN) - For production database access
- Vercel token - For production deployments

## Key Testing Paths

### Feed (/feed)
- **Navigation**: Sidebar → "Feed"
- **Layout switching**: 5 layout toggle icons in top-right of feed page (Timeline, Grid, Reels, Compact, Cards)
  - Timeline: Classic scrolling feed with PostCard components (has clickable links to post detail)
  - Grid: 3-column square tiles (Instagram style)
  - Reels: Full-screen snap-scroll cards (TikTok style) — note: posts are NOT directly clickable in this layout
  - Compact: Dense thread view (Reddit style) — entire row is clickable
  - Cards: Large card format (Facebook style)
- **Infinite scroll**: Scroll to bottom of feed. If fewer than 20 posts, shows "You've reached the end". If more, triggers IntersectionObserver to load next page via `/api/feed/paginated`.
- **Feed source tabs**: "For You" / "Following" / "Discover" — currently placeholder UI (non-functional)
- **Post composer**: At top of feed, "What's happening?" textarea with Post button

### Post Detail (/feed/[postId])
- **Navigation**: Click on a post card in Timeline or Cards layout, or click a grid tile/compact row
- **Features**:
  - Back arrow + "Back" button at top (uses router.back())
  - Author info: avatar, display name, @username, timestamp, community badge
  - Full post content with media gallery and tags
  - Engagement stats: "X likes · Y comments · Z reposts"
  - Action buttons: Like (heart toggle), Comment, Repost, Copy link, Bookmark
  - Comment section: textarea + send button, threaded replies
- **Like toggle**: Click heart icon — count increments/decrements. Uses functional updater pattern to avoid stale closure bugs on rapid clicks.
- **Comment count**: Both heading and stats use `post._count.comments` (includes all replies) for consistency.

### Profile (/profile/[username])
- **Navigation**: Sidebar → "Profile" (resolves to `/profile/{currentUser.username}`)
- **Profile completeness meter**: Shows "Complete your profile" card with percentage and 8-item checklist:
  - Profile photo, Cover image, Bio, Location, Website, Interests (3+), Links, Connected platform
  - Hidden when profile is 100% complete
  - Progress bar animates with framer-motion
- **Profile tabs**: Posts, Media, About, Communities

### Mesh Canvas (/mesh)
- **Navigation**: Sidebar → "The Mesh" (first nav item)
- **Node types**: self (center), user, community, interest, post, platform
- **Interactions**:
  - Hover over node → tooltip with details (at zoom >= 0.5x)
  - Single-click user node → profile preview panel on right
  - Double-click user node → enters their mesh (multi-user exploration)
  - Scroll → zoom in/out
  - Keyboard: R (reset view), L (toggle labels), 1-7 (filters), Cmd+K (search)
- **Multi-user exploration**: Double-click user node → loading overlay → their mesh loads → "Back to my mesh" button at top center
- **Edge rendering**: Edges between nodes vary in thickness based on interactionCount
- **Node sizing**: Nodes scale in radius based on connection count
- **Zoom controls**: Vertically centered on the right edge of the canvas (top-1/2 -translate-y-1/2). Contains Zoom in, Zoom out, Reset view, Hide labels, Hide stats buttons.
- **Action bar**: Bottom-left contains Create Post, Content Hub, Privacy buttons.
- **Stats bar**: Shows node counts (people, communities, interests, posts) and zoom percentage above the action bar.

### MeshiFloat (bottom-right floating companion)
- Click Meshi mascot → opens actions menu above Meshi
- **Actions menu sections**:
  - Quick Actions: Ask Meshi, Create Post, Search Mesh
  - Navigate: Explore, Messages, Communities, Connected Accounts
  - Settings & More: Customize Meshi, Settings, MeshPro, Send Feedback, Full Chat with Meshi
- Menu positioned at `bottom-[72px] right-4` with `z-50`
- Meshi itself uses `z-40`, size is 48px
- **Safe positioning**: Meshi docks bottom-right with safe insets:
  - Desktop: 16px from right edge, 16px from bottom
  - Mobile (<1024px): 16px from right edge, 80px from bottom (above mobile nav)
- **Drag behavior**: Meshi is draggable. Drag bounds respect safe zones. Releasing near bottom-right corner snaps back to safe position.
- **Z-index hierarchy**: Mobile nav (z-50) > Meshi actions menu (z-50) > Meshi (z-40) > zoom controls (z-10)

### Profile Preview Panel
- Click any user node → panel slides in from right
- Shows: avatar, name, username, mutual status, follower/post counts, shared interests
- Action buttons: Message, Follow/Unfollow
- Node visibility controls: Hide node, Hide all users

## Testing Meshi Positioning

When testing Meshi layout changes:
1. **Desktop Mesh page**: Verify zoom controls are vertically centered on right edge (NOT bottom-right), Meshi is at bottom-right with ~16px clearance, clear vertical separation between them
2. **Mobile viewport**: Use Chrome DevTools device toolbar (Ctrl+Shift+M) to switch to 375-400px width. Verify Meshi sits ABOVE the bottom nav bar (6 items: Mesh, Feed, Explore, Chat, Alerts, Profile)
3. **Actions menu**: Click Meshi → menu should open above it without covering zoom controls or extending below viewport
4. **Other pages**: Navigate to Feed, Settings, etc. and verify Meshi doesn't cover interactive elements like buttons or form inputs
5. **Zoom functionality**: Click each zoom button and verify the mesh actually zooms (check percentage indicator changes)

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
- The dev server port might vary — check which port is being used (commonly 3000 or 3333). Use `-p` flag to specify.
- When testing mobile viewport, the page may need a reload after switching to device toolbar mode for Meshi to recalculate its safe position.
