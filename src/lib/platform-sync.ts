"use server";

import { prisma } from "./prisma";
import { getCurrentUser } from "./auth";

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
  createPost(accessToken: string, content: string, media?: string[]): Promise<PlatformPostData | null>;
  deletePost(accessToken: string, postId: string): Promise<boolean>;
  createComment(accessToken: string, postId: string, content: string): Promise<PlatformCommentData | null>;
  deleteComment(accessToken: string, commentId: string): Promise<boolean>;
}

// ─── GitHub Adapter ─────────────────────────────────────────

const githubAdapter: PlatformAdapter = {
  async fetchPosts(accessToken, cursor) {
    try {
      const page = cursor ? parseInt(cursor) : 1;
      const res = await fetch(`https://api.github.com/user/repos?sort=updated&per_page=30&page=${page}`, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github.v3+json" },
      });
      if (!res.ok) return { posts: [] };
      const repos = await res.json();
      const posts: PlatformPostData[] = repos.map((repo: Record<string, unknown>) => ({
        platformPostId: String(repo.id),
        content: (repo.description as string) || "",
        title: repo.full_name as string,
        url: repo.html_url as string,
        postType: "article",
        likeCount: (repo.stargazers_count as number) || 0,
        commentCount: (repo.open_issues_count as number) || 0,
        shareCount: (repo.forks_count as number) || 0,
        viewCount: (repo.watchers_count as number) || 0,
        visibility: repo.private ? "private" : "public",
        publishedAt: repo.created_at ? new Date(repo.created_at as string) : undefined,
        rawMetadata: JSON.stringify({ language: repo.language, topics: repo.topics }),
      }));
      return { posts, nextCursor: repos.length === 30 ? String(page + 1) : undefined };
    } catch { return { posts: [] }; }
  },
  async fetchComments(accessToken, postId) {
    try {
      const res = await fetch(`https://api.github.com/repositories/${postId}/issues?state=all&per_page=20`, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github.v3+json" },
      });
      if (!res.ok) return { comments: [] };
      const issues = await res.json();
      const comments: PlatformCommentData[] = issues.map((issue: Record<string, unknown>) => ({
        platformCommentId: `issue-${issue.id}`,
        platformPostId: postId,
        content: (issue.title as string) || "",
        authorName: (issue.user as Record<string, unknown>)?.login as string,
        authorUsername: (issue.user as Record<string, unknown>)?.login as string,
        authorAvatarUrl: (issue.user as Record<string, unknown>)?.avatar_url as string,
        isOwnComment: false,
        likeCount: (issue.reactions as Record<string, unknown>)?.total_count as number || 0,
        replyCount: (issue.comments as number) || 0,
        url: issue.html_url as string,
        publishedAt: issue.created_at ? new Date(issue.created_at as string) : undefined,
      }));
      return { comments };
    } catch { return { comments: [] }; }
  },
  async fetchFollowers(accessToken) {
    try {
      const res = await fetch("https://api.github.com/user/followers?per_page=100", {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github.v3+json" },
      });
      if (!res.ok) return { followers: [] };
      const users = await res.json();
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
  async fetchAnalytics(accessToken) {
    try {
      const res = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github.v3+json" },
      });
      if (!res.ok) return defaultAnalytics();
      const user = await res.json();
      return {
        date: new Date(),
        followerCount: user.followers || 0,
        followingCount: user.following || 0,
        postCount: user.public_repos || 0,
        totalLikes: 0, totalComments: 0, totalViews: 0, totalShares: 0,
        newFollowers: 0, lostFollowers: 0,
      };
    } catch { return defaultAnalytics(); }
  },
  async createPost() { return null; },
  async deletePost() { return false; },
  async createComment() { return null; },
  async deleteComment() { return false; },
};

// ─── YouTube Adapter ────────────────────────────────────────

const youtubeAdapter: PlatformAdapter = {
  async fetchPosts(accessToken) {
    try {
      const res = await fetch("https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return { posts: [] };
      const channelData = await res.json();
      const uploadsId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
      if (!uploadsId) return { posts: [] };

      const videosRes = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsId}&maxResults=50`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!videosRes.ok) return { posts: [] };
      const videosData = await videosRes.json();

      // Get video stats
      const videoIds = videosData.items?.map((v: Record<string, unknown>) => (v.contentDetails as Record<string, unknown>)?.videoId).filter(Boolean).join(",");
      const statsMap: Record<string, Record<string, unknown>> = {};
      if (videoIds) {
        const statsRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoIds}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          for (const item of statsData.items || []) {
            statsMap[item.id] = item.statistics || {};
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
          visibility: "public",
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
      const data = await res.json();
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
      const data = await res.json();
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
  async fetchAnalytics(accessToken) {
    try {
      const res = await fetch("https://www.googleapis.com/youtube/v3/channels?part=statistics&mine=true", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return defaultAnalytics();
      const data = await res.json();
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
  async deletePost() { return false; },
  async createComment() { return null; },
  async deleteComment() { return false; },
};

// ─── Twitter/X Adapter ──────────────────────────────────────

const twitterAdapter: PlatformAdapter = {
  async fetchPosts(accessToken) {
    try {
      const meRes = await fetch("https://api.twitter.com/2/users/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!meRes.ok) return { posts: [] };
      const meData = await meRes.json();
      const userId = meData.data?.id;
      if (!userId) return { posts: [] };

      const res = await fetch(`https://api.twitter.com/2/users/${userId}/tweets?max_results=100&tweet.fields=public_metrics,created_at`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return { posts: [] };
      const data = await res.json();
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
      const userId = (await meRes.json()).data?.id;
      if (!userId) return { followers: [] };

      const res = await fetch(`https://api.twitter.com/2/users/${userId}/followers?max_results=100&user.fields=profile_image_url,public_metrics`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return { followers: [] };
      const data = await res.json();
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
      const data = await res.json();
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
  async createPost() { return null; },
  async deletePost() { return false; },
  async createComment() { return null; },
  async deleteComment() { return false; },
};

// ─── Discord Adapter ────────────────────────────────────────

const discordAdapter: PlatformAdapter = {
  async fetchPosts(accessToken) {
    try {
      const res = await fetch("https://discord.com/api/v10/users/@me/guilds", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return { posts: [] };
      const guilds = await res.json();
      const posts: PlatformPostData[] = guilds.map((g: Record<string, unknown>) => ({
        platformPostId: g.id as string,
        title: g.name as string,
        content: `Server with ${(g.approximate_member_count as number) || 0} members`,
        url: `https://discord.com/channels/${g.id}`,
        postType: "text",
        likeCount: 0, commentCount: 0, shareCount: 0,
        viewCount: (g.approximate_member_count as number) || 0,
        visibility: "private",
        thumbnailUrl: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png` : undefined,
        rawMetadata: JSON.stringify({ features: g.features, owner: g.owner }),
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
};

// ─── Spotify Adapter ────────────────────────────────────────

const spotifyAdapter: PlatformAdapter = {
  async fetchPosts(accessToken) {
    try {
      const res = await fetch("https://api.spotify.com/v1/me/playlists?limit=50", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return { posts: [] };
      const data = await res.json();
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
      const data = await res.json();
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
};

// ─── Twitch Adapter ─────────────────────────────────────────

const twitchAdapter: PlatformAdapter = {
  async fetchPosts(accessToken) {
    try {
      // Get user first
      const userRes = await fetch("https://api.twitch.tv/helix/users", {
        headers: { Authorization: `Bearer ${accessToken}`, "Client-Id": process.env.TWITCH_CLIENT_ID || "" },
      });
      if (!userRes.ok) return { posts: [] };
      const userData = await userRes.json();
      const userId = userData.data?.[0]?.id;
      if (!userId) return { posts: [] };

      // Get videos (VODs, highlights, uploads)
      const res = await fetch(`https://api.twitch.tv/helix/videos?user_id=${userId}&first=50`, {
        headers: { Authorization: `Bearer ${accessToken}`, "Client-Id": process.env.TWITCH_CLIENT_ID || "" },
      });
      if (!res.ok) return { posts: [] };
      const data = await res.json();
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
      const userRes = await fetch("https://api.twitch.tv/helix/users", {
        headers: { Authorization: `Bearer ${accessToken}`, "Client-Id": process.env.TWITCH_CLIENT_ID || "" },
      });
      if (!userRes.ok) return { followers: [] };
      const userId = (await userRes.json()).data?.[0]?.id;
      if (!userId) return { followers: [] };

      const res = await fetch(`https://api.twitch.tv/helix/channels/followers?broadcaster_id=${userId}&first=100`, {
        headers: { Authorization: `Bearer ${accessToken}`, "Client-Id": process.env.TWITCH_CLIENT_ID || "" },
      });
      if (!res.ok) return { followers: [] };
      const data = await res.json();
      const followers: PlatformFollowerData[] = (data.data || []).map((f: Record<string, unknown>) => ({
        platformUserId: f.user_id as string,
        username: f.user_login as string,
        displayName: f.user_name as string,
        isMutual: false,
        relationshipType: "follower",
        profileUrl: `https://twitch.tv/${f.user_login}`,
      }));
      return { followers };
    } catch { return { followers: [] }; }
  },
  async fetchMedia() { return { media: [] }; },
  async fetchAnalytics(accessToken) {
    try {
      const res = await fetch("https://api.twitch.tv/helix/users", {
        headers: { Authorization: `Bearer ${accessToken}`, "Client-Id": process.env.TWITCH_CLIENT_ID || "" },
      });
      if (!res.ok) return defaultAnalytics();
      const user = (await res.json()).data?.[0] || {};
      return {
        date: new Date(),
        followerCount: 0, followingCount: 0,
        postCount: 0,
        totalLikes: 0, totalComments: 0,
        totalViews: user.view_count || 0,
        totalShares: 0, newFollowers: 0, lostFollowers: 0,
      };
    } catch { return defaultAnalytics(); }
  },
  async createPost() { return null; },
  async deletePost() { return false; },
  async createComment() { return null; },
  async deleteComment() { return false; },
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
      const data = await res.json();
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
};

// ─── Generic / Manual Adapter (SoundCloud, Threads, Bluesky) ──

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
  soundcloud: manualAdapter,
  threads: manualAdapter,
  bluesky: manualAdapter,
  instagram: manualAdapter,
  linkedin: manualAdapter,
  reddit: manualAdapter,
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

// ─── Sync Engine ────────────────────────────────────────────

export async function syncPlatform(connectedAccountId: string, syncType: "full" | "posts" | "comments" | "followers" | "analytics" = "full") {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const account = await prisma.connectedAccount.findUnique({
    where: { id: connectedAccountId },
  });
  if (!account || account.userId !== user.id) return { error: "Account not found" };
  if (!account.accessToken) return { error: "No access token — reconnect this platform" };

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

    // Sync posts
    if (syncType === "full" || syncType === "posts") {
      let cursor: string | undefined;
      let page = 0;
      do {
        const result = await adapter.fetchPosts(account.accessToken, cursor);
        for (const post of result.posts) {
          await prisma.platformPost.upsert({
            where: {
              connectedAccountId_platformPostId: {
                connectedAccountId: account.id,
                platformPostId: post.platformPostId,
              },
            },
            create: { connectedAccountId: account.id, ...post },
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
            },
          });
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
    }

    // Sync followers
    if (syncType === "full" || syncType === "followers") {
      const result = await adapter.fetchFollowers(account.accessToken);
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
          },
        });
        itemsSynced++;
      }
    }

    // Sync analytics
    if (syncType === "full" || syncType === "analytics") {
      const analytics = await adapter.fetchAnalytics(account.accessToken);
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

export async function syncComments(connectedAccountId: string, platformPostId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const account = await prisma.connectedAccount.findUnique({
    where: { id: connectedAccountId },
  });
  if (!account || account.userId !== user.id) return { error: "Account not found" };
  if (!account.accessToken) return { error: "No access token" };

  const post = await prisma.platformPost.findFirst({
    where: { connectedAccountId: account.id, platformPostId },
  });
  if (!post) return { error: "Post not found" };

  try {
    const adapter = getAdapter(account.platform);
    const result = await adapter.fetchComments(account.accessToken, platformPostId);

    for (const comment of result.comments) {
      await prisma.platformComment.upsert({
        where: {
          connectedAccountId_platformCommentId: {
            connectedAccountId: account.id,
            platformCommentId: comment.platformCommentId,
          },
        },
        create: { connectedAccountId: account.id, postId: post.id, ...comment },
        update: {
          content: comment.content,
          likeCount: comment.likeCount,
          replyCount: comment.replyCount,
        },
      });
    }

    await prisma.platformPost.update({
      where: { id: post.id },
      data: { commentsImported: true },
    });

    return { success: true, count: result.comments.length };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to sync comments" };
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

export async function getSyncJobs(connectedAccountId?: string) {
  const user = await getCurrentUser();
  if (!user) return [];

  const accounts = await prisma.connectedAccount.findMany({
    where: { userId: user.id, ...(connectedAccountId ? { id: connectedAccountId } : {}) },
    select: { id: true },
  });

  const jobs = await prisma.syncJob.findMany({
    where: { connectedAccountId: { in: accounts.map((a) => a.id) } },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      connectedAccount: { select: { platform: true } },
    },
  });

  return jobs;
}

export async function deletePlatformPost(postId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const post = await prisma.platformPost.findUnique({
    where: { id: postId },
    include: { connectedAccount: true },
  });
  if (!post || post.connectedAccount.userId !== user.id) return { error: "Post not found" };

  // Try to delete from platform too
  if (post.connectedAccount.accessToken) {
    const adapter = getAdapter(post.connectedAccount.platform);
    await adapter.deletePost(post.connectedAccount.accessToken, post.platformPostId);
  }

  // Delete from our DB
  await prisma.platformPost.delete({ where: { id: postId } });
  return { success: true };
}

export async function crossPostContent(content: string, platforms: string[], mediaUrls?: string[]) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const results: Record<string, { success: boolean; error?: string }> = {};

  for (const platform of platforms) {
    const account = await prisma.connectedAccount.findUnique({
      where: { userId_platform: { userId: user.id, platform } },
    });

    if (!account || !account.accessToken) {
      results[platform] = { success: false, error: "Not connected or no access token" };
      continue;
    }

    try {
      const adapter = getAdapter(platform);
      const post = await adapter.createPost(account.accessToken, content, mediaUrls);
      if (post) {
        await prisma.platformPost.create({
          data: {
            connectedAccountId: account.id,
            ...post,
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
