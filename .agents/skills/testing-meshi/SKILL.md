# Testing Meshi Companion Features

## Overview
Meshi is the AI companion mascot that appears as a floating circle in the bottom-right corner of the app. It has customizable expressions, hats, colors, contextual props per page, and interactive behaviors.

## Local Dev Setup
- Run `npx next dev -p 3000` from `/mesh-app`
- App runs at `http://localhost:3000`
- Must be logged in to see Meshi (it renders in the app layout via `MeshiFloat` component)

## Key UI Paths

### Meshi Customization (Settings)
1. Navigate to Settings → click "Meshi (Beta)" tab in left sidebar
2. OR click floating Meshi → "Customize Meshi" → redirects to `/settings?tab=meshi`
3. Customization options: Expression (8 faces), Hat (7 styles), Color (8 themes)
4. Click "Save Meshi Preferences" button at bottom to persist all three to DB
5. Preferences load from server via `getMeshiPreference()` when the meshi tab becomes active

### Meshi Actions Menu
1. Click floating Meshi in bottom-right corner → opens actions menu
2. Menu options: Ask Meshi (speech), What did I miss? (search), Customize, Mesh Privacy, Full Chat
3. Speech mode: type a question and press Enter to interact

### Contextual Props
- Props only show when Meshi is in `closed` view (not clicked/expanded)
- Each page maps to a specific prop via `PAGE_PROPS` in `meshi-mascot.tsx`
- /mesh → compass, /feed → clipboard, /messages → heart, /settings → wrench, /meshpro → shield, etc.
- Props are small SVG items rendered inside the mascot circle

### Node Inspector Mode
- Only activates on `/mesh` page (exact match, not `/meshpro`)
- Open speech mode on mesh page, type phrases like "who is", "tell me about", "inspect", "look up"
- Meshi mood transitions: thinking → searching → learning
- Note: The magnifying glass prop is set in state but hidden during speech view (`prop={view === "closed" ? activeProp : "none"}`)

### Social Meshi (MeshiMini)
- When viewing another user's mesh via `/mesh?user={username}`, their customized Meshi appears in the "Viewing user's mesh" banner
- Uses `getUserMeshiPreference(userId)` server action to fetch their hat/face/color

## Key Files
- `src/components/meshi/meshi-mascot.tsx` — Core SVG component, props, moods, colors, hats, MeshiMini
- `src/components/meshi/meshi-float.tsx` — Floating wrapper with page detection, speech, actions menu
- `src/app/(app)/settings/page.tsx` — Customization UI in Meshi (Beta) tab
- `src/lib/actions.ts` — Server actions: `getMeshiPreference()`, `updateMeshiPreference()`, `getUserMeshiPreference()`

## Common Issues
- PAGE_PROPS uses `startsWith` matching — longer paths (like `/meshpro`) must be listed before shorter ones (like `/mesh`) to avoid incorrect matching
- Props are hidden during speech/actions view — only visible when Meshi is in closed/idle state
- Settings page loads saved preferences via useEffect on `activeTab` change — switching tabs and back will refetch from server
- The `handleSpeechSend` callback must include `pathname` in its dependency array to avoid stale closure issues with page-specific behaviors

## Devin Secrets Needed
- GITHUB_USERNAME — for git operations
- GITHUB_PASSWORD — for git operations
