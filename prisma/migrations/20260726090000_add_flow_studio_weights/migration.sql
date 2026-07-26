-- Algorithm Studio is sold as "your algorithm, literally" — the flagship
-- MeshPro control. Its five weights lived in localStorage, so the paid thing was
-- stored where free things live: a new phone, a new browser or a cleared cache
-- silently reset it, and there was no way to get it back.
--
-- The column holds the same JSON string normalizeStudioWeights() already parses
-- and clamps (five integers, 0..100), so nothing new validates it. Additive and
-- nullable: existing accounts stay NULL, which means "never tuned" and ranks
-- exactly as it does today.
ALTER TABLE "User" ADD COLUMN "flowStudio" TEXT;
