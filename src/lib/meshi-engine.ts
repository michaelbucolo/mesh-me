"use server";

import { prisma } from "./prisma";
import { getCurrentUser } from "./auth";
import { rateLimit } from "./security";

/**
 * Meshi Query Engine
 *
 * Server-side intelligence layer that queries the database to answer
 * natural language questions about the user's mesh. Meshi indexes
 * connections, posts, platforms, communities, and cross-platform content
 * to provide real, data-backed answers.
 */

// ─── Intent Detection ─────────────────────────────────────────

type QueryIntent =
  | { type: "person_lookup"; name: string }
  | { type: "person_posts"; name: string }
  | { type: "shared_posts"; name: string }
  | { type: "post_search"; topic: string }
  | { type: "post_count"; name?: string }
  | { type: "last_post"; topic?: string }
  | { type: "follower_count" }
  | { type: "following_count" }
  | { type: "mutual_connections" }
  | { type: "platform_summary" }
  | { type: "platform_content"; platform: string }
  | { type: "community_list" }
  | { type: "mesh_summary" }
  | { type: "interest_list" }
  | { type: "send_message"; recipient: string; message: string }
  | { type: "recent_activity" }
  | { type: "who_active" }
  | { type: "content_stats" }
  | { type: "unknown"; query: string };

const PLATFORM_NAMES = [
  "instagram", "youtube", "tiktok", "twitter", "x", "twitch",
  "spotify", "soundcloud", "linkedin", "github", "discord",
  "snapchat", "pinterest", "reddit", "facebook", "threads", "bluesky",
];

function detectIntent(query: string): QueryIntent {
  const q = query.toLowerCase().trim().replace(/[?!.]+$/, "");
  const original = query.trim();

  // ── Send message intent ──
  // Require explicit messaging syntax: "send @user: message", "dm user that message", "message user: text"
  // Exclude common false positives like "tell me about", "send me a", "let me know"
  // Match against lowercased string for detection, but extract message from original to preserve casing
  const SELF_WORDS = ["me", "my", "i", "myself"];
  const msgMatchLower = q.match(/(?:send|message|dm)\s+@?(\w+)\s*[:]\s*(.+)/i)
    || q.match(/(?:let|tell)\s+(\w+)\s+(?:know|that)\s+(.+)/i)
    || q.match(/(?:send|message|dm)\s+@?(\w+)\s+that\s+(.+)/i);
  if (msgMatchLower && msgMatchLower[1] && msgMatchLower[2] && msgMatchLower[2].length > 2) {
    const recipientWord = msgMatchLower[1].toLowerCase();
    if (!SELF_WORDS.includes(recipientWord)) {
      // Re-match against original string to preserve casing and punctuation
      const msgMatchOriginal = original.match(/(?:send|message|dm)\s+@?(\w+)\s*[:]\s*(.+)/i)
        || original.match(/(?:let|tell)\s+(\w+)\s+(?:know|that)\s+(.+)/i)
        || original.match(/(?:send|message|dm)\s+@?(\w+)\s+that\s+(.+)/i);
      const preservedMessage = msgMatchOriginal?.[2] || msgMatchLower[2];
      return { type: "send_message", recipient: msgMatchLower[1], message: preservedMessage };
    }
  }

  // ── Shared posts ──
  const sharedMatch = q.match(/(?:posts?|photos?|pictures?)\s+(?:with|together|featuring|including)\s+(\w+)/i)
    || q.match(/(?:do (?:we|i)|have (?:we|i))\s+(?:have\s+)?(?:any\s+)?posts?\s+(?:with|together|featuring)\s*(\w*)/i)
    || q.match(/(\w+)\s+and (?:i|me)\s+(?:have\s+)?(?:any\s+)?posts?\s+together/i);
  if (sharedMatch) {
    return { type: "shared_posts", name: sharedMatch[1] || "" };
  }

  // ── Person's posts ──
  const personPostsMatch = q.match(/how many (?:posts?|times?)\s+(?:has|have|does|did|is)\s+(?:@)?(\w+)\s+(?:post|appear|been|made|seen)/i)
    || q.match(/(?:@)?(\w+)(?:'s)?\s+posts?/i)
    || q.match(/posts?\s+(?:by|from|of)\s+(?:@)?(\w+)/i);
  if (personPostsMatch && personPostsMatch[1]) {
    const name = personPostsMatch[1].toLowerCase();
    const skip = ["my", "i", "me", "the", "a", "an", "all", "many", "much", "some"];
    if (!skip.includes(name)) {
      return { type: "person_posts", name };
    }
  }

  // ── Person lookup ──
  const personMatch = q.match(/(?:who is|who's|tell me about|info on|look up|do (?:i|you) (?:know|follow))\s+(?:@)?(.+)/i)
    || q.match(/(?:is|has)\s+(?:@)?(\w+)\s+(?:on|in)\s+(?:my\s+)?mesh/i)
    || q.match(/(?:find|search for|look for)\s+(?:@)?(\w+)/i);
  if (personMatch) {
    const name = personMatch[1].replace(/[?!.]+$/, "").trim();
    const featureWords = ["mesh", "feed", "mechat", "settings", "profile", "meshi", "privacy", "security", "meshpro"];
    if (name && !featureWords.some(fw => name.toLowerCase().includes(fw))) {
      return { type: "person_lookup", name };
    }
  }

  // ── Post search by topic ──
  const topicMatch = q.match(/(?:last time|when did)\s+(?:i|we)\s+(?:post|posted|share|shared)\s+(?:about\s+)?(.+)/i);
  if (topicMatch) {
    return { type: "last_post", topic: topicMatch[1].trim() };
  }

  const postSearchMatch = q.match(/(?:posts?|content)\s+(?:about|mentioning|related to|with|containing)\s+(.+)/i);
  if (postSearchMatch) {
    return { type: "post_search", topic: postSearchMatch[1].trim() };
  }

  // ── Counts ──
  if (q.includes("how many") && (q.includes("follower") || q.includes("people follow me"))) {
    return { type: "follower_count" };
  }
  if (q.includes("how many") && (q.includes("following") || q.includes("do i follow") || q.includes("people i follow"))) {
    return { type: "following_count" };
  }
  if (q.includes("how many") && q.includes("post")) {
    return { type: "post_count" };
  }
  if (q.includes("mutual") || (q.includes("follow") && q.includes("each other"))) {
    return { type: "mutual_connections" };
  }

  // ── Platform queries ──
  for (const platform of PLATFORM_NAMES) {
    if (q.includes(platform)) {
      if (q.includes("content") || q.includes("posts") || q.includes("videos") || q.includes("photos")) {
        return { type: "platform_content", platform };
      }
    }
  }
  if (q.includes("platform") || q.includes("connected") || q.includes("linked")) {
    return { type: "platform_summary" };
  }

  // ── Community ──
  if (q.includes("communit") || q.includes("group")) {
    return { type: "community_list" };
  }

  // ── Interests ──
  if (q.includes("interest") || q.includes("hobby") || q.includes("tag")) {
    return { type: "interest_list" };
  }

  // ── Activity ──
  if (q.includes("recent") || q.includes("latest") || q.includes("what's new") || q.includes("activity")) {
    return { type: "recent_activity" };
  }
  if (q.includes("who") && (q.includes("online") || q.includes("active") || q.includes("around"))) {
    return { type: "who_active" };
  }

  // ── Content stats ──
  if (q.includes("stats") || q.includes("analytics") || q.includes("engagement") || q.includes("views") || q.includes("likes")) {
    return { type: "content_stats" };
  }

  // ── Summary ──
  if (q.includes("summary") || q.includes("overview") || q.includes("tell me about my mesh") || q.includes("what do you know")) {
    return { type: "mesh_summary" };
  }

  return { type: "unknown", query: q };
}

// ─── Query Executors ──────────────────────────────────────────

interface MeshiAnswer {
  content: string;
  mood: string;
  action?: { type: string; recipient?: string; message?: string };
}

async function lookupPerson(name: string): Promise<MeshiAnswer> {
  const user = await getCurrentUser();
  if (!user) return { content: "I need you to be logged in to search your mesh!", mood: "thinking" };

  const searchTerm = name.toLowerCase().replace(/^@/, "");

  // Search in followed users
  const follows = await prisma.follow.findMany({
    where: { followerId: user.id },
    include: {
      following: {
        select: {
          id: true, username: true, displayName: true, bio: true,
          avatarUrl: true, isVerified: true, status: true, lastSeenAt: true,
          _count: { select: { followers: true, following: true, posts: true } },
        },
      },
    },
  });

  const found = follows.find(f =>
    f.following.username.toLowerCase().includes(searchTerm) ||
    f.following.displayName.toLowerCase().includes(searchTerm)
  );

  if (found) {
    const u = found.following;
    // Check if mutual
    const isMutual = await prisma.follow.findFirst({
      where: { followerId: u.id, followingId: user.id },
    });

    const parts = [`${u.displayName} (@${u.username}) is on your mesh!`];
    if (isMutual) parts.push("You follow each other.");
    else parts.push("You follow them.");
    if (u.bio) parts.push(`Bio: "${u.bio}"`);
    parts.push(`${u._count.followers} followers, ${u._count.following} following, ${u._count.posts} posts.`);
    if (u.isVerified) parts.push("They're verified!");
    if (u.status === "online") parts.push("They're online right now!");
    else if (u.lastSeenAt) {
      const ago = getTimeAgo(u.lastSeenAt);
      parts.push(`Last seen ${ago}.`);
    }

    return { content: parts.join(" "), mood: "excited" };
  }

  // Search all users (not just followed)
  const globalSearch = await prisma.user.findFirst({
    where: {
      OR: [
        { username: { contains: searchTerm } },
        { displayName: { contains: searchTerm } },
      ],
      isSuspended: false,
    },
    select: { id: true, username: true, displayName: true, isVerified: true, _count: { select: { followers: true } } },
  });

  if (globalSearch) {
    return {
      content: `I found ${globalSearch.displayName} (@${globalSearch.username}) on mesh.me, but they're not on your mesh yet. They have ${globalSearch._count.followers} followers.${globalSearch.isVerified ? " They're verified!" : ""} Want to follow them?`,
      mood: "thinking",
    };
  }

  return {
    content: `I can't find "${name}" anywhere on mesh.me. They might not have an account yet, or they might go by a different name.`,
    mood: "thinking",
  };
}

async function getSharedPosts(name: string): Promise<MeshiAnswer> {
  const user = await getCurrentUser();
  if (!user) return { content: "I need you to be logged in!", mood: "thinking" };

  const searchTerm = name.toLowerCase().replace(/^@/, "");

  // Find the other user
  const otherUser = await prisma.user.findFirst({
    where: {
      OR: [
        { username: { contains: searchTerm } },
        { displayName: { contains: searchTerm } },
      ],
    },
    select: { id: true, username: true, displayName: true },
  });

  if (!otherUser) {
    return { content: `I can't find "${name}" on mesh.me. Make sure you have the right name!`, mood: "thinking" };
  }

  // Find posts where either user tagged/mentioned the other, or where both commented
  const [myPostsCommentedByThem, theirPostsCommentedByMe] = await Promise.all([
    prisma.post.findMany({
      where: {
        authorId: user.id,
        comments: { some: { authorId: otherUser.id } },
      },
      select: { id: true, content: true, createdAt: true },
      take: 10,
    }),
    prisma.post.findMany({
      where: {
        authorId: otherUser.id,
        comments: { some: { authorId: user.id } },
      },
      select: { id: true, content: true, createdAt: true },
      take: 10,
    }),
  ]);

  // Also check for posts where content mentions the other user
  const mentionPosts = await prisma.post.findMany({
    where: {
      authorId: user.id,
      content: { contains: otherUser.username },
    },
    select: { id: true, content: true, createdAt: true },
    take: 10,
  });

  const totalInteractions = myPostsCommentedByThem.length + theirPostsCommentedByMe.length + mentionPosts.length;

  if (totalInteractions === 0) {
    return {
      content: `I don't see any shared posts or interactions between you and ${otherUser.displayName} (@${otherUser.username}) yet. You could post something together or comment on each other's posts to build that connection!`,
      mood: "thinking",
    };
  }

  const parts = [`Here's what I found between you and ${otherUser.displayName}:`];
  if (myPostsCommentedByThem.length > 0) parts.push(`They commented on ${myPostsCommentedByThem.length} of your posts.`);
  if (theirPostsCommentedByMe.length > 0) parts.push(`You commented on ${theirPostsCommentedByMe.length} of their posts.`);
  if (mentionPosts.length > 0) parts.push(`You mentioned them in ${mentionPosts.length} posts.`);

  return { content: parts.join(" "), mood: "excited" };
}

async function getPersonPosts(name: string): Promise<MeshiAnswer> {
  const user = await getCurrentUser();
  if (!user) return { content: "I need you to be logged in!", mood: "thinking" };

  const searchTerm = name.toLowerCase().replace(/^@/, "");

  const person = await prisma.user.findFirst({
    where: {
      OR: [
        { username: { contains: searchTerm } },
        { displayName: { contains: searchTerm } },
      ],
    },
    select: {
      id: true, username: true, displayName: true,
      _count: { select: { posts: true, comments: true } },
    },
  });

  if (!person) {
    return { content: `I can't find "${name}" on mesh.me.`, mood: "thinking" };
  }

  // Get their recent posts
  const recentPosts = await prisma.post.findMany({
    where: { authorId: person.id },
    select: { content: true, createdAt: true, _count: { select: { reactions: true, comments: true } } },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const parts = [`${person.displayName} (@${person.username}) has ${person._count.posts} posts and ${person._count.comments} comments on mesh.me.`];
  if (recentPosts.length > 0) {
    const latest = recentPosts[0];
    const preview = latest.content.length > 60 ? latest.content.slice(0, 60) + "..." : latest.content;
    parts.push(`Latest post: "${preview}" (${getTimeAgo(latest.createdAt)}, ${latest._count.reactions} reactions)`);
  }

  return { content: parts.join(" "), mood: "excited" };
}

async function searchPosts(topic: string): Promise<MeshiAnswer> {
  const user = await getCurrentUser();
  if (!user) return { content: "I need you to be logged in!", mood: "thinking" };

  const posts = await prisma.post.findMany({
    where: {
      OR: [
        { content: { contains: topic } },
        { tags: { some: { tag: { contains: topic } } } },
      ],
      author: {
        OR: [
          { id: user.id },
          { followers: { some: { followerId: user.id } } },
        ],
      },
    },
    include: {
      author: { select: { username: true, displayName: true } },
      _count: { select: { reactions: true, comments: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  if (posts.length === 0) {
    return { content: `I couldn't find any posts about "${topic}" on your mesh. Try a different search term!`, mood: "thinking" };
  }

  const parts = [`Found ${posts.length} post${posts.length > 1 ? "s" : ""} about "${topic}":`];
  for (const post of posts.slice(0, 3)) {
    const preview = post.content.length > 50 ? post.content.slice(0, 50) + "..." : post.content;
    parts.push(`- "${preview}" by @${post.author.username} (${getTimeAgo(post.createdAt)})`);
  }

  return { content: parts.join("\n"), mood: "excited" };
}

async function getLastPost(topic?: string): Promise<MeshiAnswer> {
  const user = await getCurrentUser();
  if (!user) return { content: "I need you to be logged in!", mood: "thinking" };

  const where: Record<string, unknown> = { authorId: user.id };
  if (topic) {
    where.OR = [
      { content: { contains: topic } },
      { tags: { some: { tag: { contains: topic } } } },
    ];
  }

  const post = await prisma.post.findFirst({
    where,
    include: {
      _count: { select: { reactions: true, comments: true } },
      tags: true,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!post) {
    return {
      content: topic
        ? `I can't find any of your posts about "${topic}". Maybe you haven't posted about it yet!`
        : "You haven't posted anything on mesh.me yet. Time to share something!",
      mood: "thinking",
    };
  }

  const preview = post.content.length > 80 ? post.content.slice(0, 80) + "..." : post.content;
  const tags = post.tags.map(t => `#${t.tag}`).join(" ");

  return {
    content: `Your ${topic ? `last post about "${topic}"` : "most recent post"} was ${getTimeAgo(post.createdAt)}: "${preview}"${tags ? ` ${tags}` : ""}. It got ${post._count.reactions} reactions and ${post._count.comments} comments.`,
    mood: "happy",
  };
}

async function getFollowerCount(): Promise<MeshiAnswer> {
  const user = await getCurrentUser();
  if (!user) return { content: "I need you to be logged in!", mood: "thinking" };

  const count = await prisma.follow.count({ where: { followingId: user.id } });

  // Get recent followers
  const recent = await prisma.follow.findMany({
    where: { followingId: user.id },
    include: { follower: { select: { displayName: true, username: true } } },
    orderBy: { createdAt: "desc" },
    take: 3,
  });

  const recentNames = recent.map(f => f.follower.displayName).join(", ");

  return {
    content: `You have ${count} follower${count !== 1 ? "s" : ""}!${recent.length > 0 ? ` Recent: ${recentNames}.` : ""}`,
    mood: count > 0 ? "excited" : "thinking",
  };
}

async function getFollowingCount(): Promise<MeshiAnswer> {
  const user = await getCurrentUser();
  if (!user) return { content: "I need you to be logged in!", mood: "thinking" };

  const count = await prisma.follow.count({ where: { followerId: user.id } });

  return {
    content: `You're following ${count} ${count === 1 ? "person" : "people"}!`,
    mood: count > 0 ? "happy" : "thinking",
  };
}

async function getMutualConnections(): Promise<MeshiAnswer> {
  const user = await getCurrentUser();
  if (!user) return { content: "I need you to be logged in!", mood: "thinking" };

  const following = await prisma.follow.findMany({
    where: { followerId: user.id },
    select: { followingId: true },
  });
  const followingIds = following.map(f => f.followingId);

  const mutuals = await prisma.follow.findMany({
    where: {
      followerId: { in: followingIds },
      followingId: user.id,
    },
    include: { follower: { select: { displayName: true, username: true } } },
  });

  if (mutuals.length === 0) {
    return { content: "You don't have any mutual connections yet. Follow more people and they might follow you back!", mood: "thinking" };
  }

  const names = mutuals.slice(0, 5).map(m => `${m.follower.displayName} (@${m.follower.username})`);
  return {
    content: `You have ${mutuals.length} mutual connection${mutuals.length !== 1 ? "s" : ""}! ${names.join(", ")}${mutuals.length > 5 ? ` and ${mutuals.length - 5} more.` : "."}`,
    mood: "love",
  };
}

async function getPlatformSummary(): Promise<MeshiAnswer> {
  const user = await getCurrentUser();
  if (!user) return { content: "I need you to be logged in!", mood: "thinking" };

  const accounts = await prisma.connectedAccount.findMany({
    where: { userId: user.id, isActive: true },
    select: {
      platform: true, platformUsername: true, lastSyncAt: true, syncStatus: true,
      _count: { select: { platformPosts: true, platformFollowers: true } },
    },
  });

  if (accounts.length === 0) {
    return { content: "You don't have any platforms connected yet! Go to Connected Accounts to link Instagram, YouTube, TikTok, and more.", mood: "thinking" };
  }

  const parts = [`You have ${accounts.length} platform${accounts.length !== 1 ? "s" : ""} connected:`];
  for (const acc of accounts) {
    const username = acc.platformUsername ? ` (@${acc.platformUsername})` : "";
    const posts = acc._count.platformPosts > 0 ? `, ${acc._count.platformPosts} posts synced` : "";
    parts.push(`- ${acc.platform}${username}${posts}`);
  }

  return { content: parts.join("\n"), mood: "excited" };
}

async function getPlatformContent(platform: string): Promise<MeshiAnswer> {
  const user = await getCurrentUser();
  if (!user) return { content: "I need you to be logged in!", mood: "thinking" };

  const account = await prisma.connectedAccount.findFirst({
    where: { userId: user.id, platform: { contains: platform }, isActive: true },
    include: {
      platformPosts: {
        orderBy: { publishedAt: "desc" },
        take: 5,
        select: {
          title: true, content: true, postType: true, publishedAt: true,
          likeCount: true, commentCount: true, viewCount: true, shareCount: true,
        },
      },
      _count: { select: { platformPosts: true, platformFollowers: true } },
    },
  });

  if (!account) {
    return { content: `You don't have ${platform} connected. Go to Connected Accounts to link it!`, mood: "thinking" };
  }

  if (account._count.platformPosts === 0) {
    return { content: `Your ${platform} account is connected but no content has been synced yet. Hit sync to pull in your posts!`, mood: "thinking" };
  }

  const parts = [`Your ${platform} has ${account._count.platformPosts} synced posts.`];
  if (account.platformPosts.length > 0) {
    parts.push("Recent:");
    for (const post of account.platformPosts.slice(0, 3)) {
      const title = post.title || (post.content ? post.content.slice(0, 40) + "..." : post.postType);
      const engagement = [
        post.likeCount > 0 ? `${post.likeCount} likes` : "",
        post.viewCount > 0 ? `${post.viewCount} views` : "",
        post.commentCount > 0 ? `${post.commentCount} comments` : "",
      ].filter(Boolean).join(", ");
      parts.push(`- "${title}" (${engagement || "no engagement data"})`);
    }
  }

  return { content: parts.join("\n"), mood: "excited" };
}

async function getCommunityList(): Promise<MeshiAnswer> {
  const user = await getCurrentUser();
  if (!user) return { content: "I need you to be logged in!", mood: "thinking" };

  const memberships = await prisma.communityMember.findMany({
    where: { userId: user.id },
    include: {
      community: {
        select: { name: true, slug: true, description: true, _count: { select: { members: true, posts: true } } },
      },
    },
  });

  if (memberships.length === 0) {
    return { content: "You're not part of any communities yet! Check out the Communities page to discover and join some.", mood: "thinking" };
  }

  const parts = [`You're in ${memberships.length} communit${memberships.length !== 1 ? "ies" : "y"}:`];
  for (const m of memberships) {
    parts.push(`- ${m.community.name} (${m.community._count.members} members, ${m.community._count.posts} posts)${m.role !== "member" ? ` — ${m.role}` : ""}`);
  }

  return { content: parts.join("\n"), mood: "happy" };
}

async function getInterestList(): Promise<MeshiAnswer> {
  const user = await getCurrentUser();
  if (!user) return { content: "I need you to be logged in!", mood: "thinking" };

  const interests = await prisma.userInterest.findMany({ where: { userId: user.id } });

  if (interests.length === 0) {
    return { content: "You haven't set any interests yet! Go to Settings > Interests to add some. They help me understand what content you'd enjoy.", mood: "thinking" };
  }

  return {
    content: `Your interests: ${interests.map(i => i.tag).join(", ")}. These help shape your feed and mesh connections!`,
    mood: "happy",
  };
}

async function getMeshSummary(): Promise<MeshiAnswer> {
  const user = await getCurrentUser();
  if (!user) return { content: "I need you to be logged in!", mood: "thinking" };

  const [followers, following, posts, communities, platforms, interests, savedPosts] = await Promise.all([
    prisma.follow.count({ where: { followingId: user.id } }),
    prisma.follow.count({ where: { followerId: user.id } }),
    prisma.post.count({ where: { authorId: user.id } }),
    prisma.communityMember.count({ where: { userId: user.id } }),
    prisma.connectedAccount.count({ where: { userId: user.id, isActive: true } }),
    prisma.userInterest.count({ where: { userId: user.id } }),
    prisma.savedPost.count({ where: { userId: user.id } }),
  ]);

  // Get cross-platform content stats
  const platformPosts = await prisma.platformPost.count({
    where: { connectedAccount: { userId: user.id } },
  });

  const totalContent = posts + platformPosts;

  const parts = [
    `Here's your mesh at a glance:`,
    `${followers} followers, following ${following} people`,
    `${posts} mesh.me posts${platformPosts > 0 ? ` + ${platformPosts} synced from connected platforms (${totalContent} total content pieces)` : ""}`,
    `${communities} communities, ${platforms} connected platforms, ${interests} interests`,
    `${savedPosts} saved posts`,
  ];

  // Account age
  const accountAge = getTimeAgo(user.createdAt);
  parts.push(`Account created ${accountAge}.`);

  if (user.isMeshPro) parts.push("MeshPro member!");

  return { content: parts.join("\n"), mood: "excited" };
}

async function getRecentActivity(): Promise<MeshiAnswer> {
  const user = await getCurrentUser();
  if (!user) return { content: "I need you to be logged in!", mood: "thinking" };

  const [recentPosts, recentComments, recentFollowers, recentNotifs] = await Promise.all([
    prisma.post.findMany({
      where: { authorId: user.id },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { content: true, createdAt: true, _count: { select: { reactions: true, comments: true } } },
    }),
    prisma.comment.findMany({
      where: { authorId: user.id },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { content: true, createdAt: true },
    }),
    prisma.follow.findMany({
      where: { followingId: user.id },
      orderBy: { createdAt: "desc" },
      take: 3,
      include: { follower: { select: { displayName: true } } },
    }),
    prisma.notification.count({ where: { recipientId: user.id, read: false } }),
  ]);

  const parts = ["Here's your recent activity:"];
  if (recentNotifs > 0) parts.push(`${recentNotifs} unread notifications.`);
  if (recentFollowers.length > 0) {
    parts.push(`New followers: ${recentFollowers.map(f => f.follower.displayName).join(", ")}.`);
  }
  if (recentPosts.length > 0) {
    const latest = recentPosts[0];
    parts.push(`Latest post (${getTimeAgo(latest.createdAt)}): ${latest._count.reactions} reactions, ${latest._count.comments} comments.`);
  }
  if (recentComments.length > 0) {
    parts.push(`You left ${recentComments.length} recent comments.`);
  }

  return { content: parts.join("\n"), mood: "happy" };
}

async function getWhoActive(): Promise<MeshiAnswer> {
  const user = await getCurrentUser();
  if (!user) return { content: "I need you to be logged in!", mood: "thinking" };

  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);

  // Find followed users who are online or recently active
  const activeUsers = await prisma.user.findMany({
    where: {
      followers: { some: { followerId: user.id } },
      OR: [
        { status: "online" },
        { lastSeenAt: { gte: fiveMinAgo } },
      ],
    },
    select: { displayName: true, username: true, status: true },
    take: 10,
  });

  if (activeUsers.length === 0) {
    return { content: "None of your connections are active right now. Check back later!", mood: "sleepy" };
  }

  const names = activeUsers.map(u => `${u.displayName} (@${u.username})`);
  return {
    content: `${activeUsers.length} ${activeUsers.length === 1 ? "person is" : "people are"} active right now: ${names.join(", ")}. Their Meshi${activeUsers.length === 1 ? " is" : "s are"} exploring the mesh!`,
    mood: "excited",
  };
}

async function getContentStats(): Promise<MeshiAnswer> {
  const user = await getCurrentUser();
  if (!user) return { content: "I need you to be logged in!", mood: "thinking" };

  const [totalPosts, totalReactions, totalComments, platformPosts] = await Promise.all([
    prisma.post.count({ where: { authorId: user.id } }),
    prisma.reaction.count({ where: { post: { authorId: user.id } } }),
    prisma.comment.count({ where: { post: { authorId: user.id } } }),
    prisma.platformPost.findMany({
      where: { connectedAccount: { userId: user.id } },
      select: { likeCount: true, commentCount: true, viewCount: true, shareCount: true },
    }),
  ]);

  const crossPlatformLikes = platformPosts.reduce((sum, p) => sum + p.likeCount, 0);
  const crossPlatformViews = platformPosts.reduce((sum, p) => sum + p.viewCount, 0);
  const crossPlatformComments = platformPosts.reduce((sum, p) => sum + p.commentCount, 0);
  const crossPlatformShares = platformPosts.reduce((sum, p) => sum + p.shareCount, 0);

  const parts = ["Your engagement stats:"];
  parts.push(`mesh.me: ${totalPosts} posts, ${totalReactions} reactions received, ${totalComments} comments received`);
  if (platformPosts.length > 0) {
    parts.push(`Cross-platform (${platformPosts.length} synced posts):`);
    if (crossPlatformViews > 0) parts.push(`  ${crossPlatformViews.toLocaleString()} total views`);
    if (crossPlatformLikes > 0) parts.push(`  ${crossPlatformLikes.toLocaleString()} total likes`);
    if (crossPlatformComments > 0) parts.push(`  ${crossPlatformComments.toLocaleString()} total comments`);
    if (crossPlatformShares > 0) parts.push(`  ${crossPlatformShares.toLocaleString()} total shares`);
  }

  return { content: parts.join("\n"), mood: "cool" };
}

async function sendMeshiMessage(recipient: string, message: string): Promise<MeshiAnswer> {
  const user = await getCurrentUser();
  if (!user) return { content: "I need you to be logged in!", mood: "thinking" };

  // Rate limit messages
  const rl = rateLimit(`msg:${user.id}`, 30, 60 * 1000);
  if (!rl.allowed) {
    return { content: "You're sending messages too quickly! Give me a moment before the next delivery.", mood: "thinking" };
  }

  // Find the recipient — prefer exact username match, fall back to displayName
  const searchTerm = recipient.toLowerCase().replace(/^@/, "");
  let recipientUser = await prisma.user.findFirst({
    where: { username: searchTerm },
    select: { id: true, username: true, displayName: true },
  });

  if (!recipientUser) {
    recipientUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username: { contains: searchTerm } },
          { displayName: { contains: searchTerm } },
        ],
      },
      select: { id: true, username: true, displayName: true },
    });
  }

  if (!recipientUser) {
    return { content: `I can't find "${recipient}" on mesh.me. Make sure the name is right!`, mood: "thinking" };
  }

  // Prevent self-messaging
  if (recipientUser.id === user.id) {
    return { content: "You can't send a message to yourself! Try sending to a friend instead.", mood: "thinking" };
  }

  // Check if either user has blocked the other
  const blockExists = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: user.id, blockedId: recipientUser.id },
        { blockerId: recipientUser.id, blockedId: user.id },
      ],
    },
  });

  if (blockExists) {
    return { content: `I wasn't able to deliver that message. There may be a connection issue between you and ${recipientUser.displayName}.`, mood: "thinking" };
  }

  // Find or create thread
  let thread = await prisma.messageThread.findFirst({
    where: {
      members: {
        every: { userId: { in: [user.id, recipientUser.id] } },
      },
      AND: [
        { members: { some: { userId: user.id } } },
        { members: { some: { userId: recipientUser.id } } },
      ],
    },
    select: { id: true },
  });

  if (!thread) {
    thread = await prisma.messageThread.create({
      data: {
        members: {
          create: [
            { userId: user.id },
            { userId: recipientUser.id },
          ],
        },
      },
      select: { id: true },
    });
  }

  // Create the message
  await prisma.message.create({
    data: {
      content: message,
      senderId: user.id,
      threadId: thread.id,
    },
  });

  // Create notification
  await prisma.notification.create({
    data: {
      type: "meshi_delivery",
      recipientId: recipientUser.id,
      actorId: user.id,
      message: `Meshi delivered a message: "${message.length > 50 ? message.slice(0, 50) + "..." : message}"`,
    },
  });

  return {
    content: `Message delivered to ${recipientUser.displayName} (@${recipientUser.username})! I traveled across the mesh to bring them your message.`,
    mood: "love",
    action: { type: "meshi_delivery", recipient: recipientUser.username, message },
  };
}

async function getPostCount(name?: string): Promise<MeshiAnswer> {
  const user = await getCurrentUser();
  if (!user) return { content: "I need you to be logged in!", mood: "thinking" };

  if (name) {
    return getPersonPosts(name);
  }

  const count = await prisma.post.count({ where: { authorId: user.id } });
  return {
    content: `You have ${count} post${count !== 1 ? "s" : ""} on mesh.me!`,
    mood: count > 0 ? "happy" : "thinking",
  };
}

// ─── Main Engine Entry Point ──────────────────────────────────

export async function meshiQuery(question: string): Promise<MeshiAnswer> {
  const intent = detectIntent(question);

  switch (intent.type) {
    case "person_lookup":
      return lookupPerson(intent.name);
    case "person_posts":
      return getPersonPosts(intent.name);
    case "shared_posts":
      return getSharedPosts(intent.name);
    case "post_search":
      return searchPosts(intent.topic);
    case "post_count":
      return getPostCount(intent.name);
    case "last_post":
      return getLastPost(intent.topic);
    case "follower_count":
      return getFollowerCount();
    case "following_count":
      return getFollowingCount();
    case "mutual_connections":
      return getMutualConnections();
    case "platform_summary":
      return getPlatformSummary();
    case "platform_content":
      return getPlatformContent(intent.platform);
    case "community_list":
      return getCommunityList();
    case "interest_list":
      return getInterestList();
    case "mesh_summary":
      return getMeshSummary();
    case "recent_activity":
      return getRecentActivity();
    case "who_active":
      return getWhoActive();
    case "content_stats":
      return getContentStats();
    case "send_message":
      return sendMeshiMessage(intent.recipient, intent.message);
    case "unknown":
      // Fall through to pattern-matching in the route handler
      return { content: "", mood: "thinking" };
  }
}

// ─── Utilities ────────────────────────────────────────────────

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 604800)}w ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
