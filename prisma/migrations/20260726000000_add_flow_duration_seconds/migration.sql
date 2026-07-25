-- The Flow is a shorts-and-reels surface, and until now nothing in the product
-- could tell a short from a long video. `PlatformMedia.durationSeconds` existed
-- but was declared in an interface and never written or read; the ranker was
-- guessing from URL shape, which classified every YouTube item — Shorts
-- included — as long-form.
--
-- These two columns are where the Flow actually reads from. Additive and
-- nullable: existing rows stay NULL and are treated as "unknown", which the
-- shorts-only rule excludes until a sync fills them in.
ALTER TABLE "PlatformPost" ADD COLUMN "durationSeconds" INTEGER;
ALTER TABLE "PlatformFeedItem" ADD COLUMN "durationSeconds" INTEGER;
