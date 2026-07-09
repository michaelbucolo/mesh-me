-- Backfill migration for tables that previously only existed via `prisma db push`.
-- Uses IF NOT EXISTS so databases that already have these tables are untouched.
-- PlatformPost is created without "isNsfw"/"contentRating"; the
-- 20260429131500_add_sensitive_content_controls migration adds those columns.

-- Cross-platform synced posts
CREATE TABLE IF NOT EXISTS "PlatformPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "connectedAccountId" TEXT NOT NULL,
    "platformPostId" TEXT NOT NULL,
    "content" TEXT,
    "title" TEXT,
    "url" TEXT,
    "postType" TEXT NOT NULL DEFAULT 'text',
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "shareCount" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "watchTimeSeconds" INTEGER,
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "isFromMesh" BOOLEAN NOT NULL DEFAULT false,
    "commentsImported" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" DATETIME,
    "thumbnailUrl" TEXT,
    "rawMetadata" TEXT,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "isScheduled" BOOLEAN NOT NULL DEFAULT false,
    "scheduledFor" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlatformPost_connectedAccountId_fkey" FOREIGN KEY ("connectedAccountId") REFERENCES "ConnectedAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "PlatformPost_connectedAccountId_idx" ON "PlatformPost"("connectedAccountId");
CREATE INDEX IF NOT EXISTS "PlatformPost_publishedAt_idx" ON "PlatformPost"("publishedAt");
CREATE INDEX IF NOT EXISTS "PlatformPost_postType_idx" ON "PlatformPost"("postType");
CREATE UNIQUE INDEX IF NOT EXISTS "PlatformPost_connectedAccountId_platformPostId_key" ON "PlatformPost"("connectedAccountId", "platformPostId");

-- Comments imported from connected platforms
CREATE TABLE IF NOT EXISTS "PlatformComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "connectedAccountId" TEXT NOT NULL,
    "platformPostId" TEXT,
    "platformCommentId" TEXT NOT NULL,
    "postId" TEXT,
    "content" TEXT NOT NULL,
    "authorName" TEXT,
    "authorUsername" TEXT,
    "authorAvatarUrl" TEXT,
    "isOwnComment" BOOLEAN NOT NULL DEFAULT false,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "replyCount" INTEGER NOT NULL DEFAULT 0,
    "parentCommentId" TEXT,
    "url" TEXT,
    "sentiment" TEXT,
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlatformComment_connectedAccountId_fkey" FOREIGN KEY ("connectedAccountId") REFERENCES "ConnectedAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlatformComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "PlatformPost" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "PlatformComment_connectedAccountId_idx" ON "PlatformComment"("connectedAccountId");
CREATE INDEX IF NOT EXISTS "PlatformComment_postId_idx" ON "PlatformComment"("postId");
CREATE UNIQUE INDEX IF NOT EXISTS "PlatformComment_connectedAccountId_platformCommentId_key" ON "PlatformComment"("connectedAccountId", "platformCommentId");

-- Media attached to synced posts
CREATE TABLE IF NOT EXISTS "PlatformMedia" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "connectedAccountId" TEXT NOT NULL,
    "platformMediaId" TEXT,
    "postId" TEXT,
    "mediaType" TEXT NOT NULL DEFAULT 'image',
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "altText" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "durationSeconds" INTEGER,
    "fileSizeBytes" INTEGER,
    "mimeType" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlatformMedia_connectedAccountId_fkey" FOREIGN KEY ("connectedAccountId") REFERENCES "ConnectedAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlatformMedia_postId_fkey" FOREIGN KEY ("postId") REFERENCES "PlatformPost" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "PlatformMedia_connectedAccountId_idx" ON "PlatformMedia"("connectedAccountId");
CREATE INDEX IF NOT EXISTS "PlatformMedia_postId_idx" ON "PlatformMedia"("postId");

-- Follower / following relationships on connected platforms
CREATE TABLE IF NOT EXISTS "PlatformFollower" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "connectedAccountId" TEXT NOT NULL,
    "platformUserId" TEXT NOT NULL,
    "username" TEXT,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "followerCount" INTEGER,
    "isMutual" BOOLEAN NOT NULL DEFAULT false,
    "relationshipType" TEXT NOT NULL DEFAULT 'follower',
    "profileUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlatformFollower_connectedAccountId_fkey" FOREIGN KEY ("connectedAccountId") REFERENCES "ConnectedAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "PlatformFollower_connectedAccountId_idx" ON "PlatformFollower"("connectedAccountId");
CREATE UNIQUE INDEX IF NOT EXISTS "PlatformFollower_connectedAccountId_platformUserId_key" ON "PlatformFollower"("connectedAccountId", "platformUserId");

-- Daily analytics snapshots per connected account
CREATE TABLE IF NOT EXISTS "PlatformAnalytics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "connectedAccountId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "followerCount" INTEGER NOT NULL DEFAULT 0,
    "followingCount" INTEGER NOT NULL DEFAULT 0,
    "postCount" INTEGER NOT NULL DEFAULT 0,
    "totalLikes" INTEGER NOT NULL DEFAULT 0,
    "totalComments" INTEGER NOT NULL DEFAULT 0,
    "totalViews" INTEGER NOT NULL DEFAULT 0,
    "totalShares" INTEGER NOT NULL DEFAULT 0,
    "newFollowers" INTEGER NOT NULL DEFAULT 0,
    "lostFollowers" INTEGER NOT NULL DEFAULT 0,
    "engagementRate" INTEGER,
    "topPostId" TEXT,
    "rawData" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformAnalytics_connectedAccountId_fkey" FOREIGN KEY ("connectedAccountId") REFERENCES "ConnectedAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "PlatformAnalytics_connectedAccountId_idx" ON "PlatformAnalytics"("connectedAccountId");
CREATE INDEX IF NOT EXISTS "PlatformAnalytics_date_idx" ON "PlatformAnalytics"("date");
CREATE UNIQUE INDEX IF NOT EXISTS "PlatformAnalytics_connectedAccountId_date_key" ON "PlatformAnalytics"("connectedAccountId", "date");

-- Sync job tracking per connected account
CREATE TABLE IF NOT EXISTS "SyncJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "connectedAccountId" TEXT NOT NULL,
    "syncType" TEXT NOT NULL DEFAULT 'full',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "itemsSynced" INTEGER NOT NULL DEFAULT 0,
    "totalItems" INTEGER,
    "error" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SyncJob_connectedAccountId_fkey" FOREIGN KEY ("connectedAccountId") REFERENCES "ConnectedAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "SyncJob_connectedAccountId_idx" ON "SyncJob"("connectedAccountId");
CREATE INDEX IF NOT EXISTS "SyncJob_status_idx" ON "SyncJob"("status");

-- Extended profile details with per-field privacy
CREATE TABLE IF NOT EXISTS "ProfileInfo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "aboutMe" TEXT,
    "workplace" TEXT,
    "jobTitle" TEXT,
    "school" TEXT,
    "birthday" TEXT,
    "gender" TEXT,
    "pronouns" TEXT,
    "hometown" TEXT,
    "currentCity" TEXT,
    "relationshipStatus" TEXT,
    "publicEmail" TEXT,
    "publicPhone" TEXT,
    "fieldPrivacy" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProfileInfo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProfileInfo_userId_key" ON "ProfileInfo"("userId");

-- Live Meshi presence on the mesh
CREATE TABLE IF NOT EXISTS "MeshPresence" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "meshiColor" TEXT NOT NULL DEFAULT 'blue',
    "meshiHat" TEXT NOT NULL DEFAULT 'none',
    "meshiHair" TEXT NOT NULL DEFAULT 'none',
    "meshiAccessory" TEXT NOT NULL DEFAULT 'none',
    "meshiEyeStyle" TEXT NOT NULL DEFAULT 'regular',
    "meshiBadge" TEXT NOT NULL DEFAULT 'none',
    "meshiOutfit" TEXT NOT NULL DEFAULT 'none',
    "meshiMood" TEXT NOT NULL DEFAULT 'happy',
    "posX" REAL NOT NULL DEFAULT 0,
    "posY" REAL NOT NULL DEFAULT 0,
    "vx" REAL NOT NULL DEFAULT 0.5,
    "vy" REAL NOT NULL DEFAULT 0.5,
    "viewingMesh" TEXT NOT NULL,
    "surface" TEXT NOT NULL DEFAULT 'mesh',
    "activePostId" TEXT,
    "activeNodeId" TEXT,
    "activeRoute" TEXT,
    "velocity" REAL NOT NULL DEFAULT 0,
    "activity" TEXT NOT NULL DEFAULT 'idle',
    "ghostMode" BOOLEAN NOT NULL DEFAULT false,
    "lastSeen" DATETIME NOT NULL
);
CREATE INDEX IF NOT EXISTS "MeshPresence_lastSeen_idx" ON "MeshPresence"("lastSeen");
CREATE INDEX IF NOT EXISTS "MeshPresence_viewingMesh_idx" ON "MeshPresence"("viewingMesh");
