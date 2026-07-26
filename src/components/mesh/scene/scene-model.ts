// Builds the constellation model from the /api/mesh response.
//
// The world is organized the way people actually hold their world in their
// heads: YOU at the center; the people you genuinely talk to physically CLOSE
// to you and acquaintances further out (closeness is distance); everything
// anyone made fanning outward from its maker with the newest work nearest
// (time flows outward); and live people visibly alive. Every placement has a
// stated reason — nothing on the mesh is arbitrary. Layout is computed
// separately by sim/layout.ts.

import { bestStillUrl, playableVideoUrl } from "@/lib/external-media";
import { branchFill } from "@/lib/palette";
import type { MeshApiResponse } from "../core/domain";
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
  /** Playable video FILE for the in-mesh viewer — never a page link. */
  videoUrl?: string | null;
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
  /** For person nodes: whether you follow them / follow each other, so the
   *  detail card can show the right Follow / Following state without a fetch. */
  isFollowing?: boolean;
  isMutual?: boolean;
  status?: string;
  /** Count shown on collapsed branch / item hubs. */
  count?: number;
  /** Relative visual weight (drives star size); 0..1. */
  weight: number;
  /** People: 0..1 real relationship strength — drives distance from you. */
  closeness?: number;
  /** Content: 0..1 recency — new work glows, old work fades like memory. */
  freshness?: number;
  /** Content created since your last visit gets a visible mark. */
  isNew?: boolean;
  /** Source hub (platform/person) the VIEWER muted — its content is withheld
   *  server-side; the hub stays so the detail sheet can offer Unmute. */
  muted?: boolean;
  /** Content creation time (ms epoch) — time flows outward on the mesh. */
  createdAtMs?: number;
  /** Honest one-line reason this node sits where it sits. */
  placeReason?: string;
  meta?: { label: string; value: string }[];
  // Layout output (filled by sim/layout)
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
}

// Colour comes from the palette now, not from Tailwind's 400 ramp. See
// src/lib/palette.ts for which plastic each branch is made of and why — six of
// these were within 13deg of a plastic the product already owned, which reads
// as the plastic rendered wrong rather than as a second colour.
const BRANCH_META: Record<BranchKey, { label: string; color: string }> = {
  identities: { label: "Identities", color: branchFill("identities") },
  platforms: { label: "Platforms", color: branchFill("platforms") },
  people: { label: "People", color: branchFill("people") },
  communities: { label: "Communities", color: branchFill("communities") },
  posts: { label: "Posts", color: branchFill("posts") },
  activity: { label: "Activity", color: branchFill("activity") },
};

// Kept deliberately lean: the mesh reads as a constellation of the most
// recent, most alive things — not an archive. Everything else lives in the
// list view and search, one tap away.
const MAX_PEOPLE = 24;
const MAX_POSTS = 12;
const MAX_PLATFORM_POSTS = 4;

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

function toMs(value: string | number | Date | null | undefined): number | undefined {
  if (value == null) return undefined;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : undefined;
}

/** Compact human age: "5m", "3h", "2d", "4mo", "1y". */
function relAge(ms: number): string {
  const s = Math.max(60, (Date.now() - ms) / 1000);
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d`;
  if (s < 86400 * 365) return `${Math.floor(s / (86400 * 30))}mo`;
  return `${Math.floor(s / (86400 * 365))}y`;
}

// Recency decay with a ~3-week feel: this week ≈ bright, a season old ≈ dim,
// years old ≈ a faint memory. Undated content sits in the middle.
function freshnessOf(ms: number | undefined): number {
  if (!ms) return 0.55;
  const ageDays = Math.max(0, (Date.now() - ms) / 86400000);
  return clamp01(Math.exp(-ageDays / 21));
}

export interface BuildSceneOptions {
  /** Your previous visit (ms epoch): anything made after it is marked New. */
  lastVisitAt?: number | null;
  /**
   * Rewind: build the world as it existed at this moment (ms epoch). People
   * who hadn't entered your life yet, platforms not yet connected, and posts
   * not yet made simply don't exist in the model.
   */
  asOf?: number | null;
}

export function buildSceneModel(data: MeshApiResponse, opts?: BuildSceneOptions): SceneModel {
  const nodes = new Map<string, SceneNode>();
  const lastVisitAt = opts?.lastVisitAt ?? null;
  const isNewSince = (ms: number | undefined) => Boolean(lastVisitAt && ms && ms > lastVisitAt);
  const asOf = opts?.asOf ?? null;
  // Undated things are kept when rewinding — the mesh never hides what it
  // can't honestly date.
  const existedBy = (ms: number | undefined) => asOf == null || ms == null || ms <= asOf;

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
    // You are not one of the six categories, so you do not get one of the six
    // plastics. The canvas paints this node from --accent and its strands from
    // --ink-3 (see paint/nodes.ts and paint/edges.ts); this value is what the
    // DOM surfaces — list view, search, node detail — put behind it, and as a
    // custom property it tracks the theme, which the old #a5b4fc could not.
    color: "var(--accent)",
    parentId: null,
    childIds: [],
    branch: null,
    href: "/profile/" + data.user.username,
    isVerified: data.user.isVerified,
    weight: 1,
  });

  // --- Platforms (connected accounts) with their recent-best posts ---
  // Platforms strand straight to you; their content fans out beyond them,
  // newest first, so each platform reads as "what I've made there lately".
  const platforms: any[] = data.connectedAccounts || [];
  if (platforms.length) {
    platforms.forEach((acct: any) => {
      const acctMs = toMs(acct.createdAt);
      if (!existedBy(acctMs)) return;
      const platformId = `platform:${acct.id}`;
      // Sort BEFORE slicing (id tiebreak): the kept top-N must be the same set
      // on every client no matter what order the API happened to send.
      const topPosts: any[] = (acct.topPosts || [])
        .filter((pp: any) => existedBy(toMs(pp.publishedAt)))
        .sort(
          (a: any, b: any) =>
            (toMs(b.publishedAt) ?? 0) - (toMs(a.publishedAt) ?? 0) ||
            String(a.id).localeCompare(String(b.id)),
        )
        .slice(0, MAX_PLATFORM_POSTS);
      const followers = acct.analytics?.followerCount ?? acct.counts?.platformFollowers ?? 0;
      const postCount = acct.counts?.platformPosts ?? topPosts.length;
      add({
        id: platformId,
        kind: "platform",
        label: acct.platform,
        sublabel: acct.platformUsername ? "@" + acct.platformUsername : undefined,
        color: platformColor(acct.platform),
        parentId: selfId,
        childIds: [],
        branch: "platforms",
        href: "/connected-accounts",
        count: topPosts.length || undefined,
        status: acct.syncStatus,
        createdAtMs: acctMs,
        weight: clamp01(0.48 + Math.min(postCount, 200) / 400),
        placeReason: "Your bridge to the wider internet — connected and syncing",
        meta: [
          { label: "Posts", value: String(postCount) },
          { label: "Followers", value: String(followers) },
        ],
      });
      topPosts.forEach((pp: any) => {
        const media = pp.media?.[0];
        const publishedMs = toMs(pp.publishedAt);
        // Node thumbnails render through <img>/canvas Image — only ever hand
        // them a still, never a video file or platform page URL.
        const image =
          bestStillUrl({ thumbnailUrl: pp.thumbnailUrl }) ||
          bestStillUrl({ mediaUrl: media?.url, thumbnailUrl: media?.thumbnailUrl }) ||
          null;
        add({
          id: `platform-post:${acct.id}:${pp.id}`,
          kind: "post",
          label: truncate(pp.title || pp.content || `${acct.platform} post`, 40),
          sublabel: acct.platform,
          content: pp.content || pp.title,
          imageUrl: image,
          videoUrl: playableVideoUrl({ mediaUrl: media?.url, thumbnailUrl: media?.thumbnailUrl }),
          color: platformColor(acct.platform),
          parentId: platformId,
          childIds: [],
          branch: "platforms",
          href: pp.url || undefined,
          createdAtMs: publishedMs,
          freshness: freshnessOf(publishedMs),
          isNew: isNewSince(publishedMs),
          weight: clamp01(0.22 + Math.min((pp.likeCount || 0) + (pp.commentCount || 0) * 2, 400) / 800),
          meta: [
            ...(publishedMs ? [{ label: "Time", value: relAge(publishedMs) }] : []),
            { label: "Likes", value: String(pp.likeCount ?? 0) },
            { label: "Comments", value: String(pp.commentCount ?? 0) },
          ],
        });
      });
    });
  }

  // --- People — placed by real relationship strength, not follow order ---
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
    // Id tiebreak so equally-close people order (and which ones survive the
    // MAX_PEOPLE slice) is identical across clients, not API array order.
    return (
      (b.interactionCount || 0) - (a.interactionCount || 0) ||
      String(a.id).localeCompare(String(b.id))
    );
  });
  const friendMeshMap = new Map((data.friendMeshes || []).map((f) => [f.user.id, f]));
  const peopleToShow = people.slice(0, MAX_PEOPLE);
  if (peopleToShow.length) {
    peopleToShow.forEach((p: any) => {
      const joinedMs = toMs(p.joinedAt);
      if (!existedBy(joinedMs)) return;
      const personId = `person:${p.id}`;
      const friendMesh = friendMeshMap.get(p.id);
      // Sort before slicing, id-tiebroken, for the same cross-client
      // determinism reason as platform topPosts above.
      const friendPosts: any[] = ((friendMesh?.posts as any[]) || [])
        .filter((fp: any) => existedBy(toMs(fp.createdAt)))
        .sort(
          (a: any, b: any) =>
            (toMs(b.createdAt) ?? 0) - (toMs(a.createdAt) ?? 0) ||
            String(a.id).localeCompare(String(b.id)),
        )
        .slice(0, 3);
      // Closeness is the human truth of the tie: following each other, how
      // often you actually interact, and whether they're here right now.
      const interaction = Math.min(p.interactionCount || 0, 24);
      const closeness = clamp01(
        0.22 + (p.isMutual ? 0.34 : 0) + (interaction / 24) * 0.36 + (p.status === "online" ? 0.08 : 0),
      );
      const placeReason = p.isMutual
        ? interaction >= 6
          ? "Right beside you — you follow each other and talk often"
          : "Close to you — you follow each other"
        : interaction >= 6
          ? "Near you — you interact a lot"
          : p.isFollowing
            ? "In your circle — you follow them"
            : "In your circle — they follow you";
      add({
        id: personId,
        kind: "person",
        label: p.displayName || p.username,
        sublabel: "@" + p.username,
        avatarUrl: p.avatarUrl,
        // Mutuality is a STATE, and the design system is explicit that emphasis
        // is never saturation — it is plinth depth and size. It used to be a
        // second violet 1.0deg from --mould-grape, i.e. a colour that read as a
        // rendering error next to the communities branch. It is already said in
        // words, twice, by `placeReason` and the sublabel above, and said again
        // by distance: a mutual sits physically closer to you.
        color: BRANCH_META.people.color,
        parentId: selfId,
        childIds: [],
        branch: "people",
        href: "/profile/" + p.username,
        userId: p.id,
        username: p.username,
        isFollowing: !!p.isFollowing,
        isMutual: !!p.isMutual,
        status: p.status || "offline",
        count: friendPosts.length || undefined,
        closeness,
        placeReason,
        createdAtMs: joinedMs,
        weight: clamp01(0.34 + closeness * 0.55),
        meta: [
          { label: "Followers", value: String(p.followerCount ?? p._count?.followers ?? 0) },
          { label: "Posts", value: String(p.postCount ?? p._count?.posts ?? 0) },
        ],
      });
      friendPosts.forEach((fp: any) => {
        const media = fp.media?.[0];
        const createdMs = toMs(fp.createdAt);
        add({
          id: `friend-post:${p.id}:${fp.id}`,
          kind: "post",
          label: truncate(fp.content || "Post", 40),
          sublabel: "@" + p.username,
          content: fp.content,
          imageUrl:
            bestStillUrl({ mediaUrl: media?.url, thumbnailUrl: media?.thumbnailUrl }) ||
            (media && media.type !== "video" ? media.url : null),
          videoUrl: media && media.type === "video" ? media.url : null,
          color: BRANCH_META.posts.color,
          parentId: personId,
          childIds: [],
          branch: "people",
          href: "/feed/" + fp.id,
          createdAtMs: createdMs,
          freshness: freshnessOf(createdMs),
          isNew: isNewSince(createdMs),
          weight: 0.24,
          meta: [
            ...(createdMs ? [{ label: "Time", value: relAge(createdMs) }] : []),
            { label: "Likes", value: String(fp.likeCount ?? fp._count?.likes ?? 0) },
            { label: "Comments", value: String(fp.commentCount ?? fp._count?.comments ?? 0) },
          ],
        });
      });
    });
  }

  // --- Posts (your own native posts) — strand straight from you ---
  // Sort with an id tiebreak BEFORE the cap so the same MAX_POSTS survive on
  // every client even when several posts share a timestamp (never API order).
  const posts: any[] = (data.posts || [])
    .filter((p: any) => existedBy(toMs(p.createdAt)))
    .sort((a: any, b: any) => (toMs(b.createdAt) ?? 0) - (toMs(a.createdAt) ?? 0) || String(a.id).localeCompare(String(b.id)))
    .slice(0, MAX_POSTS);
  if (posts.length) {
    posts.forEach((p: any) => {
      const media = p.media?.[0];
      const createdMs = toMs(p.createdAt);
      add({
        id: `post:${p.id}`,
        kind: "post",
        label: truncate(p.content || "Post", 40),
        content: p.content,
        imageUrl: media && media.type !== "video" ? media.url : null,
        videoUrl: media && media.type === "video" ? media.url : null,
        color: BRANCH_META.posts.color,
        parentId: selfId,
        childIds: [],
        branch: "posts",
        href: "/feed/" + p.id,
        createdAtMs: createdMs,
        freshness: freshnessOf(createdMs),
        isNew: isNewSince(createdMs),
        weight: clamp01(0.24 + Math.min((p.likeCount || 0) + (p.commentCount || 0) * 2, 400) / 800),
        meta: [
          ...(createdMs ? [{ label: "Time", value: relAge(createdMs) }] : []),
          { label: "Likes", value: String(p.likeCount ?? 0) },
          { label: "Comments", value: String(p.commentCount ?? 0) },
        ],
      });
    });
  }

  return { selfId, nodes };
}
