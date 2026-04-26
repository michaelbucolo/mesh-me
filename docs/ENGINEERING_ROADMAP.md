# Mesh.me Engineering Roadmap

This roadmap turns the product vision into implementation phases. It is ordered by dependency and risk.

## Implementation status tracking

Run `npm run roadmap:check` from the repository root to generate a live implementation snapshot for each phase in this roadmap.


## Phase 1: Trust Foundation

- Add shared privacy policy enforcement.
- Apply privacy checks to profile, feed, mesh, search, and public content queries.
- Encrypt OAuth access and refresh tokens at rest.
- Make 2FA real before presenting it as active security.
- Add tests for privacy visibility, token encryption, account security, and moderation checks.
- Add CI for lint, typecheck, and tests.

## Phase 2: Unified Data Model

- Introduce first-class graph concepts:
  - `MeshNode`
  - `MeshEdge`
  - `ContentSource`
  - `SyncedContent`
  - `SyncedInteraction`
  - `PlatformPermission`
  - `DataVisibilityPolicy`
- Normalize imported third-party content into one model while preserving source metadata.
- Track sync status, source URL, original creator, supported actions, and ownership.

## Phase 3: Analytics Control Center

- Build a real Analytics area for:
  - platform connection status
  - synced data inventory
  - permission review
  - privacy controls
  - deletion/export controls
  - engagement summaries
  - creator analytics
- Make privacy state visible and understandable.

## Phase 4: Mesh and Feed Over Unified Data

- Rebuild the Mesh graph from normalized nodes and edges instead of ad hoc queries.
- Make the Feed a familiar view over the same source data.
- Add interface modes for casual users, creators, and simplified layouts.

## Phase 5: MeChat and Group Sessions

- Extend native messaging toward platform-aware message and share aggregation.
- Preserve source platform attribution on shared content.
- Add group browsing session primitives: room, participants, current item, votes, reactions, and per-user engagement actions.

## Phase 6: Meshi

- Centralize Meshi logic in one domain module.
- Keep Meshi as the only deeply integrated AI surface.
- Add privacy-first Mesh question answering over local/user-authorized data.
- Add Meshi customization with Mesh Pro boundaries.

## Phase 7: Mobile and Notification Hub

- Use Capacitor integrations for push, native preferences, safe areas, and iOS polish.
- Add notification deduplication and platform-source labeling.
- Guide users to reduce duplicate native app notifications only after sync is reliable.

## Phase 8: Super-App Replacement Readiness

- Build a parity matrix for major social + messaging workflows (publish, discover, chat, group coordination, creator controls).
- Add app-replacement migration assistant: contact import, thread bootstrap, follow migration, notification mapping, and fallback guidance.
- Track hard SLOs for app-replacement confidence: message delivery, sync freshness, mobile startup, crash-free sessions.
- Gate replacement marketing claims behind measurable 30-day reliability windows.
