-- Blocks are stored one-directional but enforced symmetrically: every read path
-- also resolves the pair from the blocked side. The existing unique index is
-- blockerId-leading, so the mirrored half had no index at all.
CREATE INDEX IF NOT EXISTS "Block_blockedId_idx" ON "Block"("blockedId");
