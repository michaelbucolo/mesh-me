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
   ingest surface.

   ### The obvious design does not work, and it is worth knowing why first

   "POST the ZIP to an API route and unpack it server-side" is the shape everyone
   reaches for, and this deployment cannot run it. Checked, not assumed:

   - The **only** upload path in the repo is `/api/avatar`, which caps at
     **2 MB** and sniffs magic bytes (`MAX_FILE_SIZE = 2 * 1024 * 1024`).
   - There is **no object-storage dependency at all** — no Blob, no S3, nothing
     in `package.json` that could hold a large file.
   - `vercel.json` configures a cron and nothing else. Serverless request bodies
     are capped far below archive scale.

   On archive size: widely reported figures put Instagram exports in the hundreds
   of megabytes and Facebook's past a gigabyte, but **that number has not been
   measured against a real export here** and should not be quoted as if it had.
   It is not load-bearing — the 2 MB cap, the absent object storage and the
   serverless body limit each independently rule out the POST design, and they
   were checked directly.

   So the first thing that happens to a real archive on a POST route is a
   rejection at the edge, before any of the zip-bomb defences anyone wrote ever
   execute.

   ### Extract in the browser instead

   Parse the archive **client-side** and send only the recovered posts —
   `parseExportDocument` already returns exactly three small fields per post, so
   a lifetime of Instagram captions is a modest JSON payload. Media stays on the
   device until a second, separate step the person chooses.

   This is not a workaround. It is the better version:

   - It fits the deployment with no object storage and no body-size fight.
   - **The archive never leaves the device wholesale.** Only what you decided to
     import is transmitted — which is the honest reading of a feature whose whole
     premise is that this is *your* data, handed over by *you*.
   - The zip-bomb surface moves into the user's own tab, where a decompression
     ratio cap costs them a browser tab rather than a shared server.

   ### The ZIP library: `@zip.js/zip.js`, and why not the small one

   This entry first said *"`fflate` is the small zero-dep candidate."* That was a
   guess, and measurement refutes it. `fflate` is a third the size and it is the
   wrong tool here for three separate reasons, each verified rather than argued:

   - **It needs the whole archive in memory.** `unzip`/`unzipSync` take a single
     `Uint8Array`; JSZip reads a Blob fully through `FileReader`. Browser
     `ArrayBuffer` limits (~2 GB on Chrome, lower on iOS) make that a wall, not a
     slow path. zip.js lists the central directory through ranged `Blob.slice`
     reads — measured at **169 bytes pulled to enumerate a 51,540-byte archive**.
   - **It truncates silently when a header lies.** A central directory patched to
     declare 1024 bytes for a 50 MB entry: fflate returned 1024 bytes and did not
     throw. zip.js threw `ERR_INVALID_UNCOMPRESSED_SIZE` mid-stream, ~1 MB of
     heap in. For a repo whose parser rule is *may skip, never invent*, silent
     truncation is the wrong failure mode.
   - **It never verifies CRC-32 on the read path.** Every `crc` use in fflate's
     browser build is gzip or zip-*writing*. zip.js checks per entry and throws.

   Costs ~44 KB gzip against fflate's ~5 KB, absorbed by a dynamic import on the
   import route alone. Zero dependencies, BSD-3-Clause, actively maintained.
   Keep the specifier a **string literal** — `await import("@zip.js/zip.js")` —
   because knip resolves literal dynamic imports and not computed ones.

   **`DecompressionStream` alone is disqualified outright**, and not only because
   it does raw deflate with no ZIP container (`new DecompressionStream('zip')`
   throws). `ios/App/App.xcodeproj/project.pbxproj` sets
   `IPHONEOS_DEPLOYMENT_TARGET = 15.0`; `DecompressionStream` needs iOS 16.4. On
   the Capacitor build it would simply be `undefined`. zip.js already falls back
   to its bundled codec when the native stream is missing.

   Nothing in the repo blocks the dependency: no bundle budget, no license gate,
   no dependency-count gate. `foundation-check.mjs` only asserts deps are
   *present*. CSP is already fine — `worker-src 'self' blob:` is in both
   `next.config.ts:81` and `src/proxy.ts:215`, and zip.js builds its worker from a
   runtime blob URI, so webpack needs no worker configuration.

   ### The limits, ranked — and the ranking is the point

   An earlier version of this entry listed "caps on entry count, per-entry size
   and total decompression ratio" as though they were three co-equal defences.
   Measurement says otherwise, and gets the order almost exactly backwards.

   **Ranked by what actually protects the person:**

   1. **Worker isolation.** OOM in a browser is *uncatchable* — no JS exception
      is thrown, `try`/`catch` does nothing, the tab dies. Running the parse in a
      Worker you can `terminate()` is the only mechanism that can actually stop a
      runaway. This was missing from the earlier list entirely, and it is first.
   2. **A running total counter.** The only control that mathematically bounds
      output. Entry cap × per-entry cap is 1.3–27 TB worst case — which is to say
      no bound at all. Capping both and skipping the total is security theatre.
   3. **Nesting depth 0.** Refusing to recurse is free: no legitimate social
      export needs a zip inside a zip, and it eliminates the whole classic
      recursive-bomb class.
   4. **A resident-bytes cap**, then **entry count** — the latter because the
      *central directory is itself an attack surface before a single byte is
      decompressed*: a 93 MB zip with 1M entries cost 18 seconds and 1.2 GB of
      RAM just to instantiate the parser.
   5. **Ratio caps, last.** They get the most attention and are the softest and
      most evadable — a bomb assembled from many entries each individually under
      the cap walks straight through.

   If review pressure ever forces a limit to be relaxed, relax the ratio cap.
   **Never** relax the running total or the Worker isolation; those two carry the
   actual safety property, and the code should say so where someone raising a
   number will read it.

   **Numbers, with the reasoning attached:**

   - A per-entry ratio cap **below ~300:1 false-positives on real archives**.
     Legitimate JSON entries reach 95:1 and indent-heavy sparse JSON 294:1. The
     obvious 100:1 would reject genuine exports; a documented `THRESHOLD_RATIO`
     of 10 is known to have "blocked valid and innocuous zip files".
   - DEFLATE cannot exceed **1032:1** on a single stream. Above that is
     definitionally malformed — a Zip64 or overlap trick, not compression.
   - Whole real archives compress at about **1.03:1** — they are media-dominated
     and essentially incompressible, so a *total* budget can be tight without
     ever touching a legitimate file.
   - **On iOS the ceiling is ~100 MB, not 4 GB.** That, not the desktop
     ArrayBuffer limit, is the constraint that decides these numbers here.
   - **Never allocate from the declared uncompressed size.** That is a live JS
     CVE with 33-million-to-1 amplification from a 120-byte file.

   And one piece of honesty about sourcing: **OWASP supplies no numbers.** Its
   File Upload Cheat Sheet mentions zip bombs and specifies zero thresholds, and
   ASVS V12.1.2 was formally criticised as unworkable. Anyone citing "OWASP says"
   for a specific limit is bluffing — including a future version of this document.

   Still needed alongside the caps: refuse **before** inflating, on
   `uncompressedSize / compressedSize` read from the central directory (the
   library's own check is a backstop against a lying header, not a knob you can
   tighten), the traversal rejection `parse-export.ts` already performs on media
   paths, and a gate over all of it.

   ### Three archive facts that produce WRONG data, not missing data

   `parse-export.ts` is shape-tolerant at the document level and needs no change.
   The hazards live one layer up, in finding and decoding the right file — and
   these three do not fail loudly, they fail plausibly, which is the failure the
   parser's *may skip, never invent* rule exists to prevent.

   - **Facebook JSON is UTF-8 bytes mis-encoded as Latin-1.** Decode it the
     obvious way and every non-ASCII caption becomes mojibake. That is not a
     dropped post; it is a post in someone's history with text they did not
     write. The bytes must be re-decoded before `JSON.parse`.
   - **LinkedIn's export is flat CSV, not JSON** — posts in `Shares.csv`, and the
     archive ships in two variants where **`Basic_…zip` contains no posts at
     all**. `parseExportDocument` cannot read any of it. LinkedIn needs its own
     CSV path or an explicit, stated exclusion from v1 — silently importing
     nothing while the connect page offers the option would be the worse choice.
     (`Connections.csv` also opens with a three-line `Notes:` preamble before the
     real header, so a naive CSV read yields shifted columns.)
   - **Instagram's posts file has three vintages**: `your_instagram_activity/content/posts_1.json`
     (2023+), `content/posts_1.json` (2022 and earlier), and a flat `media.json`
     (pre-Dec-2020). Facebook's has three parent directories likewise. A reader
     keyed to one vintage finds nothing on the others and reports a clean,
     confident zero.

   Also relevant to the UI rather than the parser: Meta splits exports over ~4 GB
   into **multiple ZIP parts**, all of which are needed to reconstruct posts plus
   media — so a single-file picker is wrong. And Threads normally has no archive
   of its own; its posts ride inside the Instagram export at
   `your_instagram_activity/threads/threads_and_replies.json`.

   The copy constraint is permanent: **"your history", never "your connections".**
   W3C's data-portability minutes record the follower graph as "the primary asset
   and normally not exported, not even upon GDPR request." The parser's output
   type has exactly three fields so there is nowhere to put one.

   Unblocks the `history-imported` milestone, which was drafted for #504 and cut
   because a milestone you cannot earn is a broken promise with a progress bar.
