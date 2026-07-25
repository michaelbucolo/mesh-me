"use server";

import { prisma } from "./prisma";
import { getCurrentUser } from "./auth";
import { hasMeshiConsent, meshiConsentWhere, profileDiscoveryConsentWhere } from "./consent";
import { nsfwHiddenWhere } from "./content-safety";
import { encodeDeliveryNotificationMessage } from "./notifications";
import {
  areMutualFollowers,
  getBlockedUserIdSet,
  canSeeMeshBranch,
  canSeeMeshStats,
  canViewProfile,
  normalizeMeshVisibility,
  parseBranchOverrides,
} from "./privacy-policy";
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
  | { type: "person_post_topics"; name: string }
  | { type: "person_channels"; name: string }
  | { type: "person_platform_created"; name: string; platform: string }
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
  "applemusic", "apple music", "mastodon", "patreon", "substack",
  "medium", "devto", "dev.to", "dribbble", "behance",
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

  // ── Person platform creation date ──
  const personPlatformCreatedMatch =
    q.match(/when did\s+(?:@)?(\w+)\s+(?:make|create|start|join|open)\s+(?:their|his|her)?\s*(instagram|youtube|tiktok|twitter|x|twitch|spotify|soundcloud|linkedin|github|discord|snapchat|pinterest|reddit|facebook|threads|bluesky|applemusic|apple music|mastodon|patreon|substack|medium|devto|dev\.to|dribbble|behance)/i)
    || q.match(/when (?:did|was)\s+(?:@)?(\w+)(?:'s)?\s+(instagram|youtube|tiktok|twitter|x|twitch|spotify|soundcloud|linkedin|github|discord|snapchat|pinterest|reddit|facebook|threads|bluesky|applemusic|apple music|mastodon|patreon|substack|medium|devto|dev\.to|dribbble|behance)\s+(?:created|made|started|opened|joined)/i);
  if (personPlatformCreatedMatch && personPlatformCreatedMatch[1] && personPlatformCreatedMatch[2]) {
    const matchedPlatform = personPlatformCreatedMatch[2].toLowerCase();
    const normalizedPlatform = matchedPlatform === "x"
      ? "twitter"
      : matchedPlatform === "apple music"
        ? "applemusic"
        : matchedPlatform === "dev.to"
          ? "devto"
          : matchedPlatform;
    return { type: "person_platform_created", name: personPlatformCreatedMatch[1], platform: normalizedPlatform };
  }

  // ── Person channels / connected accounts ──
  const personChannelsMatch =
    q.match(/(?:what|which)\s+(?:channels?|platforms?|accounts?)\s+(?:does|do|has|have)\s+(?:@)?(\w+)\s+(?:have|use|own|connected)?/i)
    || q.match(/(?:@)?(\w+)(?:'s)?\s+(?:channels?|platforms?|accounts?)/i);
  if (personChannelsMatch && personChannelsMatch[1]) {
    const name = personChannelsMatch[1].toLowerCase();
    const skip = ["i", "me", "my", "you", "we", "our", "their", "his", "her", "what", "which", "all", "connected"];
    if (!skip.includes(name)) {
      return { type: "person_channels", name };
    }
  }

  // ── Person post style/topics ──
  const personTopicsMatch =
    q.match(/what kind of posts?\s+(?:does|do)\s+(?:@)?(\w+)\s+post/i)
    || q.match(/what does\s+(?:@)?(\w+)\s+post\s+about/i)
    || q.match(/what topics?\s+(?:does|do)\s+(?:@)?(\w+)\s+post/i);
  if (personTopicsMatch && personTopicsMatch[1]) {
    return { type: "person_post_topics", name: personTopicsMatch[1] };
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
    // "who is online/active" asks about presence, not a person named "online".
    if (/^(?:online|active|around)\b/.test(name.toLowerCase())) {
      return { type: "who_active" };
    }
    // "tell me about my followers" is a stats question about the user, never a
    // person named "my followers" — reroute self-phrases to the right intent.
    // Self-topics without a matching intent ("my privacy settings", "my
    // profile") fall through to the later detectors and the local knowledge
    // base instead of being answered as a person or a mesh summary.
    const selfTopicMatch = name.toLowerCase().match(/^(?:my|our)\s+(.+)$/);
    if (selfTopicMatch) {
      const topic = selfTopicMatch[1];
      if (topic.includes("follower")) return { type: "follower_count" };
      if (topic.includes("following")) return { type: "following_count" };
      if (topic.includes("mutual")) return { type: "mutual_connections" };
      if (topic.includes("post") || topic.includes("content")) return { type: "post_count" };
      if (topic.includes("communit") || topic.includes("group")) return { type: "community_list" };
      if (topic.includes("interest") || topic.includes("hobby")) return { type: "interest_list" };
      if (topic.includes("platform") || topic.includes("account") || topic.includes("channel")) return { type: "platform_summary" };
      if (topic.includes("activity") || topic.includes("notification")) return { type: "recent_activity" };
    } else {
      const featureWords = ["mesh", "feed", "mechat", "settings", "profile", "meshi", "privacy", "security", "meshpro"];
      if (name && !featureWords.some(fw => name.toLowerCase().includes(fw))) {
        return { type: "person_lookup", name };
      }
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
    // Bare "x" (Twitter) is a single letter, so a plain substring check would
    // match any query containing the letter x (e.g. "explain my content").
    // Require a standalone-word match for it.
    const matchesPlatform = platform === "x" ? /\bx\b/.test(q) : q.includes(platform);
    if (matchesPlatform) {
      if (q.includes("content") || q.includes("posts") || q.includes("videos") || q.includes("photos")) {
        const normalizedPlatform = platform === "x"
          ? "twitter"
          : platform === "apple music"
            ? "applemusic"
            : platform === "dev.to"
              ? "devto"
              : platform;
        return { type: "platform_content", platform: normalizedPlatform };
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

// Cross-user lookup gate. Meshi must never surface another member's private
// profile, posts, or connected channels to someone who could not already see
// them in the app. A viewer may see another person's aggregated content only
// when that person's profile is public or the two are mutual followers — the
// same rule the rest of the app enforces (see privacy-policy.ts).
async function resolvePersonForViewer(name: string, viewerId: string) {
  const searchTerm = name.toLowerCase().replace(/^@/, "");
  if (!searchTerm) return null;

  const person = await prisma.user.findFirst({
    where: {
      OR: [
        { username: { contains: searchTerm } },
        { displayName: { contains: searchTerm } },
      ],
      isSuspended: false,
      // Someone who switched "Meshi memory" off is not a subject Meshi may
      // answer about — for anyone. Filtering here (rather than after the read)
      // means the five person_* intents that share this resolver all fail
      // closed, and they fail as an ordinary "can't find them", which does not
      // disclose that the account exists and opted out.
      ...meshiConsentWhere(),
    },
    select: {
      id: true, username: true, displayName: true, isPublic: true,
      meshPrivacy: {
        select: { meshVisibility: true, branchOverrides: true, showConnections: true, showStats: true },
      },
    },
  });
  if (!person) return null;

  const isSelf = person.id === viewerId;
  const isMutual = isSelf ? true : await areMutualFollowers(viewerId, person.id);
  const canSeeContent = isSelf || person.isPublic || isMutual;
  // Connected accounts have no per-row visibility flag; the only gate the app
  // applies is the "platforms" mesh branch (queries.ts canSeeBranch). Mirror it
  // so Meshi never discloses channels the owner hid on their profile.
  const canSeePlatforms = canSeeMeshBranch({
    viewer: { id: viewerId },
    targetUserId: person.id,
    branchKey: "platforms",
    branchOverrides: parseBranchOverrides(person.meshPrivacy?.branchOverrides),
    isFriend: isMutual,
    showConnections: person.meshPrivacy?.showConnections,
  });
  return { ...person, isSelf, isMutual, canSeeContent, canSeePlatforms };
}

function privateProfileAnswer(): MeshiAnswer {
  return {
    content:
      "I can only share posts and channels for public profiles or people you're mutually connected with on your mesh.",
    mood: "thinking",
  };
}

// Which of an author's posts may the viewer see? Own posts: all. Otherwise only
// public posts, plus friends-only posts when the two are mutual followers.
function visibleAuthorPostWhere(isSelf: boolean, isMutual: boolean) {
  if (isSelf) return {};
  return { visibility: { in: isMutual ? ["public", "friends"] : ["public"] } };
}

async function lookupPerson(name: string): Promise<MeshiAnswer> {
  const user = await getCurrentUser();
  if (!user) return { content: "I need you to be logged in to search your mesh!", mood: "thinking" };

  const searchTerm = name.toLowerCase().replace(/^@/, "");

  // Search in followed users — filter in the database instead of loading the
  // whole follow graph (with three per-row count aggregates) to find one name.
  const found = await prisma.follow.findFirst({
    where: {
      followerId: user.id,
      following: {
        OR: [
          { username: { contains: searchTerm } },
          { displayName: { contains: searchTerm } },
        ],
        // Following someone does not license Meshi to profile them: the
        // person's own "Meshi memory" rule still decides.
        ...meshiConsentWhere(),
      },
    },
    include: {
      following: {
        select: {
          id: true, username: true, displayName: true, bio: true,
          avatarUrl: true, isVerified: true, status: true, lastSeenAt: true,
          hideActivityStatus: true, isPublic: true, isSuspended: true,
          meshPrivacy: {
            select: { meshVisibility: true, branchOverrides: true, showConnections: true, showStats: true },
          },
          _count: { select: { followers: true, following: true, posts: true } },
        },
      },
    },
  });

  if (found) {
    const u = found.following;
    // Check if mutual
    const isMutual = Boolean(await prisma.follow.findFirst({
      where: { followerId: u.id, followingId: user.id },
      select: { id: true },
    }));

    // A one-way follow does not make a private profile visible. Gate bio,
    // stats, and last-seen exactly as the profile page does (queries.ts): bio
    // and activity require canViewProfile; counts additionally require the
    // owner's showStats. Otherwise Meshi discloses what the profile withholds.
    const viewer = { id: user.id, isAdmin: user.isAdmin };
    const meshVisibility = normalizeMeshVisibility(u.meshPrivacy?.meshVisibility);
    const profileVisible = canViewProfile(viewer, u, meshVisibility, isMutual);
    const canSeeStats = profileVisible && canSeeMeshStats(viewer, u.id, u.meshPrivacy);

    const parts = [`${u.displayName} (@${u.username}) is on your mesh!`];
    if (isMutual) parts.push("You follow each other.");
    else parts.push("You follow them.");
    if (profileVisible && u.bio) parts.push(`Bio: "${u.bio}"`);
    if (canSeeStats) parts.push(`${u._count.followers} followers, ${u._count.following} following, ${u._count.posts} posts.`);
    if (u.isVerified) parts.push("They're verified!");
    // Respect the target's "Hide activity status" AND profile visibility —
    // Meshi must not leak online state or a last-seen timestamp for someone
    // who's hidden their activity or whose (private) profile the viewer can't see.
    if (profileVisible && !u.hideActivityStatus) {
      if (u.status === "online") parts.push("They're online right now!");
      else if (u.lastSeenAt) {
        const ago = getTimeAgo(u.lastSeenAt);
        parts.push(`Last seen ${ago}.`);
      }
    }

    return { content: parts.join(" "), mood: "excited" };
  }

  // Search all users (not just followed) — but only surface accounts that are
  // publicly discoverable, mirroring the directory search (search/users). This
  // prevents Meshi from being an oracle for private accounts and their stats.
  const globalSearch = await prisma.user.findFirst({
    where: {
      OR: [
        { username: { contains: searchTerm } },
        { displayName: { contains: searchTerm } },
      ],
      isSuspended: false,
      isPublic: true,
      showInDiscovery: true,
      ...profileDiscoveryConsentWhere(),
      ...meshiConsentWhere(),
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
  const safetyWhere = nsfwHiddenWhere(user);

  // Resolve the other user. This report only ever counts interactions the
  // viewer is themselves a party to (their own posts, or posts they commented
  // on), so it's safe regardless of the target's profile visibility.
  const otherUser = await resolvePersonForViewer(name, user.id);

  if (!otherUser) {
    return { content: `I can't find "${name}" on mesh.me. Make sure you have the right name!`, mood: "thinking" };
  }

  // Find posts where either user tagged/mentioned the other, or where both
  // commented — all three are independent, so they share one batch.
  const [myPostsCommentedByThem, theirPostsCommentedByMe, mentionPosts] = await Promise.all([
    prisma.post.findMany({
      where: {
        ...safetyWhere,
        authorId: user.id,
        comments: { some: { authorId: otherUser.id } },
      },
      select: { id: true, content: true, createdAt: true },
      take: 10,
    }),
    prisma.post.findMany({
      where: {
        ...safetyWhere,
        authorId: otherUser.id,
        comments: { some: { authorId: user.id } },
      },
      select: { id: true, content: true, createdAt: true },
      take: 10,
    }),
    prisma.post.findMany({
      where: {
        ...safetyWhere,
        authorId: user.id,
        content: { contains: otherUser.username },
      },
      select: { id: true, content: true, createdAt: true },
      take: 10,
    }),
  ]);

  const totalInteractions = myPostsCommentedByThem.length + theirPostsCommentedByMe.length + mentionPosts.length;

  if (totalInteractions === 0) {
    // Don't echo the resolved person's identity here: resolvePersonForViewer
    // fuzzy-matches any non-suspended account with no visibility/block gate, so
    // naming them would confirm a private/non-discoverable account's existence
    // (and display name + @username) purely from a search string.
    return {
      content: `I don't see any shared posts or interactions with "${name}" yet. You could comment on each other's posts to build that connection!`,
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
  const safetyWhere = nsfwHiddenWhere(user);

  const person = await resolvePersonForViewer(name, user.id);
  if (!person) {
    return { content: `I can't find "${name}" on mesh.me.`, mood: "thinking" };
  }
  if (!person.canSeeContent) return privateProfileAnswer();

  // Get their recent posts the viewer is actually allowed to see.
  const recentPosts = await prisma.post.findMany({
    where: { ...safetyWhere, authorId: person.id, ...visibleAuthorPostWhere(person.isSelf, person.isMutual) },
    select: { content: true, createdAt: true, _count: { select: { reactions: true, comments: true } } },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  if (recentPosts.length === 0) {
    return {
      content: `I don't see any posts from ${person.displayName} (@${person.username}) that you can view.`,
      mood: "thinking",
    };
  }

  const latest = recentPosts[0];
  const preview = latest.content.length > 60 ? latest.content.slice(0, 60) + "..." : latest.content;
  return {
    content: `${person.displayName} (@${person.username})'s most recent post you can see: "${preview}" (${getTimeAgo(latest.createdAt)}, ${latest._count.reactions} reactions).`,
    mood: "excited",
  };
}

async function getPersonPostTopics(name: string): Promise<MeshiAnswer> {
  const user = await getCurrentUser();
  if (!user) return { content: "I need you to be logged in!", mood: "thinking" };
  const safetyWhere = nsfwHiddenWhere(user);

  const person = await resolvePersonForViewer(name, user.id);
  if (!person) {
    return { content: `I can't find "${name}" on mesh.me.`, mood: "thinking" };
  }
  if (!person.canSeeContent) return privateProfileAnswer();

  // Synced platform posts (and the platform names they reveal) are only
  // aggregated when the viewer may see the target's "platforms" mesh branch —
  // otherwise the topic summary would leak hidden channel linkage.
  const canSeePlatformPosts = person.isSelf || person.canSeePlatforms;
  const [meshPosts, platformPosts] = await Promise.all([
    prisma.post.findMany({
      where: { ...safetyWhere, authorId: person.id, ...visibleAuthorPostWhere(person.isSelf, person.isMutual) },
      select: {
        content: true,
        tags: { select: { tag: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 80,
    }),
    canSeePlatformPosts
      ? prisma.platformPost.findMany({
          where: {
            ...safetyWhere,
            connectedAccount: { userId: person.id },
            // Aggregate topic counts must not include a target's non-public synced
            // posts for anyone but the owner.
            ...(person.isSelf ? {} : { visibility: "public" }),
          },
          select: { postType: true, content: true, title: true, connectedAccount: { select: { platform: true } } },
          orderBy: { publishedAt: "desc" },
          take: 80,
        })
      : Promise.resolve([] as { postType: string; content: string | null; title: string | null; connectedAccount: { platform: string } }[]),
  ]);

  const topicCounts = new Map<string, number>();
  const addTopic = (topic: string) => {
    const key = topic.toLowerCase();
    if (!key || key.length < 2) return;
    topicCounts.set(key, (topicCounts.get(key) || 0) + 1);
  };

  for (const post of meshPosts) {
    for (const tag of post.tags) addTopic(tag.tag);
  }

  for (const post of platformPosts) {
    addTopic(post.postType);
    addTopic(post.connectedAccount.platform);
  }

  const topTopics = Array.from(topicCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([topic]) => topic);

  if (meshPosts.length === 0 && platformPosts.length === 0) {
    return {
      content: `${person.displayName} (@${person.username}) hasn't posted anything yet, so I don't have a posting pattern to analyze.`,
      mood: "thinking",
    };
  }

  const hasTags = meshPosts.some((p) => p.tags.length > 0);
  const topText = topTopics.length > 0 ? ` Their main content patterns are: ${topTopics.join(", ")}.` : "";
  const tagHint = hasTags ? " I used mesh tags and synced platform post types for this summary." : " I used synced platform post types for this summary.";

  return {
    content: `${person.displayName} (@${person.username}) posts across ${meshPosts.length} mesh.me posts and ${platformPosts.length} synced platform posts.${topText}${tagHint}`,
    mood: "excited",
  };
}

async function getPersonChannels(name: string): Promise<MeshiAnswer> {
  const user = await getCurrentUser();
  if (!user) return { content: "I need you to be logged in!", mood: "thinking" };

  const person = await resolvePersonForViewer(name, user.id);
  if (!person) {
    return { content: `I can't find "${name}" on mesh.me.`, mood: "thinking" };
  }
  if (!person.canSeeContent) return privateProfileAnswer();
  if (!person.canSeePlatforms) {
    return { content: `${person.displayName} keeps their connected channels private.`, mood: "thinking" };
  }

  const accounts = await prisma.connectedAccount.findMany({
    where: { userId: person.id, isActive: true },
    select: {
      platform: true,
      platformUsername: true,
      accountLabel: true,
      alterEgo: { select: { username: true, displayName: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  if (accounts.length === 0) {
    return {
      content: `${person.displayName} (@${person.username}) hasn't connected any public channels yet.`,
      mood: "thinking",
    };
  }

  const lines = accounts.map((a) => {
    const username = a.platformUsername ? `@${a.platformUsername}` : "username hidden";
    const label = a.accountLabel ? ` (${a.accountLabel})` : "";
    // A persona/alter-ego is the mechanism for keeping a channel separated from
    // the main identity — never reveal that linkage for anyone but the owner,
    // or it deanonymizes their alternate accounts.
    const persona = person.isSelf && a.alterEgo?.username
      ? ` via persona ${a.alterEgo.displayName || a.alterEgo.username} (@${a.alterEgo.username})`
      : "";
    return `- ${a.platform}: ${username}${label}${persona}`;
  });

  return {
    content: `${person.displayName} has ${accounts.length} connected channel${accounts.length === 1 ? "" : "s"}:\n${lines.join("\n")}`,
    mood: "happy",
  };
}

async function getPersonPlatformCreated(name: string, platform: string): Promise<MeshiAnswer> {
  const user = await getCurrentUser();
  if (!user) return { content: "I need you to be logged in!", mood: "thinking" };

  const normalizedPlatform = platform === "x" ? "twitter" : platform.toLowerCase();
  const person = await resolvePersonForViewer(name, user.id);
  if (!person) {
    return { content: `I can't find "${name}" on mesh.me.`, mood: "thinking" };
  }
  if (!person.canSeeContent) return privateProfileAnswer();
  if (!person.canSeePlatforms) {
    return { content: `${person.displayName} keeps their connected channels private.`, mood: "thinking" };
  }

  const account = await prisma.connectedAccount.findFirst({
    where: {
      userId: person.id,
      isActive: true,
      platform: { contains: normalizedPlatform },
    },
    select: {
      platform: true,
      platformUsername: true,
      createdAt: true,
      lastSyncAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  if (!account) {
    return {
      content: `${person.displayName} doesn't appear to have ${platform} connected on mesh.me.`,
      mood: "thinking",
    };
  }

  return {
    content: `${person.displayName}'s ${account.platform} channel${account.platformUsername ? ` (@${account.platformUsername})` : ""} was connected on ${account.createdAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.${account.lastSyncAt ? ` Last synced ${getTimeAgo(account.lastSyncAt)}.` : ""}`,
    mood: "happy",
  };
}

async function searchPosts(topic: string): Promise<MeshiAnswer> {
  const user = await getCurrentUser();
  if (!user) return { content: "I need you to be logged in!", mood: "thinking" };
  const safetyWhere = nsfwHiddenWhere(user);

  const posts = await prisma.post.findMany({
    where: {
      ...safetyWhere,
      AND: [
        {
          OR: [
            { content: { contains: topic } },
            { tags: { some: { tag: { contains: topic } } } },
          ],
        },
        // Only surface posts the viewer is actually allowed to see: their own
        // (any visibility), public posts from people they follow, and
        // friends-only posts from mutual followers. Never leak private posts.
        {
          OR: [
            { authorId: user.id },
            {
              visibility: "public",
              author: { followers: { some: { followerId: user.id } }, ...meshiConsentWhere() },
            },
            {
              visibility: "friends",
              author: {
                followers: { some: { followerId: user.id } },
                following: { some: { followingId: user.id } },
                ...meshiConsentWhere(),
              },
            },
          ],
        },
      ],
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

  const where: Record<string, unknown> = { ...nsfwHiddenWhere(user), authorId: user.id };
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
        where: nsfwHiddenWhere(user),
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
  const safetyWhere = nsfwHiddenWhere(user);

  const [followers, following, posts, communities, platforms, interests, savedPosts] = await Promise.all([
    prisma.follow.count({ where: { followingId: user.id } }),
    prisma.follow.count({ where: { followerId: user.id } }),
    prisma.post.count({ where: { ...safetyWhere, authorId: user.id } }),
    prisma.communityMember.count({ where: { userId: user.id } }),
    prisma.connectedAccount.count({ where: { userId: user.id, isActive: true } }),
    prisma.userInterest.count({ where: { userId: user.id } }),
    prisma.savedPost.count({ where: { userId: user.id } }),
  ]);

  // Get cross-platform content stats
  const platformPosts = await prisma.platformPost.count({
    where: { ...safetyWhere, connectedAccount: { userId: user.id } },
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
  const safetyWhere = nsfwHiddenWhere(user);

  const [recentPosts, recentComments, recentFollowers, recentNotifs] = await Promise.all([
    prisma.post.findMany({
      where: { ...safetyWhere, authorId: user.id },
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
  const blockedIds = await getBlockedUserIdSet(user.id);

  // Find followed users who are online or recently active. Presence must honor
  // the target's "Hide activity status" (mirrors lookupPerson / getProfileByUsername),
  // never surface suspended accounts, and never cross a block in either direction.
  const activeUsers = await prisma.user.findMany({
    where: {
      followers: { some: { followerId: user.id } },
      isSuspended: false,
      hideActivityStatus: false,
      id: { notIn: Array.from(blockedIds) },
      // Presence read out loud by an assistant is still Meshi using their data.
      ...meshiConsentWhere(),
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
  const safetyWhere = nsfwHiddenWhere(user);

  const [totalPosts, totalReactions, totalComments, platformTotals] = await Promise.all([
    prisma.post.count({ where: { ...safetyWhere, authorId: user.id } }),
    prisma.reaction.count({ where: { post: { ...safetyWhere, authorId: user.id } } }),
    prisma.comment.count({ where: { post: { ...safetyWhere, authorId: user.id } } }),
    // Sum in the database — loading every synced post row to add four integers
    // in JS scales with the user's entire cross-platform history.
    prisma.platformPost.aggregate({
      where: { ...safetyWhere, connectedAccount: { userId: user.id } },
      _sum: { likeCount: true, commentCount: true, viewCount: true, shareCount: true },
      _count: true,
    }),
  ]);

  const syncedPostCount = platformTotals._count;
  const crossPlatformLikes = platformTotals._sum.likeCount ?? 0;
  const crossPlatformViews = platformTotals._sum.viewCount ?? 0;
  const crossPlatformComments = platformTotals._sum.commentCount ?? 0;
  const crossPlatformShares = platformTotals._sum.shareCount ?? 0;

  const parts = ["Your engagement stats:"];
  parts.push(`mesh.me: ${totalPosts} posts, ${totalReactions} reactions received, ${totalComments} comments received`);
  if (syncedPostCount > 0) {
    parts.push(`Cross-platform (${syncedPostCount} synced posts):`);
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

  // Deliver only on an exact username match. A fuzzy `contains` fallback would
  // silently send the user's private message to the first account that merely
  // contains the term (e.g. "ana" → "banana_joe") — a real misdelivery of
  // private content, so we require the exact @username instead of guessing.
  const searchTerm = recipient.toLowerCase().replace(/^@/, "");
  const recipientUser = await prisma.user.findFirst({
    where: { username: searchTerm, isSuspended: false },
    select: { id: true, username: true, displayName: true },
  });

  if (!recipientUser) {
    return {
      content: `I couldn't find an exact match for "${recipient}". So I never send a message to the wrong person, tell me their exact @username.`,
      mood: "thinking",
    };
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
  const carried = await prisma.message.create({
    data: {
      content: message,
      senderId: user.id,
      threadId: thread.id,
    },
    select: { id: true },
  });

  // Create notification. The carried message's id rides the summary as a
  // machine prefix (see src/lib/notifications.ts) so the deliveries route
  // hands over the EXACT message — no more newest-message-in-window guess.
  await prisma.notification.create({
    data: {
      type: "meshi_delivery",
      recipientId: recipientUser.id,
      actorId: user.id,
      message: encodeDeliveryNotificationMessage(
        carried.id,
        `Meshi delivered a message: "${message.length > 50 ? message.slice(0, 50) + "..." : message}"`,
      ),
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

  const count = await prisma.post.count({ where: { ...nsfwHiddenWhere(user), authorId: user.id } });
  return {
    content: `You have ${count} post${count !== 1 ? "s" : ""} on mesh.me!`,
    mood: count > 0 ? "happy" : "thinking",
  };
}

// ─── Main Engine Entry Point ──────────────────────────────────

export async function meshiQuery(question: string): Promise<MeshiAnswer> {
  // The caller's "Meshi memory" rule, enforced at the engine door rather than
  // only in /api/meshi/chat. This module is "use server", so meshiQuery is a
  // dispatchable Server Action — a client can invoke it directly and skip the
  // route's check entirely. Repeating it here is what makes the gate
  // server-authoritative instead of merely well-placed.
  const viewer = await getCurrentUser();
  if (!viewer) return { content: "", mood: "thinking" };
  if (!(await hasMeshiConsent(viewer.id))) {
    return {
      content:
        "Your privacy rules say I should not use your Mesh, so I am not reading it. You can switch Meshi memory back on in your privacy controls.",
      mood: "thinking",
    };
  }

  const intent = detectIntent(question);

  switch (intent.type) {
    case "person_lookup":
      return lookupPerson(intent.name);
    case "person_posts":
      return getPersonPosts(intent.name);
    case "person_post_topics":
      return getPersonPostTopics(intent.name);
    case "person_channels":
      return getPersonChannels(intent.name);
    case "person_platform_created":
      return getPersonPlatformCreated(intent.name, intent.platform);
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
