"use server";

import { prisma } from "./prisma";
import { getCurrentUser } from "./auth";
import { decryptSecret } from "./secret-store";
import { resolveEnvValue, usesLongLivedTokenExchange, MESH_API_USER_AGENT } from "./oauth";
import { refreshConnectedAccountToken } from "./oauth-token-refresh";
import { getPlatformActionCapability, getPlatformImportCapability, getPlatformMessagingCapability } from "./platform-capabilities";
import { serializeMeChatMetadata } from "./mechat-metadata";
import { classifyContentSafety, nsfwHiddenWhere } from "./content-safety";

// ─── Platform Adapter Interface ─────────────────────────────

interface PlatformPostData {
  platformPostId: string;
  content?: string;
  title?: string;
  url?: string;
  postType: string;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  viewCount: number;
  watchTimeSeconds?: number;
  visibility: string;
  publishedAt?: Date;
  thumbnailUrl?: string;
  isPinned?: boolean;
  rawMetadata?: string;
}

interface PlatformCommentData {
  platformCommentId: string;
  platformPostId?: string;
  content: string;
  authorName?: string;
  authorUsername?: string;
  authorAvatarUrl?: string;
  isOwnComment: boolean;
  likeCount: number;
  replyCount: number;
  parentCommentId?: string;
  url?: string;
  sentiment?: string;
  publishedAt?: Date;
}

interface PlatformFeedItemData {
  platformItemId: string;
  authorName?: string;
  authorUsername?: string;
  authorAvatarUrl?: string;
  authorUrl?: string;
  title?: string;
  content?: string;
  url?: string;
  thumbnailUrl?: string;
  mediaUrl?: string;
  postType: string;
  likeCount: number;
  commentCount: number;
  publishedAt?: Date;
  rawMetadata?: string;
  // Platform-reported adult flag (e.g. Reddit over_18); takes precedence
  // over keyword-based classification.
  isNsfw?: boolean;
}

interface PlatformFollowerData {
  platformUserId: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  followerCount?: number;
  isMutual: boolean;
  relationshipType: string;
  profileUrl?: string;
}

interface PlatformMediaData {
  platformMediaId?: string;
  platformPostId?: string;
  mediaType: string;
  url: string;
  thumbnailUrl?: string;
  altText?: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  fileSizeBytes?: number;
  mimeType?: string;
}

interface PlatformDirectMessageData {
  externalMessageId: string;
  content: string;
  isOwnMessage: boolean;
  senderName?: string;
  senderUsername?: string;
  senderAvatarUrl?: string;
  sentAt?: Date;
}

interface PlatformConversationData {
  externalConversationId: string;
  participantName?: string;
  participantUsername?: string;
  participantAvatarUrl?: string;
  url?: string;
  messages: PlatformDirectMessageData[];
}

interface PlatformAnalyticsData {
  date: Date;
  followerCount: number;
  followingCount: number;
  postCount: number;
  totalLikes: number;
  totalComments: number;
  totalViews: number;
  totalShares: number;
  newFollowers: number;
  lostFollowers: number;
  engagementRate?: number;
  topPostId?: string;
  rawData?: string;
}

// ─── Platform API Adapters ──────────────────────────────────
// Each adapter knows how to talk to a specific platform's API

interface PlatformAdapter {
  fetchPosts(accessToken: string, cursor?: string): Promise<{ posts: PlatformPostData[]; nextCursor?: string }>;
  fetchComments(accessToken: string, postId: string, cursor?: string): Promise<{ comments: PlatformCommentData[]; nextCursor?: string }>;
  fetchFollowers(accessToken: string, cursor?: string): Promise<{ followers: PlatformFollowerData[]; nextCursor?: string }>;
  fetchMedia(accessToken: string, cursor?: string): Promise<{ media: PlatformMediaData[]; nextCursor?: string }>;
  fetchAnalytics(accessToken: string): Promise<PlatformAnalyticsData>;
  // Personalized home / for-you feed (content authored by others).
  // Optional: only platforms whose official API exposes a personalized
  // or trending listing implement this.
  fetchForYouFeed?(accessToken: string): Promise<{ items: PlatformFeedItemData[] }>;
  // Direct-message sync. Optional: only platforms whose official API
  // exposes DM read/write endpoints implement these.
  fetchConversations?(accessToken: string): Promise<{ conversations: PlatformConversationData[] }>;
  sendConversationMessage?(accessToken: string, conversationId: string, content: string): Promise<{ externalMessageId?: string } | null>;
  createPost(accessToken: string, content: string, media?: string[]): Promise<PlatformPostData | null>;
  deletePost(accessToken: string, postId: string): Promise<boolean>;
  createComment(accessToken: string, postId: string, content: string): Promise<PlatformCommentData | null>;
  deleteComment(accessToken: string, commentId: string): Promise<boolean>;
  // Full control methods
  editPost(accessToken: string, postId: string, content: string): Promise<boolean>;
  likePost(accessToken: string, postId: string): Promise<boolean>;
  unlikePost(accessToken: string, postId: string): Promise<boolean>;
  followUser(accessToken: string, userId: string): Promise<boolean>;
  unfollowUser(accessToken: string, userId: string): Promise<boolean>;
  sharePost(accessToken: string, postId: string, comment?: string): Promise<boolean>;
  pinPost(accessToken: string, postId: string): Promise<boolean>;
  unpinPost(accessToken: string, postId: string): Promise<boolean>;
  updateVisibility(accessToken: string, postId: string, visibility: string): Promise<boolean>;
}

// ─── GitHub Adapter ─────────────────────────────────────────

const COMMENT_SYNC_POST_LIMIT = 25;
const GITHUB_API_VERSION = "2026-03-10";
const MESH_USER_AGENT = MESH_API_USER_AGENT;

function toInt(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function dateFromString(value: unknown): Date | undefined {
  if (typeof value !== "string" || !value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function dateFromUnixSeconds(value: unknown): Date | undefined {
  const seconds = toInt(value);
  if (!seconds) return undefined;
  const date = new Date(seconds * 1000);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

async function githubRepoFullName(accessToken: string, repoId: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.github.com/repositories/${encodeURIComponent(repoId)}`, {
      headers: githubHeaders(accessToken),
    });
    if (!res.ok) return null;
    const repo = await res.json().catch(() => null) as { full_name?: string } | null;
    return typeof repo?.full_name === "string" ? repo.full_name : null;
  } catch {
    return null;
  }
}

function githubHeaders(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/vnd.github+json",
    "User-Agent": MESH_USER_AGENT,
    "X-GitHub-Api-Version": GITHUB_API_VERSION,
  };
}

function redditHeaders(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
    "User-Agent": MESH_USER_AGENT,
  };
}

async function fetchRedditJson<T>(accessToken: string, path: string): Promise<T | null> {
  const res = await fetch(`https://oauth.reddit.com${path}`, {
    headers: redditHeaders(accessToken),
  });
  if (!res.ok) return null;
  return (await res.json().catch(() => null)) as T | null;
}

type RedditIdentity = {
  id?: string;
  name?: string;
  icon_img?: string;
  link_karma?: number;
  comment_karma?: number;
  total_karma?: number;
  created_utc?: number;
  subreddit?: { subscribers?: number };
};

type RedditListing = {
  data?: {
    after?: string | null;
    children?: Array<{ kind?: string; data?: Record<string, unknown> }>;
  };
};

async function fetchRedditCurrentUser(accessToken: string): Promise<RedditIdentity | null> {
  const user = await fetchRedditJson<RedditIdentity>(accessToken, "/api/v1/me");
  return user?.name ? user : null;
}

async function postRedditForm(accessToken: string, path: string, form: Record<string, string>): Promise<Response | null> {
  try {
    return await fetch(`https://oauth.reddit.com${path}`, {
      method: "POST",
      headers: {
        ...redditHeaders(accessToken),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(form).toString(),
    });
  } catch {
    return null;
  }
}

async function redditVote(accessToken: string, fullname: string, dir: 1 | 0 | -1): Promise<boolean> {
  const res = await postRedditForm(accessToken, "/api/vote", { id: fullname, dir: String(dir) });
  return Boolean(res?.ok);
}

function redditPermalink(value: unknown): string | undefined {
  if (typeof value !== "string" || !value) return undefined;
  return value.startsWith("http") ? value : `https://www.reddit.com${value}`;
}

function redditThumbnail(post: Record<string, unknown>): string | undefined {
  if (typeof post.thumbnail === "string" && post.thumbnail.startsWith("http")) return post.thumbnail;
  const images = (((post.preview as Record<string, unknown> | undefined)?.images as Record<string, unknown>[] | undefined) || []);
  const source = images[0]?.source as Record<string, unknown> | undefined;
  return typeof source?.url === "string" ? source.url.replaceAll("&amp;", "&") : undefined;
}

function redditPostType(post: Record<string, unknown>): string {
  if (post.is_video) return "video";
  if (post.is_self) return "text";
  if (post.post_hint === "image") return "image";
  if (post.post_hint === "rich:video") return "video";
  return "article";
}

function redditArticleId(platformPostId: string): string {
  return platformPostId.startsWith("t3_") ? platformPostId.slice(3) : platformPostId;
}

const githubAdapter: PlatformAdapter = {
  async fetchPosts(accessToken, cursor) {
    try {
      const page = cursor ? parseInt(cursor) : 1;
      const res = await fetch(`https://api.github.com/user/repos?affiliation=owner,collaborator,organization_member&sort=updated&per_page=30&page=${page}`, {
        headers: githubHeaders(accessToken),
      });
      if (!res.ok) return { posts: [] };
      const repos = await res.json().catch(() => []);
      const posts: PlatformPostData[] = repos.map((repo: Record<string, unknown>) => ({
        platformPostId: String(repo.id),
        content: (repo.description as string) || "",
        title: repo.full_name as string,
        url: repo.html_url as string,
        postType: "article",
        likeCount: toInt(repo.stargazers_count),
        commentCount: toInt(repo.open_issues_count),
        shareCount: toInt(repo.forks_count),
        viewCount: toInt(repo.watchers_count),
        visibility: repo.private ? "private" : "public",
        publishedAt: dateFromString(repo.created_at),
        rawMetadata: JSON.stringify({ language: repo.language, topics: repo.topics, updatedAt: repo.updated_at }),
      }));
      return { posts, nextCursor: repos.length === 30 ? String(page + 1) : undefined };
    } catch { return { posts: [] }; }
  },
  async fetchComments(accessToken, postId) {
    try {
      const res = await fetch(`https://api.github.com/repositories/${encodeURIComponent(postId)}/issues?state=all&filter=all&per_page=20`, {
        headers: githubHeaders(accessToken),
      });
      if (!res.ok) return { comments: [] };
      const issues = await res.json().catch(() => []);
      const comments: PlatformCommentData[] = issues.map((issue: Record<string, unknown>) => ({
        platformCommentId: `issue-${issue.id}`,
        platformPostId: postId,
        content: (issue.title as string) || "",
        authorName: (issue.user as Record<string, unknown>)?.login as string,
        authorUsername: (issue.user as Record<string, unknown>)?.login as string,
        authorAvatarUrl: (issue.user as Record<string, unknown>)?.avatar_url as string,
        isOwnComment: false,
        likeCount: toInt((issue.reactions as Record<string, unknown>)?.total_count),
        replyCount: toInt(issue.comments),
        url: issue.html_url as string,
        publishedAt: dateFromString(issue.created_at),
      }));
      return { comments };
    } catch { return { comments: [] }; }
  },
  async fetchFollowers(accessToken) {
    try {
      const res = await fetch("https://api.github.com/user/followers?per_page=100", {
        headers: githubHeaders(accessToken),
      });
      if (!res.ok) return { followers: [] };
      const users = await res.json().catch(() => []);
      const followers: PlatformFollowerData[] = users.map((u: Record<string, unknown>) => ({
        platformUserId: String(u.id),
        username: u.login as string,
        displayName: (u.login as string) || "",
        avatarUrl: u.avatar_url as string,
        isMutual: false,
        relationshipType: "follower",
        profileUrl: u.html_url as string,
      }));
      return { followers };
    } catch { return { followers: [] }; }
  },
  async fetchMedia() { return { media: [] }; },
  async fetchForYouFeed(accessToken) {
    try {
      const userRes = await fetch("https://api.github.com/user", { headers: githubHeaders(accessToken) });
      if (!userRes.ok) return { items: [] };
      const login = (await userRes.json().catch(() => ({})))?.login;
      if (!login) return { items: [] };
      const res = await fetch(`https://api.github.com/users/${encodeURIComponent(login)}/received_events?per_page=60`, {
        headers: githubHeaders(accessToken),
      });
      if (!res.ok) return { items: [] };
      const events = await res.json().catch(() => []);
      if (!Array.isArray(events)) return { items: [] };
      const items: PlatformFeedItemData[] = events
        .filter((event: Record<string, unknown>) => Boolean(event?.id && event?.repo))
        .map((event: Record<string, unknown>) => {
          const actor = event.actor as Record<string, unknown> | undefined;
          const repo = event.repo as Record<string, unknown> | undefined;
          const payload = event.payload as Record<string, unknown> | undefined;
          const repoName = (repo?.name as string) || "";
          const type = (event.type as string) || "Event";
          const summaries: Record<string, string> = {
            WatchEvent: `starred ${repoName}`,
            ForkEvent: `forked ${repoName}`,
            CreateEvent: `created ${(payload?.ref_type as string) || "repository"} in ${repoName}`,
            PushEvent: `pushed to ${repoName}`,
            ReleaseEvent: `published a release in ${repoName}`,
            PublicEvent: `open sourced ${repoName}`,
            IssuesEvent: `${(payload?.action as string) || "updated"} an issue in ${repoName}`,
            PullRequestEvent: `${(payload?.action as string) || "updated"} a pull request in ${repoName}`,
          };
          return {
            platformItemId: String(event.id),
            authorName: (actor?.display_login as string) || (actor?.login as string),
            authorUsername: actor?.login as string,
            authorAvatarUrl: actor?.avatar_url as string,
            authorUrl: actor?.login ? `https://github.com/${actor.login}` : undefined,
            title: repoName,
            content: summaries[type] || `${type.replace(/Event$/, "")} in ${repoName}`,
            url: repoName ? `https://github.com/${repoName}` : undefined,
            postType: "activity",
            likeCount: 0,
            commentCount: 0,
            publishedAt: dateFromString(event.created_at),
            rawMetadata: JSON.stringify({ type, repo: repoName }),
          };
        });
      return { items };
    } catch { return { items: [] }; }
  },
  async fetchAnalytics(accessToken) {
    try {
      const res = await fetch("https://api.github.com/user", {
        headers: githubHeaders(accessToken),
      });
      if (!res.ok) return defaultAnalytics();
      const user = await res.json().catch(() => ({}));
      return {
        date: new Date(),
        followerCount: toInt(user.followers),
        followingCount: toInt(user.following),
        postCount: toInt(user.public_repos),
        totalLikes: 0, totalComments: 0, totalViews: 0, totalShares: 0,
        newFollowers: 0, lostFollowers: 0,
      };
    } catch { return defaultAnalytics(); }
  },
  async createPost() { return null; },
  async deletePost() { return false; },
  async createComment() { return null; },
  async deleteComment() { return false; },
  async editPost() { return false; },
  async likePost(accessToken, postId) {
    const fullName = await githubRepoFullName(accessToken, postId);
    if (!fullName) return false;
    try {
      const res = await fetch(`https://api.github.com/user/starred/${fullName}`, {
        method: "PUT",
        headers: githubHeaders(accessToken),
        body: "",
      });
      return res.status === 204;
    } catch { return false; }
  },
  async unlikePost(accessToken, postId) {
    const fullName = await githubRepoFullName(accessToken, postId);
    if (!fullName) return false;
    try {
      const res = await fetch(`https://api.github.com/user/starred/${fullName}`, {
        method: "DELETE",
        headers: githubHeaders(accessToken),
      });
      return res.status === 204;
    } catch { return false; }
  },
  async followUser(accessToken, userId) {
    try {
      const res = await fetch(`https://api.github.com/user/following/${userId}`, {
        method: "PUT",
        headers: githubHeaders(accessToken),
        body: "",
      });
      return res.status === 204;
    } catch { return false; }
  },
  async unfollowUser(accessToken, userId) {
    try {
      const res = await fetch(`https://api.github.com/user/following/${userId}`, {
        method: "DELETE",
        headers: githubHeaders(accessToken),
      });
      return res.status === 204;
    } catch { return false; }
  },
  async sharePost() { return false; },
  async pinPost() { return false; },
  async unpinPost() { return false; },
  async updateVisibility() { return false; },
};

// ─── YouTube Adapter ────────────────────────────────────────

const youtubeAdapter: PlatformAdapter = {
  async fetchPosts(accessToken) {
    try {
      const res = await fetch("https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return { posts: [] };
      const channelData = await res.json().catch(() => ({}));
      const uploadsId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
      if (!uploadsId) return { posts: [] };

      const videosRes = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsId}&maxResults=50`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!videosRes.ok) return { posts: [] };
      const videosData = await videosRes.json().catch(() => ({}));

      // Get video stats + the real privacy status, so public/unlisted/private
      // survive into mesh.me exactly as YouTube reports them.
      const videoIds = videosData.items?.map((v: Record<string, unknown>) => (v.contentDetails as Record<string, unknown>)?.videoId).filter(Boolean).join(",");
      const statsMap: Record<string, Record<string, unknown>> = {};
      const privacyMap: Record<string, string> = {};
      if (videoIds) {
        const statsRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics,status&id=${videoIds}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (statsRes.ok) {
          const statsData = await statsRes.json().catch(() => ({}));
          for (const item of statsData.items || []) {
            statsMap[item.id] = item.statistics || {};
            const privacy = (item.status as Record<string, unknown> | undefined)?.privacyStatus;
            if (privacy === "private" || privacy === "unlisted" || privacy === "public") {
              privacyMap[item.id] = privacy;
            }
          }
        }
      }

      const posts: PlatformPostData[] = (videosData.items || []).map((item: Record<string, unknown>) => {
        const snippet = item.snippet as Record<string, unknown>;
        const videoId = (item.contentDetails as Record<string, unknown>)?.videoId as string;
        const stats = statsMap[videoId] || {};
        return {
          platformPostId: videoId,
          content: (snippet?.description as string) || "",
          title: (snippet?.title as string) || "",
          url: `https://youtube.com/watch?v=${videoId}`,
          postType: "video",
          likeCount: parseInt(stats.likeCount as string || "0"),
          commentCount: parseInt(stats.commentCount as string || "0"),
          shareCount: 0,
          viewCount: parseInt(stats.viewCount as string || "0"),
          visibility: privacyMap[videoId] ?? "public",
          publishedAt: snippet?.publishedAt ? new Date(snippet.publishedAt as string) : undefined,
          thumbnailUrl: ((snippet?.thumbnails as Record<string, unknown>)?.high as Record<string, unknown>)?.url as string,
          rawMetadata: JSON.stringify({ channelTitle: snippet?.channelTitle }),
        };
      });
      return { posts };
    } catch { return { posts: [] }; }
  },
  async fetchComments(accessToken, postId) {
    try {
      const res = await fetch(`https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${postId}&maxResults=100`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return { comments: [] };
      const data = await res.json().catch(() => ({}));
      const comments: PlatformCommentData[] = (data.items || []).map((item: Record<string, unknown>) => {
        const snippet = ((item.snippet as Record<string, unknown>)?.topLevelComment as Record<string, unknown>)?.snippet as Record<string, unknown>;
        return {
          platformCommentId: item.id as string,
          platformPostId: postId,
          content: (snippet?.textDisplay as string) || "",
          authorName: snippet?.authorDisplayName as string,
          authorUsername: snippet?.authorDisplayName as string,
          authorAvatarUrl: snippet?.authorProfileImageUrl as string,
          isOwnComment: false,
          likeCount: (snippet?.likeCount as number) || 0,
          replyCount: ((item.snippet as Record<string, unknown>)?.totalReplyCount as number) || 0,
          publishedAt: snippet?.publishedAt ? new Date(snippet.publishedAt as string) : undefined,
        };
      });
      return { comments };
    } catch { return { comments: [] }; }
  },
  async fetchFollowers(accessToken) {
    try {
      const res = await fetch("https://www.googleapis.com/youtube/v3/subscriptions?part=snippet&mine=true&maxResults=50", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return { followers: [] };
      const data = await res.json().catch(() => ({}));
      const followers: PlatformFollowerData[] = (data.items || []).map((item: Record<string, unknown>) => {
        const snippet = item.snippet as Record<string, unknown>;
        const resource = snippet?.resourceId as Record<string, unknown>;
        return {
          platformUserId: resource?.channelId as string || item.id as string,
          displayName: snippet?.title as string,
          avatarUrl: ((snippet?.thumbnails as Record<string, unknown>)?.default as Record<string, unknown>)?.url as string,
          isMutual: false,
          relationshipType: "following",
          profileUrl: `https://youtube.com/channel/${resource?.channelId}`,
        };
      });
      return { followers };
    } catch { return { followers: [] }; }
  },
  async fetchMedia() { return { media: [] }; },
  async fetchForYouFeed(accessToken) {
    try {
      const res = await fetch("https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&maxResults=30", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return { items: [] };
      const data = await res.json().catch(() => ({}));
      const items: PlatformFeedItemData[] = (data.items || [])
        .filter((item: Record<string, unknown>) => Boolean(item?.id))
        .map((item: Record<string, unknown>) => {
          const snippet = item.snippet as Record<string, unknown> | undefined;
          const stats = (item.statistics as Record<string, unknown>) || {};
          const channelId = snippet?.channelId as string | undefined;
          return {
            platformItemId: item.id as string,
            authorName: snippet?.channelTitle as string,
            authorUsername: snippet?.channelTitle as string,
            authorUrl: channelId ? `https://youtube.com/channel/${channelId}` : undefined,
            title: (snippet?.title as string) || "",
            content: (snippet?.description as string) || "",
            url: `https://youtube.com/watch?v=${item.id}`,
            thumbnailUrl: ((snippet?.thumbnails as Record<string, unknown>)?.high as Record<string, unknown>)?.url as string,
            postType: "video",
            likeCount: toInt(stats.likeCount),
            commentCount: toInt(stats.commentCount),
            publishedAt: dateFromString(snippet?.publishedAt),
            rawMetadata: JSON.stringify({ channelTitle: snippet?.channelTitle, viewCount: stats.viewCount }),
          };
        });
      return { items };
    } catch { return { items: [] }; }
  },
  async fetchAnalytics(accessToken) {
    try {
      const res = await fetch("https://www.googleapis.com/youtube/v3/channels?part=statistics&mine=true", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return defaultAnalytics();
      const data = await res.json().catch(() => ({}));
      const stats = data.items?.[0]?.statistics || {};
      return {
        date: new Date(),
        followerCount: parseInt(stats.subscriberCount || "0"),
        followingCount: 0,
        postCount: parseInt(stats.videoCount || "0"),
        totalLikes: 0, totalComments: parseInt(stats.commentCount || "0"),
        totalViews: parseInt(stats.viewCount || "0"), totalShares: 0,
        newFollowers: 0, lostFollowers: 0,
      };
    } catch { return defaultAnalytics(); }
  },
  async createPost() { return null; },
  async deletePost(accessToken, postId) {
    try {
      const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?id=${encodeURIComponent(postId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return res.status === 204;
    } catch { return false; }
  },
  async createComment(accessToken, postId, content) {
    try {
      const res = await fetch("https://www.googleapis.com/youtube/v3/commentThreads?part=snippet", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          snippet: {
            videoId: postId,
            topLevelComment: { snippet: { textOriginal: content } },
          },
        }),
      });
      if (!res.ok) return null;
      const data = await res.json().catch(() => null) as { id?: string } | null;
      if (!data?.id) return null;
      return {
        platformCommentId: data.id,
        platformPostId: postId,
        content,
        isOwnComment: true,
        likeCount: 0,
        replyCount: 0,
        publishedAt: new Date(),
      };
    } catch { return null; }
  },
  async deleteComment(accessToken, commentId) {
    try {
      const res = await fetch(`https://www.googleapis.com/youtube/v3/comments?id=${encodeURIComponent(commentId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return res.status === 204;
    } catch { return false; }
  },
  async editPost() { return false; },
  async likePost(accessToken, postId) {
    try {
      const res = await fetch(`https://www.googleapis.com/youtube/v3/videos/rate?id=${encodeURIComponent(postId)}&rating=like`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return res.status === 204;
    } catch { return false; }
  },
  async unlikePost(accessToken, postId) {
    try {
      const res = await fetch(`https://www.googleapis.com/youtube/v3/videos/rate?id=${encodeURIComponent(postId)}&rating=none`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return res.status === 204;
    } catch { return false; }
  },
  async followUser(accessToken, userId) {
    try {
      const res = await fetch("https://www.googleapis.com/youtube/v3/subscriptions?part=snippet", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          snippet: { resourceId: { kind: "youtube#channel", channelId: userId } },
        }),
      });
      return res.ok;
    } catch { return false; }
  },
  async unfollowUser(accessToken, userId) {
    try {
      const lookup = await fetch(`https://www.googleapis.com/youtube/v3/subscriptions?part=id&mine=true&forChannelId=${encodeURIComponent(userId)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!lookup.ok) return false;
      const data = await lookup.json().catch(() => null) as { items?: Array<{ id?: string }> } | null;
      const subscriptionId = data?.items?.[0]?.id;
      if (!subscriptionId) return false;
      const res = await fetch(`https://www.googleapis.com/youtube/v3/subscriptions?id=${encodeURIComponent(subscriptionId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return res.status === 204;
    } catch { return false; }
  },
  async sharePost() { return false; },
  async pinPost() { return false; },
  async unpinPost() { return false; },
  async updateVisibility() { return false; },
};

// ─── Twitter/X Adapter ──────────────────────────────────────

async function fetchTwitterCurrentUserId(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch("https://api.twitter.com/2/users/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null) as { data?: { id?: string } } | null;
    return data?.data?.id || null;
  } catch {
    return null;
  }
}

const twitterAdapter: PlatformAdapter = {
  async fetchPosts(accessToken) {
    try {
      const meRes = await fetch("https://api.twitter.com/2/users/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!meRes.ok) return { posts: [] };
      const meData = await meRes.json().catch(() => ({}));
      const userId = meData.data?.id;
      if (!userId) return { posts: [] };

      const res = await fetch(`https://api.twitter.com/2/users/${userId}/tweets?max_results=100&tweet.fields=public_metrics,created_at`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return { posts: [] };
      const data = await res.json().catch(() => ({}));
      const posts: PlatformPostData[] = (data.data || []).map((tweet: Record<string, unknown>) => {
        const metrics = tweet.public_metrics as Record<string, number> || {};
        return {
          platformPostId: tweet.id as string,
          content: tweet.text as string,
          url: `https://twitter.com/i/web/status/${tweet.id}`,
          postType: "tweet",
          likeCount: metrics.like_count || 0,
          commentCount: metrics.reply_count || 0,
          shareCount: metrics.retweet_count || 0,
          viewCount: metrics.impression_count || 0,
          visibility: "public",
          publishedAt: tweet.created_at ? new Date(tweet.created_at as string) : undefined,
        };
      });
      return { posts };
    } catch { return { posts: [] }; }
  },
  async fetchComments() { return { comments: [] }; },
  async fetchFollowers(accessToken) {
    try {
      const meRes = await fetch("https://api.twitter.com/2/users/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!meRes.ok) return { followers: [] };
      const userId = (await meRes.json().catch(() => ({}))).data?.id;
      if (!userId) return { followers: [] };

      const res = await fetch(`https://api.twitter.com/2/users/${userId}/followers?max_results=100&user.fields=profile_image_url,public_metrics`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return { followers: [] };
      const data = await res.json().catch(() => ({}));
      const followers: PlatformFollowerData[] = (data.data || []).map((u: Record<string, unknown>) => ({
        platformUserId: u.id as string,
        username: u.username as string,
        displayName: u.name as string,
        avatarUrl: u.profile_image_url as string,
        followerCount: (u.public_metrics as Record<string, number>)?.followers_count,
        isMutual: false,
        relationshipType: "follower",
        profileUrl: `https://twitter.com/${u.username}`,
      }));
      return { followers };
    } catch { return { followers: [] }; }
  },
  async fetchMedia() { return { media: [] }; },
  async fetchAnalytics(accessToken) {
    try {
      const res = await fetch("https://api.twitter.com/2/users/me?user.fields=public_metrics", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return defaultAnalytics();
      const data = await res.json().catch(() => ({}));
      const metrics = data.data?.public_metrics || {};
      return {
        date: new Date(),
        followerCount: metrics.followers_count || 0,
        followingCount: metrics.following_count || 0,
        postCount: metrics.tweet_count || 0,
        totalLikes: metrics.like_count || 0,
        totalComments: 0, totalViews: 0, totalShares: 0,
        newFollowers: 0, lostFollowers: 0,
      };
    } catch { return defaultAnalytics(); }
  },
  async createPost(accessToken, content) {
    try {
      const res = await fetch("https://api.twitter.com/2/tweets", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ text: content }),
      });
      if (!res.ok) return null;
      const data = await res.json().catch(() => null) as { data?: { id?: string; text?: string } } | null;
      if (!data?.data?.id) return null;
      return {
        platformPostId: data.data.id,
        content: data.data.text || content,
        url: `https://twitter.com/i/web/status/${data.data.id}`,
        postType: "tweet",
        likeCount: 0,
        commentCount: 0,
        shareCount: 0,
        viewCount: 0,
        visibility: "public",
        publishedAt: new Date(),
      };
    } catch { return null; }
  },
  async deletePost(accessToken, postId) {
    try {
      const res = await fetch(`https://api.twitter.com/2/tweets/${encodeURIComponent(postId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return false;
      const data = await res.json().catch(() => null) as { data?: { deleted?: boolean } } | null;
      return Boolean(data?.data?.deleted);
    } catch { return false; }
  },
  async createComment(accessToken, postId, content) {
    try {
      const res = await fetch("https://api.twitter.com/2/tweets", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ text: content, reply: { in_reply_to_tweet_id: postId } }),
      });
      if (!res.ok) return null;
      const data = await res.json().catch(() => null) as { data?: { id?: string } } | null;
      if (!data?.data?.id) return null;
      return {
        platformCommentId: data.data.id,
        platformPostId: postId,
        content,
        isOwnComment: true,
        likeCount: 0,
        replyCount: 0,
        url: `https://twitter.com/i/web/status/${data.data.id}`,
        publishedAt: new Date(),
      };
    } catch { return null; }
  },
  async deleteComment(accessToken, commentId) {
    return twitterAdapter.deletePost(accessToken, commentId);
  },
  async editPost() { return false; },
  async likePost(accessToken, postId) {
    const userId = await fetchTwitterCurrentUserId(accessToken);
    if (!userId) return false;
    try {
      const res = await fetch(`https://api.twitter.com/2/users/${userId}/likes`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ tweet_id: postId }),
      });
      return res.ok;
    } catch { return false; }
  },
  async unlikePost(accessToken, postId) {
    const userId = await fetchTwitterCurrentUserId(accessToken);
    if (!userId) return false;
    try {
      const res = await fetch(`https://api.twitter.com/2/users/${userId}/likes/${encodeURIComponent(postId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return res.ok;
    } catch { return false; }
  },
  async followUser(accessToken, userId) {
    const currentUserId = await fetchTwitterCurrentUserId(accessToken);
    if (!currentUserId) return false;
    try {
      const res = await fetch(`https://api.twitter.com/2/users/${currentUserId}/following`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ target_user_id: userId }),
      });
      return res.ok;
    } catch { return false; }
  },
  async unfollowUser(accessToken, userId) {
    const currentUserId = await fetchTwitterCurrentUserId(accessToken);
    if (!currentUserId) return false;
    try {
      const res = await fetch(`https://api.twitter.com/2/users/${currentUserId}/following/${encodeURIComponent(userId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return res.ok;
    } catch { return false; }
  },
  async fetchConversations(accessToken) {
    try {
      const meId = await fetchTwitterCurrentUserId(accessToken);
      if (!meId) return { conversations: [] };
      const params = new URLSearchParams({
        max_results: "100",
        event_types: "MessageCreate",
        "dm_event.fields": "id,text,created_at,sender_id,dm_conversation_id",
        expansions: "sender_id",
        "user.fields": "name,username,profile_image_url",
      });
      const res = await fetch(`https://api.twitter.com/2/dm_events?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return { conversations: [] };
      const data = await res.json().catch(() => null) as {
        data?: Array<Record<string, unknown>>;
        includes?: { users?: Array<Record<string, unknown>> };
      } | null;
      const usersById = new Map((data?.includes?.users || []).map((u) => [String(u.id), u]));
      const conversations = new Map<string, PlatformConversationData>();
      for (const event of data?.data || []) {
        const conversationId = typeof event.dm_conversation_id === "string" ? event.dm_conversation_id : "";
        const eventId = typeof event.id === "string" ? event.id : "";
        const text = typeof event.text === "string" ? event.text : "";
        if (!conversationId || !eventId || !text) continue;
        const senderId = typeof event.sender_id === "string" ? event.sender_id : "";
        const sender = usersById.get(senderId);
        const senderName = sender && typeof sender.name === "string" ? sender.name : undefined;
        const senderUsername = sender && typeof sender.username === "string" ? sender.username : undefined;
        const senderAvatarUrl = sender && typeof sender.profile_image_url === "string" ? sender.profile_image_url : undefined;
        const isOwnMessage = senderId === meId;
        let conversation = conversations.get(conversationId);
        if (!conversation) {
          conversation = {
            externalConversationId: conversationId,
            url: "https://twitter.com/messages",
            messages: [],
          };
          conversations.set(conversationId, conversation);
        }
        if (!isOwnMessage && (senderName || senderUsername)) {
          conversation.participantName = senderName || senderUsername;
          conversation.participantUsername = senderUsername;
          conversation.participantAvatarUrl = senderAvatarUrl;
        }
        conversation.messages.push({
          externalMessageId: eventId,
          content: text,
          isOwnMessage,
          senderName,
          senderUsername,
          senderAvatarUrl,
          sentAt: dateFromString(event.created_at),
        });
      }
      for (const conversation of conversations.values()) {
        conversation.messages.sort((a, b) => (a.sentAt?.getTime() || 0) - (b.sentAt?.getTime() || 0));
      }
      return { conversations: [...conversations.values()] };
    } catch { return { conversations: [] }; }
  },
  async sendConversationMessage(accessToken, conversationId, content) {
    try {
      const res = await fetch(`https://api.twitter.com/2/dm_conversations/${encodeURIComponent(conversationId)}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ text: content }),
      });
      if (!res.ok) return null;
      const data = await res.json().catch(() => null) as { data?: { dm_event_id?: string } } | null;
      return { externalMessageId: data?.data?.dm_event_id };
    } catch { return null; }
  },
  async sharePost(accessToken, postId) {
    const userId = await fetchTwitterCurrentUserId(accessToken);
    if (!userId) return false;
    try {
      const res = await fetch(`https://api.twitter.com/2/users/${userId}/retweets`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ tweet_id: postId }),
      });
      return res.ok;
    } catch { return false; }
  },
  async pinPost() { return false; },
  async unpinPost() { return false; },
  async updateVisibility() { return false; },
};

// ─── Discord Adapter ────────────────────────────────────────

const discordAdapter: PlatformAdapter = {
  async fetchPosts(accessToken) {
    try {
      const res = await fetch("https://discord.com/api/v10/users/@me/guilds?with_counts=true&limit=200", {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      });
      if (!res.ok) return { posts: [] };
      const guilds = await res.json().catch(() => ({}));
      const posts: PlatformPostData[] = (Array.isArray(guilds) ? guilds : []).map((g: Record<string, unknown>) => ({
        platformPostId: g.id as string,
        title: g.name as string,
        content: `Server with ${toInt(g.approximate_member_count)} members`,
        url: `https://discord.com/channels/${g.id}`,
        postType: "text",
        likeCount: 0, commentCount: 0, shareCount: 0,
        viewCount: toInt(g.approximate_member_count),
        visibility: "private",
        thumbnailUrl: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png` : undefined,
        rawMetadata: JSON.stringify({
          features: g.features,
          owner: g.owner,
          permissions: g.permissions,
          approximatePresenceCount: g.approximate_presence_count,
        }),
      }));
      return { posts };
    } catch { return { posts: [] }; }
  },
  async fetchComments() { return { comments: [] }; },
  async fetchFollowers() { return { followers: [] }; },
  async fetchMedia() { return { media: [] }; },
  async fetchAnalytics(accessToken) {
    try {
      const result = await this.fetchPosts(accessToken);
      return {
        ...defaultAnalytics(),
        postCount: result.posts.length,
        totalViews: result.posts.reduce((sum, post) => sum + post.viewCount, 0),
        rawData: JSON.stringify({ guildCount: result.posts.length }),
      };
    } catch { return defaultAnalytics(); }
  },
  async createPost() { return null; },
  async deletePost() { return false; },
  async createComment() { return null; },
  async deleteComment() { return false; },
  async editPost() { return false; },
  async likePost() { return false; },
  async unlikePost() { return false; },
  async followUser() { return false; },
  async unfollowUser() { return false; },
  async sharePost() { return false; },
  async pinPost() { return false; },
  async unpinPost() { return false; },
  async updateVisibility() { return false; },
};

// ─── Spotify Adapter ────────────────────────────────────────

const spotifyAdapter: PlatformAdapter = {
  async fetchPosts(accessToken) {
    try {
      const res = await fetch("https://api.spotify.com/v1/me/playlists?limit=50", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return { posts: [] };
      const data = await res.json().catch(() => ({}));
      const posts: PlatformPostData[] = (data.items || []).map((p: Record<string, unknown>) => ({
        platformPostId: p.id as string,
        title: p.name as string,
        content: (p.description as string) || "",
        url: (p.external_urls as Record<string, string>)?.spotify,
        postType: "article",
        likeCount: (p.followers as Record<string, number>)?.total || 0,
        commentCount: 0, shareCount: 0,
        viewCount: (p.tracks as Record<string, number>)?.total || 0,
        visibility: p.public ? "public" : "private",
        thumbnailUrl: ((p.images as Record<string, string>[]) || [])[0]?.url,
        rawMetadata: JSON.stringify({ collaborative: p.collaborative, trackCount: (p.tracks as Record<string, number>)?.total }),
      }));
      return { posts };
    } catch { return { posts: [] }; }
  },
  async fetchComments() { return { comments: [] }; },
  async fetchFollowers() { return { followers: [] }; },
  async fetchMedia() { return { media: [] }; },
  async fetchAnalytics(accessToken) {
    try {
      const res = await fetch("https://api.spotify.com/v1/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return defaultAnalytics();
      const data = await res.json().catch(() => ({}));
      return {
        date: new Date(),
        followerCount: data.followers?.total || 0,
        followingCount: 0, postCount: 0,
        totalLikes: 0, totalComments: 0, totalViews: 0, totalShares: 0,
        newFollowers: 0, lostFollowers: 0,
      };
    } catch { return defaultAnalytics(); }
  },
  async createPost() { return null; },
  async deletePost() { return false; },
  async createComment() { return null; },
  async deleteComment() { return false; },
  async editPost() { return false; },
  async likePost(accessToken, postId) {
    try {
      const res = await fetch(`https://api.spotify.com/v1/playlists/${encodeURIComponent(postId)}/followers`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ public: false }),
      });
      return res.ok;
    } catch { return false; }
  },
  async unlikePost(accessToken, postId) {
    try {
      const res = await fetch(`https://api.spotify.com/v1/playlists/${encodeURIComponent(postId)}/followers`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return res.ok;
    } catch { return false; }
  },
  async followUser(accessToken, userId) {
    try {
      const res = await fetch(`https://api.spotify.com/v1/me/following?type=user&ids=${encodeURIComponent(userId)}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return res.ok;
    } catch { return false; }
  },
  async unfollowUser(accessToken, userId) {
    try {
      const res = await fetch(`https://api.spotify.com/v1/me/following?type=user&ids=${encodeURIComponent(userId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return res.ok;
    } catch { return false; }
  },
  async sharePost() { return false; },
  async pinPost() { return false; },
  async unpinPost() { return false; },
  async updateVisibility() { return false; },
};

// ─── Twitch Adapter ─────────────────────────────────────────

async function fetchTwitchCurrentUser(accessToken: string): Promise<{ id: string; login?: string; viewCount?: number } | null> {
  const twitchClientId = resolveEnvValue("TWITCH_CLIENT_ID");
  if (!twitchClientId) return null;
  const userRes = await fetch("https://api.twitch.tv/helix/users", {
    headers: { Authorization: `Bearer ${accessToken}`, "Client-Id": twitchClientId },
  });
  if (!userRes.ok) return null;
  const user = (await userRes.json().catch(() => ({}))).data?.[0];
  if (!user?.id) return null;
  return {
    id: user.id as string,
    login: user.login as string | undefined,
    viewCount: (user.view_count as number) || 0,
  };
}

const twitchAdapter: PlatformAdapter = {
  async fetchPosts(accessToken) {
    try {
      const currentUser = await fetchTwitchCurrentUser(accessToken);
      if (!currentUser) return { posts: [] };
      const twitchClientId = resolveEnvValue("TWITCH_CLIENT_ID");
      if (!twitchClientId) return { posts: [] };

      // Get videos (VODs, highlights, uploads)
      const res = await fetch(`https://api.twitch.tv/helix/videos?user_id=${currentUser.id}&first=50`, {
        headers: { Authorization: `Bearer ${accessToken}`, "Client-Id": twitchClientId },
      });
      if (!res.ok) return { posts: [] };
      const data = await res.json().catch(() => ({}));
      const posts: PlatformPostData[] = (data.data || []).map((v: Record<string, unknown>) => ({
        platformPostId: v.id as string,
        title: v.title as string,
        content: (v.description as string) || "",
        url: v.url as string,
        postType: "video",
        likeCount: 0, commentCount: 0, shareCount: 0,
        viewCount: (v.view_count as number) || 0,
        visibility: "public",
        publishedAt: v.created_at ? new Date(v.created_at as string) : undefined,
        thumbnailUrl: (v.thumbnail_url as string)?.replace("%{width}", "640").replace("%{height}", "360"),
        rawMetadata: JSON.stringify({ duration: v.duration, type: v.type }),
      }));
      return { posts };
    } catch { return { posts: [] }; }
  },
  async fetchComments() { return { comments: [] }; },
  async fetchFollowers(accessToken) {
    try {
      const currentUser = await fetchTwitchCurrentUser(accessToken);
      if (!currentUser) return { followers: [] };
      const twitchClientId = resolveEnvValue("TWITCH_CLIENT_ID");
      if (!twitchClientId) return { followers: [] };

      const followersRes = await fetch(`https://api.twitch.tv/helix/channels/followers?broadcaster_id=${currentUser.id}&first=100`, {
        headers: { Authorization: `Bearer ${accessToken}`, "Client-Id": twitchClientId },
      });
      if (!followersRes.ok) return { followers: [] };
      const followerData = await followersRes.json().catch(() => ({}));
      const followers: PlatformFollowerData[] = (followerData.data || []).map((f: Record<string, unknown>) => ({
        platformUserId: f.user_id as string,
        username: f.user_login as string,
        displayName: f.user_name as string,
        isMutual: false,
        relationshipType: "follower",
        profileUrl: `https://twitch.tv/${f.user_login}`,
      }));

      const followingRes = await fetch(`https://api.twitch.tv/helix/channels/followed?user_id=${currentUser.id}&first=100`, {
        headers: { Authorization: `Bearer ${accessToken}`, "Client-Id": twitchClientId },
      });

      const followByUserId = new Map<string, PlatformFollowerData>();
      for (const follower of followers) {
        followByUserId.set(follower.platformUserId, follower);
      }

      if (followingRes.ok) {
        const followingData = await followingRes.json().catch(() => ({}));
        for (const f of (followingData.data || []) as Record<string, unknown>[]) {
          const followedUserId = f.broadcaster_id as string;
          const existing = followByUserId.get(followedUserId);
          const followingUser: PlatformFollowerData = {
            platformUserId: followedUserId,
            username: f.broadcaster_login as string,
            displayName: f.broadcaster_name as string,
            isMutual: existing?.relationshipType === "follower",
            relationshipType: existing ? "follower" : "following",
            profileUrl: `https://twitch.tv/${f.broadcaster_login}`,
          };
          if (existing) {
            existing.isMutual = true;
          } else {
            followByUserId.set(followedUserId, followingUser);
          }
        }
      }
      return { followers: Array.from(followByUserId.values()) };
    } catch { return { followers: [] }; }
  },
  async fetchMedia() { return { media: [] }; },
  async fetchAnalytics(accessToken) {
    try {
      const currentUser = await fetchTwitchCurrentUser(accessToken);
      if (!currentUser) return defaultAnalytics();
      const twitchClientId = resolveEnvValue("TWITCH_CLIENT_ID");
      if (!twitchClientId) return defaultAnalytics();

      const followersRes = await fetch(`https://api.twitch.tv/helix/channels/followers?broadcaster_id=${currentUser.id}&first=1`, {
        headers: { Authorization: `Bearer ${accessToken}`, "Client-Id": twitchClientId },
      });
      const followingRes = await fetch(`https://api.twitch.tv/helix/channels/followed?user_id=${currentUser.id}&first=1`, {
        headers: { Authorization: `Bearer ${accessToken}`, "Client-Id": twitchClientId },
      });

      const followerCount = followersRes.ok ? ((await followersRes.json().catch(() => ({}))).total as number) || 0 : 0;
      const followingCount = followingRes.ok ? ((await followingRes.json().catch(() => ({}))).total as number) || 0 : 0;

      return {
        date: new Date(),
        followerCount,
        followingCount,
        postCount: 0,
        totalLikes: 0, totalComments: 0,
        totalViews: currentUser.viewCount || 0,
        totalShares: 0, newFollowers: 0, lostFollowers: 0,
      };
    } catch { return defaultAnalytics(); }
  },
  async createPost() { return null; },
  async deletePost() { return false; },
  async createComment() { return null; },
  async deleteComment() { return false; },
  async editPost() { return false; },
  async likePost() { return false; },
  async unlikePost() { return false; },
  async followUser() { return false; },
  async unfollowUser() { return false; },
  async sharePost() { return false; },
  async pinPost() { return false; },
  async unpinPost() { return false; },
  async updateVisibility() { return false; },
};

// ─── TikTok Adapter ─────────────────────────────────────────

const tiktokAdapter: PlatformAdapter = {
  async fetchPosts(accessToken) {
    try {
      const res = await fetch("https://open.tiktokapis.com/v2/video/list/?fields=id,title,video_description,create_time,share_url,like_count,comment_count,share_count,view_count,cover_image_url", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ max_count: 50 }),
      });
      if (!res.ok) return { posts: [] };
      const data = await res.json().catch(() => ({}));
      const posts: PlatformPostData[] = (data.data?.videos || []).map((v: Record<string, unknown>) => ({
        platformPostId: v.id as string,
        title: (v.title as string) || "",
        content: (v.video_description as string) || "",
        url: v.share_url as string,
        postType: "reel",
        likeCount: (v.like_count as number) || 0,
        commentCount: (v.comment_count as number) || 0,
        shareCount: (v.share_count as number) || 0,
        viewCount: (v.view_count as number) || 0,
        visibility: "public",
        publishedAt: v.create_time ? new Date((v.create_time as number) * 1000) : undefined,
        thumbnailUrl: v.cover_image_url as string,
      }));
      return { posts };
    } catch { return { posts: [] }; }
  },
  async fetchComments() { return { comments: [] }; },
  async fetchFollowers() { return { followers: [] }; },
  async fetchMedia() { return { media: [] }; },
  async fetchAnalytics() { return defaultAnalytics(); },
  async createPost() { return null; },
  async deletePost() { return false; },
  async createComment() { return null; },
  async deleteComment() { return false; },
  async editPost() { return false; },
  async likePost() { return false; },
  async unlikePost() { return false; },
  async followUser() { return false; },
  async unfollowUser() { return false; },
  async sharePost() { return false; },
  async pinPost() { return false; },
  async unpinPost() { return false; },
  async updateVisibility() { return false; },
};

// ─── Generic / Manual Adapter (SoundCloud, Threads, Bluesky) ──

const redditAdapter: PlatformAdapter = {
  async fetchPosts(accessToken, cursor) {
    try {
      const currentUser = await fetchRedditCurrentUser(accessToken);
      if (!currentUser?.name) return { posts: [] };

      const params = new URLSearchParams({ limit: "50", raw_json: "1" });
      if (cursor) params.set("after", cursor);
      const listing = await fetchRedditJson<RedditListing>(
        accessToken,
        `/user/${encodeURIComponent(currentUser.name)}/submitted?${params.toString()}`,
      );
      const children = listing?.data?.children || [];
      const posts: PlatformPostData[] = children
        .map((child) => child.data)
        .filter((post): post is Record<string, unknown> => Boolean(post?.id))
        .map((post) => {
          const fullname = typeof post.name === "string" ? post.name : `t3_${post.id}`;
          const url = redditPermalink(post.permalink) || (typeof post.url === "string" ? post.url : undefined);
          return {
            platformPostId: fullname,
            content: (post.selftext as string) || (post.url_overridden_by_dest as string) || "",
            title: (post.title as string) || "",
            url,
            postType: redditPostType(post),
            likeCount: toInt(post.score),
            commentCount: toInt(post.num_comments),
            shareCount: toInt(post.num_crossposts),
            viewCount: 0,
            visibility: post.hidden ? "private" : "public",
            publishedAt: dateFromUnixSeconds(post.created_utc),
            thumbnailUrl: redditThumbnail(post),
            isPinned: Boolean(post.stickied),
            rawMetadata: JSON.stringify({
              author: post.author,
              domain: post.domain,
              over18: post.over_18,
              permalink: post.permalink,
              score: post.score,
              spoiler: post.spoiler,
              subreddit: post.subreddit,
              subredditId: post.subreddit_id,
            }),
          };
        });

      return { posts, nextCursor: listing?.data?.after || undefined };
    } catch { return { posts: [] }; }
  },
  async fetchComments(accessToken, postId) {
    try {
      const currentUser = await fetchRedditCurrentUser(accessToken);
      const articleId = redditArticleId(postId);
      const listing = await fetchRedditJson<RedditListing[]>(
        accessToken,
        `/comments/${encodeURIComponent(articleId)}?limit=100&raw_json=1`,
      );
      const commentsListing = Array.isArray(listing) ? listing[1] : null;
      const comments: PlatformCommentData[] = (commentsListing?.data?.children || [])
        .map((child) => child.data)
        .filter((comment): comment is Record<string, unknown> => Boolean(comment?.id && comment?.body))
        .map((comment) => {
          const fullname = typeof comment.name === "string" ? comment.name : `t1_${comment.id}`;
          const parentCommentId = typeof comment.parent_id === "string" && comment.parent_id.startsWith("t1_")
            ? comment.parent_id
            : undefined;
          return {
            platformCommentId: fullname,
            platformPostId: postId,
            content: (comment.body as string) || "",
            authorName: comment.author as string,
            authorUsername: comment.author as string,
            isOwnComment: Boolean(currentUser?.name && comment.author === currentUser.name),
            likeCount: toInt(comment.score),
            replyCount: Array.isArray((comment.replies as RedditListing | undefined)?.data?.children)
              ? ((comment.replies as RedditListing).data?.children || []).length
              : 0,
            parentCommentId,
            url: redditPermalink(comment.permalink),
            publishedAt: dateFromUnixSeconds(comment.created_utc),
          };
        });

      return { comments };
    } catch { return { comments: [] }; }
  },
  async fetchFollowers() { return { followers: [] }; },
  async fetchMedia() { return { media: [] }; },
  async fetchForYouFeed(accessToken) {
    try {
      const currentUser = await fetchRedditCurrentUser(accessToken);
      const listing = await fetchRedditJson<RedditListing>(accessToken, "/best?limit=40&raw_json=1");
      const items: PlatformFeedItemData[] = (listing?.data?.children || [])
        .map((child) => child.data)
        .filter((post): post is Record<string, unknown> => Boolean(post?.id))
        .filter((post) => !currentUser?.name || post.author !== currentUser.name)
        .map((post) => {
          const fullname = typeof post.name === "string" ? post.name : `t3_${post.id}`;
          const author = typeof post.author === "string" ? post.author : undefined;
          return {
            platformItemId: fullname,
            authorName: author,
            authorUsername: author,
            authorUrl: author ? `https://www.reddit.com/user/${author}` : undefined,
            title: (post.title as string) || "",
            content: (post.selftext as string) || "",
            url: redditPermalink(post.permalink) || (typeof post.url === "string" ? post.url : undefined),
            thumbnailUrl: redditThumbnail(post),
            postType: redditPostType(post),
            likeCount: toInt(post.score),
            commentCount: toInt(post.num_comments),
            publishedAt: dateFromUnixSeconds(post.created_utc),
            rawMetadata: JSON.stringify({
              subreddit: post.subreddit,
              domain: post.domain,
              over18: post.over_18,
              spoiler: post.spoiler,
            }),
            isNsfw: post.over_18 === true,
          };
        });
      return { items };
    } catch { return { items: [] }; }
  },
  async fetchAnalytics(accessToken) {
    try {
      const currentUser = await fetchRedditCurrentUser(accessToken);
      if (!currentUser) return defaultAnalytics();
      return {
        date: new Date(),
        followerCount: toInt(currentUser.subreddit?.subscribers),
        followingCount: 0,
        postCount: 0,
        totalLikes: toInt(currentUser.total_karma) || toInt(currentUser.link_karma) + toInt(currentUser.comment_karma),
        totalComments: toInt(currentUser.comment_karma),
        totalViews: 0,
        totalShares: 0,
        newFollowers: 0,
        lostFollowers: 0,
        rawData: JSON.stringify({
          createdUtc: currentUser.created_utc,
          linkKarma: currentUser.link_karma,
          commentKarma: currentUser.comment_karma,
          totalKarma: currentUser.total_karma,
        }),
      };
    } catch { return defaultAnalytics(); }
  },
  async createPost(accessToken, content) {
    const currentUser = await fetchRedditCurrentUser(accessToken);
    if (!currentUser?.name) return null;
    const res = await postRedditForm(accessToken, "/api/submit", {
      api_type: "json",
      sr: `u_${currentUser.name}`,
      kind: "self",
      title: content.slice(0, 300),
      text: content,
    });
    if (!res?.ok) return null;
    const payload = await res.json().catch(() => null) as { json?: { errors?: unknown[]; data?: { name?: string; url?: string } } } | null;
    if (!payload?.json || (payload.json.errors || []).length > 0) return null;
    const fullname = payload.json.data?.name;
    if (!fullname) return null;
    return {
      platformPostId: fullname,
      content,
      url: payload.json.data?.url,
      postType: "text",
      likeCount: 1,
      commentCount: 0,
      shareCount: 0,
      viewCount: 0,
      visibility: "public",
      publishedAt: new Date(),
    };
  },
  async deletePost(accessToken, postId) {
    const res = await postRedditForm(accessToken, "/api/del", { id: postId });
    return Boolean(res?.ok);
  },
  async createComment(accessToken, postId, content) {
    const res = await postRedditForm(accessToken, "/api/comment", {
      api_type: "json",
      thing_id: postId,
      text: content,
    });
    if (!res?.ok) return null;
    const payload = await res.json().catch(() => null) as { json?: { errors?: unknown[]; data?: { things?: Array<{ data?: { name?: string; permalink?: string } }> } } } | null;
    if (!payload?.json || (payload.json.errors || []).length > 0) return null;
    const created = payload.json.data?.things?.[0]?.data;
    if (!created?.name) return null;
    return {
      platformCommentId: created.name,
      platformPostId: postId,
      content,
      isOwnComment: true,
      likeCount: 1,
      replyCount: 0,
      url: redditPermalink(created.permalink),
      publishedAt: new Date(),
    };
  },
  async deleteComment(accessToken, commentId) {
    const res = await postRedditForm(accessToken, "/api/del", { id: commentId });
    return Boolean(res?.ok);
  },
  async editPost(accessToken, postId, content) {
    const res = await postRedditForm(accessToken, "/api/editusertext", {
      api_type: "json",
      thing_id: postId,
      text: content,
    });
    return Boolean(res?.ok);
  },
  async likePost(accessToken, postId) {
    return redditVote(accessToken, postId, 1);
  },
  async unlikePost(accessToken, postId) {
    return redditVote(accessToken, postId, 0);
  },
  async followUser(accessToken, userId) {
    const res = await postRedditForm(accessToken, "/api/subscribe", {
      action: "sub",
      sr_name: userId.startsWith("u_") || userId.startsWith("r/") ? userId.replace(/^r\//, "") : `u_${userId}`,
    });
    return Boolean(res?.ok);
  },
  async unfollowUser(accessToken, userId) {
    const res = await postRedditForm(accessToken, "/api/subscribe", {
      action: "unsub",
      sr_name: userId.startsWith("u_") || userId.startsWith("r/") ? userId.replace(/^r\//, "") : `u_${userId}`,
    });
    return Boolean(res?.ok);
  },
  async fetchConversations(accessToken) {
    try {
      const [inbox, sent] = await Promise.all([
        fetchRedditJson<RedditListing>(accessToken, "/message/inbox?limit=100"),
        fetchRedditJson<RedditListing>(accessToken, "/message/sent?limit=100"),
      ]);
      const conversations = new Map<string, PlatformConversationData>();
      const ingest = (listing: RedditListing | null, isOwnMessage: boolean) => {
        for (const child of listing?.data?.children || []) {
          if (child.kind !== "t4") continue;
          const data = child.data || {};
          const author = typeof data.author === "string" ? data.author : "";
          const dest = typeof data.dest === "string" ? data.dest : "";
          const other = isOwnMessage ? dest : author;
          const body = typeof data.body === "string" ? data.body : "";
          const messageId = typeof data.name === "string" ? data.name : "";
          if (!other || other.startsWith("#") || !body || !messageId) continue;
          const key = `u/${other.toLowerCase()}`;
          let conversation = conversations.get(key);
          if (!conversation) {
            conversation = {
              externalConversationId: key,
              participantName: other,
              participantUsername: other,
              url: "https://www.reddit.com/message/messages/",
              messages: [],
            };
            conversations.set(key, conversation);
          }
          conversation.messages.push({
            externalMessageId: messageId,
            content: body,
            isOwnMessage,
            senderName: author || undefined,
            senderUsername: author || undefined,
            sentAt: dateFromUnixSeconds(data.created_utc),
          });
        }
      };
      ingest(inbox, false);
      ingest(sent, true);
      for (const conversation of conversations.values()) {
        conversation.messages.sort((a, b) => (a.sentAt?.getTime() || 0) - (b.sentAt?.getTime() || 0));
      }
      return { conversations: [...conversations.values()] };
    } catch { return { conversations: [] }; }
  },
  async sendConversationMessage(accessToken, conversationId, content) {
    const to = conversationId.replace(/^u\//i, "");
    if (!to) return null;
    const res = await postRedditForm(accessToken, "/api/compose", {
      api_type: "json",
      to,
      subject: "Mesh.me",
      text: content,
    });
    if (!res?.ok) return null;
    const payload = await res.json().catch(() => null) as { json?: { errors?: unknown[] } } | null;
    if (!payload?.json || (payload.json.errors || []).length > 0) return null;
    return {};
  },
  async sharePost() { return false; },
  async pinPost() { return false; },
  async unpinPost() { return false; },
  async updateVisibility() { return false; },
};

const manualAdapter: PlatformAdapter = {
  async fetchPosts() { return { posts: [] }; },
  async fetchComments() { return { comments: [] }; },
  async fetchFollowers() { return { followers: [] }; },
  async fetchMedia() { return { media: [] }; },
  async fetchAnalytics() { return defaultAnalytics(); },
  async createPost() { return null; },
  async deletePost() { return false; },
  async createComment() { return null; },
  async deleteComment() { return false; },
  async editPost() { return false; },
  async likePost() { return false; },
  async unlikePost() { return false; },
  async followUser() { return false; },
  async unfollowUser() { return false; },
  async sharePost() { return false; },
  async pinPost() { return false; },
  async unpinPost() { return false; },
  async updateVisibility() { return false; },
};

// ─── Adapter Registry ───────────────────────────────────────

const adapters: Record<string, PlatformAdapter> = {
  github: githubAdapter,
  youtube: youtubeAdapter,
  twitter: twitterAdapter,
  discord: discordAdapter,
  spotify: spotifyAdapter,
  twitch: twitchAdapter,
  tiktok: tiktokAdapter,
  reddit: redditAdapter,
  soundcloud: manualAdapter,
  threads: manualAdapter,
  bluesky: manualAdapter,
  instagram: manualAdapter,
  linkedin: manualAdapter,
  facebook: manualAdapter,
  pinterest: manualAdapter,
  snapchat: manualAdapter,
};

function getAdapter(platform: string): PlatformAdapter {
  return adapters[platform] || manualAdapter;
}

function defaultAnalytics(): PlatformAnalyticsData {
  return {
    date: new Date(),
    followerCount: 0, followingCount: 0, postCount: 0,
    totalLikes: 0, totalComments: 0, totalViews: 0, totalShares: 0,
    newFollowers: 0, lostFollowers: 0,
  };
}

function isStrictTokenEncryptionEnabled(): boolean {
  return Boolean(process.env.APP_DATA_ENCRYPTION_KEY);
}

function getStoredToken(value: string | null): string | null {
  if (!value) return null;

  if (value.startsWith("enc:v1:")) {
    try {
      return decryptSecret(value);
    } catch {
      return null;
    }
  }

  // Legacy plaintext tokens are only allowed before APP_DATA_ENCRYPTION_KEY is rolled out.
  return isStrictTokenEncryptionEnabled() ? null : value;
}

function getStoredConnectedAccountTokens(account: { accessToken: string | null; refreshToken: string | null }): {
  accessToken: string | null;
  refreshToken: string | null;
} {
  return {
    accessToken: getStoredAccessToken(account.accessToken),
    refreshToken: getStoredRefreshToken(account.refreshToken),
  };
}

function getStoredAccessToken(value: string | null): string | null {
  return getStoredToken(value);
}

function getStoredRefreshToken(value: string | null): string | null {
  return getStoredToken(value);
}

async function getValidAccessToken(account: {
  id: string;
  platform: string;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: Date | null;
}): Promise<string | null> {
  let tokens = getStoredConnectedAccountTokens(account);
  const refreshBefore = Date.now() + 120_000;
  const shouldRefresh = !tokens.accessToken
    || (account.expiresAt !== null && account.expiresAt.getTime() <= refreshBefore);

  if (shouldRefresh) {
    if (!tokens.refreshToken && !usesLongLivedTokenExchange(account.platform)) return null;

    const result = await refreshConnectedAccountToken(account.id);
    if (result !== "refreshed") return null;

    const refreshedAccount = await prisma.connectedAccount.findUnique({
      where: { id: account.id },
      select: { accessToken: true, refreshToken: true },
    });
    if (!refreshedAccount) return null;
    tokens = getStoredConnectedAccountTokens(refreshedAccount);
  }

  return tokens.accessToken;
}

async function migratePlatformCommentsIntoMeChat(account: {
  id: string;
  userId: string;
  platform: string;
}) {
  const comments = await prisma.platformComment.findMany({
    where: {
      connectedAccountId: account.id,
      authorUsername: { not: null },
      content: { not: "" },
    },
    select: {
      platformCommentId: true,
      authorUsername: true,
      content: true,
      publishedAt: true,
      url: true,
      post: { select: { url: true } },
    },
    take: 200,
    orderBy: { publishedAt: "desc" },
  });

  if (comments.length === 0) return 0;

  const usernames = [...new Set(
    comments
      .map((c) => c.authorUsername?.trim().toLowerCase())
      .filter((value): value is string => Boolean(value)),
  )];

  if (usernames.length === 0) return 0;

  const users = await prisma.user.findMany({
    where: { username: { in: usernames } },
    select: { id: true, username: true, displayName: true },
  });
  const userByUsername = new Map(users.map((u) => [u.username.toLowerCase(), u]));
  let imported = 0;

  for (const comment of comments) {
    const username = comment.authorUsername?.trim().toLowerCase();
    if (!username) continue;
    const sender = userByUsername.get(username);
    if (!sender || sender.id === account.userId) continue;

    const existingThread = await prisma.messageThread.findFirst({
      where: {
        AND: [
          { members: { some: { userId: account.userId } } },
          { members: { some: { userId: sender.id } } },
        ],
      },
      select: { id: true },
    });

    const thread = existingThread || await prisma.messageThread.create({
      data: {
        members: {
          create: [
            { userId: account.userId },
            { userId: sender.id },
          ],
        },
      },
      select: { id: true },
    });

    const marker = `[${account.platform}:${comment.platformCommentId}]`;
    const alreadyImported = await prisma.message.findFirst({
      where: {
        threadId: thread.id,
        OR: [
          { platformCommentId: comment.platformCommentId },
          { content: { startsWith: marker } },
        ],
      },
      select: { id: true },
    });
    if (alreadyImported) continue;

    const sourceUrl = comment.url || comment.post?.url;
    const importedContent = `${marker} ${comment.content}${sourceUrl ? `\n${sourceUrl}` : ""}`;

    await prisma.message.create({
      data: {
        content: importedContent,
        senderId: sender.id,
        threadId: thread.id,
        sourcePlatform: account.platform,
        messageType: "imported_comment",
        sourceUrl,
        platformCommentId: comment.platformCommentId,
        createdAt: comment.publishedAt || new Date(),
      },
    });
    await prisma.messageThread.update({
      where: { id: thread.id },
      data: { updatedAt: comment.publishedAt || new Date() },
    });
    imported++;
  }

  return imported;
}

async function syncDirectMessagesIntoMeChat(account: {
  id: string;
  userId: string;
  platform: string;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: Date | null;
}) {
  const adapter = getAdapter(account.platform);
  if (!adapter.fetchConversations) return 0;
  if (!getPlatformMessagingCapability(account.platform).supported) return 0;

  const accessToken = await getValidAccessToken(account);
  if (!accessToken) return 0;

  const { conversations } = await adapter.fetchConversations(accessToken);
  let imported = 0;

  for (const conversation of conversations.slice(0, 40)) {
    if (!conversation.externalConversationId || conversation.messages.length === 0) continue;

    const title = conversation.participantName
      || conversation.participantUsername
      || `${account.platform} conversation`;

    let thread = await prisma.messageThread.findFirst({
      where: {
        connectedAccountId: account.id,
        externalConversationId: conversation.externalConversationId,
      },
      select: { id: true },
    });

    if (!thread) {
      thread = await prisma.messageThread.create({
        data: {
          title,
          threadType: "direct",
          sourcePlatform: account.platform,
          isEncrypted: false,
          connectedAccountId: account.id,
          externalConversationId: conversation.externalConversationId,
          members: { create: [{ userId: account.userId, role: "owner" }] },
        },
        select: { id: true },
      });
    }

    const externalIds = conversation.messages
      .map((message) => message.externalMessageId)
      .filter(Boolean);
    const existing = await prisma.message.findMany({
      where: { threadId: thread.id, externalMessageId: { in: externalIds } },
      select: { externalMessageId: true },
    });
    const seen = new Set(existing.map((row) => row.externalMessageId));

    const recentOwnReplies = await prisma.message.findMany({
      where: {
        threadId: thread.id,
        senderId: account.userId,
        externalMessageId: null,
        messageType: "external_dm",
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      select: { content: true, createdAt: true },
    });

    let latest: Date | null = null;
    for (const message of conversation.messages) {
      if (!message.externalMessageId || seen.has(message.externalMessageId)) continue;
      const content = message.content.trim().slice(0, 4000);
      if (!content) continue;
      if (message.isOwnMessage && recentOwnReplies.some((reply) =>
        reply.content === content
        && (!message.sentAt || Math.abs(message.sentAt.getTime() - reply.createdAt.getTime()) < 60 * 60 * 1000),
      )) {
        continue;
      }

      const sentAt = message.sentAt || new Date();
      await prisma.message.create({
        data: {
          content,
          senderId: account.userId,
          threadId: thread.id,
          sourcePlatform: account.platform,
          messageType: "external_dm",
          sourceUrl: conversation.url || null,
          externalMessageId: message.externalMessageId,
          createdAt: sentAt,
          metadata: message.isOwnMessage
            ? null
            : serializeMeChatMetadata({
              externalSender: {
                name: message.senderName || title,
                username: message.senderUsername || conversation.participantUsername,
                avatarUrl: message.senderAvatarUrl || conversation.participantAvatarUrl,
              },
            }),
        },
      });
      if (!latest || sentAt > latest) latest = sentAt;
      imported++;
    }

    if (latest) {
      await prisma.messageThread.update({
        where: { id: thread.id },
        data: { title, updatedAt: latest },
      });
    }
  }

  return imported;
}

export async function deliverMeChatMessageToPlatform(input: {
  connectedAccountId: string;
  externalConversationId: string;
  content: string;
}): Promise<{ status: "delivered" | "failed"; platform: string; externalMessageId?: string; error?: string }> {
  const user = await getCurrentUser();
  if (!user) {
    return { status: "failed", platform: "unknown", error: "Not authenticated" };
  }

  const account = await prisma.connectedAccount.findUnique({
    where: { id: input.connectedAccountId },
    select: {
      id: true,
      userId: true,
      platform: true,
      isActive: true,
      accessToken: true,
      refreshToken: true,
      expiresAt: true,
    },
  });

  if (!account || account.userId !== user.id) {
    return { status: "failed", platform: "unknown", error: "This connected account is no longer active. Reconnect it to keep replying from Mesh.me." };
  }

  if (!account.isActive) {
    return { status: "failed", platform: account.platform, error: "This connected account is no longer active. Reconnect it to keep replying from Mesh.me." };
  }

  const capability = getPlatformMessagingCapability(account.platform);
  const adapter = getAdapter(account.platform);
  if (!capability.supported || !adapter.sendConversationMessage) {
    return { status: "failed", platform: account.platform, error: capability.reason };
  }

  const accessToken = await getValidAccessToken(account);
  if (!accessToken) {
    return { status: "failed", platform: account.platform, error: "The connection expired. Reconnect the account to keep replying from Mesh.me." };
  }

  const result = await adapter.sendConversationMessage(accessToken, input.externalConversationId, input.content);
  if (!result) {
    return { status: "failed", platform: account.platform, error: "The platform did not accept the message. It is saved here — try again in a moment." };
  }

  return { status: "delivered", platform: account.platform, externalMessageId: result.externalMessageId };
}

export async function syncMeChatConversationsForCurrentUser() {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const accounts = await prisma.connectedAccount.findMany({
    where: { userId: user.id, isActive: true },
    select: {
      id: true,
      userId: true,
      platform: true,
      accessToken: true,
      refreshToken: true,
      expiresAt: true,
    },
  });

  let imported = 0;
  for (const account of accounts) {
    imported += await migratePlatformCommentsIntoMeChat(account);
    imported += await syncDirectMessagesIntoMeChat(account);
  }

  return {
    success: true,
    accounts: accounts.length,
    imported,
  };
}

// ─── Sync Engine ────────────────────────────────────────────

export async function syncPlatform(connectedAccountId: string, syncType: "full" | "posts" | "comments" | "followers" | "analytics" = "full") {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const account = await prisma.connectedAccount.findUnique({
    where: { id: connectedAccountId },
  });
  if (!account || account.userId !== user.id) return { error: "Account not found" };

  const importCapability = getPlatformImportCapability(account.platform);
  if (!importCapability.supported) return { error: importCapability.reason };

  const accessToken = await getValidAccessToken(account);
  if (!accessToken) return { error: "No access token - reconnect this platform" };

  // Create sync job
  const job = await prisma.syncJob.create({
    data: {
      connectedAccountId: account.id,
      syncType,
      status: "running",
      startedAt: new Date(),
    },
  });

  // Update account sync status
  await prisma.connectedAccount.update({
    where: { id: account.id },
    data: { syncStatus: "syncing", syncError: null },
  });

  try {
    const adapter = getAdapter(account.platform);
    let itemsSynced = 0;
    const syncedPostRefs: Array<{ id: string; platformPostId: string }> = [];

    // Sync posts
    if (syncType === "full" || syncType === "posts") {
      let cursor: string | undefined;
      let page = 0;
      // Oldest publish time among posts actually returned this sync — the lower
      // bound of the window we can observe. Used to safely reconcile deletions.
      let oldestSeenPublishedAt: Date | null = null;
      do {
        const result = await adapter.fetchPosts(accessToken, cursor);
        for (const post of result.posts) {
          const safety = classifyContentSafety(post.title, post.content, post.rawMetadata);
          const syncedPost = await prisma.platformPost.upsert({
            where: {
              connectedAccountId_platformPostId: {
                connectedAccountId: account.id,
                platformPostId: post.platformPostId,
              },
            },
            create: { connectedAccountId: account.id, ...post, ...safety },
            update: {
              content: post.content,
              title: post.title,
              url: post.url,
              likeCount: post.likeCount,
              commentCount: post.commentCount,
              shareCount: post.shareCount,
              viewCount: post.viewCount,
              thumbnailUrl: post.thumbnailUrl,
              rawMetadata: post.rawMetadata,
              isPinned: post.isPinned || false,
              // Source visibility is authoritative: a post made private or
              // unlisted at the source updates here on every sync, so mesh.me
              // never keeps showing it more broadly than the source allows.
              visibility: post.visibility,
              postType: post.postType,
              publishedAt: post.publishedAt,
              watchTimeSeconds: post.watchTimeSeconds,
              ...safety,
            },
          });
          syncedPostRefs.push({ id: syncedPost.id, platformPostId: syncedPost.platformPostId });
          if (post.publishedAt && (!oldestSeenPublishedAt || post.publishedAt < oldestSeenPublishedAt)) {
            oldestSeenPublishedAt = post.publishedAt;
          }
          itemsSynced++;
        }
        cursor = result.nextCursor;
        page++;
        // Update progress
        await prisma.syncJob.update({
          where: { id: job.id },
          data: { itemsSynced, progress: Math.min(90, page * 30) },
        });
      } while (cursor && page < 10);

      // Honor source-side deletions, safely for feeds that only return a capped
      // window of recent posts (most post adapters return a single page and do
      // not paginate). Among the posts we actually saw this sync, take the oldest
      // publish time as the lower bound of the observed window. Any cached post
      // at or after that boundary that the source did NOT return has been deleted
      // there — it fell inside the window yet is gone — so we remove it (cascade
      // deletes its comments). Cached posts OLDER than the window are outside what
      // this fetch can observe and are left untouched, so accounts with more
      // history than the fetch window never lose valid posts. Requires seeing at
      // least one dated post, so a transient empty response prunes nothing.
      const seenPostIds = new Set(syncedPostRefs.map((ref) => ref.platformPostId));
      if (seenPostIds.size > 0 && oldestSeenPublishedAt) {
        await prisma.platformPost.deleteMany({
          where: {
            connectedAccountId: account.id,
            platformPostId: { notIn: [...seenPostIds] },
            publishedAt: { gte: oldestSeenPublishedAt },
          },
        });
      }
    }

    // Sync the platform's personalized home / for-you feed
    if ((syncType === "full" || syncType === "posts") && adapter.fetchForYouFeed) {
      const feed = await adapter.fetchForYouFeed(accessToken);
      for (const rawItem of feed.items) {
        const { isNsfw: platformNsfw, ...item } = rawItem;
        const classified = classifyContentSafety(item.title, item.content, item.rawMetadata);
        const isNsfw = platformNsfw === true || classified.isNsfw;
        const safety = { isNsfw, contentRating: isNsfw ? "adult" : classified.contentRating };
        await prisma.platformFeedItem.upsert({
          where: {
            connectedAccountId_platformItemId: {
              connectedAccountId: account.id,
              platformItemId: item.platformItemId,
            },
          },
          create: { connectedAccountId: account.id, ...item, ...safety, fetchedAt: new Date() },
          update: {
            title: item.title,
            content: item.content,
            url: item.url,
            thumbnailUrl: item.thumbnailUrl,
            mediaUrl: item.mediaUrl,
            authorName: item.authorName,
            authorUsername: item.authorUsername,
            authorAvatarUrl: item.authorAvatarUrl,
            authorUrl: item.authorUrl,
            likeCount: item.likeCount,
            commentCount: item.commentCount,
            rawMetadata: item.rawMetadata,
            fetchedAt: new Date(),
            ...safety,
          },
        });
        itemsSynced++;
      }
      // Retention: keep the feed fresh and storage bounded.
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      await prisma.platformFeedItem.deleteMany({
        where: { connectedAccountId: account.id, fetchedAt: { lt: cutoff } },
      });
    }

    // Sync recent comments for providers that expose a read comment API.
    if (syncType === "full" || syncType === "comments") {
      const commentTargets = syncedPostRefs.length > 0
        ? syncedPostRefs
        : await prisma.platformPost.findMany({
            where: { connectedAccountId: account.id },
            select: { id: true, platformPostId: true },
            orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
            take: COMMENT_SYNC_POST_LIMIT,
          });

      for (const postRef of commentTargets.slice(0, COMMENT_SYNC_POST_LIMIT)) {
        const result = await adapter.fetchComments(accessToken, postRef.platformPostId);
        for (const comment of result.comments) {
          await prisma.platformComment.upsert({
            where: {
              connectedAccountId_platformCommentId: {
                connectedAccountId: account.id,
                platformCommentId: comment.platformCommentId,
              },
            },
            create: { connectedAccountId: account.id, postId: postRef.id, ...comment },
            update: {
              platformPostId: comment.platformPostId,
              content: comment.content,
              authorName: comment.authorName,
              authorUsername: comment.authorUsername,
              authorAvatarUrl: comment.authorAvatarUrl,
              isOwnComment: comment.isOwnComment,
              likeCount: comment.likeCount,
              replyCount: comment.replyCount,
              parentCommentId: comment.parentCommentId,
              url: comment.url,
              sentiment: comment.sentiment,
              publishedAt: comment.publishedAt,
              postId: postRef.id,
            },
          });
          itemsSynced++;
        }
        await prisma.platformPost.update({
          where: { id: postRef.id },
          data: { commentsImported: result.comments.length > 0 },
        });
      }
    }

    // Sync followers
    if (syncType === "full" || syncType === "followers") {
      const result = await adapter.fetchFollowers(accessToken);
      for (const follower of result.followers) {
        await prisma.platformFollower.upsert({
          where: {
            connectedAccountId_platformUserId: {
              connectedAccountId: account.id,
              platformUserId: follower.platformUserId,
            },
          },
          create: { connectedAccountId: account.id, ...follower },
          update: {
            username: follower.username,
            displayName: follower.displayName,
            avatarUrl: follower.avatarUrl,
            followerCount: follower.followerCount,
            isMutual: follower.isMutual,
            relationshipType: follower.relationshipType,
            profileUrl: follower.profileUrl,
          },
        });
        itemsSynced++;
      }
      // Note: we intentionally do NOT prune "removed" followers here. Most
      // follower adapters return only a single capped page and do not paginate,
      // and follower lists have no reliable ordering key, so there is no safe
      // completeness signal — pruning could delete valid followers beyond the
      // cap. Safe follower reconciliation requires adapter-level pagination
      // first (tracked in docs/PLATFORM_COMPLIANCE_AUDIT.md).
    }

    // Sync analytics
    if (syncType === "full" || syncType === "analytics") {
      const analytics = await adapter.fetchAnalytics(accessToken);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      await prisma.platformAnalytics.upsert({
        where: {
          connectedAccountId_date: {
            connectedAccountId: account.id,
            date: today,
          },
        },
        create: { connectedAccountId: account.id, ...analytics, date: today },
        update: { ...analytics, date: today },
      });
      itemsSynced++;
    }

    // Mark complete
    await prisma.syncJob.update({
      where: { id: job.id },
      data: { status: "completed", progress: 100, itemsSynced, completedAt: new Date() },
    });

    await prisma.connectedAccount.update({
      where: { id: account.id },
      data: { syncStatus: "idle", lastSyncAt: new Date() },
    });

    await migratePlatformCommentsIntoMeChat({
      id: account.id,
      userId: account.userId,
      platform: account.platform,
    });

    return { success: true, itemsSynced };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Sync failed";
    await prisma.syncJob.update({
      where: { id: job.id },
      data: { status: "failed", error: errorMsg, completedAt: new Date() },
    });
    await prisma.connectedAccount.update({
      where: { id: account.id },
      data: { syncStatus: "error", syncError: errorMsg },
    });
    return { error: errorMsg };
  }
}


// ─── Content Management Actions ─────────────────────────────

export async function getPlatformContent(platform?: string, postType?: string, page = 1, limit = 20) {
  const user = await getCurrentUser();
  if (!user) return { posts: [], total: 0 };

  const accounts = await prisma.connectedAccount.findMany({
    where: { userId: user.id, isActive: true, ...(platform ? { platform } : {}) },
    select: { id: true, platform: true },
  });

  const accountIds = accounts.map((a) => a.id);
  if (accountIds.length === 0) return { posts: [], total: 0 };

  const where = {
    ...nsfwHiddenWhere(user),
    connectedAccountId: { in: accountIds },
    ...(postType ? { postType } : {}),
  };

  const [posts, total] = await Promise.all([
    prisma.platformPost.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        connectedAccount: { select: { platform: true, platformUsername: true } },
        media: true,
        _count: { select: { comments: true } },
      },
    }),
    prisma.platformPost.count({ where }),
  ]);

  return { posts, total };
}

export async function getPlatformAnalyticsSummary() {
  const user = await getCurrentUser();
  if (!user) return null;

  const accounts = await prisma.connectedAccount.findMany({
    where: { userId: user.id, isActive: true },
    include: {
      _count: {
        select: { platformPosts: true, platformFollowers: true, platformComments: true },
      },
      platformAnalytics: {
        orderBy: { date: "desc" },
        take: 1,
      },
    },
  });

  const summary = accounts.map((account) => {
    const latest = account.platformAnalytics[0];
    return {
      platform: account.platform,
      platformUsername: account.platformUsername,
      lastSyncAt: account.lastSyncAt,
      syncStatus: account.syncStatus,
      postCount: account._count.platformPosts,
      followerCount: latest?.followerCount || 0,
      commentCount: account._count.platformComments,
      totalViews: latest?.totalViews || 0,
      totalLikes: latest?.totalLikes || 0,
      engagementRate: latest?.engagementRate,
    };
  });

  return summary;
}

function missingScopeError(
  account: { platform: string; scopes: string | null },
  capability: { requiredScopes?: string[] },
): string | null {
  const required = capability.requiredScopes || [];
  if (required.length === 0) return null;
  if (!account.scopes) {
    return `Reconnect your ${account.platform} account to grant the permission this action needs on ${account.platform}.`;
  }
  const granted = account.scopes.split(/[\s,]+/).filter(Boolean);
  const missing = required.filter((scope) => !granted.includes(scope));
  if (missing.length === 0) return null;
  return `Reconnect your ${account.platform} account to grant the permission this action needs on ${account.platform}.`;
}

async function getActingAccountForSourcePost(
  userId: string,
  sourceAccount: { id: string; userId: string; platform: string; accessToken: string | null; scopes: string | null }
) {
  if (sourceAccount.userId === userId) return sourceAccount;

  return prisma.connectedAccount.findFirst({
    where: {
      userId,
      platform: sourceAccount.platform,
      isActive: true,
    },
  });
}


export async function deletePlatformPost(postId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const post = await prisma.platformPost.findUnique({
    where: { id: postId },
    include: { connectedAccount: true },
  });
  if (!post || post.connectedAccount.userId !== user.id) return { error: "Post not found" };

  const capability = getPlatformActionCapability(post.connectedAccount.platform, "delete");
  if (!capability.supported) return { error: capability.reason };
  const scopeError = missingScopeError(post.connectedAccount, capability);
  if (scopeError) return { error: scopeError };

  const accessToken = getStoredAccessToken(post.connectedAccount.accessToken);
  if (post.connectedAccount.accessToken && !accessToken) return { error: "Stored token is unreadable. Reconnect this platform account." };
  if (!accessToken) return { error: "No access token" };

  const adapter = getAdapter(post.connectedAccount.platform);
  const ok = await adapter.deletePost(accessToken, post.platformPostId);
  if (!ok) return { error: "Delete failed - platform may not support this action" };

  await prisma.platformPost.delete({ where: { id: postId } });
  return { success: true };
}

export async function crossPostContent(content: string, platforms: string[], mediaUrls?: string[], accountIds?: string[]) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const results: Record<string, { success: boolean; error?: string }> = {};

  // If account IDs are provided, use them directly; otherwise fall back to platform names
  if (accountIds && accountIds.length > 0) {
    for (const accountId of accountIds) {
      const account = await prisma.connectedAccount.findUnique({
        where: { id: accountId },
      });
      if (!account || account.userId !== user.id || !account.isActive) {
        results[accountId] = { success: false, error: "Account not found or inactive" };
        continue;
      }
      const capability = getPlatformActionCapability(account.platform, "cross-post");
      if (!capability.supported) {
        results[account.platformUsername || account.platform] = { success: false, error: capability.reason };
        continue;
      }
      const scopeError = missingScopeError(account, capability);
      if (scopeError) {
        results[account.platformUsername || account.platform] = { success: false, error: scopeError };
        continue;
      }
      const accessToken = getStoredAccessToken(account.accessToken);
      if (account.accessToken && !accessToken) {
        results[accountId] = { success: false, error: "Token encryption key is missing" };
        continue;
      }
      if (!accessToken) {
        results[accountId] = { success: false, error: "No access token" };
        continue;
      }
      try {
        const adapter = getAdapter(account.platform);
        const post = await adapter.createPost(accessToken, content, mediaUrls);
        if (post) {
          const safety = classifyContentSafety(content, post.title, post.content, post.rawMetadata);
          await prisma.platformPost.create({
            data: { connectedAccountId: account.id, ...post, ...safety, isFromMesh: true },
          });
          results[account.platformUsername || account.platform] = { success: true };
        } else {
          results[account.platformUsername || account.platform] = { success: false, error: "Platform API returned no result" };
        }
      } catch (err) {
        results[account.platformUsername || account.platform] = { success: false, error: err instanceof Error ? err.message : "Failed" };
      }
    }
    return { results };
  }

  for (const platform of platforms) {
    const account = await prisma.connectedAccount.findFirst({
      where: { userId: user.id, platform, isActive: true },
    });

      const capability = getPlatformActionCapability(platform, "cross-post");
      if (!capability.supported) {
        results[platform] = { success: false, error: capability.reason };
        continue;
      }
      const accessToken = getStoredAccessToken(account?.accessToken || null);
      if (!account) {
        results[platform] = { success: false, error: "Not connected or no access token" };
        continue;
      }
      const scopeError = missingScopeError(account, capability);
      if (scopeError) {
        results[platform] = { success: false, error: scopeError };
        continue;
      }
      if (account.accessToken && !accessToken) {
        results[platform] = { success: false, error: "Token encryption key is missing" };
        continue;
      }
      if (!accessToken) {
        results[platform] = { success: false, error: "No access token" };
        continue;
      }

    try {
      const adapter = getAdapter(platform);
      const post = await adapter.createPost(accessToken, content, mediaUrls);
      if (post) {
        const safety = classifyContentSafety(content, post.title, post.content, post.rawMetadata);
        await prisma.platformPost.create({
          data: {
            connectedAccountId: account.id,
            ...post,
            ...safety,
            isFromMesh: true,
          },
        });
        results[platform] = { success: true };
      } else {
        results[platform] = { success: false, error: "Platform API returned no result" };
      }
    } catch (err) {
      results[platform] = { success: false, error: err instanceof Error ? err.message : "Failed" };
    }
  }

  return { results };
}

// ─── Full Platform Control Actions ──────────────────────────

/** Edit an existing platform post's content */
export async function editPlatformPost(postId: string, content: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const post = await prisma.platformPost.findUnique({
    where: { id: postId },
    include: { connectedAccount: true },
  });
  if (!post || post.connectedAccount.userId !== user.id) return { error: "Post not found" };
  const capability = getPlatformActionCapability(post.connectedAccount.platform, "edit");
  if (!capability.supported) return { error: capability.reason };
  const scopeError = missingScopeError(post.connectedAccount, capability);
  if (scopeError) return { error: scopeError };
  const accessToken = getStoredAccessToken(post.connectedAccount.accessToken);
  if (!accessToken) return { error: "No access token" };

  const adapter = getAdapter(post.connectedAccount.platform);
  const ok = await adapter.editPost(accessToken, post.platformPostId, content);
  if (!ok) return { error: "Platform does not support editing or the request failed" };

  await prisma.platformPost.update({ where: { id: postId }, data: { content, ...classifyContentSafety(post.title, content, post.rawMetadata) } });
  return { success: true };
}

/** Like a platform post */
export async function likePlatformPost(postId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const post = await prisma.platformPost.findUnique({
    where: { id: postId },
    include: { connectedAccount: true },
  });
  if (!post) return { error: "Post not found" };

  const actingAccount = await getActingAccountForSourcePost(user.id, post.connectedAccount);
  if (!actingAccount) return { error: `Connect ${post.connectedAccount.platform} to like this post from Mesh.me.` };

  const capability = getPlatformActionCapability(actingAccount.platform, "like");
  if (!capability.supported) return { error: capability.reason };
  const scopeError = missingScopeError(actingAccount, capability);
  if (scopeError) return { error: scopeError };

  const accessToken = getStoredAccessToken(actingAccount.accessToken);
  if (actingAccount.accessToken && !accessToken) return { error: "Stored token is unreadable. Reconnect this platform account." };
  if (!accessToken) return { error: "No access token" };

  const adapter = getAdapter(actingAccount.platform);
  const ok = await adapter.likePost(accessToken, post.platformPostId);
  if (!ok) return { error: "Platform does not support liking or the request failed" };

  await prisma.platformPost.update({
    where: { id: postId },
    data: { likeCount: { increment: 1 } },
  });
  return { success: true };
}

/** Unlike a platform post */
export async function unlikePlatformPost(postId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const post = await prisma.platformPost.findUnique({
    where: { id: postId },
    include: { connectedAccount: true },
  });
  if (!post) return { error: "Post not found" };

  const actingAccount = await getActingAccountForSourcePost(user.id, post.connectedAccount);
  if (!actingAccount) return { error: `Connect ${post.connectedAccount.platform} to unlike this post from Mesh.me.` };

  const capability = getPlatformActionCapability(actingAccount.platform, "unlike");
  if (!capability.supported) return { error: capability.reason };
  const scopeError = missingScopeError(actingAccount, capability);
  if (scopeError) return { error: scopeError };

  const accessToken = getStoredAccessToken(actingAccount.accessToken);
  if (actingAccount.accessToken && !accessToken) return { error: "Stored token is unreadable. Reconnect this platform account." };
  if (!accessToken) return { error: "No access token" };

  const adapter = getAdapter(actingAccount.platform);
  const ok = await adapter.unlikePost(accessToken, post.platformPostId);
  if (!ok) return { error: "Platform does not support unliking or the request failed" };

  // Use atomic decrement, then clamp
  await prisma.platformPost.update({
    where: { id: postId },
    data: { likeCount: { decrement: 1 } },
  });
  // Clamp to 0 if it went negative
  await prisma.platformPost.updateMany({
    where: { id: postId, likeCount: { lt: 0 } },
    data: { likeCount: 0 },
  });
  return { success: true };
}

/** Follow a user on a connected platform */
export async function followPlatformUser(connectedAccountId: string, platformUserId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const account = await prisma.connectedAccount.findUnique({
    where: { id: connectedAccountId },
  });
  if (!account || account.userId !== user.id) return { error: "Account not found" };
  const capability = getPlatformActionCapability(account.platform, "follow");
  if (!capability.supported) return { error: capability.reason };
  const followScopeError = missingScopeError(account, capability);
  if (followScopeError) return { error: followScopeError };
  const accessToken = getStoredAccessToken(account.accessToken);
  if (!accessToken) return { error: "No access token" };

  const adapter = getAdapter(account.platform);
  const ok = await adapter.followUser(accessToken, platformUserId);
  if (!ok) return { error: "Follow failed — platform may not support this action" };

  // Update mutual status in our DB
  await prisma.platformFollower.updateMany({
    where: { connectedAccountId, platformUserId },
    data: { isMutual: true, relationshipType: "mutual" },
  });

  return { success: true };
}

/** Unfollow a user on a connected platform */
export async function unfollowPlatformUser(connectedAccountId: string, platformUserId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const account = await prisma.connectedAccount.findUnique({
    where: { id: connectedAccountId },
  });
  if (!account || account.userId !== user.id) return { error: "Account not found" };
  const capability = getPlatformActionCapability(account.platform, "unfollow");
  if (!capability.supported) return { error: capability.reason };
  const unfollowScopeError = missingScopeError(account, capability);
  if (unfollowScopeError) return { error: unfollowScopeError };
  const accessToken = getStoredAccessToken(account.accessToken);
  if (!accessToken) return { error: "No access token" };

  const adapter = getAdapter(account.platform);
  const ok = await adapter.unfollowUser(accessToken, platformUserId);
  if (!ok) return { error: "Unfollow failed — platform may not support this action" };

  await prisma.platformFollower.updateMany({
    where: { connectedAccountId, platformUserId },
    data: { isMutual: false, relationshipType: "follower" },
  });

  return { success: true };
}

/** Share / repost a platform post */
export async function sharePlatformPost(postId: string, comment?: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const post = await prisma.platformPost.findUnique({
    where: { id: postId },
    include: { connectedAccount: true },
  });
  if (!post) return { error: "Post not found" };

  const actingAccount = await getActingAccountForSourcePost(user.id, post.connectedAccount);
  if (!actingAccount) return { error: `Connect ${post.connectedAccount.platform} to share this post from Mesh.me.` };

  const capability = getPlatformActionCapability(actingAccount.platform, "share");
  if (!capability.supported) return { error: capability.reason };
  const scopeError = missingScopeError(actingAccount, capability);
  if (scopeError) return { error: scopeError };
  const accessToken = getStoredAccessToken(actingAccount.accessToken);
  if (!accessToken) return { error: "No access token" };

  const adapter = getAdapter(actingAccount.platform);
  const ok = await adapter.sharePost(accessToken, post.platformPostId, comment);
  if (!ok) return { error: "Share failed — platform may not support this action" };

  await prisma.platformPost.update({
    where: { id: postId },
    data: { shareCount: { increment: 1 } },
  });
  return { success: true };
}

/** Pin a platform post */
export async function pinPlatformPost(postId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const post = await prisma.platformPost.findUnique({
    where: { id: postId },
    include: { connectedAccount: true },
  });
  if (!post || post.connectedAccount.userId !== user.id) return { error: "Post not found" };
  const capability = getPlatformActionCapability(post.connectedAccount.platform, "pin");
  if (!capability.supported) return { error: capability.reason };
  const accessToken = getStoredAccessToken(post.connectedAccount.accessToken);
  if (!accessToken) return { error: "No access token" };

  const adapter = getAdapter(post.connectedAccount.platform);
  const ok = await adapter.pinPost(accessToken, post.platformPostId);
  if (!ok) return { error: "Pin failed — platform may not support this action" };

  await prisma.platformPost.update({
    where: { id: postId },
    data: { isPinned: true },
  });
  return { success: true };
}

/** Unpin a platform post */
export async function unpinPlatformPost(postId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const post = await prisma.platformPost.findUnique({
    where: { id: postId },
    include: { connectedAccount: true },
  });
  if (!post || post.connectedAccount.userId !== user.id) return { error: "Post not found" };
  const capability = getPlatformActionCapability(post.connectedAccount.platform, "unpin");
  if (!capability.supported) return { error: capability.reason };
  const accessToken = getStoredAccessToken(post.connectedAccount.accessToken);
  if (!accessToken) return { error: "No access token" };

  const adapter = getAdapter(post.connectedAccount.platform);
  const ok = await adapter.unpinPost(accessToken, post.platformPostId);
  if (!ok) return { error: "Unpin failed — platform may not support this action" };

  await prisma.platformPost.update({
    where: { id: postId },
    data: { isPinned: false },
  });
  return { success: true };
}

/** Update a platform post's visibility (public/private/unlisted) */
export async function updatePlatformPostVisibility(postId: string, visibility: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const post = await prisma.platformPost.findUnique({
    where: { id: postId },
    include: { connectedAccount: true },
  });
  if (!post || post.connectedAccount.userId !== user.id) return { error: "Post not found" };
  const capability = getPlatformActionCapability(post.connectedAccount.platform, "visibility");
  if (!capability.supported) return { error: capability.reason };
  const accessToken = getStoredAccessToken(post.connectedAccount.accessToken);
  if (!accessToken) return { error: "No access token" };

  const adapter = getAdapter(post.connectedAccount.platform);
  const ok = await adapter.updateVisibility(accessToken, post.platformPostId, visibility);
  if (!ok) return { error: "Visibility update failed — platform may not support this action" };

  await prisma.platformPost.update({
    where: { id: postId },
    data: { visibility },
  });
  return { success: true };
}

/** Reply to a comment on a platform post */
export async function replyToPlatformComment(postId: string, content: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const post = await prisma.platformPost.findUnique({
    where: { id: postId },
    include: { connectedAccount: true },
  });
  if (!post) return { error: "Post not found" };

  const actingAccount = await getActingAccountForSourcePost(user.id, post.connectedAccount);
  if (!actingAccount) return { error: `Connect ${post.connectedAccount.platform} to comment on this post from Mesh.me.` };

  const capability = getPlatformActionCapability(actingAccount.platform, "reply");
  if (!capability.supported) return { error: capability.reason };
  const scopeError = missingScopeError(actingAccount, capability);
  if (scopeError) return { error: scopeError };

  const accessToken = getStoredAccessToken(actingAccount.accessToken);
  if (!accessToken) return { error: "No access token" };

  const adapter = getAdapter(actingAccount.platform);
  const comment = await adapter.createComment(accessToken, post.platformPostId, content);

  if (comment) {
    await prisma.platformComment.create({
      data: {
        connectedAccountId: actingAccount.id,
        postId: post.id,
        ...comment,
        isOwnComment: true,
      },
    });
    return { success: true, comment };
  }

  return { error: "Failed to create comment on platform" };
}

/** Delete a synced platform comment */
export async function deletePlatformComment(commentId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const comment = await prisma.platformComment.findUnique({
    where: { id: commentId },
    include: { connectedAccount: true },
  });
  if (!comment || comment.connectedAccount.userId !== user.id) return { error: "Comment not found" };
  const capability = getPlatformActionCapability(comment.connectedAccount.platform, "delete-comment");
  if (!capability.supported) return { error: capability.reason };
  const scopeError = missingScopeError(comment.connectedAccount, capability);
  if (scopeError) return { error: scopeError };
  const accessToken = getStoredAccessToken(comment.connectedAccount.accessToken);
  if (!accessToken) return { error: "No access token" };

  const adapter = getAdapter(comment.connectedAccount.platform);
  const ok = await adapter.deleteComment(accessToken, comment.platformCommentId);
  if (!ok) return { error: "Delete comment failed — platform may not support this action" };

  await prisma.platformComment.delete({ where: { id: commentId } });
  return { success: true };
}

/** Get full post details including comments */
export async function getPlatformPostDetails(postId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const post = await prisma.platformPost.findUnique({
    where: { id: postId },
    include: {
      connectedAccount: { select: { platform: true, platformUsername: true, userId: true } },
      comments: {
        orderBy: { publishedAt: "desc" },
        take: 50,
      },
      media: true,
    },
  });
  if (!post || post.connectedAccount.userId !== user.id) return { error: "Post not found" };

  return { post };
}

/** Get connected account details with sync status */
export async function getConnectedAccountDetails(accountId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const account = await prisma.connectedAccount.findUnique({
    where: { id: accountId },
    include: {
      platformPosts: { orderBy: { publishedAt: "desc" }, take: 5 },
      platformFollowers: { orderBy: { followerCount: "desc" }, take: 10 },
      syncJobs: { orderBy: { createdAt: "desc" }, take: 5 },
      platformAnalytics: { orderBy: { date: "desc" }, take: 1 },
    },
  });
  if (!account || account.userId !== user.id) return { error: "Account not found" };

  return { account };
}
