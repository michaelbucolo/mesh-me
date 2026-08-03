// YOUR PRESENCE, MESHED — THE READ.
//
// ── WHY THIS REPLACES THE RING FIELD'S READ ────────────────────────────────
//
// The ring field arranged everything by urgency alone. That is a defensible
// ordering and it produced an indefensible screen: abstract discs on black,
// nobody recognisable, and — with five items — ninety percent empty. It was a
// chart. A chart is not a home.
//
// The product's actual claim is that mesh.me is where you manage your presence
// across every platform at once. So the structure of the surface is now the
// structure of that claim:
//
//   YOU at the centre. One ARM per platform. On each arm, the real things from
//   that platform, with the ones that want you nearest the middle.
//
// That is legible without a tutorial, which the old surface needed ("drag to
// look around, scroll to zoom") and therefore failed. You recognise your own
// platform logos instantly; "closer means it wants you more" needs no legend.
//
// ── URGENCY IS KEPT, BUT DEMOTED FROM POSITION TO EMPHASIS ─────────────────
//
// `wants-you.ts` decides what counts as owed, and that judgement is good and
// gated (~300 assertions across two gates). What was wrong was letting it be
// the ONLY axis. Here it survives as `awaitingViewer`, which decides how near
// the centre a bead sits and whether it glows — while WHICH ARM it sits on is
// decided by where it actually came from.

import { prisma } from "@/lib/prisma";
import { nsfwHiddenWhere } from "@/lib/content-safety";
import { readWantsYou } from "./read-wants-you";

/** A thing on an arm. Deliberately close to what a person would call it. */
export type ArmItem = {
  id: string;
  kind: "message" | "mention" | "reply" | "post" | "person";
  /** Who or what. Never truncated here — the view decides what fits. */
  title: string;
  body?: string;
  /** A face or a thumbnail. The whole reason the old surface felt empty was
   * that this was never populated and every node fell back to a glyph. */
  imageUrl?: string | null;
  atMs: number;
  /** It is addressed to you and you have not answered. Drives pull + glow. */
  awaitingViewer?: boolean;
  href: string;
};

/**
 * What a platform arm is doing right now.
 *
 * "offer" is the one that earns its place: an arm for a platform you have NOT
 * connected. An empty mesh then reads as an invitation to bring your presence
 * in, rather than as a broken screen — which is exactly the job the product
 * says it does.
 */
export type ArmState = "live" | "syncing" | "error" | "stale" | "offer";

export type PresenceArm = {
  /** "mesh" for native, otherwise the platform key (matches PlatformLogo). */
  platform: string;
  /** Your handle THERE. This is presence: it is the thing you are managing. */
  handle: string | null;
  state: ArmState;
  /** Plain-language status. Never a raw error code. */
  detail: string | null;
  items: ArmItem[];
  /** How many of `items` are owed. Shown on the arm's head. */
  wantsYou: number;
};

export type MyPresence = {
  you: { id: string; username: string; displayName: string | null; avatarUrl: string | null };
  arms: PresenceArm[];
  nowMs: number;
  totalWantsYou: number;
  /** Arms that are actually connected (excludes offers) — used by the centre. */
  connectedCount: number;
};

/**
 * Platforms offered when you have not connected them.
 *
 * A short, deliberate list rather than every logo we own: an empty mesh
 * offering eleven strangers is noise, and these are the ones whose absence a
 * person is most likely to feel. Only ever shown when NOT already connected.
 */
const OFFERED = ["instagram", "youtube", "tiktok", "twitter"] as const;

/** Per-arm bead cap. More than this and an arm reads as a smear rather than
 * a set of things you could actually act on. */
const MAX_PER_ARM = 6;

const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

export async function readMyPresence(userId: string): Promise<MyPresence> {
  const [me, accounts, wants, myPosts] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, displayName: true, avatarUrl: true },
    }),
    prisma.connectedAccount.findMany({
      where: { userId },
      select: {
        id: true,
        platform: true,
        platformUsername: true,
        isActive: true,
        syncStatus: true,
        syncError: true,
        lastSyncAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    // Reuse the gated judgement rather than re-deriving "what is owed" here.
    // A second copy of that rule is the one thing this file must not contain.
    readWantsYou(userId),
    prisma.post.findMany({
      where: { authorId: userId, ...nsfwHiddenWhere(null) },
      orderBy: { createdAt: "desc" },
      take: MAX_PER_ARM,
      select: {
        id: true,
        content: true,
        createdAt: true,
        media: { select: { url: true }, take: 1 },
      },
    }),
  ]);

  const nowMs = wants.nowMs;

  // Group everything that wants you by the platform it actually came from.
  const byPlatform = new Map<string, ArmItem[]>();
  for (const item of wants.items) {
    const key = item.platform || "mesh";
    const list = byPlatform.get(key) ?? [];
    list.push({
      id: item.id,
      kind: item.kind === "community" ? "post" : item.kind,
      title: item.title,
      body: item.body,
      imageUrl: item.imageUrl ?? null,
      atMs: item.atMs,
      awaitingViewer: item.awaitingViewer,
      href: item.href,
    });
    byPlatform.set(key, list);
  }

  const arms: PresenceArm[] = [];

  // ── THE NATIVE ARM ────────────────────────────────────────────────────────
  // mesh.me is a platform in your presence too, so it is an arm like any
  // other rather than a privileged special case. Your own posts hang here.
  const nativeItems = byPlatform.get("mesh") ?? [];
  byPlatform.delete("mesh");
  for (const p of myPosts) {
    const text = (p.content || "").trim();
    nativeItems.push({
      id: `mypost-${p.id}`,
      kind: "post",
      title: text.split("\n")[0] || "Your post",
      body: text,
      imageUrl: p.media[0]?.url ?? null,
      atMs: p.createdAt.getTime(),
      href: `/feed/${encodeURIComponent(p.id)}`,
    });
  }
  arms.push(makeArm("mesh", me?.username ? `@${me.username}` : null, "live", null, nativeItems));

  // ── CONNECTED PLATFORM ARMS ───────────────────────────────────────────────
  for (const account of accounts) {
    const items = byPlatform.get(account.platform) ?? [];
    byPlatform.delete(account.platform);

    let state: ArmState = "live";
    let detail: string | null = null;
    if (!account.isActive) {
      state = "error";
      detail = "Disconnected — reconnect to keep it in your mesh";
    } else if (account.syncStatus === "error") {
      state = "error";
      // Plain language: a raw provider error is not something to put on a wall.
      detail = "Needs attention — sign in again to resume syncing";
    } else if (account.syncStatus === "syncing") {
      state = "syncing";
      detail = "Bringing your posts across…";
    } else if (account.syncStatus === "rate_limited") {
      state = "stale";
      detail = "Paused by the platform — it will resume on its own";
    } else if (!account.lastSyncAt || nowMs - account.lastSyncAt.getTime() > STALE_AFTER_MS) {
      state = "stale";
      detail = "Not synced recently";
    }

    arms.push(
      makeArm(
        account.platform,
        account.platformUsername ? `@${account.platformUsername}` : null,
        state,
        detail,
        items,
      ),
    );
  }

  // Anything left came from a platform with no ConnectedAccount row (a mirrored
  // thread, say). It is still real, so it still gets an arm rather than being
  // dropped on the floor.
  for (const [platform, items] of byPlatform) {
    arms.push(makeArm(platform, null, "live", null, items));
  }

  // ── OFFERS ────────────────────────────────────────────────────────────────
  const present = new Set(arms.map((a) => a.platform));
  for (const platform of OFFERED) {
    if (present.has(platform)) continue;
    arms.push({
      platform,
      handle: null,
      state: "offer",
      detail: "Bring it into your mesh",
      items: [],
      wantsYou: 0,
    });
  }

  const connectedCount = arms.filter((a) => a.state !== "offer").length;

  return {
    you: {
      id: userId,
      username: me?.username ?? "you",
      displayName: me?.displayName ?? null,
      avatarUrl: me?.avatarUrl ?? null,
    },
    arms,
    nowMs,
    totalWantsYou: arms.reduce((n, a) => n + a.wantsYou, 0),
    connectedCount,
  };
}

/** Owed things first, then newest. Position on the arm IS this order, so it
 * has to be decided once, here, rather than by whoever draws it. */
function makeArm(
  platform: string,
  handle: string | null,
  state: ArmState,
  detail: string | null,
  items: ArmItem[],
): PresenceArm {
  const sorted = items
    .slice()
    .sort((a, b) => {
      const owed = Number(!!b.awaitingViewer) - Number(!!a.awaitingViewer);
      return owed !== 0 ? owed : b.atMs - a.atMs;
    })
    .slice(0, MAX_PER_ARM);

  return {
    platform,
    handle,
    state,
    detail,
    items: sorted,
    wantsYou: sorted.filter((i) => i.awaitingViewer).length,
  };
}
