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

### Auth Flow Personality
1. Sign out or visit `/` when unauthenticated
2. MeshEntry renders with MeshiMascot above the "mesh.me" wordmark
3. Click "Sign in" — Meshi shows speech bubble: "Welcome back! Enter your username."
4. Enter a username and submit — Meshi shows: "Hey @{username}! Enter your password to unlock your mesh."
5. Wrong password triggers: "Hmm, that doesn't seem right" speech bubble

### MeshiFloat Global Presence
1. Log in and navigate to any authenticated page (/feed, /mesh, /settings, /messages)
2. MeshiFloat should appear as a small floating mascot (HOME_POSITION: x=28, y=84 in sidebar area, or bottom-right when activated)
3. Click it to open the speech/chat view with input field and quick actions
4. It persists across page navigation

### Knowledge Boundary Enforcement
1. Open MeshiFloat speech view (click the floating mascot)
2. Ask about someone NOT on the mesh: "who is elon musk"
3. Expected: Meshi responds with "I don't see 'elon musk' on your mesh yet..."
4. Ask about a mesh.me feature: "tell me about the feed"
5. Expected: Meshi responds with feature information (not a person-not-found response)
6. Test greetings: "hey" → friendly response
7. Test gratitude: "thanks" → thankful response

### Catch-up Summary
1. In MeshiFloat speech input, type a search trigger: "show me my mesh" or "search my connections"
2. Search triggers are: ["search", "find", "look for", "where", "show me"]
3. Meshi shows animated search text progression ("Looking through your mesh...", "Scanning your connections...", etc.)
4. After ~4.5s, displays a summary built from real mesh stats (followers, following, platforms, communities)

### Sidebar MeshiMascot
1. On any authenticated page, check the top-left sidebar
2. Should show interactive MeshiMascot (blue face icon) with "BETA" badge
3. Replaces the old static logo

## Dev Server
- Run: `npm run dev` (starts on port 3000)
- The app uses Next.js with Turso database
- Auth is cookie-based — sign out via sidebar "Sign out" button

## Devin Secrets Needed
- `GITHUB_USERNAME` and `GITHUB_PASSWORD` for pushing to repo
- `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` for database access
- `VERCEL_TOKEN` for deployment

## Common Issues
- MeshiFloat may overlap with sidebar elements on small screens — check responsive behavior
- Knowledge boundary patterns might be too broad — queries like "find people to follow" could be intercepted as person lookups. If this happens, narrow the personPatterns regex in meshi-chat.tsx
- The `is X on my mesh` regex needs a dedicated pattern with proper capture group (was fixed in PR #13)
- Feature word filter uses prefix matching ("communit" matches both "community" and "communities")
