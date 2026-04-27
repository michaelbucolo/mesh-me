-- Add unified data model foundations for mesh graph + cross-platform normalized content.

CREATE TABLE "MeshNode" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "connectedAccountId" TEXT,
  "nodeType" TEXT NOT NULL DEFAULT 'user',
  "externalId" TEXT,
  "label" TEXT NOT NULL,
  "metadata" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "MeshNode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MeshNode_connectedAccountId_fkey" FOREIGN KEY ("connectedAccountId") REFERENCES "ConnectedAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "MeshEdge" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "sourceNodeId" TEXT NOT NULL,
  "targetNodeId" TEXT NOT NULL,
  "edgeType" TEXT NOT NULL DEFAULT 'follows',
  "weight" INTEGER NOT NULL DEFAULT 1,
  "metadata" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "MeshEdge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MeshEdge_sourceNodeId_fkey" FOREIGN KEY ("sourceNodeId") REFERENCES "MeshNode" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MeshEdge_targetNodeId_fkey" FOREIGN KEY ("targetNodeId") REFERENCES "MeshNode" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "SyncedContent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "connectedAccountId" TEXT NOT NULL,
  "meshNodeId" TEXT,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "title" TEXT,
  "normalizedText" TEXT,
  "canonicalUrl" TEXT,
  "publishedAt" DATETIME,
  "engagementScore" INTEGER NOT NULL DEFAULT 0,
  "rawPayload" TEXT,
  "lastSyncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "SyncedContent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SyncedContent_connectedAccountId_fkey" FOREIGN KEY ("connectedAccountId") REFERENCES "ConnectedAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SyncedContent_meshNodeId_fkey" FOREIGN KEY ("meshNodeId") REFERENCES "MeshNode" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "PlatformPermission" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "connectedAccountId" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "permission" TEXT NOT NULL,
  "isGranted" BOOLEAN NOT NULL DEFAULT true,
  "grantedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" DATETIME,
  "lastCheckedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "source" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "PlatformPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PlatformPermission_connectedAccountId_fkey" FOREIGN KEY ("connectedAccountId") REFERENCES "ConnectedAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "MeshNode_userId_nodeType_externalId_key" ON "MeshNode" ("userId", "nodeType", "externalId");
CREATE INDEX "MeshNode_userId_nodeType_idx" ON "MeshNode" ("userId", "nodeType");
CREATE INDEX "MeshNode_connectedAccountId_idx" ON "MeshNode" ("connectedAccountId");

CREATE UNIQUE INDEX "MeshEdge_userId_sourceNodeId_targetNodeId_edgeType_key" ON "MeshEdge" ("userId", "sourceNodeId", "targetNodeId", "edgeType");
CREATE INDEX "MeshEdge_userId_edgeType_idx" ON "MeshEdge" ("userId", "edgeType");
CREATE INDEX "MeshEdge_sourceNodeId_idx" ON "MeshEdge" ("sourceNodeId");
CREATE INDEX "MeshEdge_targetNodeId_idx" ON "MeshEdge" ("targetNodeId");

CREATE UNIQUE INDEX "SyncedContent_connectedAccountId_sourceType_sourceId_key" ON "SyncedContent" ("connectedAccountId", "sourceType", "sourceId");
CREATE INDEX "SyncedContent_userId_sourceType_idx" ON "SyncedContent" ("userId", "sourceType");
CREATE INDEX "SyncedContent_meshNodeId_idx" ON "SyncedContent" ("meshNodeId");

CREATE UNIQUE INDEX "PlatformPermission_connectedAccountId_permission_key" ON "PlatformPermission" ("connectedAccountId", "permission");
CREATE INDEX "PlatformPermission_userId_platform_idx" ON "PlatformPermission" ("userId", "platform");
