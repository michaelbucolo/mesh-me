// Builds MeshNode[] and MeshEdge[] from the /api/mesh response.
// Deterministic layout: positions based on type rings + index angle, no Math.random().

import type { MeshNode, MeshEdge } from "./mesh-types";
import { NODE_COLORS, PLATFORM_COLORS } from "./mesh-types";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface MeshApiResponse {
  user: { id: string; username: string; displayName: string | null; avatarUrl: string | null; bio: string | null };
  following: any[];
  followers: any[];
  communities: any[];
  interests: string[];
  posts: any[];
  connectedAccounts: any[];
  alterEgos: any[];
  meshiPreference: { colorTheme: string; hatStyle: string; faceStyle: string };
  stats: {
    followingCount: number;
    followerCount: number;
    mutualCount: number;
    communityCount: number;
    postCount: number;
    interestCount: number;
    connectedPlatformCount: number;
    alterEgoCount: number;
  };
}

interface BuildResult {
  nodes: MeshNode[];
  edges: MeshEdge[];
}

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

export function buildMeshData(data: MeshApiResponse, cx: number, cy: number): BuildResult {
  const nodes: MeshNode[] = [];
  const edges: MeshEdge[] = [];

  const userId = data.user.id;

  // Build community ID → name lookup for resolving shared communities
  const communityNameMap: Record<string, string> = {};
  for (const c of data.communities || []) {
    communityNameMap[c.id] = c.name;
  }

  // --- Self node (center) ---
  nodes.push({
    id: userId,
    type: "self",
    label: data.user.displayName || data.user.username,
    sublabel: "@" + data.user.username,
    avatarUrl: data.user.avatarUrl,
    href: "/profile/" + data.user.username,
    x: cx, y: cy, vx: 0, vy: 0,
    radius: 32,
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
    const pos = ringPosition(cx, cy, 120, i, alterEgos.length, Math.PI / 6);
    nodes.push({
      id: "alter-ego-" + ego.id,
      type: "alter-ego",
      label: ego.displayName || ego.username,
      sublabel: "@" + ego.username,
      avatarUrl: ego.avatarUrl,
      x: pos.x, y: pos.y, vx: 0, vy: 0,
      radius: 18,
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
    const pos = ringPosition(cx, cy, 240, i, platforms.length, Math.PI / 4);
    const platformKey = acct.platform?.toLowerCase() || "";
    const analytics = acct.analytics || null;
    const totalPosts = acct.counts?.platformPosts || 0;
    const totalFollowers = acct.counts?.platformFollowers || 0;

    nodes.push({
      id: "platform-" + acct.id,
      type: "platform",
      label: acct.platform,
      sublabel: acct.platformUsername ? "@" + acct.platformUsername : undefined,
      href: "/connected-accounts",
      x: pos.x, y: pos.y, vx: 0, vy: 0,
      radius: 16 + Math.min(totalPosts * 0.2, 8),
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
      target: "platform-" + acct.id,
      strength: 0.7,
      type: "platform",
    });

    // --- Platform top posts as sub-nodes orbiting the platform ---
    const topPosts = acct.topPosts || [];
    topPosts.forEach((pp: any, pi: number) => {
      const subPos = ringPosition(pos.x, pos.y, 55 + pi * 8, pi, topPosts.length, Math.PI / 3 + i);
      const ppId = "pp-" + pp.id;
      const ppEngagement = (pp.likeCount || 0) + (pp.commentCount || 0) * 2 + (pp.viewCount || 0) * 0.01;
      nodes.push({
        id: ppId,
        type: "post",
        label: (pp.title || pp.content || pp.postType || "Post").slice(0, 35) + ((pp.title || pp.content || "").length > 35 ? "..." : ""),
        content: pp.content || pp.title,
        href: pp.url || undefined,
        imageUrl: pp.thumbnailUrl || null,
        x: subPos.x, y: subPos.y, vx: 0, vy: 0,
        radius: 7 + Math.min(ppEngagement * 0.3, 6),
        color: PLATFORM_COLORS[platformKey] || NODE_COLORS.post,
        opacity: 0.75,
        pulsePhase: pi * 0.6 + i,
        connections: ["platform-" + acct.id],
        likeCount: pp.likeCount,
        commentCount: pp.commentCount,
        repostCount: pp.shareCount,
        platform: acct.platform,
        lastActiveAt: pp.publishedAt || null,
      });
      edges.push({
        source: "platform-" + acct.id,
        target: ppId,
        strength: 0.35,
        type: "platform-content",
      });
    });

    // --- Platform top followers as sub-nodes ---
    const topFollowers = acct.topFollowers || [];
    topFollowers.slice(0, 6).forEach((pf: any, fi: number) => {
      const subPos = ringPosition(pos.x, pos.y, 75 + fi * 6, fi, Math.min(topFollowers.length, 6), -Math.PI / 4 + i);
      const pfId = "pf-" + pf.id;
      nodes.push({
        id: pfId,
        type: "user",
        label: pf.displayName || pf.username || "User",
        sublabel: pf.username ? "@" + pf.username : undefined,
        avatarUrl: pf.avatarUrl,
        href: pf.profileUrl || undefined,
        x: subPos.x, y: subPos.y, vx: 0, vy: 0,
        radius: 9 + Math.min((pf.followerCount || 0) * 0.001, 4),
        color: PLATFORM_COLORS[platformKey] || NODE_COLORS.user,
        opacity: 0.7,
        pulsePhase: fi * 0.7 + i,
        connections: ["platform-" + acct.id],
        isMutual: pf.isMutual,
        followerCount: pf.followerCount,
        platform: acct.platform,
      });
      edges.push({
        source: "platform-" + acct.id,
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
    const baseDist = isMutual ? 340 : 440;
    const interactionPull = Math.min(interactionCount * 4, 60);
    const ringRadius = baseDist - interactionPull;
    const pos = ringPosition(cx, cy, ringRadius, i, peopleToDraw.length);

    const engagement = computeEngagement(f);
    // Scale radius by engagement — more engaged users are bigger
    const engagementBoost = Math.min(engagement * 0.02, 6);

    nodes.push({
      id: f.id,
      type: "user",
      label: f.displayName || f.username,
      sublabel: "@" + f.username,
      avatarUrl: f.avatarUrl,
      href: "/profile/" + f.username,
      x: pos.x, y: pos.y, vx: 0, vy: 0,
      radius: (isMutual ? 18 : 14) + engagementBoost,
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
          // Update connections arrays
          const nodeA = nodes.find((n) => n.id === users[i]);
          const nodeB = nodes.find((n) => n.id === users[j]);
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
        const nodeA = nodes.find((n) => n.id === mutualPeople[i].id);
        const nodeB = nodes.find((n) => n.id === mutualPeople[j].id);
        if (nodeA && !nodeA.connections.includes(mutualPeople[j].id)) nodeA.connections.push(mutualPeople[j].id);
        if (nodeB && !nodeB.connections.includes(mutualPeople[i].id)) nodeB.connections.push(mutualPeople[i].id);
      }
    }
  }

  // --- Communities (ring 4) ---
  const communities = data.communities || [];
  communities.forEach((c: any, i: number) => {
    const pos = ringPosition(cx, cy, 560, i, communities.length, Math.PI / 5);
    const communityId = "community-" + c.id;
    nodes.push({
      id: communityId,
      type: "community",
      label: c.name,
      sublabel: c.category || undefined,
      href: "/communities/" + c.slug,
      x: pos.x, y: pos.y, vx: 0, vy: 0,
      radius: 16 + Math.min((c.memberCount || 0) * 0.3, 8),
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
        const personNode = nodes.find((n) => n.id === person.id);
        if (personNode && !personNode.connections.includes(communityId)) {
          personNode.connections.push(communityId);
        }
      }
    }
  });

  // --- Interests (ring 5) ---
  const interests = data.interests || [];
  interests.forEach((tag: string, i: number) => {
    const pos = ringPosition(cx, cy, 680, i, interests.length, Math.PI / 8);
    const tagId = "tag-" + tag;
    nodes.push({
      id: tagId,
      type: "tag",
      label: "#" + tag,
      x: pos.x, y: pos.y, vx: 0, vy: 0,
      radius: 10,
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
        const personNode = nodes.find((n) => n.id === person.id);
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
    const pos = ringPosition(cx, cy, 820, i, Math.min(posts.length, maxPosts), Math.PI / 10);
    const postId = "post-" + p.id;
    // Size posts by engagement
    const postEngagement = (p.likeCount || 0) + (p.commentCount || 0) * 2 + (p.repostCount || 0) * 3;
    const engagementRadius = Math.min(postEngagement * 0.5, 8);

    nodes.push({
      id: postId,
      type: "post",
      label: (p.content || "Post").slice(0, 40) + ((p.content || "").length > 40 ? "..." : ""),
      content: p.content,
      href: "/feed/" + p.id,
      x: pos.x, y: pos.y, vx: 0, vy: 0,
      radius: 10 + engagementRadius,
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
      if (nodes.some((n) => n.id === communityNodeId)) {
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
        if (nodes.some((n) => n.id === tagNodeId)) {
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

  // Update self node connections
  const selfNode = nodes[0];
  selfNode.connections = nodes.filter((n) => n.type !== "self").map((n) => n.id);

  return { nodes, edges };
}

/**
 * Build mesh data for viewing another user's mesh (from /api/users/[username]/mesh).
 */
export function buildUserMeshData(data: any, cx: number, cy: number): BuildResult {
  const nodes: MeshNode[] = [];
  const edges: MeshEdge[] = [];
  const nodeId = data.user?.id || "viewed-user";

  nodes.push({
    id: nodeId,
    type: "self",
    label: data.user?.displayName || data.user?.username || "User",
    sublabel: data.user?.username ? "@" + data.user.username : undefined,
    avatarUrl: data.user?.avatarUrl,
    x: cx, y: cy, vx: 0, vy: 0,
    radius: 28,
    color: NODE_COLORS.self,
    opacity: 1,
    pulsePhase: 0,
    connections: [],
  });

  // Following
  (data.following || []).slice(0, 30).forEach((f: any, i: number) => {
    const isMutual = !!f.isMutual;
    const pos = ringPosition(cx, cy, 160, i, Math.min((data.following || []).length, 30));
    nodes.push({
      id: f.id,
      type: "user",
      label: f.displayName || f.username,
      sublabel: "@" + f.username,
      avatarUrl: f.avatarUrl,
      href: "/profile/" + f.username,
      x: pos.x, y: pos.y, vx: 0, vy: 0,
      radius: isMutual ? 18 : 14,
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

  // Communities
  (data.communities || []).slice(0, 10).forEach((c: any, i: number) => {
    const pos = ringPosition(cx, cy, 220, i, Math.min((data.communities || []).length, 10), Math.PI / 3);
    const cid = "community-" + c.id;
    nodes.push({
      id: cid,
      type: "community",
      label: c.name,
      x: pos.x, y: pos.y, vx: 0, vy: 0,
      radius: 14,
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

  // Update self connections
  nodes[0].connections = nodes.filter((n) => n.type !== "self").map((n) => n.id);

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
