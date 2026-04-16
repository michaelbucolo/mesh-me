# Testing mesh.me Application

## Local Dev Setup

```bash
cd mesh-me
npm install

# Database setup (SQLite dev DB has path resolution quirks)
npx prisma db push              # Creates prisma/dev.db
sqlite3 dev.db < <(sqlite3 prisma/dev.db .dump)  # Copy schema to root
npx tsx prisma/seed.ts           # Seed root dev.db

# Start dev server
npx next dev -p 3333
```

The app runs at http://localhost:3333 (port 3333 is used to avoid conflicts). Uses SQLite locally (dev.db in project root).

**Important**: `file:./dev.db` in the Prisma schema resolves to the project root at runtime, but `prisma db push` creates it inside `prisma/`. You must copy the schema to root and seed the root copy. After schema changes, delete BOTH `dev.db` files and redo the setup.

### Schema Sync (Critical)

If the Prisma schema has been updated with new fields but the local SQLite DB hasn't been migrated, **all user queries will crash** with errors like `SQLITE_ERROR: no such column: main.User.showInDiscovery`.

**Fix options:**
1. **Best**: Delete both `dev.db` files and redo full setup (push + copy + seed)
2. **Quick**: Add missing columns directly:
   ```bash
   sqlite3 dev.db "ALTER TABLE User ADD COLUMN columnName TYPE NOT NULL DEFAULT value;"
   ```
3. After any DB fix, restart the dev server with a clean cache:
   ```bash
   rm -rf .next
   npx next dev -p 3333
   ```

**How to detect**: If you see "Something went wrong" on any page, check the browser console (F12) for the actual Prisma/SQLite error. The server console may also show the error.

## Authentication for Testing

- The local dev DB has seed users (alexcreates, mayamusic, jordandev, lunawrites, samfilms)
- Passwords are bcrypt hashed. To reset a test user's password:
  ```bash
  node -e "const b=require('bcryptjs');console.log(b.hashSync('testpass123',12));"
  sqlite3 dev.db "UPDATE User SET passwordHash='<hash>' WHERE username='alexcreates';"
  ```
- Login flow: Go to / → click "Sign in" → enter username → click "Continue" → enter password → click "Sign in" → redirects to /mesh
- Test accounts: `alexcreates/password123` (admin), `demouser/password123`, `mayamusic/password123`
- The production site (meshme.vercel.app) uses Turso DB, not local SQLite
- **Important**: Vercel preview deployments may fail with server-side errors if the preview branch uses `file:./dev.db` (local SQLite) instead of Turso. Test locally when preview deployment has DB errors.

### Playwright Headless Login Flow

When GUI tools (computer, recording, browser_console) are unavailable, use Playwright headless chromium for automated testing:

```javascript
const { chromium } = require('playwright');
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();

// Login flow (3-step: welcome → credentials → password)
await page.goto('http://localhost:3333', { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForTimeout(2000);

// Step 1: Click "Sign in" on welcome page
await page.locator('button:has-text("Sign in")').first().click();
await page.waitForTimeout(1000);

// Step 2: Fill username and click Continue
await page.locator('input[type="text"]').first().fill('alexcreates');
await page.locator('button:has-text("Continue")').first().click();
await page.waitForTimeout(1500);

// Step 3: Fill password and submit
await page.locator('input[type="password"]').first().fill('password123');
await page.locator('button[type="submit"]:has-text("Sign in")').first().click();
await page.waitForTimeout(4000);

// Verify: URL should now be /mesh
console.log(page.url()); // http://localhost:3333/mesh
```

**Key selector details** (from `src/components/mesh-entry.tsx`):
- Welcome page has TWO buttons: "Join the Mesh" (signup) and "Sign in" (login)
- Credentials step: username input is `input[type="text"]` with placeholder "username or email" (login mode)
- Credentials step: submit button text is "Continue" (not "Sign in")
- Login-password step: password input is `input[type="password"]` with placeholder "Password"
- Login-password step: submit button is `button[type="submit"]` with text "Sign in"

**Common login failures**:
- If you try `input[name="username"]` or `input[placeholder*="username" i]` — these may not match because the input has no `name` attribute and placeholder text changes based on login vs signup mode
- The landing page (/) uses `min-h-screen` layout; the authenticated app uses `h-[100dvh]`. If your viewport test finds `min-h-screen`, login failed.
- After successful login, app redirects to `/mesh` (page.tsx line 8: `if (user?.onboarded) redirect("/mesh")`)

## Devin Secrets Needed

- `GITHUB_USERNAME` / `GITHUB_PASSWORD` - For GitHub repo access and PR creation
- Turso credentials (DATABASE_URL, AUTH_TOKEN) - For production database access
- Vercel token - For production deployments

## Key Testing Paths

### Sidebar Navigation
- **Structure**: Three labeled groups plus bottom section
  - **CORE**: The Mesh, Feed, Explore
  - **SOCIAL**: MeChat (badge shows unread count), Notifications (badge shows unread count), Communities
  - **MANAGE** (collapsible): Content Hub, Connected Accounts — click group header to collapse/expand, chevron rotates -90° when collapsed
  - **ADMIN** (only for admin users): Admin Console
  - **Bottom** (separate from groups): Profile, Settings, MeshPro
- Badge values for `alexcreates` seed data: MeChat = 1, Notifications = 2
- Sidebar is hidden on mobile (<1024px), replaced by mobile bottom nav

### Header (Desktop)
- **Location**: Sticky top bar, only visible on lg+ screens (hidden on mobile)
- **Content**: 3 icon-only buttons (no text labels) aligned right:
  - Search (magnifying glass) — links to /search, no badge
  - Messages (chat bubble) — links to /messages, badge shows unread count
  - Notifications (bell) — links to /notifications, badge shows unread count
- Badge counts should match sidebar badge counts
- Badge overflow: shows "99+" when count > 99

### Mobile Bottom Nav
- 6 items: Mesh, Feed, Explore, Chat, Alerts, Profile
- Badge overflow: shows "99+" when count > 99
- Uses safe area insets for iOS
- Z-index: z-50 (above Meshi at z-40)

### Connected Accounts (/connected-accounts)
- **Path**: Sidebar → MANAGE → Connected Accounts
- **Platform logos**: All 16 platforms show official SVG brand logos via `PLATFORM_LOGO_MAP` from `src/components/platform-logos.tsx`. Each logo renders inside a colored square matching the platform's brand color.
- **Platforms** (10 active + 6 coming soon):
  - Active (with Connect button): GitHub, Discord, Spotify, YouTube, X/Twitter, TikTok, Twitch, SoundCloud, Threads, Bluesky
  - Coming Soon (grayed out): Instagram, LinkedIn, Reddit, Facebook, Pinterest, Snapchat
- **Key assertion**: Verify SVG logos render (not text fallbacks like "GH", "DC", "SP"). If `PLATFORM_LOGO_MAP` import is broken or keys don't match platform IDs, fallback text icons appear instead.
- **Connect dialog**: Clicking Connect opens a dialog showing the platform logo, import options, and username input.

### Forgot Password Flow
- **Path**: Landing page → "Sign in" → enter username → Continue → password screen → "Forgot password?" link
- **Reset password screen**: Heading "Reset password", email input with mail icon and "you@example.com" placeholder, "Send reset link" button
- **Success screen**: "Check your email" heading, subtitle "We sent a reset link to {email}", Meshi says "Check your inbox!"
- **Backend**: Server action `requestPasswordReset` in `src/lib/actions.ts` — rate limited (3 requests per 15 min), generates 32-byte crypto token with 1-hour expiry, always returns success (prevents email enumeration)
- **Testing note**: Email is not actually sent in dev (console.log only). Verify the transition from reset form to success screen.
- **Gotcha**: On the password screen, the first click on "Forgot password?" might dismiss a Meshi speech bubble instead of navigating. Click again if needed.

### MeshPro Payment Flow
- **Path**: Settings → MeshPro tab → click "Subscribe" on Monthly ($4.99) or Yearly ($39.99)
- **Modal content**: "Subscribe to MeshPro" heading, price/period, feature checklist (6 items), "Continue to payment" button
- **Footer text**: "Apple Pay, Google Pay, and all major cards accepted. Cancel anytime."
- **Real Stripe integration**: The checkout button calls `POST /api/stripe/checkout` which creates a real Stripe Checkout session and redirects to Stripe's hosted payment page.
- **Without Stripe keys**: When `STRIPE_SECRET_KEY` is not configured (typical in local dev), clicking "Continue to payment" shows a red error: **"Payment is not configured yet. Please check back soon."** The button resets from loading state, and the close button (X) remains functional.
- **With Stripe keys**: User is redirected to Stripe Checkout with Apple Pay, Google Pay, and card options enabled.
- **Webhook handling**: `POST /api/stripe/webhook` handles `checkout.session.completed`, `customer.subscription.deleted`, and `invoice.payment_failed` events. Distinguishes transient errors (returns 500 for Stripe retry) from permanent errors (returns 200).
- **Key assertions**:
  - Modal shows correct price ($4.99/month or $39.99/year)
  - Error message appears when Stripe not configured
  - Loading state resets after error (button not stuck spinning)
  - Close button (X) works after error
  - **Backdrop click guard**: Backdrop `onClick` should check `loading` state — if loading, backdrop click should be a no-op to prevent dismissing the modal while checkout is in flight

### Privacy Toggle Persistence
- **Path**: Settings → Privacy & Safety tab
- **Toggles**: Public account (default ON), Show in discovery (default ON), Hide activity status (default OFF), Read receipts (default ON)
- **Persistence**: Toggle click → "Privacy settings updated" success toast → state saved to DB via server action `updatePrivacySettings`
- **Verify**: Toggle a setting, do a full page reload, confirm the toggle state persisted
- **Gotcha**: After clicking a toggle, the page might briefly show a different tab. Navigate back to Privacy & Safety to verify the change before reloading.

### Verification Banner
- **Path**: Any authenticated page when account is >1 month old and email/phone not verified
- **Content**: Shield icon, "Verify your account" heading, email section with "Verify" button, phone section with "Add" button
- **Dismiss**: X button hides banner within session
- **Testing**: Backdate the test user's `createdAt` to trigger the banner:
  ```bash
  sqlite3 dev.db "UPDATE User SET createdAt='2026-02-01T00:00:00.000Z' WHERE username='alexcreates';"
  ```
- **Date calculation**: Uses `setMonth()` with overflow guard (not Date constructor) to handle month-end edge cases correctly

### Onboarding (/onboarding)
- **Path**: Navigate directly to /onboarding
- **3 steps** (streamlined from original 5):
  - Step 0: Meshi mascot, "Welcome to the Mesh", bio textarea (160 char limit), location input (optional), Next button
  - Step 1: "What are you into?" — interest tag buttons (30 options), counter shows "X selected", must pick at least 3 to enable Next
  - Step 2: "Connect your world" — 16 platform buttons (Instagram, YouTube, TikTok, X/Twitter, Twitch, Spotify, SoundCloud, LinkedIn, GitHub, Discord, Snapchat, Pinterest, Reddit, Facebook, Threads, Bluesky), "Enter the Mesh" button
- **Progress bar**: Exactly 3 segments at top, fills as you advance
- **Key assertion**: Verify 3 segments (not 5) to confirm the streamlining worked

### Settings (/settings)
- **Navigation**: Sidebar → "Settings"
- **Architecture**: The Settings page is a slim 269-line shell (`settings/page.tsx`) that manages state and renders 14 extracted tab components from `settings/tabs/`.
- **14 tabs**: Profile, Interests & Links, Customize, Alter Egos, Notifications, Privacy & Safety, Mesh Privacy, Security, Security Hub, Digital Footprint, Blocked Users, Achievements, Meshi (Beta), MeshPro
- **Tab switching**: Click tab in left sidebar (desktop) or horizontal scroll bar (mobile). Each tab renders its own extracted component.
- **URL parameter routing**: Navigate to `/settings?tab=<tab-id>` to deep-link to a specific tab. Tab IDs: `profile`, `interests`, `customize`, `alter-egos`, `notifications`, `privacy`, `mesh-privacy`, `security`, `security-hub`, `footprint`, `blocked`, `achievements`, `meshi`, `meshpro`
- **Key tabs to verify**:
  - Profile: avatar/banner upload, display name, bio, location, website, accent color picker (15 options)
  - Customize: 4 themes (Midnight, Deep Ocean, Dark Violet, Charcoal), 4 feed layouts, background mesh toggle
  - MeshPro: Pricing ($4.99/mo monthly, $39.99/yr yearly = $3.33/mo), 10 feature descriptions, redeem code
  - Meshi (Beta): Expression selector (8), hat selector (7 free + 6 MeshPro), color selector (8 free + 6 MeshPro), enable toggle, achievement titles (8), app logo customization (MeshPro)
- **Desktop sidebar**: Left nav with all 14 tabs + Sign out button at bottom
- **Mobile tabs**: Horizontal scrollable tab bar above content, Sign out at bottom of content

### Meshi Tab — MeshPro Cosmetics Gating
- **Path**: `/settings?tab=meshi`
- **MeshPro-exclusive hats** (6): headphones, halo, wizard, astronaut, pirate, chef
  - Non-MeshPro users see these with Lock icons, `opacity-50`, and `disabled` attribute
  - MeshPro users see them fully enabled
- **MeshPro-exclusive colors** (6): crimson, midnight, rose, emerald, arctic, obsidian
  - Same Lock icon + opacity-50 + disabled gating as hats
  - Each color button renders a Meshi mascot SVG preview in the selected color
- **"MeshPro Exclusive" labels**: 2 section labels (one for hats, one for colors)
- **isMeshPro prop chain**: `getUserSettings()` query → `settings/page.tsx` → `MeshiTab` component. If `isMeshPro` is not threaded properly, cosmetics may default to all-locked or all-unlocked incorrectly.
- **Achievement Titles section**: h3 "Title" heading, 8 titles (Explorer, Socialite, Creator, Connector, Pioneer, Influencer, Mesh Master, Guardian), "No title" default option. Each title has a Trophy/Lock icon.
- **Playwright assertion**: Count `button[disabled]` elements — should be >= 12 for a non-MeshPro user (6 hats + 6 colors). All should have `opacity-50` class.

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
- **Navigation**: Sidebar → "The Mesh" (first nav item under CORE)
- **Component architecture**: Mesh page broken into focused components:
  - `mesh-types.ts` — shared type definitions (MeshNode, MeshEdge, etc.)
  - `mesh-node-detail.tsx` — right-side panel for node inspection
  - `mesh-command-palette.tsx` — Ctrl+K search overlay
  - `mesh-footprint-panel.tsx` — digital footprint slide-out
  - `mesh-privacy-controls.tsx` — privacy settings panel
  - `mesh-post-composer.tsx` — inline post creation
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
- **Label rendering**: Labels have dark semi-transparent pill backgrounds (`rgba(0,0,0,0.5)`) behind white bold (600 weight) text for readability against any canvas background. The `drawLabel()` function in `mesh-renderer.ts` measures text width and draws a rounded rect pill behind it.
- **Tooltip rendering**: `drawTooltip()` shows stats (followers, posts, platforms), emoji prefixes for platform nodes, shared communities, online status. Tooltips have drop shadow and accent border. Only visible at zoom >= 0.5x.
- **Zoom controls**: Vertically centered on the right edge of the canvas (top-1/2 -translate-y-1/2). Contains Zoom in, Zoom out, Reset view, Hide labels, Hide stats buttons.
- **Action bar**: Bottom-left contains Create Post, Content Hub, Privacy buttons.
- **Stats bar**: Shows node counts (people, communities, interests, posts) and zoom percentage above the action bar.

### Meshi Singleton on Mesh Page
- **Critical rule**: Only ONE Meshi should be visible on /mesh at any time
- **Current implementation**: The floating Meshi (`meshi-float.tsx`) HIDES on /mesh page. It is visible on all other pages (settings, feed, etc.) but transitions out when entering /mesh.
- **How it works**: `isOnMeshPage` detects `/mesh` route. When `isOnMeshPage` is true AND `isMeshTransition` is false, the floating Meshi's AnimatePresence removes it from the DOM entirely.
- **isMeshTransition**: A brief 600ms flag that keeps the floating Meshi visible during the transition animation when entering/leaving /mesh. Uses `useRef` for `prevPathname` (NOT `useState`) to avoid competing useEffect cleanup bugs.
- **Canvas Meshi**: The mesh canvas does NOT draw the local user's Meshi. Remote users' Meshis appear via `drawRemoteMeshis()`.
- **How to verify (Playwright)**:
  1. Navigate to `/settings` → check `.fixed.z-40` exists (floating Meshi visible)
  2. Navigate to `/mesh` → wait 2000ms → check `.fixed.z-40` is absent from DOM
  3. If `.fixed.z-40` is still present on /mesh with opacity:1, `isMeshTransition` is stuck true (regression)
- **Common regression**: If `prevPathname` is converted back to `useState`, the competing useEffect cleanup will clear the 600ms timer, leaving `isMeshTransition` permanently true and the floating Meshi visible as an invisible overlay on /mesh.

### Viewport Constraint
- **Layout**: The authenticated app layout (`src/app/(app)/layout.tsx:55`) uses `h-[100dvh] overflow-hidden` to prevent page scrolling
- **Unauthenticated pages** (landing, terms, privacy, etc.) use `min-h-screen` instead
- **How to verify (Playwright)**: After login, check for a `div` with class containing `100dvh`:
  ```javascript
  const result = await page.evaluate(() => {
    const divs = document.querySelectorAll('div');
    for (const div of divs) {
      if ((div.className || '').includes('100dvh')) return div.className;
    }
    return null;
  });
  // Should find: "relative h-[100dvh] overflow-hidden bg-[var(--bg-primary)]"
  ```
- **Known issue**: The `window.scrollY` listener for Meshi scroll mood reactions may not work correctly with `overflow-hidden` on the root since the page itself doesn't scroll. The scroll event should listen on `<main>` instead.

### MeshNodeDetail Panel
- Click any user node → panel slides in from right
- Shows: avatar, name, username, mutual status, follower/post counts, shared interests
- Action buttons: Message, Follow/Unfollow
- **Follow button state**: Uses `node.isFollowing` (NOT `node.isMutual`) to determine label:
  - `isFollowing: true` → shows "Unfollow" button
  - `isFollowing: false` → shows "Follow" button
  - Following nodes (users you follow) have bare IDs; follower-only nodes have "follower-" prefix
- Message button strips "follower-" prefix from node.id before navigating
- Node visibility controls: Hide node, Hide all users

### MeshiFloat (bottom-right floating companion)
- Click Meshi mascot → opens actions menu above Meshi
- **Actions menu** is an extracted component (`meshi-actions-menu.tsx`) with:
  - Header: Meshi mascot mini-preview + "Your mesh.me companion"
  - Quick Actions: Ask Meshi, Create Post, Search Mesh
  - Navigate: Explore, Messages, Communities, Connected Accounts
  - Settings & More: Customize Meshi, Settings, MeshPro, Send Feedback, Full Chat with Meshi
  - Footer: "Zero data stored" + mesh.me branding
- Menu positioned at `bottom-[72px] right-4` with `z-50`
- Meshi itself uses `z-40`, size is 48px
- **Safe positioning**: Meshi docks bottom-right with safe insets:
  - Desktop: 16px from right edge, 16px from bottom
  - Mobile (<1024px): 16px from right edge, 80px from bottom (above mobile nav)
- **Drag behavior**: Meshi is draggable. Drag bounds respect safe zones. Releasing near bottom-right corner snaps back to safe position.
- **Z-index hierarchy**: Mobile nav (z-50) > Meshi actions menu (z-50) > Meshi (z-40) > zoom controls (z-10)
- **Page-specific visibility**: Meshi is visible on ALL pages EXCEPT /mesh (where it hides to maintain singleton with the canvas representation). See "Meshi Singleton on Mesh Page" section.

## Page Consistency

All app pages should have:
- `animate-page-enter` class on the main content div (smooth fade/slide entrance animation)
- `data-meshi-zone` attribute for Meshi contextual awareness
- Verify with: `document.querySelector('.animate-page-enter') !== null` in browser console

## Testing Meshi Positioning

When testing Meshi layout changes:
1. **Desktop Mesh page**: Verify zoom controls are vertically centered on right edge (NOT bottom-right), Meshi is HIDDEN on /mesh page (not visible at all)
2. **Mobile viewport**: Use Chrome DevTools device toolbar (Ctrl+Shift+M) to switch to 375-400px width. Verify Meshi sits ABOVE the bottom nav bar (6 items: Mesh, Feed, Explore, Chat, Alerts, Profile)
3. **Actions menu**: Click Meshi → menu should open above it without covering zoom controls or extending below viewport
4. **Other pages**: Navigate to Feed, Settings, etc. and verify Meshi IS visible and doesn't cover interactive elements
5. **Zoom functionality**: Click each zoom button and verify the mesh actually zooms (check percentage indicator changes)

## Build & Lint

```bash
npm run lint
npx next build
```

## Database

- Prisma schema at `prisma/schema.prisma`
- After schema changes: `npx prisma generate` then `npx prisma db push` (or `npx prisma migrate dev` for migrations)
- **Critical**: After adding new fields to the Prisma schema, the local SQLite DB must be synced. Either re-push or manually ALTER TABLE. Failure to sync causes all queries touching the User model to crash.
- ProfileInfo model stores Facebook-level fields with per-field JSON privacy
- Local dev DB has ~18 seed posts across multiple users and communities
- Privacy fields on User model: `showInDiscovery` (default true), `hideActivityStatus` (default false), `readReceipts` (default true)
- Password reset fields: `resetToken` (unique, nullable), `resetTokenExpiry` (nullable DateTime)
- Stripe fields on User model: `stripeCustomerId` (unique, nullable), `stripeSubscriptionId` (nullable)
- MeshPro field: `isMeshPro` (boolean, default false) — controls access to premium cosmetics in Meshi tab

## Common Issues

- If sqlite3 CLI is not installed: `sudo apt-get install -y sqlite3`
- Dev DB might not exist on fresh clone - run `npx prisma db push` then copy and seed (see Local Dev Setup)
- The canvas is rendered with Canvas 2D API, not a library - interactions are custom event handlers on the canvas element
- Preview deployments on Vercel may fail if DATABASE_URL points to local SQLite — use local dev server for testing in this case
- When testing in Reels layout, posts don't have direct click-through links — switch to Timeline or Compact layout to navigate to post detail pages
- The dev server port might vary — check which port is being used (commonly 3000 or 3333). Use `-p` flag to specify.
- When testing mobile viewport, the page may need a reload after switching to device toolbar mode for Meshi to recalculate its safe position.
- The "1 Issue" badge in bottom-left during dev mode is a Next.js dev indicator, not a bug.
- **DB schema mismatch**: If you see "Something went wrong" on pages after a schema update, check browser console for `SQLITE_ERROR: no such column` errors. This means the DB needs to be synced with the Prisma schema (see Schema Sync section above).
- **Forgot password first click**: On the password screen, the first click on "Forgot password?" may dismiss a Meshi speech bubble overlay. Click the link again to navigate.
- **Privacy toggle tab jump**: After clicking a privacy toggle, the Settings page might briefly show the MeshPro tab. Navigate back to Privacy & Safety to verify the change before reloading.
- **Stripe not configured**: When testing MeshPro payment locally without `STRIPE_SECRET_KEY`, the checkout API returns a 500 error. The frontend should show "Payment is not configured yet. Please check back soon." If it doesn't show this message, the error handling in `meshpro-tab.tsx` may be broken.
- **Two canvases on /mesh**: The mesh page has TWO canvas elements — a background `MeshBackground` (class `absolute inset-0 w-full h-full opacity-30`, pointer-events-none) and the actual mesh canvas (class `w-full h-full`). When checking if the mesh canvas is interactive via `elementFromPoint`, make sure to test the mesh canvas specifically (the one without `opacity-30` or `absolute inset-0`).
- **Playwright login selectors**: The login form uses React state transitions (welcome → credentials → login-password). Do NOT use `input[name="username"]` — the input has no `name` attribute. Use `input[type="text"]` for username and `input[type="password"]` for password. Wait 1-2s between steps for AnimatePresence transitions.
