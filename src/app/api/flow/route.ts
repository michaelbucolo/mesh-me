import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ANONYMOUS_VIEWER } from "@/lib/feed-data";
import { explainFlowPost, getFlowCandidates, getViewerTasteProfile, normalizeFlowRankMode, normalizeStudioWeights, rankFlowPosts } from "@/lib/flow-ranking";

/**
 * Ranked Flow feed. The client sends the ids it already has (`exclude`) plus
 * ids the viewer has recently watched (`seen`); the server returns the next
 * best-ranked batch the viewer hasn't been handed yet. Guests get the public
 * discover supply — watching is free, interacting needs an account.
 */
export async function GET(request: Request) {
  const user = (await getCurrentUser()) ?? ANONYMOUS_VIEWER;

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
  // Custom Studio weights are a Mesh Pro control — validated server-side so
  // the flag can't be spoofed by the client.
  const isPro = (user as { isMeshPro?: boolean }).isMeshPro === true;
  const studio = isPro ? normalizeStudioWeights(searchParams.get("studio")) : null;

  const [candidates, profile] = await Promise.all([
    getFlowCandidates(user),
    getViewerTasteProfile(user.id),
  ]);

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

  const fresh = candidates.filter((post) => !exclude.has(post.id));
  let ranked = rankFlowPosts(fresh, profile, { seen, limit, mode, studio, recent: recentPosts });
  let recycled = false;

  // The Flow never ends. When fresh supply runs out, re-rank what's already
  // been handed over and keep going — seen-fatigue plus dither reshuffles the
  // order so the loop never replays identically. The most recently scrolled
  // ids are held back from the refill so a post never reappears right after
  // it was on screen.
  if (ranked.length < limit && candidates.length > 0) {
    recycled = true;
    const already = new Set(ranked.map((post) => post.id));
    const need = limit - ranked.length;
    // Hold back as many recently-scrolled ids as the pool can afford — shrink
    // the hold-back window rather than abandon it, so even a tiny library
    // keeps repeats spaced apart instead of showing the same post twice in a
    // row. Aim for double the needed pool so the ranker has slack to
    // interleave authors and platforms instead of draining one voice dry.
    let pool: typeof candidates = [];
    let fallback: typeof candidates | null = null;
    for (let tail = recent.length; tail >= 0; tail = tail > 0 ? Math.floor(tail / 2) : -1) {
      const held = new Set(recent.slice(0, tail));
      pool = candidates.filter((post) => !already.has(post.id) && !held.has(post.id));
      if (pool.length >= need * 2) break;
      if (!fallback && pool.length >= need) fallback = pool;
    }
    if (pool.length < need * 2 && fallback) pool = fallback;
    const seamRecent = [...recentPosts, ...ranked].slice(-8);
    const refill = rankFlowPosts(pool, profile, { seen, limit: need, mode, studio, recent: seamRecent });
    ranked = [...ranked, ...refill];
  }

  return NextResponse.json({
    posts: ranked.map((post) => ({
      ...post,
      whyThis: explainFlowPost(post, profile, mode, studio),
    })),
    hasMore: candidates.length > 0,
    recycled,
  });
}
