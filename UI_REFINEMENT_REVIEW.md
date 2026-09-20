# Mesh.me interface refinement

Target: meshs.me. Base: `56e5dbcab91cf4dfbfc7afa4f4d41f92be131cfe`.

## Changes

- **Navigation:** grouped account menu, profile photo, reliable dismissal and Escape focus return; correct page titles; accessible compact navigation; unread message badges; skip-to-content link. Hidden mobile navigation no longer receives keyboard focus.
- **Explore:** one organized filter panel with removable active filters; contextual search; author handles and timestamps; recoverable empty states; native post links; explicit follow-failure feedback.
- **Posting:** full-width writing area, persistent audience control, four distinct attachment tools, clearer character budget and draft status. Short posts no longer occupy a fixed-height block. Share menus stay attached to their triggers and copying reports the actual result.
- **Settings:** consistent outer spacing, a narrower desktop section rail, clearer active and focus states, and one main landmark.
- **Shared controls:** scrollable modal bodies, Cancel-first confirmations, readable mobile inputs, and compact notifications that pause while hovered, focused, or in a hidden tab.
- **Motion:** navigation, filters, and notification badges respect reduced motion. Existing opt-in sound and haptic preferences are retained.

## Meshi identity and presence

- Meshi opens a presence panel with local activity, visibility, Ghost Mode, Your Mesh, and Customize. Optional AI help requires an explicit action and keeps its provider disclosure.
- The same saved face and cosmetics carry through login, profile, Mesh visitors, chat presence, delivery arrivals, and people viewing the same post. Your own Mesh avatar opens the same controls.
- Expressions respond to actual typing, scrolling, messages, and inactivity without collecting input contents. Portraits stay still; the live avatar yields to the Mesh canvas.
- Ghost changes are serialized across controls. Hiding takes effect locally before saving; becoming visible waits for account confirmation. Failed hiding survives stale server renders and unavailable storage. An old pending response cannot change the newly signed-in account.
- Presence checks current privacy, suspension, blocking, room membership, and post access. Private routes are never broadcast. Browsing-location sharing is scoped to the signed-in account on each device; legacy unscoped opt-ins are not inherited.
- The feed owns one heartbeat, clears stale post presence, and excludes unpublished optimistic drafts. Public room payloads cannot expose private post locations. Chat read receipts follow the same visibility rules on initial render and polling.

Automated regression coverage exercises Ghost save failures and races, account switching, storage failures, cross-instance privacy changes, blocked chat presence, canonical appearance, and post/room access. The release workflow runs these against isolated local data. Deployment and live verification are recorded in the release pull request.

## Review status

Passed: production build (96 static pages), TypeScript, ESLint, unused-code checks, the repository release suite (`npm run check`), and all 23 strict diagnostics. This includes 248 theme contrast ratios and the navigation, motion, accessibility, hierarchy, grouped-list, and interaction-contract checks. The isolated database and production HTTP experience suite passed 390 assertions; launch behavior passed 90 assertions with mocked payment transport.

The existing live Explore, Feed, and Settings screens were inspected to identify the spacing and navigation problems. The updated local interface could not be opened in the available browser because its URL security policy blocked local previews. Interactive verification of the new menu dismissal, modal focus, toast timing, and 390px/820px layouts remains required on an accessible preview.

This change contains no database migration, production fixtures, credentials, provider configuration, or billing changes. The temporary layout-review route was removed. Publication to michaelbucolo/mesh-me and deployment to meshs.me were authorized on 2026-09-19.

Production credential recovery and verification of email delivery and live billing remain separate launch work; these UI checks do not establish their readiness.
