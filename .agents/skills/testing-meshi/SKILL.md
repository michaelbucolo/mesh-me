# Testing Meshi AI Companion Features

## Overview
Meshi is the AI companion mascot for mesh.me. It appears across the entire app as a living entity with personality, mood changes, speech bubbles, and mesh-awareness.

## Key Components
- **MeshEntry** (`src/components/mesh-entry.tsx`): Auth flow with Meshi personality — speech bubbles react to login/signup steps
- **MeshiFloat** (`src/components/meshi/meshi-float.tsx`): Global floating companion visible on all authenticated pages
- **MeshiChat** (`src/components/meshi/meshi-chat.tsx`): Knowledge boundary enforcement — Meshi only knows about entities on the user's mesh
- **MeshiMascot** (`src/components/meshi/meshi-mascot.tsx`): Interactive mascot with physics, moods, and animations
- **Sidebar** (`src/components/layout/sidebar.tsx`): MeshiMascot replaces static logo with BETA badge

## How to Test

### Meshi Command Center (Primary Interaction)
1. Click the Meshi mascot (purple blob) in bottom-right corner of any authenticated page
2. Menu opens with three sections:
   - **Quick Actions**: Ask Meshi, Create Post, Search Mesh
   - **Navigate**: Explore, Messages, Communities, Connected Accounts
   - **Settings & More**: Customize Meshi, Settings, MeshPro, Send Feedback, Full Chat with Meshi
3. Test each menu item navigates to the correct page
4. "Zero data stored" badge appears at bottom of menu

### Ask Meshi (Knowledge Q&A)
1. Click Meshi -> "Ask Meshi" — speech bubble input appears
2. Ask mesh-related questions: "how many followers do I have?" -> Meshi responds with real mesh data
3. Ask about features: "tell me about the feed" -> Meshi responds with feature info
4. Ask about someone NOT on mesh: "who is elon musk" -> Meshi responds with "I don't see them on your mesh"

### Full Chat with Meshi
1. Click Meshi -> "Full Chat with Meshi" — full chat panel opens
2. More detailed conversational interface

### Auth Flow Personality
1. Sign out or visit `/` when unauthenticated
2. MeshEntry renders with MeshiMascot above the "mesh.me" wordmark
3. Click "Sign in" — Meshi shows speech bubble: "Welcome back! Enter your username."
4. Enter a username and submit — Meshi shows: "Hey @{username}! Enter your password to unlock your mesh."
5. Wrong password triggers: "Hmm, that doesn't seem right" speech bubble

### Meshi Customization (Settings -> Meshi Beta tab)
1. Navigate to /settings?tab=meshi
2. **Expression picker**: 8 moods (Happy, Excited, Thinking, Sleepy, Surprised, Love, Cool, Wink)
3. **Hat picker**: 7 options (None, Tophat, Crown, Beanie, Cap, Party, Flower)
4. **Color picker**: 8 colors (Blue, Purple, Pink, Green, Orange, Cyan, Gold, Rainbow)
5. **Enable/Disable toggle**: Turns Meshi on/off globally
6. **Code redeemer**: Input field for redeeming exclusive cosmetics
7. Click "Save Meshi Preferences" to persist changes to server

### Meshi Draggability
1. Click and hold the Meshi mascot
2. Drag to a new position on screen
3. Release — Meshi stays at new position

## Dev Server
- Run: `npx next dev -p 3333` (starts on port 3333)
- The app uses Next.js with SQLite locally / Turso in production
- Auth is cookie-based — sign out via Settings -> Security -> Sign out

## Devin Secrets Needed
- `GITHUB_USERNAME` and `GITHUB_PASSWORD` for pushing to repo
- `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` for database access
- `VERCEL_TOKEN` for deployment

## Common Issues
- MeshiFloat may overlap with sidebar elements on small screens — check responsive behavior
- Knowledge boundary patterns might be too broad — queries like "find people to follow" could be intercepted as person lookups
- The Meshi command center menu closes when clicking any item (expected behavior)
- Meshi preferences are saved both to localStorage (enabled state) and server (hat, face, color)
- Port 3333 may already be in use — kill with `fuser -k 3333/tcp` before restarting
