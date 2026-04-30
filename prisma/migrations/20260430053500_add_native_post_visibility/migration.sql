-- Native Mesh.me posts need explicit audience controls.
-- Values are "public", "friends", or "private".

ALTER TABLE "Post" ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'public';

CREATE INDEX "Post_visibility_createdAt_idx" ON "Post"("visibility", "createdAt");
