# Testing Content Hub & Sync Features

## Overview
The Content Hub is a unified dashboard for managing cross-platform content. It has 6 tabs: Overview, Content, Analytics, Audience, Publish, Sync.

## Test Setup
1. Start local dev server: `npx next dev -p 3333`
2. Log in with seeded credentials (see local-dev-setup SKILL)
3. Connect at least one platform via Connected Accounts page
   - SoundCloud, Threads, and Bluesky support manual username-based connection (no OAuth needed)
   - Click "Connect" next to the platform, enter a username, click "Link"
   - An import dialog will appear after connecting

## Key Test Flows

### Content Hub Tab Navigation
1. Navigate to `/content-hub`
2. If no platforms connected, you'll see an empty state with "Connect Your Accounts" button
3. With a connected platform, verify all 6 tabs load:
   - **Overview**: Stats bar, connected platforms list, recent content, quick action cards
   - **Content**: Search bar, platform filter, type filter, content list
   - **Analytics**: Total Reach/Views/Likes/Content stats, platform breakdown
   - **Audience**: Follower list with platform filter
   - **Publish**: Cross-post composer with platform selector and tips
   - **Sync**: Sync management with per-platform sync buttons (Posts, Followers, Analytics, Full)
4. Verify tab switching is smooth with NO full-page spinner
5. On Content tab, change platform and type filters - verify inline refresh only

### Connected Accounts Sync Controls
1. Navigate to `/connected-accounts`
2. Verify "Sync all" button in header
3. Connected platforms show sync icons and "Disconnect" button
4. Unconnected platforms show "Connect" button
5. "Coming Soon" platforms (Instagram, LinkedIn) show disabled state

## Bug Fixes to Verify
- No full-page spinner when switching tabs (useRef mount tracking)
- Filter/pagination changes on Content tab don't trigger redundant API calls
- Per-platform sync buttons disabled during "Sync All" operation
- Cross-post error handling shows proper error notification
- Comment sync validates platformPostId is provided

## Known Limitations
- Platform sync uses stub adapters - actual API calls return mock/empty data
- Vercel preview may fail if DB hasn't been migrated for new Prisma models
- Local testing is more reliable for features that add new DB models

## Secrets Needed
No secrets needed for basic Content Hub testing. OAuth platform connections require platform credentials.
