import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ANONYMOUS_VIEWER } from "@/lib/feed-data";
import { applyWatchSignal, authorKey, explainFlowPost, getFlowCandidates, getViewerTasteProfile, normalizeFlowRankMode, normalizeStudioWeights, rankFlowPosts, type WatchStats } from "@/lib/flow-ranking";
import { parseAcceptLanguage } from "@/lib/language";
import { rateLimit } from "@/lib/security";
import { getTrustedClientIp } from "@/lib/client-ip";

/**
 * Ranked Flow feed. The client sends the ids it already has (`exclude`) plus
 * ids the viewer has recently watched (`seen`); the server returns the next
 * best-ranked batch the viewer hasn't been handed yet. Guests get the public
 * discover supply — watching is free, interacting needs an account.
 */
export async function GET(request: Request) {
  const user = (await getCurrentUser()) ?? ANONYMOUS_VIEWER;

  // This route runs the heaviest read workload in the feed subsystem and — so
  // guests can browse — is intentionally left out of the proxy's protected
  // prefixes, so it gets no proxy-level throttle. Cap it in-handler (per user,
  // or per IP for guests) so it can't be looped for cheap request→work
  // amplification. The sibling /api/flow/impression does the same.
  const rlKey = user.id === ANONYMOUS_VIEWER.id
    ? `flow:ip:${getTrustedClientIp(request.headers)}`
    : `flow:${user.id}`;
  if (!rateLimit(rlKey, 120, 60_000).allowed) {
    return NextResponse.json({ error: "Slow down" }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const limitRaw = parseInt(searchParams.get("limit") || "12", 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 30) : 12;
  const parseIds = (key: string) =>
    (searchParams.get(key) || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
      .slice(0, 600);
  const excludeIds = parseIds("exclude");
  const exclude = new Set(excludeIds);
  const seen = new Set(parseIds("seen"));
  const mode = normalizeFlowRankMode(searchParams.get("mode"));
  // Custom Studio weights are a MeshPro control — validated server-side so
  // the flag can't be spoofed by the client.
  const isPro = (user as { isMeshPro?: boolean }).isMeshPro === true;
  const studio = isPro ? normalizeStudioWeights(searchParams.get("studio")) : null;
  // Cater the Flow to the viewer's language on every page, same as first paint.
  const viewerLangs = new Set(parseAcceptLanguage(request.headers.get("accept-language")));

  const [candidates, profile] = await Promise.all([
    getFlowCandidates(user),
    getViewerTasteProfile(user.id),
  ]);

  // Server-persisted seen/liked state, scoped to exactly this batch's candidates
  // (PK-served `IN` over ≤~480 keys — coverage-complete, not a recency window),
  // so the ranker never replays a reel the viewer already saw on ANY device.
  // Guests have no persisted state and issue zero queries here.
  const isGuest = user.id === ANONYMOUS_VIEWER.id;
  const impressions = isGuest
    ? []
    : await prisma.flowImpression.findMany({
        where: { userId: user.id, postId: { in: candidates.map((p) => p.id) } },
        select: { postId: true, liked: true, watchMs: true, completion: true },
      });
  const persistedSeen = new Set(impressions.map((i) => i.postId));
  const likedSet = new Set(impressions.filter((i) => i.liked).map((i) => i.postId));

  // Implicit watch behavior — Reels' primary ranking input. Completions and
  // long dwells accrue author affinity in the same profile explicit likes
  // feed; fast skips subtract, and also deepen the per-post seen crush below.
  const watchStats = new Map<string, WatchStats>(
    impressions
      .filter((i) => i.watchMs > 0 || i.completion > 0 || i.liked)
      .map((i) => [i.postId, { watchMs: i.watchMs, completion: i.completion, liked: i.liked }]),
  );
  applyWatchSignal(profile, candidates, watchStats);

  // Recency by *last* appearance: the client's exclude list is in scroll
  // order and repeats ids once the Flow wraps, so walk it backwards and keep
  // the first (i.e. most recent) sighting of each id.
  const recent: string[] = [];
  const noted = new Set<string>();
  for (let i = excludeIds.length - 1; i >= 0 && recent.length < 40; i--) {
    const id = excludeIds[i];
    if (!noted.has(id)) {
      noted.add(id);
      recent.push(id);
    }
  }
  // The posts the viewer scrolled right before this request, oldest→newest —
  // they seed the ranker's diversity window so an author or platform run
  // can't straddle the seam between two responses.
  const candidateById = new Map(candidates.map((post) => [post.id, post]));
  const recentPosts = recent
    .slice(0, 8)
    .map((id) => candidateById.get(id))
    .filter((post): post is (typeof candidates)[number] => Boolean(post))
    .reverse();

  let ranked: typeof candidates;
  let recycled = false;

  if (mode === "chronological") {
    // Chronological is a strict timeline: page through unseen posts newest
    // first, and only loop back to the top once the timeline is exhausted.
    // In chronological mode the ranker sorts by createdAt BEFORE reading
    // opts.seen, so passing `seen` there is a no-op — this filter is what
    // actually enforces cross-session no-repeat in this mode.
    const seenUnion = new Set([...seen, ...persistedSeen]);
    const fresh = candidates.filter((post) => !exclude.has(post.id) && !seenUnion.has(post.id));
    ranked = rankFlowPosts(fresh, profile, { seen, limit, mode, studio });
    if (ranked.length < limit && candidates.length > 0) {
      recycled = true;
      const already = new Set(ranked.map((post) => post.id));
      const refill = rankFlowPosts(
        candidates.filter((post) => !already.has(post.id)),
        profile,
        { seen, limit: limit - ranked.length, mode, studio },
      );
      ranked = [...ranked, ...refill];
    }
  } else {
    // Scored modes rank one blended pool: unseen posts score ~17x higher than
    // seen ones, so fresh material always surfaces first — but when the only
    // unseen posts left are a wall from one dominant author, the diversity
    // pass can reach past them to an already-seen post from another voice
    // instead of serving sixteen reels in a row from the same person. The
    // Flow never ends: once everything's been seen, seen-fatigue plus dither
    // reshuffle the loop so it never replays identically.
    //
    // The most recently scrolled ids are held out of the pool entirely so a
    // post never reappears right after it was on screen — shrinking the
    // hold-back window rather than abandoning it when the library is small,
    // and requiring the pool to span multiple voices, not just be big enough.
    const seenAll = new Set([...seen, ...excludeIds, ...persistedSeen]);
    const distinctAuthors = new Set(candidates.map(authorKey)).size;
    const wantedAuthors = Math.min(distinctAuthors, 3);
    const poolFits = (pool: typeof candidates) =>
      pool.length >= limit * 2 && new Set(pool.map(authorKey)).size >= wantedAuthors;
    let pool: typeof candidates = [];
    let fallback: typeof candidates | null = null;
    for (let tail = recent.length; tail >= 0; tail = tail > 0 ? Math.floor(tail / 2) : -1) {
      const held = new Set(recent.slice(0, tail));
      pool = candidates.filter((post) => !held.has(post.id));
      if (poolFits(pool)) break;
      if (!fallback && pool.length >= limit) fallback = pool;
    }
    if (!poolFits(pool) && fallback && new Set(fallback.map(authorKey)).size >= new Set(pool.map(authorKey)).size) {
      pool = fallback;
    }
    ranked = rankFlowPosts(pool, profile, { seen: seenAll, limit, mode, studio, recent: recentPosts, viewerLangs, watch: watchStats });
    recycled = ranked.some((post) => exclude.has(post.id));
  }

  return NextResponse.json({
    posts: ranked.map((post) => ({
      ...post,
      // Pre-fill the heart for external items the viewer privately liked (native
      // posts already carry their own viewer reactions and are never in likedSet).
      reactions: likedSet.has(post.id) ? [{ id: "self" }] : post.reactions,
      whyThis: explainFlowPost(post, profile, mode, studio),
    })),
    hasMore: candidates.length > 0,
    recycled,
  });
}
