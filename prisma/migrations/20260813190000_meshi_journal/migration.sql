-- Meshi's journal: the grant row IS the consent (fail-closed); deleting it
-- cascades every entry. Entries carry grantId only — never userId — so recall
-- and the withdrawal cascade can never disagree about ownership.
CREATE TABLE "MeshiJournalGrant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "grantedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MeshiJournalGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "MeshiJournalEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "grantId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "expiresAt" DATETIME,
    CONSTRAINT "MeshiJournalEntry_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "MeshiJournalGrant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "MeshiJournalGrant_userId_key" ON "MeshiJournalGrant"("userId");
CREATE INDEX "MeshiJournalEntry_grantId_kind_idx" ON "MeshiJournalEntry"("grantId", "kind");
