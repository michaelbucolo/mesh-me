// Builds MeshNode[] and MeshEdge[] from the /api/mesh response.
// Deterministic layout: positions based on type rings + index angle, no Math.random().

import type { MeshNode, MeshEdge } from "./mesh-types";
import { NODE_COLORS, PLATFORM_COLORS, normalizeMediaAspectRatio } from "./mesh-types";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface MeshApiResponse {
  user: { id: string; username: string; displayName: string | null; avatarUrl: string | null; bio: string | null; isVerified: boolean };
  following: any[];
  followers: any[];
  communities: any[];
  interests: string[];
  posts: any[];
  connectedAccounts: any[];
  platforms?: MeshPlatform[];
  recentComments?: MeshRecentComment[];
  activities?: Array<{
    id: string;
    type: string;
    label: string;
    summary?: string | null;
    href?: string;
    sourcePostId?: string | null;
    connectedAccountId?: string | null;
    createdAt?: string | Date | null;
    isUnread?: boolean;
    actor?: {
      id: string;
      username: string;
      displayName: string | null;
      avatarUrl: string | null;
    } | null;
  }>;
  friendMeshes?: Array<{
    user: { id: string; username: string; displayName: string | null; avatarUrl: string | null };
    posts: any[];
    connectedAccounts: any[];
  }>;
  alterEgos: any[];
  meshiPreference: {
    colorTheme: string;
    hatStyle: string;
    faceStyle: string;
    hairStyle: string;
    accessoryStyle: string;
    eyeStyle: string;
    badgeStyle: string;
    outfitStyle: string;
  };
  meshCosmetics?: Array<{ type: string; value: string; isActive?: boolean }>;
  stats: {
    followingCount: number;
    followerCount: number;
    mutualCount: number;
    communityCount: number;
    postCount: number;
    interestCount: number;
    connectedPlatformCount: number;
    alterEgoCount: number;
    activityCount?: number;
  };
}

export interface MeshPlatform {
  id: string;
  platform: string;
  platformUsername: string | null;
  syncStatus: string;
  isConnected: boolean;
  counts: {
    posts: number;
    comments: number;
    followers: number;
    media: number;
  };
  manageHref: string;
  sourcesHref: string;
}

export interface MeshRecentComment {
  id: string;
  content: string;
  createdAt: string;
  replyCount: number;
  likeCount: number;
  author: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    isVerified: boolean;
  };
  post: {
    id: string;
    content: string;
  };
}

interface BuildResult {
  nodes: MeshNode[];
  edges: MeshEdge[];
}

const BRANCH_LABELS: Record<MeshNode["type"], string> = {
  self: "You",
  "alter-ego": "Identities",
  platform: "Platforms",
  user: "People",
  community: "Communities",
  tag: "Interests",
  post: "Posts",
  activity: "Activity",
};

/**
 * Lay out items in a ring around (cx, cy) at the given radius.
 * Returns deterministic angles based on index.
 */
function ringPosition(cx: number, cy: number, radius: number, index: number, total: number, offsetAngle = 0) {
  const angle = (index / Math.max(total, 1)) * Math.PI * 2 + offsetAngle;
  return {
    x: cx + Math.cos(angle) * radius,
    y: cy + Math.sin(angle) * radius,
  };
}

/** Compute an engagement score from node metrics */
function computeEngagement(node: { followerCount?: number; postCount?: number; interactionCount?: number }): number {
  return (node.followerCount || 0) * 0.3 + (node.postCount || 0) * 0.5 + (node.interactionCount || 0) * 2;
}

function computeImportance(node: MeshNode): number {
  if (node.type === "self") return 1;
  const metricScore = (node.followerCount || 0) * 0.0008
    + (node.memberCount || 0) * 0.004
    + (node.likeCount || 0) * 0.01
    + (node.commentCount || 0) * 0.02
    + (node.interactionCount || 0) * 0.05
    + (node.engagementScore || 0) * 0.004
    + node.connections.length * 0.025;

  return Math.max(0.12, Math.min(1, 0.18 + node.radius / 54 + metricScore));
}

function inferPostMediaType(value: string | null | undefined): MeshNode["mediaType"] {
  const type = value?.toLowerCase();
  if (!type) return "text";
  if (["image", "photo", "pin"].includes(type)) return "image";
  if (["video", "story", "reel", "short", "shorts", "tiktok", "gif"].includes(type)) return "video";
  if (["audio", "podcast"].includes(type)) return "audio";
  if (["link", "article", "thread", "tweet"].includes(type)) return "link";
  if (type === "text") return "text";
  return "unknown";
}

function inferPostAspectRatio(postType: string | null | undefined, platform: string | null | undefined): number {
  const normalizedType = postType?.toLowerCase() || "";
  const normalizedPlatform = platform?.toLowerCase() || "";

  if (["story", "reel", "short", "shorts", "snap", "tiktok"].includes(normalizedType)) return 9 / 16;
  if (normalizedPlatform === "youtube" || normalizedType === "video") return 16 / 9;
  if (["tweet", "thread", "article", "link", "text"].includes(normalizedType)) return 1.7;
  return 1;
}

function mediaAspectRatio(width?: number | null, height?: number | null, fallback = 1): number {
  if (width && height) return normalizeMediaAspectRatio(width / height);
  return normalizeMediaAspectRatio(fallback);
}

function organizeNode(node: MeshNode, cx: number, cy: number): MeshNode {
  const dx = node.x - cx;
  const dy = node.y - cy;
  const orbitRadius = node.orbitRadius ?? Math.hypot(dx, dy);
  const orbitAngle = node.orbitAngle ?? Math.atan2(dy, dx);

  return {
    ...node,
    anchorX: node.anchorX ?? node.x,
    anchorY: node.anchorY ?? node.y,
    orbitRadius,
    orbitAngle,
    branchLabel: node.branchLabel ?? BRANCH_LABELS[node.type],
    importance: node.importance ?? computeImportance(node),
  };
}

export type MeshViewMode = "simplified" | "advanced";

// Caps used by the Simplified view to keep the Mesh digestible.
const SIMPLE_MAX_PEOPLE = 12;
const SIMPLE_MAX_POSTS = 14;

/**
 * Simplified view: keep the user at center, their identities, connected
 * platforms, the most relevant people, and their most important posts.
 * Low-signal clutter (loose activity items and interest tags) is set aside
 * for the Advanced view. Returns the subset of nodes to show; edges are
 * filtered downstream by node visibility.
 */
export function applyViewMode(nodes: MeshNode[], mode: MeshViewMode): MeshNode[] {
  if (mode === "advanced") return nodes;

  const byImportance = (a: MeshNode, b: MeshNode) =>
    (b.importance ?? 0) - (a.importance ?? 0);

  const topPeople = new Set(
    nodes.filter((n) => n.type === "user").sort(byImportance).slice(0, SIMPLE_MAX_PEOPLE).map((n) => n.id),
  );
  const topPosts = new Set(
    nodes.filter((n) => n.type === "post").sort(byImportance).slice(0, SIMPLE_MAX_POSTS).map((n) => n.id),
  );

  return nodes.filter((node) => {
    switch (node.type) {
      case "self":
      case "alter-ego":
      case "platform":
      case "community":
        return true;
      case "user":
        return topPeople.has(node.id);
      case "post":
        return topPosts.has(node.id);
      default:
        // activity + tag nodes are Advanced-only
        return false;
    }
  });
}

export function buildMeshData(data: MeshApiResponse, cx: number, cy: number): BuildResult {
  const nodes: MeshNode[] = [];
  const edges: MeshEdge[] = [];
  const nodeMap = new Map<string, MeshNode>();
  const nodeIds = new Set<string>();

  const addNode = (node: MeshNode) => {
    const organizedNode = organizeNode(node, cx, cy);
    nodes.push(organizedNode);
    nodeMap.set(organizedNode.id, organizedNode);
    nodeIds.add(organizedNode.id);
  };

  const userId = data.user.id;

  // Build community ID → name lookup for resolving shared communities
  const communityNameMap: Record<string, string> = {};
  for (const c of data.communities || []) {
    communityNameMap[c.id] = c.name;
  }

  // --- Self node (center) ---
  addNode({
    id: userId,
    type: "self",
    label: data.user.displayName || data.user.username,
    sublabel: "@" + data.user.username,
    avatarUrl: data.user.avatarUrl,
    href: "/profile/" + data.user.username,
    sourceType: "mesh",
    sourceId: data.user.id,
    x: cx, y: cy, vx: 0, vy: 0,
    radius: 48,
    color: NODE_COLORS.self,
    opacity: 1,
    pulsePhase: 0,
    connections: [],
    status: "online",
    followerCount: data.stats.followerCount,
    postCount: data.stats.postCount,
    engagementScore: computeEngagement({
      followerCount: data.stats.followerCount,
      postCount: data.stats.postCount,
    }),
    platformCount: data.connectedAccounts?.length || 0,
    description: data.user.bio || undefined,
  });

  // --- Alter Egos (ring 1: close to self) ---
  const alterEgos = data.alterEgos || [];
  alterEgos.forEach((ego: any, i: number) => {
    const pos = ringPosition(cx, cy, 180, i, alterEgos.length, Math.PI / 6);
    addNode({
      id: "alter-ego-" + ego.id,
      type: "alter-ego",
      label: ego.displayName || ego.username,
      sublabel: "@" + ego.username,
      avatarUrl: ego.avatarUrl,
      x: pos.x, y: pos.y, vx: 0, vy: 0,
      radius: 21,
      color: NODE_COLORS["alter-ego"],
      opacity: 1,
      pulsePhase: i * 1.2,
      connections: [userId],
      description: ego.bio || undefined,
    });
    edges.push({
      source: userId,
      target: "alter-ego-" + ego.id,
      strength: 1.0,
      type: "alter-ego",
    });
  });

  // --- Connected Platforms (ring 2) with sub-nodes ---
  const platforms = data.connectedAccounts || [];
  platforms.forEach((acct: any, i: number) => {
    const pos = ringPosition(cx, cy, 340, i, platforms.length, Math.PI / 4);
    const platformKey = acct.platform?.toLowerCase() || "";
    const analytics = acct.analytics || null;
    const totalPosts = acct.counts?.platformPosts || 0;
    const totalFollowers = acct.counts?.platformFollowers || 0;
    const platformNodeId = "platform-" + acct.id;

    addNode({
      id: platformNodeId,
      type: "platform",
      label: acct.platform,
      sublabel: acct.platformUsername ? "@" + acct.platformUsername : undefined,
      href: "/connected-accounts",
      sourceType: "platform",
      sourceId: acct.id,
      connectedAccountId: acct.id,
      syncStatus: acct.syncStatus,
      x: pos.x, y: pos.y, vx: 0, vy: 0,
      radius: 19 + Math.min(totalPosts * 0.2, 10),
      color: PLATFORM_COLORS[platformKey] || NODE_COLORS.platform,
      opacity: 0.9,
      pulsePhase: i * 0.8,
      connections: [userId],
      platform: acct.platform,
      postCount: totalPosts,
      followerCount: analytics?.followerCount ?? totalFollowers,
      likeCount: analytics?.totalLikes ?? 0,
      commentCount: analytics?.totalComments ?? 0,
      description: acct.platformUsername
        ? `${totalPosts} posts · ${totalFollowers} followers synced`
        : undefined,
      engagementScore: analytics
        ? (analytics.followerCount || 0) * 0.1 + (analytics.totalLikes || 0) * 0.3 + (analytics.totalViews || 0) * 0.01
        : 0,
    });
    edges.push({
      source: userId,
      target: platformNodeId,
      strength: 0.7,
      type: "platform",
    });

    // --- Platform top posts as sub-nodes orbiting the platform ---
    const topPosts = acct.topPosts || [];
    topPosts.forEach((pp: any, pi: number) => {
      const subPos = ringPosition(pos.x, pos.y, 68 + pi * 9, pi, topPosts.length, Math.PI / 3 + i);
      const ppId = "pp-" + pp.id;
      const ppEngagement = (pp.likeCount || 0) + (pp.commentCount || 0) * 2 + (pp.viewCount || 0) * 0.01;
      const firstMedia = pp.media?.[0];
      const postType = pp.postType || firstMedia?.mediaType;
      const mediaType = inferPostMediaType(postType);
      const imageUrl = pp.thumbnailUrl || firstMedia?.thumbnailUrl || firstMedia?.url || null;
      addNode({
        id: ppId,
        type: "post",
        label: (pp.title || pp.content || pp.postType || "Post").slice(0, 35) + ((pp.title || pp.content || "").length > 35 ? "..." : ""),
        content: pp.content || pp.title,
        href: pp.url || undefined,
        sourceType: "platform",
        sourceId: pp.id,
        connectedAccountId: acct.id,
        platformPostId: pp.platformPostId,
        visibility: pp.visibility,
        isPinned: pp.isPinned,
        imageUrl,
        mediaType: imageUrl ? mediaType : "text",
        mediaAspectRatio: mediaAspectRatio(firstMedia?.width, firstMedia?.height, inferPostAspectRatio(postType, acct.platform)),
        x: subPos.x, y: subPos.y, vx: 0, vy: 0,
        radius: 9 + Math.min(ppEngagement * 0.3, 7),
        color: PLATFORM_COLORS[platformKey] || NODE_COLORS.post,
        opacity: 0.75,
        pulsePhase: pi * 0.6 + i,
        connections: [platformNodeId],
        likeCount: pp.likeCount,
        commentCount: pp.commentCount,
        repostCount: pp.shareCount,
        platform: acct.platform,
        lastActiveAt: pp.publishedAt || null,
      });
      edges.push({
        source: platformNodeId,
        target: ppId,
        strength: 0.35,
        type: "platform-content",
      });
    });

    // --- Platform top followers as sub-nodes ---
    const topFollowers = acct.topFollowers || [];
    topFollowers.slice(0, 6).forEach((pf: any, fi: number) => {
      const subPos = ringPosition(pos.x, pos.y, 95 + fi * 8, fi, Math.min(topFollowers.length, 6), -Math.PI / 4 + i);
      const pfId = "pf-" + pf.id;
      addNode({
        id: pfId,
        type: "user",
        label: pf.displayName || pf.username || "User",
        sublabel: pf.username ? "@" + pf.username : undefined,
        avatarUrl: pf.avatarUrl,
        href: pf.profileUrl || undefined,
        sourceType: "platform",
        sourceId: pf.id,
        connectedAccountId: acct.id,
        platformUserId: pf.platformUserId,
        x: subPos.x, y: subPos.y, vx: 0, vy: 0,
        radius: 11 + Math.min((pf.followerCount || 0) * 0.001, 5),
        color: PLATFORM_COLORS[platformKey] || NODE_COLORS.user,
        opacity: 0.7,
        pulsePhase: fi * 0.7 + i,
        connections: [platformNodeId],
        isMutual: pf.isMutual,
        followerCount: pf.followerCount,
        platform: acct.platform,
      });
      edges.push({
        source: platformNodeId,
        target: pfId,
        strength: 0.25,
        type: "platform-follower",
      });
    });
  });

  // --- Following / Followers (ring 3: people) ---
  // Merge following + followers, dedup, prioritize mutuals
  const seenUsers = new Set<string>();
  const allPeople: any[] = [];

  for (const f of data.following || []) {
    if (!seenUsers.has(f.id)) {
      seenUsers.add(f.id);
      allPeople.push({ ...f, isFollowing: true });
    }
  }
  for (const f of data.followers || []) {
    if (!seenUsers.has(f.id)) {
      seenUsers.add(f.id);
      allPeople.push({ ...f, isFollowing: false });
    }
  }

  // Sort: mutuals first, then by interaction count
  allPeople.sort((a, b) => {
    if (a.isMutual && !b.isMutual) return -1;
    if (!a.isMutual && b.isMutual) return 1;
    return (b.interactionCount || 0) - (a.interactionCount || 0);
  });

  const maxPeople = 40;
  const peopleToDraw = allPeople.slice(0, maxPeople);

  peopleToDraw.forEach((f, i) => {
    const isMutual = !!f.isMutual;
    const interactionCount = f.interactionCount || 0;
    // Mutuals closer, high-interaction users even closer
    const baseDist = isMutual ? 500 : 650;
    const interactionPull = Math.min(interactionCount * 4, 80);
    const ringRadius = baseDist - interactionPull;
    const pos = ringPosition(cx, cy, ringRadius, i, peopleToDraw.length);

    const engagement = computeEngagement(f);
    // Scale radius by engagement — more engaged users are bigger
    const engagementBoost = Math.min(engagement * 0.02, 7);

    addNode({
      id: f.id,
      type: "user",
      label: f.displayName || f.username,
      sublabel: "@" + f.username,
      avatarUrl: f.avatarUrl,
      href: "/profile/" + f.username,
      sourceType: "mesh",
      sourceId: f.id,
      x: pos.x, y: pos.y, vx: 0, vy: 0,
      radius: (isMutual ? 21 : 17) + engagementBoost,
      color: isMutual ? NODE_COLORS.mutual : NODE_COLORS.user,
      opacity: 1,
      pulsePhase: i * 0.4,
      connections: [userId],
      isMutual,
      isFollowing: f.isFollowing,
      followerCount: f.followerCount ?? f._count?.followers,
      postCount: f.postCount ?? f._count?.posts,
      sharedInterests: f.sharedInterests,
      sharedCommunities: (f.sharedCommunities || []).map((id: string) => communityNameMap[id] || id),
      interactionCount,
      status: f.status || "offline",
      engagementScore: engagement,
      lastActiveAt: f.lastSeenAt || null,
    });
    edges.push({
      source: userId,
      target: f.id,
      strength: isMutual ? 1.0 : 0.7,
      type: isMutual ? "mutual" : "follow",
      interactionCount,
      status: f.status || "offline",
    });
  });

  // --- Combined friend meshes ---
  // Mutual follows become "friend mesh" branches: shared native posts and shared
  // platform content orbit the friend's node so their live world is part of yours.
  const friendMeshMap = new Map((data.friendMeshes || []).map((friend) => [friend.user.id, friend]));
  const friendsToMerge = peopleToDraw
    .filter((person) => person.isMutual && friendMeshMap.has(person.id))
    .slice(0, 10);

  friendsToMerge.forEach((person, friendIndex) => {
    const friendMesh = friendMeshMap.get(person.id);
    const friendNode = nodeMap.get(person.id);
    if (!friendMesh || !friendNode) return;

    const friendPosts = (friendMesh.posts || []).slice(0, 4);
    friendPosts.forEach((p: any, postIndex: number) => {
      const total = Math.max(friendPosts.length, 1);
      const subPos = ringPosition(
        friendNode.x,
        friendNode.y,
        82 + postIndex * 8,
        postIndex,
        total,
        (friendNode.orbitAngle ?? 0) + Math.PI / 7
      );
      const postId = `friend-native-post-${person.id}-${p.id}`;
      const postEngagement = (p.likeCount || 0) + (p.commentCount || 0) * 2 + (p.repostCount || 0) * 3;
      const firstMedia = p.media?.[0];
      const mediaType = inferPostMediaType(firstMedia?.type);
      const imageUrl = firstMedia?.url || null;

      addNode({
        id: postId,
        type: "post",
        label: (p.content || "Friend post").slice(0, 38) + ((p.content || "").length > 38 ? "..." : ""),
        sublabel: `@${person.username} · mesh.me`,
        content: p.content,
        href: "/feed/" + p.id,
        sourceType: "mesh",
        sourceId: p.id,
        imageUrl,
        mediaType: imageUrl ? mediaType : "text",
        mediaAspectRatio: mediaAspectRatio(firstMedia?.width, firstMedia?.height, imageUrl ? 1 : 1.7),
        x: subPos.x, y: subPos.y, vx: 0, vy: 0,
        radius: 11 + Math.min(postEngagement * 0.42, 8),
        color: NODE_COLORS.post,
        opacity: 0.78,
        pulsePhase: friendIndex * 0.5 + postIndex * 0.4,
        connections: [person.id],
        branchLabel: "Friend Mesh",
        likeCount: p.likeCount,
        commentCount: p.commentCount,
        repostCount: p.repostCount,
        lastActiveAt: p.createdAt || null,
      });

      edges.push({
        source: person.id,
        target: postId,
        strength: 0.32,
        type: "post",
      });
      if (!friendNode.connections.includes(postId)) friendNode.connections.push(postId);
    });

    const friendPlatforms = (friendMesh.connectedAccounts || []).slice(0, 3);
    friendPlatforms.forEach((acct: any, accountIndex: number) => {
      const platformKey = acct.platform?.toLowerCase() || "";
      const platformNodeId = `friend-platform-${person.id}-${acct.id}`;
      const platformPos = ringPosition(
        friendNode.x,
        friendNode.y,
        138 + accountIndex * 12,
        accountIndex,
        Math.max(friendPlatforms.length, 1),
        (friendNode.orbitAngle ?? 0) - Math.PI / 5
      );

      addNode({
        id: platformNodeId,
        type: "platform",
        label: acct.platform,
        sublabel: acct.platformUsername ? `@${acct.platformUsername}` : `@${person.username}`,
        href: "/connected-accounts",
        sourceType: "platform",
        sourceId: acct.id,
        connectedAccountId: acct.id,
        syncStatus: acct.syncStatus,
        x: platformPos.x, y: platformPos.y, vx: 0, vy: 0,
        radius: 14 + Math.min((acct.topPosts?.length || 0) * 1.2, 5),
        color: PLATFORM_COLORS[platformKey] || NODE_COLORS.platform,
        opacity: 0.74,
        pulsePhase: friendIndex + accountIndex * 0.6,
        connections: [person.id],
        branchLabel: "Friend Platforms",
        platform: acct.platform,
        postCount: acct.topPosts?.length || 0,
        description: `${person.displayName || person.username}'s shared ${acct.platform} branch`,
      });

      edges.push({
        source: person.id,
        target: platformNodeId,
        strength: 0.26,
        type: "platform",
      });
      if (!friendNode.connections.includes(platformNodeId)) friendNode.connections.push(platformNodeId);

      const topPosts = (acct.topPosts || []).slice(0, 3);
      topPosts.forEach((pp: any, platformPostIndex: number) => {
        const postPos = ringPosition(
          platformPos.x,
          platformPos.y,
          62 + platformPostIndex * 7,
          platformPostIndex,
          Math.max(topPosts.length, 1),
          accountIndex + friendIndex * 0.35
        );
        const ppId = `friend-platform-post-${person.id}-${pp.id}`;
        const ppEngagement = (pp.likeCount || 0) + (pp.commentCount || 0) * 2 + (pp.viewCount || 0) * 0.01;
        const firstMedia = pp.media?.[0];
        const postType = pp.postType || firstMedia?.mediaType;
        const mediaType = inferPostMediaType(postType);
        const imageUrl = pp.thumbnailUrl || firstMedia?.thumbnailUrl || firstMedia?.url || null;

        addNode({
          id: ppId,
          type: "post",
          label: (pp.title || pp.content || `${acct.platform} post`).slice(0, 35) + ((pp.title || pp.content || "").length > 35 ? "..." : ""),
          sublabel: `@${person.username} · ${acct.platform}`,
          content: pp.content || pp.title,
          href: pp.url || undefined,
          sourceType: "platform",
          sourceId: pp.id,
          connectedAccountId: acct.id,
          platformPostId: pp.platformPostId,
          visibility: pp.visibility,
          isPinned: pp.isPinned,
          imageUrl,
          mediaType: imageUrl ? mediaType : "text",
          mediaAspectRatio: mediaAspectRatio(firstMedia?.width, firstMedia?.height, inferPostAspectRatio(postType, acct.platform)),
          x: postPos.x, y: postPos.y, vx: 0, vy: 0,
          radius: 8 + Math.min(ppEngagement * 0.18, 6),
          color: PLATFORM_COLORS[platformKey] || NODE_COLORS.post,
          opacity: 0.68,
          pulsePhase: platformPostIndex * 0.5 + friendIndex,
          connections: [platformNodeId],
          branchLabel: "Friend Mesh",
          likeCount: pp.likeCount,
          commentCount: pp.commentCount,
          repostCount: pp.shareCount,
          platform: acct.platform,
          lastActiveAt: pp.publishedAt || null,
        });
        edges.push({
          source: platformNodeId,
          target: ppId,
          strength: 0.22,
          type: "platform-content",
        });
        const platformNode = nodeMap.get(platformNodeId);
        if (platformNode && !platformNode.connections.includes(ppId)) platformNode.connections.push(ppId);
      });
    });
  });

  // --- Cross-connections: users who share communities ---
  // This creates the web-like interconnected feel
  const communityUserMap: Record<string, string[]> = {};
  for (const person of peopleToDraw) {
    const sharedComms = person.sharedCommunities || [];
    for (const commId of sharedComms) {
      if (!communityUserMap[commId]) communityUserMap[commId] = [];
      communityUserMap[commId].push(person.id);
    }
  }

  // Connect users who share the same community
  const crossEdgeSet = new Set<string>();
  for (const commId of Object.keys(communityUserMap)) {
    const users = communityUserMap[commId];
    // Connect pairs of users in this community (limited to avoid too many edges)
    for (let i = 0; i < Math.min(users.length, 4); i++) {
      for (let j = i + 1; j < Math.min(users.length, 4); j++) {
        const edgeKey = [users[i], users[j]].sort().join("|");
        if (!crossEdgeSet.has(edgeKey)) {
          crossEdgeSet.add(edgeKey);
          edges.push({
            source: users[i],
            target: users[j],
            strength: 0.15,
            type: "shared-community",
          });
          const nodeA = nodeMap.get(users[i]);
          const nodeB = nodeMap.get(users[j]);
          if (nodeA && !nodeA.connections.includes(users[j])) nodeA.connections.push(users[j]);
          if (nodeB && !nodeB.connections.includes(users[i])) nodeB.connections.push(users[i]);
        }
      }
    }
  }

  // --- Cross-follow edges: mutual follows between other users ---
  const mutualPeople = peopleToDraw.filter((p) => p.isMutual);
  for (let i = 0; i < Math.min(mutualPeople.length, 8); i++) {
    for (let j = i + 1; j < Math.min(mutualPeople.length, 8); j++) {
      const edgeKey = [mutualPeople[i].id, mutualPeople[j].id].sort().join("|");
      if (!crossEdgeSet.has(edgeKey)) {
        crossEdgeSet.add(edgeKey);
        edges.push({
          source: mutualPeople[i].id,
          target: mutualPeople[j].id,
          strength: 0.1,
          type: "cross-follow",
        });
        const nodeA = nodeMap.get(mutualPeople[i].id);
        const nodeB = nodeMap.get(mutualPeople[j].id);
        if (nodeA && !nodeA.connections.includes(mutualPeople[j].id)) nodeA.connections.push(mutualPeople[j].id);
        if (nodeB && !nodeB.connections.includes(mutualPeople[i].id)) nodeB.connections.push(mutualPeople[i].id);
      }
    }
  }

  // --- Communities (ring 4) ---
  const communities = data.communities || [];
  communities.forEach((c: any, i: number) => {
    const pos = ringPosition(cx, cy, 800, i, communities.length, Math.PI / 5);
    const communityId = "community-" + c.id;
    addNode({
      id: communityId,
      type: "community",
      label: c.name,
      sublabel: c.category || undefined,
      href: "/communities/" + c.slug,
      x: pos.x, y: pos.y, vx: 0, vy: 0,
      radius: 19 + Math.min((c.memberCount || 0) * 0.3, 10),
      color: NODE_COLORS.community,
      opacity: 0.9,
      pulsePhase: i * 0.6,
      connections: [userId],
      memberCount: c.memberCount,
      postCount: c.postCount,
      category: c.category,
      description: c.description || undefined,
    });
    edges.push({
      source: userId,
      target: communityId,
      strength: 0.5,
      type: "community",
    });

    // Connect community to users who are also in it
    for (const person of peopleToDraw) {
      const sharedComms = person.sharedCommunities || [];
      if (sharedComms.includes(c.id)) {
        edges.push({
          source: person.id,
          target: communityId,
          strength: 0.2,
          type: "community",
        });
        const personNode = nodeMap.get(person.id);
        if (personNode && !personNode.connections.includes(communityId)) {
          personNode.connections.push(communityId);
        }
      }
    }
  });

  // --- Interests (ring 5) ---
  const interests = data.interests || [];
  interests.forEach((tag: string, i: number) => {
    const pos = ringPosition(cx, cy, 960, i, interests.length, Math.PI / 8);
    const tagId = "tag-" + tag;
    addNode({
      id: tagId,
      type: "tag",
      label: "#" + tag,
      x: pos.x, y: pos.y, vx: 0, vy: 0,
      radius: 12,
      color: NODE_COLORS.tag,
      opacity: 0.85,
      pulsePhase: i * 0.9,
      connections: [userId],
    });
    edges.push({
      source: userId,
      target: tagId,
      strength: 0.3,
      type: "interest",
    });

    // Connect users who share this interest
    for (const person of peopleToDraw) {
      if (person.sharedInterests?.includes(tag)) {
        edges.push({
          source: person.id,
          target: tagId,
          strength: 0.15,
          type: "interest",
        });
        const personNode = nodeMap.get(person.id);
        if (personNode && !personNode.connections.includes(tagId)) {
          personNode.connections.push(tagId);
        }
      }
    }
  });

  // --- Posts (ring 6: outermost) ---
  const posts = data.posts || [];
  const maxPosts = 24;
  posts.slice(0, maxPosts).forEach((p: any, i: number) => {
    const pos = ringPosition(cx, cy, 1140, i, Math.min(posts.length, maxPosts), Math.PI / 10);
    const postId = "post-" + p.id;
    // Size posts by engagement
    const postEngagement = (p.likeCount || 0) + (p.commentCount || 0) * 2 + (p.repostCount || 0) * 3;
    const engagementRadius = Math.min(postEngagement * 0.5, 10);
    const firstMedia = p.media?.[0];
    const mediaType = inferPostMediaType(firstMedia?.type);
    const imageUrl = firstMedia?.url || null;

    addNode({
      id: postId,
      type: "post",
      label: (p.content || "Post").slice(0, 40) + ((p.content || "").length > 40 ? "..." : ""),
      content: p.content,
      href: "/feed/" + p.id,
      sourceType: "mesh",
      sourceId: p.id,
      imageUrl,
      mediaType: imageUrl ? mediaType : "text",
      mediaAspectRatio: mediaAspectRatio(firstMedia?.width, firstMedia?.height, imageUrl ? 1 : 1.7),
      x: pos.x, y: pos.y, vx: 0, vy: 0,
      radius: 12 + engagementRadius,
      color: NODE_COLORS.post,
      opacity: 0.8,
      pulsePhase: i * 0.5,
      connections: [userId],
      likeCount: p.likeCount,
      commentCount: p.commentCount,
      repostCount: p.repostCount,
      lastActiveAt: p.createdAt || null,
    });
    edges.push({
      source: userId,
      target: postId,
      strength: 0.25,
      type: "post",
    });

    // Connect post to its community if in one
    if (p.communityId) {
      const communityNodeId = "community-" + p.communityId;
      if (nodeIds.has(communityNodeId)) {
        edges.push({
          source: communityNodeId,
          target: postId,
          strength: 0.2,
          type: "post",
        });
      }
    }

    // Connect post to its tags
    if (p.tags) {
      for (const tag of p.tags) {
        const tagNodeId = "tag-" + tag;
        if (nodeIds.has(tagNodeId)) {
          edges.push({
            source: tagNodeId,
            target: postId,
            strength: 0.15,
            type: "interest",
          });
        }
      }
    }
  });

  // --- Recent activity (near the center) ---
  // Activity nodes make the Mesh a dashboard, not just a static map: notifications,
  // comments, reactions, messages, and platform syncs become clickable signals.
  const activities = data.activities || [];
  const maxActivities = 18;
  activities.slice(0, maxActivities).forEach((activity, i) => {
    const activityCount = Math.min(activities.length, maxActivities);
    const pos = ringPosition(cx, cy, 260, i, activityCount, -Math.PI / 2);
    const activityNodeId = `activity-${activity.id}`;
    const postNodeId = activity.sourcePostId ? `post-${activity.sourcePostId}` : null;
    const platformNodeId = activity.connectedAccountId ? `platform-${activity.connectedAccountId}` : null;
    const targetNodeId = postNodeId && nodeIds.has(postNodeId)
      ? postNodeId
      : platformNodeId && nodeIds.has(platformNodeId)
        ? platformNodeId
        : null;
    const signalStrength = activity.isUnread ? 0.95 : 0.55;

    addNode({
      id: activityNodeId,
      type: "activity",
      label: activity.label || "Activity",
      sublabel: activity.actor?.username ? `@${activity.actor.username}` : activity.type.replace(/-/g, " "),
      avatarUrl: activity.actor?.avatarUrl || null,
      href: activity.href || "/notifications",
      sourceType: "mesh",
      sourceId: activity.id,
      connectedAccountId: activity.connectedAccountId || undefined,
      x: pos.x, y: pos.y, vx: 0, vy: 0,
      radius: activity.isUnread ? 17 : 14,
      color: activity.isUnread ? "#7dd3fc" : NODE_COLORS.activity,
      opacity: activity.isUnread ? 1 : 0.82,
      pulsePhase: i * 0.55,
      connections: targetNodeId ? [userId, targetNodeId] : [userId],
      description: activity.summary || undefined,
      branchLabel: "Activity",
      activityType: activity.type,
      isUnread: activity.isUnread,
      lastActiveAt: activity.createdAt ? String(activity.createdAt) : null,
      importance: activity.isUnread ? 0.78 : 0.48,
    });

    edges.push({
      source: userId,
      target: activityNodeId,
      strength: signalStrength,
      type: "activity",
    });

    if (targetNodeId) {
      edges.push({
        source: activityNodeId,
        target: targetNodeId,
        strength: 0.42,
        type: "activity",
      });
      const targetNode = nodeMap.get(targetNodeId);
      if (targetNode && !targetNode.connections.includes(activityNodeId)) {
        targetNode.connections.push(activityNodeId);
      }
    }
  });

  // Update self node connections
  const selfNode = nodeMap.get(userId);
  if (selfNode) {
    selfNode.connections = nodes.filter((n) => n.type !== "self").map((n) => n.id);
  }

  return { nodes, edges };
}

/**
 * Build mesh data for viewing another user's mesh (from /api/users/[username]/mesh).
 */
export function buildUserMeshData(data: any, cx: number, cy: number): BuildResult {
  const nodes: MeshNode[] = [];
  const edges: MeshEdge[] = [];
  const nodeId = data.user?.id || "viewed-user";
  const addNode = (node: MeshNode) => {
    nodes.push(organizeNode(node, cx, cy));
  };

  addNode({
    id: nodeId,
    type: "self",
    label: data.user?.displayName || data.user?.username || "User",
    sublabel: data.user?.username ? "@" + data.user.username : undefined,
    avatarUrl: data.user?.avatarUrl,
    x: cx, y: cy, vx: 0, vy: 0,
    radius: 32,
    color: NODE_COLORS.self,
    opacity: 1,
    pulsePhase: 0,
    connections: [],
    followerCount: data.stats?.followers,
    postCount: data.stats?.posts,
    platformCount: data.stats?.platforms,
  });

  const following = data.following || [];
  following.slice(0, 30).forEach((f: any, i: number) => {
    const isMutual = !!f.isMutual;
    const pos = ringPosition(cx, cy, 250, i, Math.min(following.length, 30));
    addNode({
      id: f.id,
      type: "user",
      label: f.displayName || f.username,
      sublabel: "@" + f.username,
      avatarUrl: f.avatarUrl,
      href: "/profile/" + f.username,
      x: pos.x, y: pos.y, vx: 0, vy: 0,
      radius: isMutual ? 20 : 17,
      color: isMutual ? NODE_COLORS.mutual : NODE_COLORS.user,
      opacity: 1,
      pulsePhase: i * 0.4,
      connections: [nodeId],
      isMutual,
      followerCount: f.followerCount,
      postCount: f.postCount,
    });
    edges.push({
      source: nodeId,
      target: f.id,
      strength: isMutual ? 1.0 : 0.7,
      type: isMutual ? "mutual" : "follow",
    });
  });

  (data.communities || []).slice(0, 12).forEach((c: any, i: number) => {
    const pos = ringPosition(cx, cy, 390, i, Math.min((data.communities || []).length, 12), Math.PI / 5);
    const cid = "community-" + c.id;
    addNode({
      id: cid,
      type: "community",
      label: c.name,
      sublabel: c.slug ? `/${c.slug}` : undefined,
      href: c.slug ? "/communities/" + c.slug : undefined,
      x: pos.x, y: pos.y, vx: 0, vy: 0,
      radius: 16 + Math.min((c.memberCount || 0) * 0.02, 7),
      color: NODE_COLORS.community,
      opacity: 0.9,
      pulsePhase: i * 0.6,
      connections: [nodeId],
      memberCount: c.memberCount,
    });
    edges.push({
      source: nodeId,
      target: cid,
      strength: 0.5,
      type: "community",
    });
  });

  (data.platforms || []).slice(0, 8).forEach((platform: any, i: number) => {
    const pos = ringPosition(cx, cy, 520, i, Math.min((data.platforms || []).length, 8), Math.PI / 6);
    const platformId = `friend-platform-${platform.id}`;
    const platformKey = platform.platform?.toLowerCase() || "";

    addNode({
      id: platformId,
      type: "platform",
      label: platform.platform,
      sublabel: platform.platformUsername ? "@" + platform.platformUsername : undefined,
      x: pos.x, y: pos.y, vx: 0, vy: 0,
      radius: 18,
      color: PLATFORM_COLORS[platformKey] || NODE_COLORS.platform,
      opacity: 0.88,
      pulsePhase: i * 0.7,
      connections: [nodeId],
      postCount: platform.publicPosts?.length || 0,
      platform: platform.platform,
    });

    edges.push({
      source: nodeId,
      target: platformId,
      strength: 0.45,
      type: "platform",
    });

    (platform.publicPosts || []).slice(0, 5).forEach((post: any, j: number) => {
      const postPos = ringPosition(pos.x, pos.y, 80 + j * 8, j, Math.min((platform.publicPosts || []).length, 5), i);
      const postId = `friend-post-${platform.id}-${post.id}`;
      const mediaType = inferPostMediaType(post.postType);
      addNode({
        id: postId,
        type: "post",
        label: (post.title || post.content || "Post").slice(0, 34) + ((post.title || post.content || "").length > 34 ? "..." : ""),
        content: post.content,
        href: post.url || undefined,
        sourceType: "platform",
        sourceId: post.id,
        connectedAccountId: platform.id,
        platformPostId: post.platformPostId,
        visibility: post.visibility,
        isPinned: post.isPinned,
        imageUrl: post.thumbnailUrl,
        mediaType: post.thumbnailUrl ? mediaType : "text",
        mediaAspectRatio: normalizeMediaAspectRatio(inferPostAspectRatio(post.postType, platform.platform)),
        x: postPos.x, y: postPos.y, vx: 0, vy: 0,
        radius: 10 + Math.min(((post.likeCount || 0) + (post.commentCount || 0) * 2 + (post.viewCount || 0) * 0.01) * 0.06, 6),
        color: PLATFORM_COLORS[platformKey] || NODE_COLORS.post,
        opacity: 0.72,
        pulsePhase: j * 0.45,
        connections: [platformId],
        likeCount: post.likeCount,
        commentCount: post.commentCount,
        platform: platform.platform,
        lastActiveAt: post.publishedAt || null,
      });

      edges.push({
        source: platformId,
        target: postId,
        strength: 0.28,
        type: "platform-content",
      });
    });
  });

  (data.interests || []).slice(0, 18).forEach((tag: string, i: number) => {
    const pos = ringPosition(cx, cy, 640, i, Math.min((data.interests || []).length, 18), Math.PI / 8);
    const tagId = "friend-tag-" + tag;
    addNode({
      id: tagId,
      type: "tag",
      label: "#" + tag,
      x: pos.x, y: pos.y, vx: 0, vy: 0,
      radius: 11,
      color: NODE_COLORS.tag,
      opacity: 0.8,
      pulsePhase: i * 0.4,
      connections: [nodeId],
    });
    edges.push({
      source: nodeId,
      target: tagId,
      strength: 0.22,
      type: "interest",
    });
  });

  if (nodes[0]) {
    nodes[0].connections = nodes.filter((n) => n.id !== nodeId).map((n) => n.id);
  }

  return { nodes, edges };
}

/**
 * Preload avatar images for nodes.
 * Populates the cache map with HTMLImageElements keyed by node ID.
 */
export function preloadNodeImages(nodes: MeshNode[], cache: Map<string, HTMLImageElement | null>) {
  for (const node of nodes) {
    const url = node.avatarUrl || node.imageUrl;
    if (url && !cache.has(node.id)) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = url;
      cache.set(node.id, img);
    }
  }
}
