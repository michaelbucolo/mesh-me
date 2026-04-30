import { getAdvancedSocialDashboard } from "@/lib/queries";
import type { AdvancedSocialData } from "@/components/social/advanced-social-workspace";

type RawPerson = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isVerified?: boolean;
};

type RawPost = {
  id: string;
  content: string;
  createdAt: Date;
  visibility: string;
  author: RawPerson;
  community: { id: string; name: string; slug: string } | null;
  media: Array<{ id: string; url: string; type: string }>;
  tags: Array<{ id: string; tag: string }>;
  _count?: { comments?: number; reactions?: number; reposts?: number };
};

type RawSession = {
  id: string;
  hostId: string;
  title: string;
  status: string;
  sessionType: string;
  callMode: string;
  callStatus: string;
  currentItemId: string | null;
  callStartedAt: Date | null;
  callEndedAt: Date | null;
  updatedAt: Date;
  participants: Array<{
    id: string;
    userId: string;
    role: string;
    user: RawPerson;
  }>;
  items: Array<{
    id: string;
    sourcePlatform: string;
    sourceUrl: string | null;
    title: string | null;
    content: string | null;
    postId: string | null;
    platformPostId: string | null;
    status: string;
    votes: Array<{
      id: string;
      userId: string;
      vote: string;
    }>;
  }>;
};

type RawPlatformPost = {
  id: string;
  platformPostId: string;
  title: string | null;
  content: string | null;
  url: string | null;
  postType: string;
  thumbnailUrl: string | null;
  publishedAt: Date | null;
  likeCount: number;
  commentCount: number;
  viewCount: number;
  connectedAccount: {
    id: string;
    platform: string;
    platformUsername: string | null;
  };
  media: Array<{
    id: string;
    url: string | null;
    thumbnailUrl: string | null;
    mediaType: string;
  }>;
};

function serializePost(post: RawPost, extras: Partial<AdvancedSocialData["savedPosts"][number]> = {}) {
  return {
    id: post.id,
    content: post.content,
    createdAt: post.createdAt.toISOString(),
    visibility: post.visibility,
    author: {
      id: post.author.id,
      username: post.author.username,
      displayName: post.author.displayName,
      avatarUrl: post.author.avatarUrl,
      isVerified: post.author.isVerified,
    },
    community: post.community
      ? {
          id: post.community.id,
          name: post.community.name,
          slug: post.community.slug,
        }
      : null,
    media: (post.media || []).map((media) => ({
      id: media.id,
      url: media.url,
      type: media.type,
    })),
    tags: (post.tags || []).map((tag) => ({
      id: tag.id,
      tag: tag.tag,
    })),
    counts: {
      comments: post._count?.comments ?? 0,
      reactions: post._count?.reactions ?? 0,
      reposts: post._count?.reposts ?? 0,
    },
    ...extras,
  };
}

function serializeSession(session: RawSession) {
  return {
    id: session.id,
    hostId: session.hostId,
    title: session.title,
    status: session.status,
    sessionType: session.sessionType,
    callMode: session.callMode,
    callStatus: session.callStatus,
    currentItemId: session.currentItemId,
    callStartedAt: session.callStartedAt?.toISOString() ?? null,
    callEndedAt: session.callEndedAt?.toISOString() ?? null,
    updatedAt: session.updatedAt.toISOString(),
    participants: (session.participants || []).map((participant) => ({
      id: participant.id,
      userId: participant.userId,
      role: participant.role,
      user: participant.user,
    })),
    items: (session.items || []).map((item) => ({
      id: item.id,
      sourcePlatform: item.sourcePlatform,
      sourceUrl: item.sourceUrl,
      title: item.title,
      content: item.content,
      postId: item.postId,
      platformPostId: item.platformPostId,
      status: item.status,
      votes: (item.votes || []).map((vote) => ({
        id: vote.id,
        userId: vote.userId,
        vote: vote.vote,
      })),
    })),
  };
}

function serializePlatformPost(post: RawPlatformPost) {
  return {
    id: post.id,
    platformPostId: post.platformPostId,
    title: post.title,
    content: post.content,
    url: post.url,
    postType: post.postType,
    thumbnailUrl: post.thumbnailUrl,
    publishedAt: post.publishedAt?.toISOString() ?? null,
    likeCount: post.likeCount,
    commentCount: post.commentCount,
    viewCount: post.viewCount,
    connectedAccount: {
      id: post.connectedAccount.id,
      platform: post.connectedAccount.platform,
      platformUsername: post.connectedAccount.platformUsername,
    },
    media: (post.media || []).map((media) => ({
      id: media.id,
      url: media.url,
      thumbnailUrl: media.thumbnailUrl,
      mediaType: media.mediaType,
    })),
  };
}

export async function getSerializedAdvancedSocialData(): Promise<AdvancedSocialData | null> {
  const dashboard = await getAdvancedSocialDashboard();
  if (!dashboard) return null;

  return {
    currentUser: dashboard.currentUser,
    spaces: dashboard.spaces.map((space) => ({
      ...space,
      joinedAt: space.joinedAt.toISOString(),
    })),
    sessions: dashboard.sessions.map((session) => serializeSession(session)),
    savedPosts: dashboard.savedPosts.map((saved) => serializePost(saved.post, {
      savedPostId: saved.id,
      savedAt: saved.createdAt.toISOString(),
    })),
    recentPosts: dashboard.recentPosts.map((post) => serializePost(post)),
    platformPosts: dashboard.platformPosts.map((post) => serializePlatformPost(post)),
    connectedAccounts: dashboard.connectedAccounts.map((account) => ({
      id: account.id,
      platform: account.platform,
      platformUsername: account.platformUsername,
      syncStatus: account.syncStatus,
      lastSyncAt: account.lastSyncAt?.toISOString() ?? null,
      counts: {
        posts: account._count.platformPosts,
        comments: account._count.platformComments,
        followers: account._count.platformFollowers,
      },
    })),
    friends: dashboard.friends.map((friend) => ({
      id: friend.id,
      username: friend.username,
      displayName: friend.displayName,
      avatarUrl: friend.avatarUrl,
    })),
    communityThreads: dashboard.communityThreads.map((thread) => ({
      id: thread.id,
      title: thread.title,
      memberCount: thread.memberCount,
      lastMessage: thread.lastMessage
        ? {
            content: thread.lastMessage.content,
            createdAt: thread.lastMessage.createdAt.toISOString(),
          }
        : null,
      updatedAt: thread.updatedAt.toISOString(),
    })),
  };
}
