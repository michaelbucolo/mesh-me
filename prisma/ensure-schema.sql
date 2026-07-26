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
    "accessoryStyle" TEXT NOT NULL DEFAULT 'none',
    "eyeStyle" TEXT NOT NULL DEFAULT 'regular',
    "badgeStyle" TEXT NOT NULL DEFAULT 'none',
    "outfitStyle" TEXT NOT NULL DEFAULT 'none',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MeshiPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
