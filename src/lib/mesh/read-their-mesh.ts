import { prisma } from "@/lib/prisma";
import { nsfwHiddenWhere } from "@/lib/content-safety";
import { hasMeshPro } from "@/lib/mesh-pro";
import { areMutualFollowers, canViewMesh, normalizeMeshVisibility } from "@/lib/privacy-policy";
import type { FeedCurrentUser } from "@/lib/feed-data";
import type { FieldItem } from "@/components/meshfield/model/rings";

/**
 * Someone else's mesh, as field items.
 *
 * ── WHY THIS IS NOT `readWantsYou` WITH A DIFFERENT ID ─────────────────────
 *
 * "What wants you" is a read of the VIEWER's obligations — unread threads
 * addressed to them, notifications aimed at them. Pointed at a stranger it
 * would answer a question nobody asked ("what does Ada owe Ada?") and would
 * leak her unread state besides. A stranger's mesh is a different question —
 * what they have been putting out — so it is a different read.
 *
 * ── THE GATE IS REUSED, NOT RESTATED ───────────────────────────────────────
 *
 * Whether a viewer may see this mesh at all is decided by the same pure
 * helpers `/api/mesh` uses: `normalizeMeshVisibility` for the owner's setting
 * (whose canonical default is PRIVATE, so an account with no MeshPrivacy row
 * stays shut rather than falling open), `areMutualFollowers` for the friends
 * case, and `canViewMesh` for the decision itself. Blocking is checked
 * alongside rather than inside, exactly as the route does it, because
 * canViewMesh is pure and sync and shared with the privacy contract checks.
 *
 * Restating any of that here would have produced a second copy of an access
 * rule, and the gates would only be watching one of them.
 */

/** Enough of the owner to render the centre of their field. */
type MeshOwner = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  isVerified: boolean;
  isMeshPro: boolean;
};

export type TheirMesh =
  /** No such user, or they are suspended. */
  | { state: "missing" }
  /** They exist, but this viewer is not allowed in. Identity only — the same
   * shape the old surface's locked state had, and deliberately nothing more. */
  | { state: "locked"; owner: MeshOwner; nowMs: number }
  | { state: "open"; owner: MeshOwner; items: FieldItem[]; nowMs: number };

/** Their most recent public posts. Capped for the same reason the other read
 * is: the geometry drops all but a few dozen nodes at any viewport, so reading
 * more would be work whose result is thrown away. */
const POST_LIMIT = 48;

export async function readTheirMesh(handle: string, viewer: FeedCurrentUser | null): Promise<TheirMesh> {
  const nowMs = Date.now();

  // Meshes are reached by id (node clicks, presence) AND by username (profile
  // links, shared URLs) — resolve either, exactly as the route does.
  const target = await prisma.user.findFirst({
    where: { OR: [{ id: handle }, { username: handle.toLowerCase() }] },
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      isVerified: true,
      isMeshPro: true,
      isSuspended: true,
      meshPrivacy: { select: { meshVisibility: true } },
    },
  });

  if (!target || target.isSuspended) return { state: "missing" };

  const owner: MeshOwner = {
    id: target.id,
    username: target.username,
    displayName: target.displayName,
    avatarUrl: target.avatarUrl,
    isVerified: target.isVerified,
    // hasMeshPro, not the raw column: a founder's membership is derived,
    // so reading the column directly makes a founder look un-Pro to
    // everyone except themselves.
    isMeshPro: hasMeshPro(target),
  };

  // A signed-out viewer is never a friend and never an admin, so the gate can
  // run without inventing an identity for them.
  const viewerId = viewer?.id ?? null;
  const isOwner = !!viewerId && viewerId === target.id;

  const [isFriend, blockBetween] = await Promise.all([
    viewerId && !isOwner ? areMutualFollowers(viewerId, target.id) : Promise.resolve(false),
    viewerId && !isOwner
      ? prisma.block.findFirst({
          where: {
            OR: [
              { blockerId: viewerId, blockedId: target.id },
              { blockerId: target.id, blockedId: viewerId },
            ],
          },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);

  if (blockBetween) return { state: "locked", owner, nowMs };

  const visibility = normalizeMeshVisibility(target.meshPrivacy?.meshVisibility);
  if (!canViewMesh(viewer, target.id, visibility, isFriend)) {
    return { state: "locked", owner, nowMs };
  }

  // The viewer's own NSFW policy applies to someone else's mesh too — a viewer
  // with NSFW off must not receive public-but-flagged posts here when they are
  // hidden everywhere else.
  const posts = await prisma.post.findMany({
    where: { authorId: target.id, visibility: "public", ...nsfwHiddenWhere(viewer) },
    orderBy: { createdAt: "desc" },
    take: POST_LIMIT,
    select: {
      id: true,
      content: true,
      createdAt: true,
      media: { select: { url: true, type: true }, take: 1 },
    },
  });

  const items: FieldItem[] = posts.map((p) => {
    const text = (p.content || "").trim();
    return {
      id: p.id,
      kind: "post",
      // The first line is the closest thing a post has to a title. The model
      // layer never truncates, so this hands over the whole line and lets
      // `legible` decide what actually fits.
      title: text.split("\n")[0] || "Post",
      platform: "mesh",
      imageUrl: p.media[0]?.url ?? null,
      body: text,
      atMs: p.createdAt.getTime(),
      href: `/feed/${encodeURIComponent(p.id)}`,
    };
  });

  return { state: "open", owner, items, nowMs };
}
