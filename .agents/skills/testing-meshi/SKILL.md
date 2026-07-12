---
name: testing-meshi
description: Test Meshi companion features end-to-end — chat engine Q&A, auth-flow personality, customization (hats, hair, accessories, badges, outfits), wearable physics, and persistence. Use when verifying Meshi UI or renderer changes.
---

# Testing Meshi AI Companion Features

## Overview
Meshi is the AI companion mascot for mesh.me. It appears across the entire app as a living entity with personality, mood changes, speech bubbles, and mesh-awareness. Meshi has a smart query engine that answers natural language questions using real database data.

## Key Components
- **MeshEntry** (`src/components/mesh-entry.tsx`): Auth flow with Meshi personality — speech bubbles react to login/signup steps
- **MeshiFloat** (`src/components/meshi/meshi-float.tsx`): Global floating companion visible on all authenticated pages. Click to open actions menu, then select "Full Chat with Meshi" for Q&A testing
- **MeshiChat** (`src/components/meshi/meshi-chat.tsx`): Knowledge boundary enforcement — Meshi only knows about entities on the user's mesh
- **MeshiMascot** (`src/components/meshi/meshi-mascot.tsx`): Interactive mascot with physics, moods, and animations
- **MeshiEngine** (`src/lib/meshi-engine.ts`): Server-side smart query engine with 18+ intent handlers. Queries the database for real answers (post counts, person lookups, platform summaries, community lists, mutual connections, content stats, recent activity, who's active)
- **MeshiDelivery** (`src/components/meshi/meshi-delivery.tsx`): Animated message delivery system (traveling → arriving → delivered phases)
- **Sidebar** (`src/components/layout/sidebar.tsx`): MeshiMascot replaces static logo with BETA badge

## How to Test

### Opening Meshi Chat
1. Click the floating Meshi mascot (bottom-right corner on any authenticated page)
2. This opens the **actions menu** (not the chat directly)
3. Click **"Full Chat with Meshi"** at the bottom of the actions menu to open the chat panel
4. The chat panel has an input field at the bottom: "Ask Meshi anything..."
5. Type your question and press Enter

### Smart Engine Q&A (Focus: 4 main features)

#### 1. Post Count Query
- Type: "How many posts do I have?"
- Expected: Real count from database (e.g., "You have 2 posts on mesh.me!" for alexcreates)
- FAIL indicator: Generic canned response or wrong number
- Code: `src/lib/meshi-engine.ts` — `getPostCount` handler

#### 2. Person Lookup
- Type: "Who is mayamusic?" (or any seeded username)
- Expected: DisplayName, username, bio, follower/following/post counts, verified status, mutual follow relationship
- Example response: "Maya Chen (@mayamusic) is on your mesh! You follow each other. Bio: '...' 6 followers, 4 following, 2 posts. They're verified!"
- FAIL indicator: "I can't find..." or generic text when the user exists in the DB
- Code: `src/lib/meshi-engine.ts` — `lookupPerson` handler

#### 3. Intent Regex Safety (Critical)
- Type: "tell me about my followers"
- PASS: Any informational response (NOT "Message delivered" or "traveled across the mesh")
- FAIL: Response contains "Message delivered" — means the SELF_WORDS exclusion is broken
- The SELF_WORDS list ["me", "my", "i", "myself"] at line 51 prevents "tell me about X" from triggering send_message
- NOTE: This query may fall through to person_lookup (searching for "my followers" as a person) rather than follower_count. That's acceptable — the critical test is that no message is sent.

#### 4. Privacy Transparency Dashboard
- Navigate to Settings → click "Privacy & Safety" tab in the left settings nav
- Scroll down past "Our Privacy Commitment to You" section
- Look for "Your Data Transparency Report" section
- Expected: Real data counts matching the database (for alexcreates: Posts=2, Followers=8, Following=4, Communities=3, Interests=4)
- "What mesh.me does NOT collect" section should list exactly 8 items: Browsing history, Device fingerprints, Location tracking, Behavioral analytics, Ad preferences, Third-party cookies, Contact lists, App usage patterns
- Active sessions count should be displayed
- Code: `src/app/(app)/settings/page.tsx` lines 391-397 (lazy loads on tab select), lines 1192-1201 (NOT collected items)

### Expected Seed Data Values (alexcreates)
- Posts: 2
- Followers: 8
- Following: 4
- Communities: 3 (creativeCoder admin, soundVision, designSystems)
- Interests: 4 (Art, Design, Photography, Technology)
- Comments: 3
- Reactions: 10

### Auth Flow Personality
1. Sign out or visit `/` when unauthenticated
2. MeshEntry renders with MeshiMascot above the "mesh.me" wordmark
3. Click "Sign in" — Meshi shows speech bubble: "Welcome back! Enter your username."
4. Enter a username and submit — Meshi shows: "Hey @{username}! Enter your password to unlock your mesh."
5. Wrong password triggers: "Hmm, that doesn't seem right" speech bubble

### MeshiFloat Global Presence
1. Log in and navigate to any authenticated page (/feed, /mesh, /settings, /messages)
2. MeshiFloat should appear as a small floating mascot in the bottom-right corner
3. Click it to open the actions menu with Quick Actions, Navigate, and Settings & More sections
4. It persists across page navigation

### Knowledge Boundary Enforcement
1. Open MeshiFloat chat (click mascot → "Full Chat with Meshi")
2. Ask about someone NOT on the mesh: "who is elon musk"
3. Expected: Meshi responds with "I can't find 'elon musk' anywhere on mesh.me..."
4. Ask about a mesh.me feature: "tell me about the feed"
5. Expected: Meshi responds with feature information (not a person-not-found response)
6. Test greetings: "hey" → friendly response
7. Test gratitude: "thanks" → thankful response

### Message Delivery Animation
1. In Meshi chat, type: "send @demouser: hello there!"
2. Expected animation sequence: Meshi travels with envelope (1.5s) → arrives and reveals message (1s) → shows delivered checkmark (3.5s) → total ~6s
3. FAIL indicator: Animation stuck in "traveling" phase forever (would indicate the useEffect split bug has regressed)
4. After animation completes, the delivery should be marked as read on the server via POST

## Dev Server
- Run: `npx next dev -p 3333` (port 3333 per local-dev-setup skill)
- Database: SQLite at project root `dev.db` (seeded with 10 users, 15 posts)
- Auth: NextAuth.js with username/password — test accounts: alexcreates/password123, demouser/password123, mayamusic/password123

## Secrets Needed
- None required for local testing — SQLite database is file-based and pre-seeded
- `GITHUB_USERNAME` and `GITHUB_PASSWORD` for pushing to repo (if needed)

## Testing Meshi Customization (Settings → Meshi)
1. Navigate to `/settings#meshi` (or click the "Meshi" section in the settings nav). The live preview `MeshiMascot` sits above the "Customize Meshi" grid with groups: Color, Hat, Hair, Eyes, Expression, Accessories, Badges, Outfits, and a "Save Meshi" submit button.
2. **Premium gating**: seeded accounts are Free, so most cosmetics are disabled. To unlock everything for testing, flip the flag in the local DB (temp script with the generated Prisma client): `prisma.user.update({ where: { username: "alexcreates" }, data: { isMeshPro: true, meshProSince: new Date() } })`, then refresh. Run the script from inside the repo (imports resolve relative to cwd) and delete it afterward.
3. **Database location gotcha**: `DATABASE_URL` may point at `prisma/dev.db` while a stale `dev.db` sits at the repo root. If login fails with seeded credentials, verify which file the server actually uses and restart the dev server after any DB change.
4. **Scrolling may be broken**: mouse-wheel scrolling on the settings page might not work in the test browser (wheel events may be swallowed). Workarounds: use browser zoom (Ctrl+- / Ctrl+0) to fit more of the grid on screen, or click a grid button and press Tab — focus changes auto-scroll the container.
5. The preview mascot is small; use screenshot zoom on the preview region to judge artwork/conflict details.
6. **Conflict checks worth repeating**: hair should tuck under closed hats (cap/beanie/tophat/etc.) but render full-size under open ones (halo/headband/bow/flower/none); badges sit at the lower-right rim clear of tall hats; the `lashes` accessory maps to the eye style so it never doubles with another accessory.
7. **Physics**: wearable springs react to on-screen movement of the mascot (bounding-rect velocity). Ways to induce motion: click the interactive settings preview (bounce), or watch the user's Meshi travel between nodes on `/mesh` (panning the canvas also moves it). Physics is continuous — capture it in a recording; single screenshots rarely catch the tilt.
8. **Persistence**: after "Save Meshi", reload and confirm selections persist and the same custom Meshi appears app-wide (settings header avatar, `/mesh` loading screen, mesh node). Meshi is a singleton — flag any screen showing two copies of the user's Meshi at once.

## Common Issues
- **Meshi chat not opening**: You must click the mascot first to open the actions menu, THEN click "Full Chat with Meshi". Clicking the mascot does NOT directly open the chat.
- **Intent routing quirks**: "tell me about my followers" routes to person_lookup (searching for "my followers") instead of follower_count. The critical safety check is that it doesn't trigger send_message.
- **MeshiFloat may overlap with sidebar elements on small screens** — check responsive behavior
- **Feature word filter uses prefix matching** ("communit" matches both "community" and "communities")
- **Privacy dashboard lazy-loads** — data only fetches when the Privacy & Safety tab is selected. If you navigate there and see no data, wait a moment for the async fetch to complete.
