-- Align migration history with schema.prisma for databases provisioned via
-- `prisma migrate deploy`. The `lastAction` (tiny-world action broadcast) and
-- `isPro` (server-authoritative Pro aura) columns were added to the Prisma model
-- and to prisma/ensure-schema.sql, but no migration ever captured them, so
-- `prisma migrate diff --from-migrations --to-schema` reported drift and the
-- `schema:check` gate failed.
--
-- Databases that already received these columns through the remote build path
-- (`scripts/ensure-remote-schema.mjs` applying `prisma/ensure-schema.sql`) or via
-- `prisma db push` must BASELINE this migration instead of applying it — a plain
-- ADD COLUMN aborts with `duplicate column name`. Mark it applied without running
-- it (mirrors 20260709021700_align_connected_account_and_notification_preferences):
--   npx prisma migrate resolve --applied 20260719120000_align_mesh_presence_last_action_pro
ALTER TABLE "MeshPresence" ADD COLUMN "lastAction" TEXT;
ALTER TABLE "MeshPresence" ADD COLUMN "isPro" BOOLEAN NOT NULL DEFAULT false;
