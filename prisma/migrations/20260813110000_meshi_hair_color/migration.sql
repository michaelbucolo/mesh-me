-- Meshi hair color: its own axis at last (meshi-slots.ts reserved this change).
-- "inherit" keeps deriving the tone from the body color exactly as before, so
-- every existing row and every free account renders byte-identically.
ALTER TABLE "MeshiPreference" ADD COLUMN "hairColor" TEXT NOT NULL DEFAULT 'inherit';
ALTER TABLE "MeshPresence" ADD COLUMN "meshiHairColor" TEXT NOT NULL DEFAULT 'inherit';
