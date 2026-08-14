-- CreateTable
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "bio" TEXT,
    "location" TEXT,
    "website" TEXT,
    "avatarUrl" TEXT,
    "bannerUrl" TEXT,
    "accentColor" TEXT NOT NULL DEFAULT '#6366f1',
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isSuspended" BOOLEAN NOT NULL DEFAULT false,
    "onboarded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "activeTitle" TEXT,
    "isMeshPro" BOOLEAN NOT NULL DEFAULT false,
    "meshProSince" DATETIME,
    "meshProGiftUntil" DATETIME,
    "charterNumber" INTEGER,
    "showCharterNumber" BOOLEAN NOT NULL DEFAULT true,
    "patronSince" DATETIME,
    "showPatronChip" BOOLEAN NOT NULL DEFAULT true,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "signupNumber" INTEGER,
    "showInDiscovery" BOOLEAN NOT NULL DEFAULT false,
    "hideActivityStatus" BOOLEAN NOT NULL DEFAULT false,
    "readReceipts" BOOLEAN NOT NULL DEFAULT false,
    "ghostMode" BOOLEAN NOT NULL DEFAULT false,
    "flowStudio" TEXT,
    "nsfwEnabled" BOOLEAN NOT NULL DEFAULT false,
    "adultVerificationStatus" TEXT NOT NULL DEFAULT 'unverified',
    "adultVerifiedAt" DATETIME,
    "adultVerificationExpiresAt" DATETIME,
    "adultVerificationProvider" TEXT,
    "adultVerificationRegion" TEXT,
    "adultVerificationReference" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "resetToken" TEXT,
    "resetTokenExpiry" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'offline',
    "lastSeenAt" DATETIME,
    "caughtUpAt" DATETIME,
    "mergedIntoUserId" TEXT
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "UserInterest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    CONSTRAINT "UserInterest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "UserLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    CONSTRAINT "UserLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Follow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Follow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Follow_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Post" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "content" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "communityId" TEXT,
    "isRepost" BOOLEAN NOT NULL DEFAULT false,
    "repostId" TEXT,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "isNsfw" BOOLEAN NOT NULL DEFAULT false,
    "contentRating" TEXT NOT NULL DEFAULT 'general',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Post_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Post_repostId_fkey" FOREIGN KEY ("repostId") REFERENCES "Post" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PostMedia" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'image',
    "width" INTEGER,
    "height" INTEGER,
    CONSTRAINT "PostMedia_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PostTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    CONSTRAINT "PostTag_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Comment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "content" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Comment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Comment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Reaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL DEFAULT 'like',
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Reaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Reaction_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Community" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "iconUrl" TEXT,
    "bannerUrl" TEXT,
    "category" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "rules" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CommunityMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommunityMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CommunityMember_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MessageThread" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT,
    "threadType" TEXT NOT NULL DEFAULT 'direct',
    "sourcePlatform" TEXT NOT NULL DEFAULT 'mesh',
    "isEncrypted" BOOLEAN NOT NULL DEFAULT true,
    "connectedAccountId" TEXT,
    "externalConversationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    -- Mirrored DMs are a copy of correspondence that lives on the platform.
    -- Revoking the connection is the moment our copy stops being ours to keep.
    CONSTRAINT "MessageThread_connectedAccountId_fkey" FOREIGN KEY ("connectedAccountId") REFERENCES "ConnectedAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ThreadMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "notificationsMuted" BOOLEAN NOT NULL DEFAULT false,
    "lastRead" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ThreadMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ThreadMember_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "MessageThread" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "content" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "sourcePlatform" TEXT NOT NULL DEFAULT 'mesh',
    "messageType" TEXT NOT NULL DEFAULT 'text',
    "sourceUrl" TEXT,
    "sourcePostId" TEXT,
    "platformPostId" TEXT,
    "platformCommentId" TEXT,
    "externalMessageId" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Message_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "MessageThread" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "actorId" TEXT,
    "postId" TEXT,
    "message" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Notification_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Notification_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "UserNotificationPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailDigest" TEXT NOT NULL DEFAULT 'weekly',
    "messages" BOOLEAN NOT NULL DEFAULT true,
    "mentions" BOOLEAN NOT NULL DEFAULT true,
    "comments" BOOLEAN NOT NULL DEFAULT true,
    "follows" BOOLEAN NOT NULL DEFAULT true,
    "platformAlerts" BOOLEAN NOT NULL DEFAULT true,
    "securityAlerts" BOOLEAN NOT NULL DEFAULT true,
    "productUpdates" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserNotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Report" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reporterId" TEXT NOT NULL,
    "reportedUserId" TEXT,
    "reportedPostId" TEXT,
    "reportedCommentId" TEXT,
    "reportedCommunityId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Report_reportedUserId_fkey" FOREIGN KEY ("reportedUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Report_reportedPostId_fkey" FOREIGN KEY ("reportedPostId") REFERENCES "Post" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Report_reportedCommentId_fkey" FOREIGN KEY ("reportedCommentId") REFERENCES "Comment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Report_reportedCommunityId_fkey" FOREIGN KEY ("reportedCommunityId") REFERENCES "Community" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Block" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Block_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Block_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Mute" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "muterId" TEXT NOT NULL,
    "mutedId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Mute_muterId_fkey" FOREIGN KEY ("muterId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Mute_mutedId_fkey" FOREIGN KEY ("mutedId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SavedPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SavedPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SavedPost_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AdminLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "adminId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ConnectedAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "platformUsername" TEXT,
    "platformId" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "expiresAt" DATETIME,
    "scopes" TEXT,
    "serviceUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" DATETIME,
    "syncStatus" TEXT NOT NULL DEFAULT 'idle',
    "syncError" TEXT,
    "alterEgoId" TEXT,
    "accountLabel" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ConnectedAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ConnectedAccount_alterEgoId_fkey" FOREIGN KEY ("alterEgoId") REFERENCES "AlterEgo" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PlatformPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "connectedAccountId" TEXT NOT NULL,
    "platformPostId" TEXT NOT NULL,
    "content" TEXT,
    "title" TEXT,
    "url" TEXT,
    "durationSeconds" INTEGER,
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
    "isNsfw" BOOLEAN NOT NULL DEFAULT false,
    "contentRating" TEXT NOT NULL DEFAULT 'general',
    "isScheduled" BOOLEAN NOT NULL DEFAULT false,
    "scheduledFor" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlatformPost_connectedAccountId_fkey" FOREIGN KEY ("connectedAccountId") REFERENCES "ConnectedAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PlatformFeedItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "connectedAccountId" TEXT NOT NULL,
    "platformItemId" TEXT NOT NULL,
    "authorName" TEXT,
    "authorUsername" TEXT,
    "authorAvatarUrl" TEXT,
    "authorUrl" TEXT,
    "title" TEXT,
    "content" TEXT,
    "url" TEXT,
    "thumbnailUrl" TEXT,
    "mediaUrl" TEXT,
    "durationSeconds" INTEGER,
    "postType" TEXT NOT NULL DEFAULT 'post',
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "isNsfw" BOOLEAN NOT NULL DEFAULT false,
    "contentRating" TEXT NOT NULL DEFAULT 'general',
    "publishedAt" DATETIME,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawMetadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlatformFeedItem_connectedAccountId_fkey" FOREIGN KEY ("connectedAccountId") REFERENCES "ConnectedAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE IF NOT EXISTS "FeedPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "layout" TEXT NOT NULL DEFAULT 'cards',
    "sources" TEXT NOT NULL DEFAULT 'all',
    "mutedSources" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FeedPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MeshNode" (
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
CREATE TABLE IF NOT EXISTS "MeshEdge" (
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
CREATE TABLE IF NOT EXISTS "ContentSource" (
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
CREATE TABLE IF NOT EXISTS "SyncedContent" (
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
CREATE TABLE IF NOT EXISTS "SyncedInteraction" (
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
CREATE TABLE IF NOT EXISTS "PlatformPermission" (
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
CREATE TABLE IF NOT EXISTS "DataVisibilityPolicy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "visibility" TEXT NOT NULL,
    "allowDiscovery" BOOLEAN NOT NULL DEFAULT false,
    "allowAnalytics" BOOLEAN NOT NULL DEFAULT false,
    "allowAiUse" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" DATETIME,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DataVisibilityPolicy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Achievement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "title" TEXT,
    "threshold" INTEGER NOT NULL DEFAULT 1,
    "isLimited" BOOLEAN NOT NULL DEFAULT false,
    "maxHolders" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "UserAchievement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "unlockedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MeshiPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "hatStyle" TEXT NOT NULL DEFAULT 'none',
    "faceStyle" TEXT NOT NULL DEFAULT 'happy',
    "colorTheme" TEXT NOT NULL DEFAULT 'blue',
    "hairStyle" TEXT NOT NULL DEFAULT 'none',
    "hairColor" TEXT NOT NULL DEFAULT 'inherit',
    "accessoryStyle" TEXT NOT NULL DEFAULT 'none',
    "eyeStyle" TEXT NOT NULL DEFAULT 'regular',
    "badgeStyle" TEXT NOT NULL DEFAULT 'none',
    -- RETIRED: outfits were removed from Meshi customization. Kept because it is
    -- NOT NULL with a default, so nothing breaks by never setting it; dropping a
    -- column on the live database buys nothing.
    "outfitStyle" TEXT NOT NULL DEFAULT 'none',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MeshiPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CharterSeat" (
    "number" INTEGER NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'open',
    "userId" TEXT,
    "stripeSessionId" TEXT,
    "paymentIntentId" TEXT,
    "holdExpiresAt" DATETIME,
    "claimedAt" DATETIME,
    "retiredAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CharterSeat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MeshiJournalGrant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "grantedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MeshiJournalGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MeshiJournalEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "grantId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "expiresAt" DATETIME,
    CONSTRAINT "MeshiJournalEntry_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "MeshiJournalGrant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PatronStint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT NOT NULL,
    "monthlyCents" INTEGER NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    "refundedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PatronStint_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "OwnedMeshiItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "purchaserId" TEXT,
    "category" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "message" TEXT,
    "stripeSessionId" TEXT NOT NULL,
    "paymentIntentId" TEXT,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "labelQuietedAt" DATETIME,
    CONSTRAINT "OwnedMeshiItem_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OwnedMeshiItem_purchaserId_fkey" FOREIGN KEY ("purchaserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MeshiRecipe" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hatStyle" TEXT NOT NULL,
    "faceStyle" TEXT NOT NULL,
    "colorTheme" TEXT NOT NULL,
    "hairStyle" TEXT NOT NULL,
    "hairColor" TEXT NOT NULL,
    "accessoryStyle" TEXT NOT NULL,
    "eyeStyle" TEXT NOT NULL,
    "badgeStyle" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MeshiRecipe_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ScheduledPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "title" TEXT,
    "mediaJson" TEXT NOT NULL DEFAULT '[]',
    "targetsJson" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "scheduledFor" DATETIME NOT NULL,
    "tz" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" DATETIME,
    "claimedAt" DATETIME,
    "firedAt" DATETIME,
    "completedAt" DATETIME,
    "reportJson" TEXT,
    "notifiedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ScheduledPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PersonalAccessToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "selector" TEXT NOT NULL,
    "verifierHash" TEXT NOT NULL,
    "scopes" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "lastUsedAt" DATETIME,
    CONSTRAINT "PersonalAccessToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SchedulerRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "claimed" INTEGER NOT NULL DEFAULT 0,
    "fired" INTEGER NOT NULL DEFAULT 0,
    "missed" INTEGER NOT NULL DEFAULT 0,
    "retried" INTEGER NOT NULL DEFAULT 0,
    "interrupted" INTEGER NOT NULL DEFAULT 0,
    "detail" TEXT
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MeshProGift" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "purchaserId" TEXT,
    "recipientId" TEXT NOT NULL,
    "months" INTEGER NOT NULL,
    "message" TEXT,
    "occasion" TEXT,
    "stripeSessionId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MeshProGift_purchaserId_fkey" FOREIGN KEY ("purchaserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MeshProGift_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MeshCosmetic" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MeshCosmetic_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MeshPrivacy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "meshVisibility" TEXT NOT NULL DEFAULT 'private',
    "branchOverrides" TEXT NOT NULL DEFAULT '{}',
    "showConnections" BOOLEAN NOT NULL DEFAULT false,
    "showStats" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MeshPrivacy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "GlobalMeshMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "sharedBranches" TEXT NOT NULL DEFAULT '[]',
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GlobalMeshMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AuthIdentity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AuthIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AlterEgo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "bio" TEXT,
    "avatarUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AlterEgo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "UserEmail" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserEmail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "EmailVerificationToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumedAt" DATETIME,
    CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "UserPhone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserPhone_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TwoFactorMethod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "secret" TEXT,
    "publicKey" TEXT,
    "label" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TwoFactorMethod_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AccountMergeRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "primaryUserId" TEXT NOT NULL,
    "secondaryEmail" TEXT NOT NULL,
    "secondaryUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "verifyToken" TEXT,
    "approvedAt" DATETIME,
    "expiresAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
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

-- CreateTable
CREATE TABLE IF NOT EXISTS "MeChatSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hostId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "sessionType" TEXT NOT NULL DEFAULT 'co_browse',
    "callMode" TEXT NOT NULL DEFAULT 'none',
    "callStatus" TEXT NOT NULL DEFAULT 'idle',
    "callStartedAt" DATETIME,
    "callEndedAt" DATETIME,
    "currentItemId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MeChatSession_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MeChatSessionParticipant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'participant',
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME,
    CONSTRAINT "MeChatSessionParticipant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "MeChatSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MeChatSessionParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MeChatSessionItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "addedById" TEXT NOT NULL,
    "sourcePlatform" TEXT NOT NULL DEFAULT 'mesh',
    "sourceUrl" TEXT,
    "title" TEXT,
    "content" TEXT,
    "postId" TEXT,
    "platformPostId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MeChatSessionItem_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "MeChatSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MeChatSessionItem_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MeChatSessionVote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vote" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MeChatSessionVote_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "MeChatSessionItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MeChatSessionVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MeChatNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "songTitle" TEXT,
    "songArtist" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    CONSTRAINT "MeChatNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "RedeemCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "rewardType" TEXT NOT NULL,
    "rewardValue" TEXT NOT NULL,
    "rewardLabel" TEXT NOT NULL,
    "redeemedBy" TEXT,
    "redeemedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MeshPresence" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "meshiColor" TEXT NOT NULL DEFAULT 'blue',
    "meshiHat" TEXT NOT NULL DEFAULT 'none',
    "meshiHair" TEXT NOT NULL DEFAULT 'none',
    "meshiHairColor" TEXT NOT NULL DEFAULT 'inherit',
    "meshiAccessory" TEXT NOT NULL DEFAULT 'none',
    "meshiEyeStyle" TEXT NOT NULL DEFAULT 'regular',
    "meshiBadge" TEXT NOT NULL DEFAULT 'none',
    -- RETIRED alongside MeshiPreference.outfitStyle.
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
    "lastAction" TEXT,
    "isPro" BOOLEAN NOT NULL DEFAULT false,
    "lastSeen" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_stripeCustomerId_key" ON "User"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_resetToken_key" ON "User"("resetToken");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UserInterest_tag_idx" ON "UserInterest"("tag");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "UserInterest_userId_tag_key" ON "UserInterest"("userId", "tag");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Follow_followerId_idx" ON "Follow"("followerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Follow_followingId_idx" ON "Follow"("followingId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Follow_followerId_followingId_key" ON "Follow"("followerId", "followingId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Post_authorId_idx" ON "Post"("authorId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Post_communityId_idx" ON "Post"("communityId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Post_createdAt_idx" ON "Post"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Post_visibility_createdAt_idx" ON "Post"("visibility", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Post_isNsfw_createdAt_idx" ON "Post"("isNsfw", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PostTag_tag_idx" ON "PostTag"("tag");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Comment_postId_idx" ON "Comment"("postId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Comment_authorId_idx" ON "Comment"("authorId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Reaction_postId_idx" ON "Reaction"("postId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Reaction_userId_postId_key" ON "Reaction"("userId", "postId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Community_name_key" ON "Community"("name");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Community_slug_key" ON "Community"("slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Community_category_idx" ON "Community"("category");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CommunityMember_communityId_idx" ON "CommunityMember"("communityId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CommunityMember_userId_communityId_key" ON "CommunityMember"("userId", "communityId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MessageThread_threadType_idx" ON "MessageThread"("threadType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MessageThread_sourcePlatform_idx" ON "MessageThread"("sourcePlatform");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MessageThread_connectedAccountId_idx" ON "MessageThread"("connectedAccountId");
CREATE UNIQUE INDEX IF NOT EXISTS "MessageThread_connectedAccountId_externalConversationId_key" ON "MessageThread"("connectedAccountId", "externalConversationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ThreadMember_role_idx" ON "ThreadMember"("role");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ThreadMember_userId_threadId_key" ON "ThreadMember"("userId", "threadId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Message_threadId_idx" ON "Message"("threadId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Message_threadId_createdAt_idx" ON "Message"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Message_sourcePlatform_idx" ON "Message"("sourcePlatform");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Message_platformPostId_idx" ON "Message"("platformPostId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Message_platformCommentId_idx" ON "Message"("platformCommentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Message_externalMessageId_idx" ON "Message"("externalMessageId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Notification_recipientId_idx" ON "Notification"("recipientId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Notification_recipientId_read_idx" ON "Notification"("recipientId", "read");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Notification_recipientId_createdAt_idx" ON "Notification"("recipientId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "UserNotificationPreference_userId_key" ON "UserNotificationPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Block_blockerId_blockedId_key" ON "Block"("blockerId", "blockedId");
CREATE INDEX IF NOT EXISTS "Block_blockedId_idx" ON "Block"("blockedId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Mute_muterId_mutedId_key" ON "Mute"("muterId", "mutedId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SavedPost_userId_postId_key" ON "SavedPost"("userId", "postId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdminLog_createdAt_idx" ON "AdminLog"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ConnectedAccount_userId_platform_idx" ON "ConnectedAccount"("userId", "platform");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ConnectedAccount_platform_idx" ON "ConnectedAccount"("platform");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ConnectedAccount_alterEgoId_idx" ON "ConnectedAccount"("alterEgoId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PlatformPost_connectedAccountId_idx" ON "PlatformPost"("connectedAccountId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PlatformPost_publishedAt_idx" ON "PlatformPost"("publishedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PlatformPost_postType_idx" ON "PlatformPost"("postType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PlatformPost_isNsfw_publishedAt_idx" ON "PlatformPost"("isNsfw", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PlatformPost_connectedAccountId_platformPostId_key" ON "PlatformPost"("connectedAccountId", "platformPostId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PlatformFeedItem_connectedAccountId_publishedAt_idx" ON "PlatformFeedItem"("connectedAccountId", "publishedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PlatformFeedItem_isNsfw_publishedAt_idx" ON "PlatformFeedItem"("isNsfw", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PlatformFeedItem_connectedAccountId_platformItemId_key" ON "PlatformFeedItem"("connectedAccountId", "platformItemId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PlatformComment_connectedAccountId_idx" ON "PlatformComment"("connectedAccountId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PlatformComment_postId_idx" ON "PlatformComment"("postId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PlatformComment_connectedAccountId_platformCommentId_key" ON "PlatformComment"("connectedAccountId", "platformCommentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PlatformMedia_connectedAccountId_idx" ON "PlatformMedia"("connectedAccountId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PlatformMedia_postId_idx" ON "PlatformMedia"("postId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PlatformFollower_connectedAccountId_idx" ON "PlatformFollower"("connectedAccountId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PlatformFollower_connectedAccountId_platformUserId_key" ON "PlatformFollower"("connectedAccountId", "platformUserId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PlatformAnalytics_connectedAccountId_idx" ON "PlatformAnalytics"("connectedAccountId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PlatformAnalytics_date_idx" ON "PlatformAnalytics"("date");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PlatformAnalytics_connectedAccountId_date_key" ON "PlatformAnalytics"("connectedAccountId", "date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SyncJob_connectedAccountId_idx" ON "SyncJob"("connectedAccountId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SyncJob_status_idx" ON "SyncJob"("status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FeedPreference_userId_key" ON "FeedPreference"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MeshNode_userId_nodeType_idx" ON "MeshNode"("userId", "nodeType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MeshNode_sourceType_sourceId_idx" ON "MeshNode"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MeshEdge_userId_edgeType_idx" ON "MeshEdge"("userId", "edgeType");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "MeshEdge_userId_fromNodeId_toNodeId_edgeType_key" ON "MeshEdge"("userId", "fromNodeId", "toNodeId", "edgeType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ContentSource_connectedAccountId_idx" ON "ContentSource"("connectedAccountId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ContentSource_userId_sourceType_sourceId_key" ON "ContentSource"("userId", "sourceType", "sourceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SyncedContent_userId_canonicalType_idx" ON "SyncedContent"("userId", "canonicalType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SyncedContent_syncStatus_syncedAt_idx" ON "SyncedContent"("syncStatus", "syncedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SyncedInteraction_userId_interactionType_idx" ON "SyncedInteraction"("userId", "interactionType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SyncedInteraction_syncedContentId_happenedAt_idx" ON "SyncedInteraction"("syncedContentId", "happenedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PlatformPermission_connectedAccountId_permissionState_idx" ON "PlatformPermission"("connectedAccountId", "permissionState");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PlatformPermission_userId_platform_permissionKey_connectedAccountId_key" ON "PlatformPermission"("userId", "platform", "permissionKey", "connectedAccountId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DataVisibilityPolicy_userId_entityType_idx" ON "DataVisibilityPolicy"("userId", "entityType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DataVisibilityPolicy_visibility_idx" ON "DataVisibilityPolicy"("visibility");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Achievement_slug_key" ON "Achievement"("slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UserAchievement_userId_idx" ON "UserAchievement"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "UserAchievement_userId_achievementId_key" ON "UserAchievement"("userId", "achievementId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "MeshiPreference_userId_key" ON "MeshiPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CharterSeat_stripeSessionId_key" ON "CharterSeat"("stripeSessionId");

CREATE UNIQUE INDEX IF NOT EXISTS "CharterSeat_paymentIntentId_key" ON "CharterSeat"("paymentIntentId");

CREATE INDEX IF NOT EXISTS "CharterSeat_status_idx" ON "CharterSeat"("status");

CREATE UNIQUE INDEX IF NOT EXISTS "User_charterNumber_key" ON "User"("charterNumber");

-- The 100 charter seats. INSERT OR IGNORE on the primary key: replaying is a
-- no-op, and no application code path creates a CharterSeat row — the cap is
-- this fixed universe, not a config value.
INSERT OR IGNORE INTO "CharterSeat" ("number", "updatedAt") VALUES
(1, '2026-08-13 00:00:00'),
(2, '2026-08-13 00:00:00'),
(3, '2026-08-13 00:00:00'),
(4, '2026-08-13 00:00:00'),
(5, '2026-08-13 00:00:00'),
(6, '2026-08-13 00:00:00'),
(7, '2026-08-13 00:00:00'),
(8, '2026-08-13 00:00:00'),
(9, '2026-08-13 00:00:00'),
(10, '2026-08-13 00:00:00'),
(11, '2026-08-13 00:00:00'),
(12, '2026-08-13 00:00:00'),
(13, '2026-08-13 00:00:00'),
(14, '2026-08-13 00:00:00'),
(15, '2026-08-13 00:00:00'),
(16, '2026-08-13 00:00:00'),
(17, '2026-08-13 00:00:00'),
(18, '2026-08-13 00:00:00'),
(19, '2026-08-13 00:00:00'),
(20, '2026-08-13 00:00:00'),
(21, '2026-08-13 00:00:00'),
(22, '2026-08-13 00:00:00'),
(23, '2026-08-13 00:00:00'),
(24, '2026-08-13 00:00:00'),
(25, '2026-08-13 00:00:00'),
(26, '2026-08-13 00:00:00'),
(27, '2026-08-13 00:00:00'),
(28, '2026-08-13 00:00:00'),
(29, '2026-08-13 00:00:00'),
(30, '2026-08-13 00:00:00'),
(31, '2026-08-13 00:00:00'),
(32, '2026-08-13 00:00:00'),
(33, '2026-08-13 00:00:00'),
(34, '2026-08-13 00:00:00'),
(35, '2026-08-13 00:00:00'),
(36, '2026-08-13 00:00:00'),
(37, '2026-08-13 00:00:00'),
(38, '2026-08-13 00:00:00'),
(39, '2026-08-13 00:00:00'),
(40, '2026-08-13 00:00:00'),
(41, '2026-08-13 00:00:00'),
(42, '2026-08-13 00:00:00'),
(43, '2026-08-13 00:00:00'),
(44, '2026-08-13 00:00:00'),
(45, '2026-08-13 00:00:00'),
(46, '2026-08-13 00:00:00'),
(47, '2026-08-13 00:00:00'),
(48, '2026-08-13 00:00:00'),
(49, '2026-08-13 00:00:00'),
(50, '2026-08-13 00:00:00'),
(51, '2026-08-13 00:00:00'),
(52, '2026-08-13 00:00:00'),
(53, '2026-08-13 00:00:00'),
(54, '2026-08-13 00:00:00'),
(55, '2026-08-13 00:00:00'),
(56, '2026-08-13 00:00:00'),
(57, '2026-08-13 00:00:00'),
(58, '2026-08-13 00:00:00'),
(59, '2026-08-13 00:00:00'),
(60, '2026-08-13 00:00:00'),
(61, '2026-08-13 00:00:00'),
(62, '2026-08-13 00:00:00'),
(63, '2026-08-13 00:00:00'),
(64, '2026-08-13 00:00:00'),
(65, '2026-08-13 00:00:00'),
(66, '2026-08-13 00:00:00'),
(67, '2026-08-13 00:00:00'),
(68, '2026-08-13 00:00:00'),
(69, '2026-08-13 00:00:00'),
(70, '2026-08-13 00:00:00'),
(71, '2026-08-13 00:00:00'),
(72, '2026-08-13 00:00:00'),
(73, '2026-08-13 00:00:00'),
(74, '2026-08-13 00:00:00'),
(75, '2026-08-13 00:00:00'),
(76, '2026-08-13 00:00:00'),
(77, '2026-08-13 00:00:00'),
(78, '2026-08-13 00:00:00'),
(79, '2026-08-13 00:00:00'),
(80, '2026-08-13 00:00:00'),
(81, '2026-08-13 00:00:00'),
(82, '2026-08-13 00:00:00'),
(83, '2026-08-13 00:00:00'),
(84, '2026-08-13 00:00:00'),
(85, '2026-08-13 00:00:00'),
(86, '2026-08-13 00:00:00'),
(87, '2026-08-13 00:00:00'),
(88, '2026-08-13 00:00:00'),
(89, '2026-08-13 00:00:00'),
(90, '2026-08-13 00:00:00'),
(91, '2026-08-13 00:00:00'),
(92, '2026-08-13 00:00:00'),
(93, '2026-08-13 00:00:00'),
(94, '2026-08-13 00:00:00'),
(95, '2026-08-13 00:00:00'),
(96, '2026-08-13 00:00:00'),
(97, '2026-08-13 00:00:00'),
(98, '2026-08-13 00:00:00'),
(99, '2026-08-13 00:00:00'),
(100, '2026-08-13 00:00:00');

CREATE UNIQUE INDEX IF NOT EXISTS "MeshiJournalGrant_userId_key" ON "MeshiJournalGrant"("userId");

CREATE INDEX IF NOT EXISTS "MeshiJournalEntry_grantId_kind_idx" ON "MeshiJournalEntry"("grantId", "kind");

CREATE UNIQUE INDEX IF NOT EXISTS "PatronStint_stripeSubscriptionId_key" ON "PatronStint"("stripeSubscriptionId");

CREATE INDEX IF NOT EXISTS "PatronStint_userId_idx" ON "PatronStint"("userId");

CREATE UNIQUE INDEX IF NOT EXISTS "OwnedMeshiItem_stripeSessionId_key" ON "OwnedMeshiItem"("stripeSessionId");

CREATE UNIQUE INDEX IF NOT EXISTS "OwnedMeshiItem_paymentIntentId_key" ON "OwnedMeshiItem"("paymentIntentId");

CREATE INDEX IF NOT EXISTS "OwnedMeshiItem_ownerId_idx" ON "OwnedMeshiItem"("ownerId");

CREATE INDEX IF NOT EXISTS "OwnedMeshiItem_purchaserId_idx" ON "OwnedMeshiItem"("purchaserId");

CREATE INDEX IF NOT EXISTS "MeshiRecipe_userId_idx" ON "MeshiRecipe"("userId");

CREATE UNIQUE INDEX IF NOT EXISTS "MeshiRecipe_userId_name_key" ON "MeshiRecipe"("userId", "name");

CREATE INDEX IF NOT EXISTS "ScheduledPost_status_scheduledFor_idx" ON "ScheduledPost"("status", "scheduledFor");

CREATE INDEX IF NOT EXISTS "ScheduledPost_status_nextAttemptAt_idx" ON "ScheduledPost"("status", "nextAttemptAt");

CREATE INDEX IF NOT EXISTS "ScheduledPost_userId_scheduledFor_idx" ON "ScheduledPost"("userId", "scheduledFor");

CREATE INDEX IF NOT EXISTS "SchedulerRun_startedAt_idx" ON "SchedulerRun"("startedAt");

CREATE UNIQUE INDEX IF NOT EXISTS "PersonalAccessToken_selector_key" ON "PersonalAccessToken"("selector");

CREATE INDEX IF NOT EXISTS "PersonalAccessToken_userId_idx" ON "PersonalAccessToken"("userId");

CREATE INDEX IF NOT EXISTS "PersonalAccessToken_expiresAt_idx" ON "PersonalAccessToken"("expiresAt");

CREATE UNIQUE INDEX IF NOT EXISTS "MeshProGift_stripeSessionId_key" ON "MeshProGift"("stripeSessionId");

CREATE INDEX IF NOT EXISTS "MeshProGift_recipientId_idx" ON "MeshProGift"("recipientId");

CREATE INDEX IF NOT EXISTS "MeshProGift_purchaserId_idx" ON "MeshProGift"("purchaserId");

CREATE INDEX IF NOT EXISTS "MeshCosmetic_userId_idx" ON "MeshCosmetic"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "MeshPrivacy_userId_key" ON "MeshPrivacy"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "GlobalMeshMember_userId_key" ON "GlobalMeshMember"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuthIdentity_userId_idx" ON "AuthIdentity"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AuthIdentity_provider_providerAccountId_key" ON "AuthIdentity"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AlterEgo_username_key" ON "AlterEgo"("username");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AlterEgo_userId_idx" ON "AlterEgo"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "UserEmail_email_key" ON "UserEmail"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UserEmail_userId_idx" ON "UserEmail"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "EmailVerificationToken_tokenHash_key" ON "EmailVerificationToken"("tokenHash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EmailVerificationToken_userId_idx" ON "EmailVerificationToken"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EmailVerificationToken_email_idx" ON "EmailVerificationToken"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EmailVerificationToken_expiresAt_idx" ON "EmailVerificationToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "UserPhone_phone_key" ON "UserPhone"("phone");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UserPhone_userId_idx" ON "UserPhone"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TwoFactorMethod_userId_idx" ON "TwoFactorMethod"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AccountMergeRequest_primaryUserId_idx" ON "AccountMergeRequest"("primaryUserId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AccountMergeRequest_secondaryEmail_idx" ON "AccountMergeRequest"("secondaryEmail");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AccountMergeRequest_secondaryUserId_idx" ON "AccountMergeRequest"("secondaryUserId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ProfileInfo_userId_key" ON "ProfileInfo"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MeChatSession_hostId_idx" ON "MeChatSession"("hostId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MeChatSession_status_idx" ON "MeChatSession"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MeChatSessionParticipant_userId_idx" ON "MeChatSessionParticipant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "MeChatSessionParticipant_sessionId_userId_key" ON "MeChatSessionParticipant"("sessionId", "userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MeChatSessionItem_sessionId_idx" ON "MeChatSessionItem"("sessionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MeChatSessionItem_addedById_idx" ON "MeChatSessionItem"("addedById");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MeChatSessionVote_userId_idx" ON "MeChatSessionVote"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "MeChatSessionVote_itemId_userId_key" ON "MeChatSessionVote"("itemId", "userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MeChatNote_userId_idx" ON "MeChatNote"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MeChatNote_expiresAt_idx" ON "MeChatNote"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "RedeemCode_code_key" ON "RedeemCode"("code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MeshPresence_lastSeen_idx" ON "MeshPresence"("lastSeen");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MeshPresence_viewingMesh_idx" ON "MeshPresence"("viewingMesh");

-- CreateTable
CREATE TABLE IF NOT EXISTS "RateLimitHit" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "count" INTEGER NOT NULL DEFAULT 0,
    "resetAt" DATETIME NOT NULL,
    "lockedUntil" DATETIME,
    "lockCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RateLimitHit_resetAt_idx" ON "RateLimitHit"("resetAt");

-- CreateTable
CREATE TABLE IF NOT EXISTS "FlowImpression" (
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "seenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "liked" BOOLEAN NOT NULL DEFAULT false,
    "authorKey" TEXT,
    "format" TEXT,
    "tags" TEXT,
    "watchMs" INTEGER NOT NULL DEFAULT 0,
    "completion" REAL NOT NULL DEFAULT 0,
    PRIMARY KEY ("userId", "postId"),
    CONSTRAINT "FlowImpression_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FlowImpression_userId_seenAt_idx" ON "FlowImpression"("userId", "seenAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FlowImpression_userId_liked_idx" ON "FlowImpression"("userId", "liked");

-- CreateTable
-- Public content owned by no mesh.me account: fetched from a platform's
-- official API with mesh.me's own app credentials. "expiresAt" is a retention
-- limit from the source platform's terms, not a cache hint — reads filter on
-- it and a sweep deletes past it.
CREATE TABLE IF NOT EXISTS "PublicPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "platform" TEXT NOT NULL,
    "platformPostId" TEXT NOT NULL,
    "lane" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT,
    "url" TEXT,
    "postType" TEXT NOT NULL DEFAULT 'video',
    "thumbnailUrl" TEXT,
    "mediaUrl" TEXT,
    "durationSeconds" INTEGER,
    "lang" TEXT,
    "authorName" TEXT,
    "authorUsername" TEXT,
    "authorAvatarUrl" TEXT,
    "authorUrl" TEXT,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "isNsfw" BOOLEAN NOT NULL DEFAULT false,
    "contentRating" TEXT NOT NULL DEFAULT 'general',
    "publishedAt" DATETIME,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PublicPost_platform_platformPostId_key" ON "PublicPost"("platform", "platformPostId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PublicPost_platform_publishedAt_idx" ON "PublicPost"("platform", "publishedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PublicPost_expiresAt_idx" ON "PublicPost"("expiresAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PublicPost_lane_fetchedAt_idx" ON "PublicPost"("lane", "fetchedAt");

-- CreateTable
-- One fetch of one lane, so "the Flow is empty" can distinguish "no key
-- configured" from "the fetch is failing".
CREATE TABLE IF NOT EXISTS "PublicSupplyRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "platform" TEXT NOT NULL,
    "lane" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "itemsFetched" INTEGER NOT NULL DEFAULT 0,
    "itemsStored" INTEGER NOT NULL DEFAULT 0,
    "detail" TEXT,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PublicSupplyRun_platform_startedAt_idx" ON "PublicSupplyRun"("platform", "startedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PublicSupplyRun_startedAt_idx" ON "PublicSupplyRun"("startedAt");

-- CreateTable
-- One browser's Web Push subscription (see PushSubscription in schema.prisma —
-- endpoint is the push service's unique URL for that browser, hence UNIQUE).
CREATE TABLE IF NOT EXISTS "PushSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- CreateTable
-- Snapshot bookmarks of Flow content (see SavedFlowItem in schema.prisma —
-- snapshot, not FK, because supply rows are pruned on retention schedules).
CREATE TABLE IF NOT EXISTS "SavedFlowItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "platform" TEXT,
    "title" TEXT,
    "url" TEXT,
    "thumbnailUrl" TEXT,
    "authorName" TEXT,
    "postType" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SavedFlowItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SavedFlowItem_userId_refId_key" ON "SavedFlowItem"("userId", "refId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SavedFlowItem_userId_idx" ON "SavedFlowItem"("userId");

-- CreateTable
CREATE TABLE IF NOT EXISTS "UserLocation" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL,
    "precision" TEXT NOT NULL DEFAULT 'town',
    "audience" TEXT NOT NULL DEFAULT 'nobody',
    "reportedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserLocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UserLocation_reportedAt_idx" ON "UserLocation"("reportedAt");

-- CreateTable
CREATE TABLE IF NOT EXISTS "MapDoodle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "ink" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MapDoodle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MapDoodle_createdAt_idx" ON "MapDoodle"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MapDoodle_userId_createdAt_idx" ON "MapDoodle"("userId", "createdAt");
