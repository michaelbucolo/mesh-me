-- CreateTable
CREATE TABLE "MeshNode" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "nodeType" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL DEFAULT 'mesh',
  "sourceId" TEXT,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "imageUrl" TEXT,
  "metadata" TEXT NOT NULL DEFAULT '{}',
  "visibility" TEXT NOT NULL DEFAULT 'private',
  "isArchived" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "MeshNode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MeshEdge" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "fromNodeId" TEXT NOT NULL,
  "toNodeId" TEXT NOT NULL,
  "edgeType" TEXT NOT NULL,
  "strength" INTEGER NOT NULL DEFAULT 100,
  "metadata" TEXT NOT NULL DEFAULT '{}',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "MeshEdge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MeshEdge_fromNodeId_fkey" FOREIGN KEY ("fromNodeId") REFERENCES "MeshNode" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MeshEdge_toNodeId_fkey" FOREIGN KEY ("toNodeId") REFERENCES "MeshNode" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContentSource" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "connectedAccountId" TEXT,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "sourceUrl" TEXT,
  "sourceAuthorId" TEXT,
  "sourceAuthorName" TEXT,
  "sourceCreatedAt" DATETIME,
  "ingestState" TEXT NOT NULL DEFAULT 'active',
  "metadata" TEXT NOT NULL DEFAULT '{}',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ContentSource_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ContentSource_connectedAccountId_fkey" FOREIGN KEY ("connectedAccountId") REFERENCES "ConnectedAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SyncedContent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "contentSourceId" TEXT NOT NULL,
  "canonicalType" TEXT NOT NULL,
  "textContent" TEXT,
  "title" TEXT,
  "mediaJson" TEXT NOT NULL DEFAULT '[]',
  "permalink" TEXT,
  "ownership" TEXT NOT NULL DEFAULT 'external',
  "actionSupport" TEXT NOT NULL DEFAULT '{}',
  "syncStatus" TEXT NOT NULL DEFAULT 'synced',
  "syncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "SyncedContent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SyncedContent_contentSourceId_fkey" FOREIGN KEY ("contentSourceId") REFERENCES "ContentSource" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SyncedInteraction" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "syncedContentId" TEXT NOT NULL,
  "interactionType" TEXT NOT NULL,
  "actorSourceId" TEXT,
  "actorDisplayName" TEXT,
  "value" INTEGER,
  "body" TEXT,
  "happenedAt" DATETIME,
  "metadata" TEXT NOT NULL DEFAULT '{}',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SyncedInteraction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SyncedInteraction_syncedContentId_fkey" FOREIGN KEY ("syncedContentId") REFERENCES "SyncedContent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlatformPermission" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "connectedAccountId" TEXT,
  "platform" TEXT NOT NULL,
  "permissionKey" TEXT NOT NULL,
  "permissionState" TEXT NOT NULL DEFAULT 'granted',
  "grantedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" DATETIME,
  "source" TEXT NOT NULL DEFAULT 'oauth_scope',
  "metadata" TEXT NOT NULL DEFAULT '{}',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "PlatformPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PlatformPermission_connectedAccountId_fkey" FOREIGN KEY ("connectedAccountId") REFERENCES "ConnectedAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DataVisibilityPolicy" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "visibility" TEXT NOT NULL,
  "allowDiscovery" BOOLEAN NOT NULL DEFAULT true,
  "allowAnalytics" BOOLEAN NOT NULL DEFAULT true,
  "allowAiUse" BOOLEAN NOT NULL DEFAULT false,
  "expiresAt" DATETIME,
  "metadata" TEXT NOT NULL DEFAULT '{}',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "DataVisibilityPolicy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "MeshNode_userId_nodeType_idx" ON "MeshNode"("userId", "nodeType");
CREATE INDEX "MeshNode_sourceType_sourceId_idx" ON "MeshNode"("sourceType", "sourceId");

CREATE UNIQUE INDEX "MeshEdge_userId_fromNodeId_toNodeId_edgeType_key" ON "MeshEdge"("userId", "fromNodeId", "toNodeId", "edgeType");
CREATE INDEX "MeshEdge_userId_edgeType_idx" ON "MeshEdge"("userId", "edgeType");

CREATE UNIQUE INDEX "ContentSource_userId_sourceType_sourceId_key" ON "ContentSource"("userId", "sourceType", "sourceId");
CREATE INDEX "ContentSource_connectedAccountId_idx" ON "ContentSource"("connectedAccountId");

CREATE INDEX "SyncedContent_userId_canonicalType_idx" ON "SyncedContent"("userId", "canonicalType");
CREATE INDEX "SyncedContent_syncStatus_syncedAt_idx" ON "SyncedContent"("syncStatus", "syncedAt");

CREATE INDEX "SyncedInteraction_userId_interactionType_idx" ON "SyncedInteraction"("userId", "interactionType");
CREATE INDEX "SyncedInteraction_syncedContentId_happenedAt_idx" ON "SyncedInteraction"("syncedContentId", "happenedAt");

CREATE UNIQUE INDEX "PlatformPermission_userId_platform_permissionKey_connectedAccountId_key" ON "PlatformPermission"("userId", "platform", "permissionKey", "connectedAccountId");
CREATE INDEX "PlatformPermission_connectedAccountId_permissionState_idx" ON "PlatformPermission"("connectedAccountId", "permissionState");

CREATE INDEX "DataVisibilityPolicy_userId_entityType_idx" ON "DataVisibilityPolicy"("userId", "entityType");
CREATE INDEX "DataVisibilityPolicy_visibility_idx" ON "DataVisibilityPolicy"("visibility");
