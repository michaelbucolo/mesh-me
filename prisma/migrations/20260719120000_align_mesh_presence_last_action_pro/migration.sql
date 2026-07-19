-- Reconcile the MeshPresence migration history with schema.prisma and
-- prisma/ensure-schema.sql. The `lastAction` (tiny-world action broadcast) and
-- `isPro` (server-authoritative Pro aura) columns were added to the Prisma model
-- and to ensure-schema.sql, but no migration ever captured them, so
-- `prisma migrate diff --from-migrations --to-schema` reported drift and the
-- `schema:check` gate failed. These ADD COLUMNs bring the migrations in line.
ALTER TABLE "MeshPresence" ADD COLUMN "lastAction" TEXT;
ALTER TABLE "MeshPresence" ADD COLUMN "isPro" BOOLEAN NOT NULL DEFAULT false;
