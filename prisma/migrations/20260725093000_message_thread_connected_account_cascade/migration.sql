-- MessageThread.connectedAccountId was a bare TEXT column with no foreign key
-- for its whole life. Disconnecting a platform deleted the ConnectedAccount row
-- and left every mirrored DM thread behind, pointing at an id that no longer
-- existed: unreachable from any surface, deleted by nothing, and still present
-- after a GDPR erasure request or Meta's data-deletion callback.
--
-- Two parts. The first is remediation for data already leaked; the second stops
-- it happening again.

-- 1. REMEDIATION — remove threads mirrored from connections that are already
--    gone, deepest table first. These rows are the actual leak: real
--    correspondence, stored unencrypted, belonging to connections the user
--    already revoked. There is no path in the product that can reach or delete
--    them, so this is the only opportunity.
--
--    A NULL connectedAccountId means a mesh-native thread and is never touched.
DELETE FROM "Message"
WHERE "threadId" IN (
    SELECT "id" FROM "MessageThread"
    WHERE "connectedAccountId" IS NOT NULL
      AND "connectedAccountId" NOT IN (SELECT "id" FROM "ConnectedAccount")
);

DELETE FROM "ThreadMember"
WHERE "threadId" IN (
    SELECT "id" FROM "MessageThread"
    WHERE "connectedAccountId" IS NOT NULL
      AND "connectedAccountId" NOT IN (SELECT "id" FROM "ConnectedAccount")
);

DELETE FROM "MessageThread"
WHERE "connectedAccountId" IS NOT NULL
  AND "connectedAccountId" NOT IN (SELECT "id" FROM "ConnectedAccount");

-- 2. PREVENTION — rebuild the table with the foreign key SQLite cannot add in
--    place. Cascade is correct rather than merely convenient: these rows are a
--    COPY of correspondence that lives on the platform, and revoking our access
--    to the platform is exactly the moment our copy stops being ours to keep.
--
--    The orphan purge above must run first: the copy below runs with foreign
--    keys off, so any surviving orphan would be carried straight through the
--    new constraint without being checked.

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MessageThread" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT,
    "threadType" TEXT NOT NULL DEFAULT 'direct',
    "sourcePlatform" TEXT NOT NULL DEFAULT 'mesh',
    "isEncrypted" BOOLEAN NOT NULL DEFAULT true,
    "connectedAccountId" TEXT,
    "externalConversationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MessageThread_connectedAccountId_fkey" FOREIGN KEY ("connectedAccountId") REFERENCES "ConnectedAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_MessageThread" ("connectedAccountId", "createdAt", "externalConversationId", "id", "isEncrypted", "sourcePlatform", "threadType", "title", "updatedAt") SELECT "connectedAccountId", "createdAt", "externalConversationId", "id", "isEncrypted", "sourcePlatform", "threadType", "title", "updatedAt" FROM "MessageThread";
DROP TABLE "MessageThread";
ALTER TABLE "new_MessageThread" RENAME TO "MessageThread";
CREATE INDEX "MessageThread_threadType_idx" ON "MessageThread"("threadType");
CREATE INDEX "MessageThread_sourcePlatform_idx" ON "MessageThread"("sourcePlatform");
CREATE INDEX "MessageThread_connectedAccountId_idx" ON "MessageThread"("connectedAccountId");
CREATE UNIQUE INDEX "MessageThread_connectedAccountId_externalConversationId_key" ON "MessageThread"("connectedAccountId", "externalConversationId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
