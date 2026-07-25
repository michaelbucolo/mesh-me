-- Permissive backfill for the three DataVisibilityPolicy consent flags.
--
-- WHY: allowDiscovery / allowAnalytics / allowMeshiUse all default to false,
-- but until this change NOTHING read them — they were written by the privacy
-- centre and echoed back to the UI, and no query ever filtered on them. Their
-- effective behaviour was therefore "permissive, always". The moment the gates
-- in src/lib/consent.ts go live, a stored `false` starts meaning "deny", so
-- every row written under the old regime has to be re-examined before it can
-- be trusted as an answer.
--
-- Rows are NOT all flipped to true. The privacy centre never exposed these
-- three booleans directly: the client derives them from the one visibility
-- dropdown the user actually chose (see updatePolicy() in
-- src/components/privacy/privacy-control-center.tsx):
--
--     allowDiscovery = visibility === "public"
--     allowAnalytics = visibility !== "hidden"
--     allowMeshiUse  = visibility !== "hidden"   (meshi_memory only; hard-coded
--                                                 false on every other category)
--
-- So a stored value is one of two very different things: a faithful expansion
-- of a deliberate choice, or a placeholder the user never expressed an opinion
-- about. Blanket-truing would erase the first kind — it would re-enable
-- analytics and Meshi for exactly the users who went and switched them off,
-- which is the same false assurance this change exists to remove. Blanket-
-- honouring would enforce the second kind, which is not consent at all.
--
-- The rule below is therefore: bring every row up to the permissive value that
-- was actually in force, EXCEPT where the row records a deliberate restrictive
-- audience for the flag its category governs.
--
-- Note that the largest safety net is not here but in the gates themselves: an
-- ABSENT policy row reads as permissive (mirroring how the sibling `visibility`
-- field is already enforced in src/app/api/mesh/route.ts). Accounts that never
-- opened the privacy centre have no rows at all and are untouched by both this
-- migration and the new gates — no dashboard blanks, nothing leaves discovery.
--
-- This is data-only; it adds no columns and leaves the schema untouched, so
-- `npm run schema:check` still diffs clean. The remote (libSQL) database does
-- not run migrations — the same three statements are mirrored as a runOnce
-- block in scripts/ensure-remote-schema.mjs. They live there rather than in
-- prisma/ensure-schema.sql because that file is replayed on EVERY build, and an
-- UPDATE replayed on every deploy would silently overwrite choices users make
-- from now on. runOnce is the marker-table mechanism this repo already uses for
-- one-time data normalizations.

-- FIRST, retire the pre-rename 'meshi_ai' category. /api/data-controls
-- normalizes 'meshi_ai' to 'meshi_memory' on write but matches rows by the
-- NORMALIZED name, so a legacy row is never found and never updated — a new
-- meshi_memory row is created alongside it. Once allowMeshiUse is actually
-- enforced that stranding becomes a trap: the gate denies if ANY matching row
-- denies (the safe direction), so a user carrying a denying meshi_ai row could
-- not switch Meshi back on from the privacy centre no matter what they picked.
-- Drop legacy rows already superseded by a real meshi_memory row, then rename
-- the rest so one row per user survives and the UI can address it.
DELETE FROM "DataVisibilityPolicy"
WHERE "entityType" = 'meshi_ai'
  AND EXISTS (
    SELECT 1 FROM "DataVisibilityPolicy" AS newer
    WHERE newer."userId" = "DataVisibilityPolicy"."userId"
      AND newer."entityType" = 'meshi_memory'
      AND newer."entityId" IS "DataVisibilityPolicy"."entityId"
  );

UPDATE "DataVisibilityPolicy" SET "entityType" = 'meshi_memory' WHERE "entityType" = 'meshi_ai';

-- allowDiscovery. Honour an explicit non-public choice on `profile`, whose UI
-- copy is unambiguously about discovery ("Who can discover your identity
-- outside direct shares") — a private or friends-only profile must not surface
-- to strangers, and that is the whole point of the switch. `native_posts` is
-- treated more permissively: its copy ("Default handling for posts created
-- directly on Mesh.me") never told anyone it would withdraw already-published
-- posts from Explore, and native posts carry a more specific, already-enforced
-- control in Post.visibility. A vague category default must not retroactively
-- override the per-post audience the author set deliberately, so only an
-- explicit private/hidden withdraws them.
UPDATE "DataVisibilityPolicy"
SET "allowDiscovery" = 1
WHERE "allowDiscovery" = 0
  AND (
    "visibility" = 'public'
    OR ("entityType" = 'native_posts' AND "visibility" NOT IN ('private', 'hidden'))
  );

-- allowAnalytics. Only an explicit 'hidden' denies, which is exactly what the
-- panel promises ("Hidden means Mesh.me will not use that category for display
-- or assistant context"). Everything else — including rows that landed on the
-- column default without the user ever choosing — is restored to the permissive
-- value that was really in effect, so no existing dashboard blanks by accident.
UPDATE "DataVisibilityPolicy"
SET "allowAnalytics" = 1
WHERE "allowAnalytics" = 0
  AND "visibility" <> 'hidden';

-- allowMeshiUse. Same 'hidden'-only denial, scoped to the Meshi categories.
-- Rows for other categories keep their hard-coded false because it is a
-- placeholder, never a choice — and the gate in src/lib/consent.ts only ever
-- consults this flag on meshi_memory/meshi_ai, so those values are never read.
-- 'meshi_ai' is the pre-rename spelling of 'meshi_memory' and still on disk.
-- The physical column is "allowAiUse"; `allowMeshiUse` is the Prisma-side name
-- via @map, and SQL has to use the real one.
UPDATE "DataVisibilityPolicy"
SET "allowAiUse" = 1
WHERE "allowAiUse" = 0
  AND "visibility" <> 'hidden'
  AND "entityType" IN ('meshi_memory', 'meshi_ai');
