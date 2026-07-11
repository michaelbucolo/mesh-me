// Builds a constellation model from the /api/mesh response.
//
// The model is a shallow tree: you at the center, a ring of labelled category
// branches (your whole online presence, grouped), and each branch's items
// underneath it. Items that have their own footprint (a connected platform's
// posts, a persona's accounts, a friend's shared world) carry children so they
// can be opened in place. Layout is computed separately by scene-layout.ts.

import type { MeshApiResponse } from "../mesh-data";
import { PLATFORM_COLORS } from "../mesh-types";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type BranchKey =
  | "identities"
  | "platforms"
  | "people"
  | "communities"
  | "posts"
  | "activity";

export type SceneNodeKind =
  | "self"
  | "branch"
  | "persona"
  | "platform"
  | "person"
  | "post"
  | "community"
  | "interest"
  | "activity";

export interface SceneNode {
  id: string;
  kind: SceneNodeKind;
  label: string;
  sublabel?: string;
  description?: string;
  avatarUrl?: string | null;
  imageUrl?: string | null;
  content?: string;
  color: string;
  parentId: string | null;
  childIds: string[];
  branch: BranchKey | null;
  /** External or internal link opened from the detail sheet. */
  href?: string;
  /** For person nodes: the user whose mesh we can travel into. */
  userId?: string;
  username?: string;
  isVerified?: boolean;
  status?: string;
  /** Count shown on collapsed branch / item hubs. */
  count?: number;
  /** Relative visual weight (drives star size); 0..1. */
  weight: number;
  meta?: { label: string; value: string }[];
  // Layout output (filled by scene-layout)
  x: number;
  y: number;
  angle: number;
  depth: number;
  // Animated display position (spring-driven, updated every frame)
  dx: number;
  dy: number;
  vx: number;
  vy: number;
  /** Timestamp (rAF clock) this node joined the mesh, for the arrival animation. */
  bornAt?: number;
}

export interface SceneModel {
  selfId: string;
  nodes: Map<string, SceneNode>;
  /** Branch hub ids in display order. */
  branchOrder: string[];
}

export const BRANCH_META: Record<BranchKey, { label: string; color: string }> = {
  identities: { label: "Identities", color: "#c084fc" },
  platforms: { label: "Platforms", color: "#f59e0b" },
  people: { label: "People", color: "#818cf8" },
  communities: { label: "Communities", color: "#ec4899" },
  posts: { label: "Posts", color: "#34d399" },
  activity: { label: "Activity", color: "#38bdf8" },
};

// Branches render clockwise from the top in this order.
const BRANCH_DISPLAY_ORDER: BranchKey[] = [
  "identities",
  "platforms",
  "people",
  "communities",
  "posts",
  "activity",
];

const MAX_PEOPLE = 24;
const MAX_POSTS = 18;
const MAX_PLATFORM_POSTS = 6;
const MAX_PERSONA_ACCOUNTS = 6;
const MAX_COMMUNITIES = 12;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function truncate(value: string, max: number): string {
  const trimmed = value.trim();
  return trimmed.length > max ? trimmed.slice(0, max - 1).trimEnd() + "…" : trimmed;
}

function platformColor(platform: string | null | undefined): string {
  return PLATFORM_COLORS[(platform || "").toLowerCase()] || BRANCH_META.platforms.color;
}

export function buildSceneModel(data: MeshApiResponse): SceneModel {
  const nodes = new Map<string, SceneNode>();
  const branchOrder: string[] = [];

  const add = (node: Omit<SceneNode, "x" | "y" | "angle" | "depth" | "dx" | "dy" | "vx" | "vy">) => {
    const full: SceneNode = { ...node, x: 0, y: 0, angle: 0, depth: 0, dx: 0, dy: 0, vx: 0, vy: 0 };
    nodes.set(full.id, full);
    if (full.parentId) {
      const parent = nodes.get(full.parentId);
      if (parent && !parent.childIds.includes(full.id)) parent.childIds.push(full.id);
    }
    return full;
  };

  const selfId = data.user.id;
  add({
    id: selfId,
    kind: "self",
    label: data.user.displayName || data.user.username,
    sublabel: "@" + data.user.username,
    description: data.user.bio || undefined,
    avatarUrl: data.user.avatarUrl,
    color: "#a5b4fc",
    parentId: null,
    childIds: [],
    branch: null,
    href: "/profile/" + data.user.username,
    isVerified: data.user.isVerified,
    weight: 1,
  });

  const branchId = (key: BranchKey) => `branch:${key}`;

  const ensureBranch = (key: BranchKey, count: number) => {
    const id = branchId(key);
    if (nodes.has(id)) {
      const existing = nodes.get(id)!;
      existing.count = count;
      return existing;
    }
    branchOrder.push(id);
    return add({
      id,
      kind: "branch",
      label: BRANCH_META[key].label,
      color: BRANCH_META[key].color,
      parentId: selfId,
      childIds: [],
      branch: key,
      count,
      weight: 0.62,
    });
  };

  // --- Identities (personas / alter egos) ---
  const personas: any[] = data.alterEgos || [];
  if (personas.length) {
    ensureBranch("identities", personas.length);
    personas.forEach((ego: any) => {
      const accounts: any[] = (ego.connectedAccounts || []).slice(0, MAX_PERSONA_ACCOUNTS);
      const personaId = `persona:${ego.id}`;
      add({
        id: personaId,
        kind: "persona",
        label: ego.displayName || ego.username,
        sublabel: "@" + ego.username,
        avatarUrl: ego.avatarUrl,
        color: BRANCH_META.identities.color,
        parentId: branchId("identities"),
        childIds: [],
        branch: "identities",
        href: ego.username ? "/profile/" + ego.username : undefined,
        count: accounts.length || undefined,
        weight: 0.52,
      });
      accounts.forEach((acct: any) => {
        add({
          id: `persona-acct:${ego.id}:${acct.id}`,
          kind: "platform",
          label: acct.platform,
          sublabel: acct.platformUsername ? "@" + acct.platformUsername : undefined,
          color: platformColor(acct.platform),
          parentId: personaId,
          childIds: [],
          branch: "identities",
          href: "/connected-accounts",
          weight: 0.34,
        });
      });
    });
  }

  // --- Platforms (connected accounts) with their top posts ---
  const platforms: any[] = data.connectedAccounts || [];
  if (platforms.length) {
    ensureBranch("platforms", platforms.length);
    platforms.forEach((acct: any) => {
      const platformId = `platform:${acct.id}`;
      const topPosts: any[] = (acct.topPosts || []).slice(0, MAX_PLATFORM_POSTS);
      const followers = acct.analytics?.followerCount ?? acct.counts?.platformFollowers ?? 0;
      const postCount = acct.counts?.platformPosts ?? topPosts.length;
      add({
        id: platformId,
        kind: "platform",
        label: acct.platform,
        sublabel: acct.platformUsername ? "@" + acct.platformUsername : undefined,
        color: platformColor(acct.platform),
        parentId: branchId("platforms"),
        childIds: [],
        branch: "platforms",
        href: "/connected-accounts",
        count: topPosts.length || undefined,
        status: acct.syncStatus,
        weight: clamp01(0.4 + Math.min(postCount, 200) / 400),
        meta: [
          { label: "Posts", value: String(postCount) },
          { label: "Followers", value: String(followers) },
        ],
      });
      topPosts.forEach((pp: any) => {
        const media = pp.media?.[0];
        const image = pp.thumbnailUrl || media?.thumbnailUrl || media?.url || null;
        add({
          id: `platform-post:${acct.id}:${pp.id}`,
          kind: "post",
          label: truncate(pp.title || pp.content || `${acct.platform} post`, 40),
          sublabel: acct.platform,
          content: pp.content || pp.title,
          imageUrl: image,
          color: platformColor(acct.platform),
          parentId: platformId,
          childIds: [],
          branch: "platforms",
          href: pp.url || undefined,
          weight: clamp01(0.22 + Math.min((pp.likeCount || 0) + (pp.commentCount || 0) * 2, 400) / 800),
          meta: [
            { label: "Likes", value: String(pp.likeCount ?? 0) },
            { label: "Comments", value: String(pp.commentCount ?? 0) },
          ],
        });
      });
    });
  }

  // --- People (following + followers, mutuals first) ---
  const seen = new Set<string>();
  const people: any[] = [];
  for (const f of data.following || []) {
    if (!seen.has(f.id)) { seen.add(f.id); people.push({ ...f, isFollowing: true }); }
  }
  for (const f of data.followers || []) {
    if (!seen.has(f.id)) { seen.add(f.id); people.push({ ...f, isFollowing: false }); }
  }
  people.sort((a, b) => {
    if (!!a.isMutual !== !!b.isMutual) return a.isMutual ? -1 : 1;
    return (b.interactionCount || 0) - (a.interactionCount || 0);
  });
  const friendMeshMap = new Map((data.friendMeshes || []).map((f) => [f.user.id, f]));
  const peopleToShow = people.slice(0, MAX_PEOPLE);
  if (peopleToShow.length) {
    ensureBranch("people", people.length);
    peopleToShow.forEach((p: any) => {
      const personId = `person:${p.id}`;
      const friendMesh = friendMeshMap.get(p.id);
      const friendPosts: any[] = ((friendMesh?.posts as any[]) || []).slice(0, 4);
      add({
        id: personId,
        kind: "person",
        label: p.displayName || p.username,
        sublabel: "@" + p.username,
        avatarUrl: p.avatarUrl,
        color: p.isMutual ? "#a78bfa" : BRANCH_META.people.color,
        parentId: branchId("people"),
        childIds: [],
        branch: "people",
        href: "/profile/" + p.username,
        userId: p.id,
        username: p.username,
        status: p.status || "offline",
        count: friendPosts.length || undefined,
        weight: clamp01(0.34 + (p.isMutual ? 0.16 : 0) + Math.min(p.interactionCount || 0, 40) / 120),
        meta: [
          { label: "Followers", value: String(p.followerCount ?? p._count?.followers ?? 0) },
          { label: "Posts", value: String(p.postCount ?? p._count?.posts ?? 0) },
        ],
      });
      friendPosts.forEach((fp: any) => {
        const media = fp.media?.[0];
        add({
          id: `friend-post:${p.id}:${fp.id}`,
          kind: "post",
          label: truncate(fp.content || "Post", 40),
          sublabel: "@" + p.username,
          content: fp.content,
          imageUrl: media?.url || null,
          color: BRANCH_META.posts.color,
          parentId: personId,
          childIds: [],
          branch: "people",
          href: "/feed/" + fp.id,
          weight: 0.24,
          meta: [
            { label: "Likes", value: String(fp.likeCount ?? fp._count?.likes ?? 0) },
            { label: "Comments", value: String(fp.commentCount ?? fp._count?.comments ?? 0) },
          ],
        });
      });
    });
  }

  // --- Communities ---
  const communities: any[] = (data.communities || []).slice(0, MAX_COMMUNITIES);
  if (communities.length) {
    ensureBranch("communities", (data.communities || []).length);
    communities.forEach((c: any) => {
      add({
        id: `community:${c.id}`,
        kind: "community",
        label: c.name,
        sublabel: c.category || undefined,
        color: BRANCH_META.communities.color,
        parentId: branchId("communities"),
        childIds: [],
        branch: "communities",
        href: "/communities/" + c.slug,
        weight: clamp01(0.32 + Math.min(c.memberCount || 0, 1000) / 2000),
        meta: [
          { label: "Members", value: String(c.memberCount ?? c._count?.members ?? 0) },
          { label: "Posts", value: String(c.postCount ?? c._count?.posts ?? 0) },
        ],
      });
    });
  }

  // --- Posts (your own native posts) ---
  const posts: any[] = (data.posts || []).slice(0, MAX_POSTS);
  if (posts.length) {
    ensureBranch("posts", (data.posts || []).length);
    posts.forEach((p: any) => {
      const media = p.media?.[0];
      add({
        id: `post:${p.id}`,
        kind: "post",
        label: truncate(p.content || "Post", 40),
        content: p.content,
        imageUrl: media?.url || null,
        color: BRANCH_META.posts.color,
        parentId: branchId("posts"),
        childIds: [],
        branch: "posts",
        href: "/feed/" + p.id,
        weight: clamp01(0.24 + Math.min((p.likeCount || 0) + (p.commentCount || 0) * 2, 400) / 800),
        meta: [
          { label: "Likes", value: String(p.likeCount ?? 0) },
          { label: "Comments", value: String(p.commentCount ?? 0) },
        ],
      });
    });
  }

  // --- Activity ---
  const activities: any[] = (data.activities || []).slice(0, 14);
  if (activities.length) {
    ensureBranch("activity", (data.activities || []).length);
    activities.forEach((a: any) => {
      add({
        id: `activity:${a.id}`,
        kind: "activity",
        label: truncate(a.label || "Activity", 40),
        sublabel: a.actor?.username ? "@" + a.actor.username : a.type?.replace(/-/g, " "),
        avatarUrl: a.actor?.avatarUrl || null,
        content: a.summary || undefined,
        color: a.isUnread ? "#7dd3fc" : BRANCH_META.activity.color,
        parentId: branchId("activity"),
        childIds: [],
        branch: "activity",
        href: a.href || "/notifications",
        weight: a.isUnread ? 0.38 : 0.26,
      });
    });
  }

  // Order branches by the canonical display order.
  branchOrder.sort(
    (a, b) =>
      BRANCH_DISPLAY_ORDER.indexOf(nodes.get(a)!.branch as BranchKey) -
      BRANCH_DISPLAY_ORDER.indexOf(nodes.get(b)!.branch as BranchKey),
  );

  return { selfId, nodes, branchOrder };
}
