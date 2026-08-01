# Surface audit — what exists vs. what a person can reach

_Audited against `7be5856`; findings below re-verified before each is acted on._

This is the inventory that `npm run reachability:check` was written out of. It is
kept in the repo because the raw audit was lost once already to a `/tmp` sweep,
and because it is the working backlog — every remaining item names a file.

## Why this document exists at all

`dead-code:check` (knip) gates the build, so **"an exported function with no
importer" is empty by construction here**. That is a real guarantee and it
produces a false sense of coverage, because knip reasons about the *module*
graph and a person does not navigate the module graph. They navigate links.

Everything below in "Working code with no door" passed **every** gate in
`npm run check` while being unreachable. (The chain is long enough that its
length gets misquoted; count it with
`node -e 'console.log(require("./package.json").scripts.check.split("&&").length)'`
rather than trusting a number written down here or anywhere else.)

## Confirmed platform capability table

Computed by executing `getPlatformCapability()` over `MESH_PLATFORMS`. Nothing in
the product may claim past this table; `platform-allowlist:check`,
`claim-truth:check` and `unified-claim:check` enforce it.

| platform | importContent | crossPost | interactionSync | notificationSync |
|---|---|---|---|---|
| instagram, facebook, threads, snapchat, linkedin, pinterest | – | – | – | – |
| twitter (displayed "X"), reddit | ✓ | ✓ | ✓ | – |
| youtube | ✓ | – | ✓ | – |
| tiktok, twitch, discord | ✓ | – | – | – |

12 platforms. `crossPost` is **twitter and reddit only**. `importContent` is
**six**. **`notificationSync` is empty for all twelve** — nothing may claim
notification mirroring. Six platforms have **zero** flags, which is the whole
reason the portability axis exists.

## Working code with no door

### Routes with zero inbound links

| Route | Lines | State |
|---|---|---|
| `/communities/create` | 24 | **FIXED.** Real page wrapping `CommunityCreateForm`; `grep -rn "communities/create"` returned nothing. The only creation path for an entire surface was URL-only. Now linked from the community hub header. |
| `/watch` | 112 | Complete watch-scale surface — one high-contrast column, unread count, 3 notifications, 3 threads, fingertip targets for a 40mm screen, no canvas or chrome. Works. Deliberately URL-only (opened from a watch face); recorded in `INTENTIONALLY_UNLINKED`. |
| `/pricing` | 15 | Redirect-only to `/meshpro`. Correct as an external/SEO landing; recorded as intentional. |

### API routes with no client caller

Legitimate externals — OAuth callbacks, `meta/deauthorize`, `meta/deletion`,
`stripe/webhook`, `health`, `adult-verification/callback`, and
`public-supply/refresh` (hourly Vercel cron, fails closed without
`PUBLIC_SUPPLY_CRON_SECRET`) — are correctly caller-less and are not listed.

`reachability:check` now covers these too, so the list below is enforced rather
than remembered. The audit found five; the gate found four more.

| Route | Lines | Disposition |
|---|---|---|
| `/api/security-hub/overview` | 40 | **DONE.** Counting moved to `src/lib/content-inventory.ts`, rendered server-side on `/analytics`, route deleted. |
| `/api/communities` | 54 | **DELETED.** GET-only; the page uses `getCommunitiesHubData()` server-side. |
| `/api/auth/platforms` | 33 | **DELETED.** Wrapped `getConnectedAccountsDashboard`, which `/connected-accounts` calls server-side. |
| `/api/account/email-verification` | 25 | **DELETED.** Wrapped the `requestEmailVerification` server action that `settings-control-center.tsx` calls directly. |
| `/api/explore` | 70 | **DELETED.** Wrapped `getExplorePosts`/`getDiscoverUsers`/`getTrendingCommunities`, all called server-side by the explore page. |
| `/api/feed` | 27 | **DELETED.** Wrapped `getCombinedFeedPosts`, which the feed page calls server-side; the client uses `/api/feed/paginated`. |
| `/api/settings` | 15 | **DELETED.** Wrapped `getUserSettings`/`getBlockedUsers`, both called server-side by the settings page. |
| `/api/sync` | 92 | **DELETED.** POST took a `connectedAccountId` and called `syncPlatform` — exactly `/api/connected-accounts/[id]/sync`, which has two real callers. GET duplicated the connected-accounts page's own load. |
| `/api/account/alter-egos` | 136 | **KEPT, unwired.** GET/POST/DELETE, rate-limited, `MAX_ALTER_EGOS` enforced, username uniqueness checked against both `User` and `AlterEgo`. Listed in the gate's `UNWIRED_PENDING_UI` with the work owed, because deleting correct code we want is worse than recording the debt. See Tier 2 below. |

Worth recording: `foundation-check.mjs` **asserted the existence of three of the
deleted routes**, so the build would have failed anyone who tried to remove
them. A foundation check that pins an unreachable endpoint in place is enforcing
the opposite of a foundation.

### Prisma models never read or written

| Model(s) | Verdict |
|---|---|
| `ContentSource` + `SyncedContent` + `SyncedInteraction` | **Keep — this is the valuable one.** A complete canonical ingestion pipeline: `sourceType`/`sourceId`/`ingestState`, `canonicalType`/`ownership: "external"`/`actionSupport`/`syncStatus`, per-interaction actor/value/`happenedAt`. `platform-sync.ts` bypasses it and writes `PlatformPost`/`PlatformComment`/`PlatformMedia` instead. Shaped exactly for portability import. |
| `Achievement` + `UserAchievement` | **Keep, finish.** `User.activeTitle` exists, `prisma.userAchievement.findMany` runs once and is a permanently empty query, and `actions.ts` has an `// ─── Achievement Actions ───` header with nothing under it. No row is ever created and nothing is seeded. |
| `MeshNode`, `MeshEdge` | **Drop.** The mesh is computed live from `Follow`/`ConnectedAccount`. The eponymous tables have never been read or written. |
| `Mute` | **Drop.** Superseded on purpose by muted-source keys as JSON on `FeedPreference`, so muting is private by construction. |
| `RedeemCode` | **Drop.** Zero references anywhere. |

`UserLink`, `MeChatSessionParticipant` and `MeChatSessionVote` look write-only to
a direct-delegate scan but are read through relational `include`/`select`. Not
orphans.

### Defects found and fixed

- `src/app/sitemap.ts` advertised `/roadmap` to every crawler that read it. No
  such route exists. A sitemap is a list of promises and nothing in the build
  checked that they resolve — now `reachability:check` does.
- The co-browse item route exports `GET` and `PATCH`, while every action verb
  (`add-item`, `vote`) reads like a creation. A client written from the action
  names gets a bare 405 with no body, which looks like an auth failure.
  Plausibly why the room sat unreachable. Nothing static checks an HTTP verb.

## Remaining backlog, ranked by (value if surfaced) / (work to surface)

**Tier 1**

1. ~~Surface `/api/security-hub/overview` on `/analytics`.~~ **Done.**
2. ~~Delete the duplicate API routes.~~ **Done — seven of them.**
3. Drop `Mute`, `MeshNode`, `MeshEdge`, `RedeemCode`. **Not done, deliberately.**
   Unlike deleting a route, dropping a table is irreversible against production
   data, and this session cannot inspect production row counts — only that
   nothing in the code reads or writes them. That is good evidence and not
   proof. Worth doing; worth doing with the row counts in hand.

**Tier 2 — days**

3. **Personas: decide what they are, then build or delete.** The first version of
   this entry said "surface creation — the backend is done, it just needs a
   form." That was wrong, and the correction is the useful part:

   `/connected-accounts` displays personas under the line *"Fold a separate
   persona's connections into your one mesh.me account — nothing stays split
   off"*, and the only action offered is `foldPersonaIntoMainIdentity`, which
   deactivates the persona and nulls `alterEgoId` on its accounts. **Personas
   currently exist only in order to be dissolved.** A "create a persona" button
   on that page would be the product arguing with itself in adjacent sentences.

   `ConnectedAccount.alterEgoId` is modelled but written by **no application
   code** — it appears only in generated Prisma types — so even the "group your
   accounts under a persona" capability the schema describes has no writer.

   The feature is still worth having. Separate identities — alt, professional vs.
   personal, pseudonymous — is a primitive Instagram and LinkedIn structurally
   cannot offer well, because their business is one legible identity per human.
   And it does not actually conflict with One Account: *one account* is about not
   being scattered across platforms, which is compatible with choosing which face
   a given connection wears. **One account ≠ one identity.**

   But that is a product decision plus reconciled copy plus a definition of what
   a persona *does* (scope the mesh? tag posts? group connected accounts?) — not
   a form. Until it is made, the endpoints sit in the gate's
   `UNWIRED_PENDING_UI` with this stated.
4. **Achievements.** Seed rows, award logic, display `activeTitle`. Explicitly
   the **earned-milestone kind — fixed, legible thresholds** — not
   variable-reward. `threshold`, `isLimited` and `maxHolders` are already
   modelled. A reason to come back tomorrow that is not a slot machine.

**Tier 3 — the strategic one**

5. **Land `portabilityImport` on `ContentSource`/`SyncedContent`/`SyncedInteraction`.**
   This is the only mechanism that gives the **six no-capability platforms** —
   half the roster, including Instagram and Facebook — any content in mesh.me at
   all, and it works through a legal duty (GDPR Art. 20, DMA Art. 6(9)) rather
   than a commercial permission a platform can revoke. No scraping, no
   credentials: the user downloads their own archive and hands it over.
   `parse-export.ts` and `portability-parse:check` are done. What remains is the
   upload surface, which is its own security slice — zip bombs, decompression
   ratios, extraction paths — and must not be rushed into an unrelated PR.

   The copy constraint is permanent: **"your history", never "your connections".**
   W3C's data-portability minutes record the follower graph as "the primary asset
   and normally not exported, not even upon GDPR request." The parser's output
   type has exactly three fields so there is nowhere to put one.
