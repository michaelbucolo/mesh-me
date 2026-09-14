-- Legacy community posts used "private" to mean all members. Preserve that
-- existing audience while reserving "private" for the author's Only me choice.
UPDATE "Post" SET "visibility" = 'community'
WHERE "communityId" IS NOT NULL AND "visibility" = 'private';
