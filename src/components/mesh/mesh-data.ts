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

export function buildMeshData(data: MeshApiResponse, cx: number, cy: number): BuildResult {
  const nodes: MeshNode[] = [];
  const edges: MeshEdge[] = [];

  const userId = data.user.id;

  // --- Self node (center) ---
  nodes.push({
    id: userId,
    type: "self",
    label: data.user.displayName || data.user.username,
    sublabel: "@" + data.user.username,
    avatarUrl: data.user.avatarUrl,
    href: "/profile/" + data.user.username,
    x: cx, y: cy, vx: 0, vy: 0,
    radius: 28,
    color: NODE_COLORS.self,
    opacity: 1,
    pulsePhase: 0,
    connections: [],
    status: "online",
  });

  // --- Alter Egos (ring 1: close to self) ---
  const alterEgos = data.alterEgos || [];
  alterEgos.forEach((ego: any, i: number) => {
    const pos = ringPosition(cx, cy, 80, i, alterEgos.length, Math.PI / 6);
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
    });
    edges.push({
      source: userId,
      target: "alter-ego-" + ego.id,
      strength: 1.0,
      type: "alter-ego",
    });
  });

  // --- Connected Platforms (ring 2) ---
  const platforms = data.connectedAccounts || [];
  platforms.forEach((acct: any, i: number) => {
    const pos = ringPosition(cx, cy, 130, i, platforms.length, Math.PI / 4);
    const platformKey = acct.platform?.toLowerCase() || "";
    nodes.push({
      id: "platform-" + acct.id,
      type: "platform",
      label: acct.platform,
      sublabel: acct.platformUsername ? "@" + acct.platformUsername : undefined,
      href: "/connected-accounts",
      x: pos.x, y: pos.y, vx: 0, vy: 0,
      radius: 14,
      color: PLATFORM_COLORS[platformKey] || NODE_COLORS.platform,
      opacity: 0.9,
      pulsePhase: i * 0.8,
      connections: [userId],
      platform: acct.platform,
    });
    edges.push({
      source: userId,
      target: "platform-" + acct.id,
      strength: 0.7,
      type: "platform",
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
  allPeople.slice(0, maxPeople).forEach((f, i) => {
    const isMutual = !!f.isMutual;
    const interactionCount = f.interactionCount || 0;
    const baseDist = isMutual ? 180 : 250;
    const interactionPull = Math.min(interactionCount * 3, 50);
    const pos = ringPosition(cx, cy, baseDist - interactionPull, i, Math.min(allPeople.length, maxPeople));

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
      connections: [userId],
      isMutual,
      isFollowing: f.isFollowing,
      followerCount: f.followerCount ?? f._count?.followers,
      postCount: f.postCount ?? f._count?.posts,
      sharedInterests: f.sharedInterests,
      interactionCount,
      status: f.status || "offline",
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

  // --- Communities (ring 4) ---
  const communities = data.communities || [];
  communities.forEach((c: any, i: number) => {
    const pos = ringPosition(cx, cy, 320, i, communities.length, Math.PI / 5);
    const communityId = "community-" + c.id;
    nodes.push({
      id: communityId,
      type: "community",
      label: c.name,
      sublabel: c.category || undefined,
      href: "/communities/" + c.slug,
      x: pos.x, y: pos.y, vx: 0, vy: 0,
      radius: 14,
      color: NODE_COLORS.community,
      opacity: 0.9,
      pulsePhase: i * 0.6,
      connections: [userId],
      memberCount: c.memberCount,
      postCount: c.postCount,
      category: c.category,
    });
    edges.push({
      source: userId,
      target: communityId,
      strength: 0.5,
      type: "community",
    });
  });

  // --- Interests (ring 5) ---
  const interests = data.interests || [];
  interests.forEach((tag: string, i: number) => {
    const pos = ringPosition(cx, cy, 380, i, interests.length, Math.PI / 8);
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
    for (const person of allPeople.slice(0, maxPeople)) {
      if (person.sharedInterests?.includes(tag)) {
        edges.push({
          source: person.id,
          target: tagId,
          strength: 0.15,
          type: "interest",
        });
        if (!nodes.find((n) => n.id === person.id)?.connections.includes(tagId)) {
          const personNode = nodes.find((n) => n.id === person.id);
          if (personNode) personNode.connections.push(tagId);
        }
      }
    }
  });

  // --- Posts (ring 6: outermost) ---
  const posts = data.posts || [];
  posts.slice(0, 20).forEach((p: any, i: number) => {
    const pos = ringPosition(cx, cy, 440, i, Math.min(posts.length, 20), Math.PI / 10);
    const postId = "post-" + p.id;
    nodes.push({
      id: postId,
      type: "post",
      label: (p.content || "Post").slice(0, 30) + ((p.content || "").length > 30 ? "..." : ""),
      content: p.content,
      href: "/feed/" + p.id,
      x: pos.x, y: pos.y, vx: 0, vy: 0,
      radius: 10,
      color: NODE_COLORS.post,
      opacity: 0.8,
      pulsePhase: i * 0.5,
      connections: [userId],
      likeCount: p.likeCount,
      commentCount: p.commentCount,
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
    radius: 26,
    color: NODE_COLORS.self,
    opacity: 1,
    pulsePhase: 0,
    connections: [],
  });

  // Following
  (data.following || []).slice(0, 20).forEach((f: any, i: number) => {
    const isMutual = !!f.isMutual;
    const pos = ringPosition(cx, cy, 160, i, Math.min((data.following || []).length, 20));
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
  (data.communities || []).slice(0, 6).forEach((c: any, i: number) => {
    const pos = ringPosition(cx, cy, 200, i, Math.min((data.communities || []).length, 6), Math.PI / 3);
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
