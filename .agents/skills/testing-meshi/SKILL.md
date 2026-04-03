# Testing Meshi AI Companion Features

## Overview
Meshi is the AI companion mascot for mesh.me. It appears across the entire app as a living entity with personality, mood changes, speech bubbles, and mesh-awareness. The Meshi Command Center is a global command palette (Cmd+K) that serves as the primary interaction point.

## Key Components
- **MeshiCommand** (`src/components/meshi/meshi-command.tsx`): Global command palette with search + chat modes, keyboard navigation, 15+ commands across navigation/actions/meshi categories
- **AppShell** (`src/components/layout/app-shell.tsx`): Client-side layout wrapper managing Meshi command center open/close state, wires Cmd+K to both Sidebar and MobileNav
- **MeshEntry** (`src/components/mesh-entry.tsx`): Auth flow with Meshi personality — speech bubbles react to login/signup steps
- **MeshiFloat** (`src/components/meshi/meshi-float.tsx`): Global floating companion visible on all authenticated pages
- **MeshiMascot** (`src/components/meshi/meshi-mascot.tsx`): Interactive mascot with physics, moods, and animations
- **Sidebar** (`src/components/layout/sidebar.tsx`): Has "Ask Meshi anything" search bar at top that opens command center

## How to Test

### Meshi Command Center (Cmd+K)
1. Navigate to any authenticated page (e.g., /dashboard)
2. Press Ctrl+K (or Cmd+K on Mac) to open the command palette
3. **Verify categories render in order**: Meshi section first, then Actions, then Navigate
4. **First item highlighted**: "Chat with Meshi" should be highlighted by default (index 0)
5. **Keyboard navigation**: Press ArrowDown/ArrowUp — highlight should move through items correctly, crossing category boundaries
6. **Enter executes correct command**: Navigate highlight to a specific command (e.g., "Dashboard"), press Enter — verify it navigates to /dashboard (NOT a different page)
7. **Search filtering**: Type "feed" — should filter to show only matching commands. Arrow keys and Enter should still work correctly on filtered results
8. Press Ctrl+K again or Escape to close — should close without flickering

### Chat Mode
1. Open command center with Ctrl+K
2. Click "Chat with Meshi" in the footer (bottom-right of palette)
3. **Verify mode switch**: Input placeholder changes to "Talk to Meshi...", sparkles icon replaces search icon
4. **Quick suggestions appear**: When no messages exist, 3 buttons show: "What can you do?", "Sync my platforms", "Show analytics"
5. **Click a quick suggestion** (e.g., "What can you do?")
6. **Verify**: User message appears as blue bubble (right-aligned), Meshi responds with correct contextual message after ~500ms
7. **Manual chat**: Type "hello" and press Enter — Meshi should respond with "Hey there! How can I help you today?"
8. **Switch back**: Click "Commands" in footer to return to command search mode
9. Press Escape in chat mode — returns to command mode. Press Escape again — closes palette

### Sidebar "Ask Meshi" Trigger
1. On any authenticated page, look for "Ask Meshi anything..." search bar at top of sidebar
2. Click it — should open the Meshi Command Center (same as Ctrl+K)

### Auth Flow Personality
1. Sign out or visit `/` when unauthenticated
2. MeshEntry renders with MeshiMascot above the "mesh.me" wordmark
3. Click "Sign in" — Meshi shows speech bubble with welcome message
4. Enter a username and submit — Meshi shows personalized message
5. Wrong password triggers error speech bubble

### MeshiFloat Global Presence
1. Log in and navigate to any authenticated page (/feed, /mesh, /settings, /messages)
2. MeshiFloat should appear as a small floating mascot in bottom-right corner
3. Click it to open the speech/chat view
4. It persists across page navigation

## Dev Server
- Run: `npm run dev` (starts on port 3000 by default, may use 3333 depending on config)
- The app uses Next.js with SQLite/Turso database
- Auth is cookie-based — sign out via sidebar "Sign out" button
- If port is in use, kill old processes: `pkill -f 'next dev'` and remove lock: `rm -f .next/dev/lock`

## Test Accounts (from seed)
- Admin: `alexcreates` / `password123`
- User: `demouser` / `password123`
- User: `mayamusic` / `password123`

## Devin Secrets Needed
- `GITHUB_USERNAME` and `GITHUB_PASSWORD` for pushing to repo
- `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` for database access (production)
- `VERCEL_TOKEN` for deployment

## Common Issues
- **Port lock file**: If dev server won't start, remove `.next/dev/lock` and kill stale next processes
- **Keyboard shortcut on Linux**: Use Ctrl+K instead of Cmd+K (browser captures Cmd+K on Linux as address bar focus)
- **Command palette index mismatch**: If keyboard Enter executes wrong command, check that `displayOrder` array in meshi-command.tsx matches the render order (meshi → actions → navigation). The `filteredCommands` array preserves definition order which differs from render order.
- **Quick suggestions silent failure**: If quick suggestion buttons don't produce chat messages, check that `sendDirectMessage(text)` is used instead of `setQuery + setTimeout(handleChatSend)` — the latter has a stale closure bug where `handleChatSend` captures an empty query.
- **CSS variable with hex alpha**: Do NOT use `var(--accent)` in color arrays where `+ "15"` hex alpha suffix is appended. Only raw hex colors like `"#2d7ff9"` work with this pattern. `var(--accent)15` is invalid CSS.
- **MeshiFloat may overlap with sidebar elements** on small screens — check responsive behavior
- **Vercel preview errors**: If PR adds new Prisma models, the Vercel/Turso production DB may not have them. Test locally instead.
