import "server-only";

// THE PERSONAL DATA API'S ONE SPINE — /api/me/v1.
//
// Everything the API is lives here: the closed resource table (routes, the
// scope validator, the /developers page, and pat-check all read the SAME
// constant, so the docs cannot drift from the code), the wrapper every
// route runs through (verify → limiters → scope → handler → no-store), and
// the owner-pinned query helpers with their field allowlists.
//
// Laws, each pinned by pat-check:
//
//   BEARER ONLY. No cookies, no sessions, no same-origin — a route with no
//   ambient authority has no CSRF surface. No CORS headers either: a PAT in
//   browser JavaScript is a leak in progress, so the API deliberately does
//   not invite it.
//
//   OWNER-PINNED EVERYWHERE. Every where-clause carries the token owner's
//   id; no route reads a user identifier from the request. Not-yours and
//   nonexistent are the same 404 by construction, not by comparison.
//
//   ONE 401. Malformed, unknown, wrong-verifier, expired, revoked,
//   suspended — all identical. A dead token learns nothing about whether
//   it was ever real.
//
//   NOTHING CACHED. Every response is private, no-store; every request
//   re-verifies and re-adjudicates. A cursor is not a capability.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTrustedClientIp } from "@/lib/client-ip";
import { durableRateLimit } from "@/lib/durable-rate-limit";
import { listJournal } from "@/lib/meshi-memory";
import { verifyPersonalAccessToken, type PatScope, type VerifiedPat } from "@/lib/personal-access-token";
import { rateLimit } from "@/lib/security";

/** The closed resource table — the API's public shape, in one place. */
export const PAT_RESOURCES = [
  { path: "/api/me/v1", scope: null, description: "Who this token is: name, fingerprint, scopes, expiry, and this index." },
  { path: "/api/me/v1/profile", scope: "profile:read", description: "Your profile fields and follower/following/post counts. Includes your email — scope accordingly." },
  { path: "/api/me/v1/posts", scope: "posts:read", description: "Your mesh.me posts, newest first. /posts/{id} fetches one." },
  { path: "/api/me/v1/comments", scope: "posts:read", description: "Comments you wrote." },
  { path: "/api/me/v1/reactions", scope: "posts:read", description: "Reactions you gave (post ids, not other people)." },
  { path: "/api/me/v1/saves", scope: "posts:read", description: "Posts you saved (ids and timestamps)." },
  { path: "/api/me/v1/imported/accounts", scope: "imported:read", description: "Your connected platforms — names and sync facts, never credentials." },
  { path: "/api/me/v1/imported/posts", scope: "imported:read", description: "Your imported platform posts with their engagement totals." },
  { path: "/api/me/v1/imported/comments", scope: "imported:read", description: "Your own comments as imported from platforms." },
  { path: "/api/me/v1/imported/media", scope: "imported:read", description: "Media attached to your imported posts." },
  { path: "/api/me/v1/analytics", scope: "analytics:read", description: "Stored per-platform analytics snapshots, exactly as the data export ships them." },
  { path: "/api/me/v1/journal", scope: "journal:read", description: "Meshi's journal, if you keep one. Off means {granted:false} — never an error." },
] as const;

const UNAUTHORIZED = { error: "That token doesn't work here.", code: "unauthorized" } as const;

const PAGE_LIMIT_MAX = 100;
const PAGE_LIMIT_DEFAULT = 50;
const PER_TOKEN_PER_MIN = 60;
const PER_TOKEN_PER_HOUR = 600;
const PER_USER_PER_HOUR = 1000;

function noStore(body: unknown, status: number, extra: Record<string, string> = {}) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store", ...extra },
  });
}

function unauthorized() {
  return noStore(UNAUTHORIZED, 401, { "WWW-Authenticate": "Bearer" });
}

/**
 * The one wrapper. Verify (fail-closed, uniform 401, pre-auth failures
 * durable-limited per IP and per selector so the selector index cannot be
 * ground offline), then both limiter tiers per token and per user, then
 * scope, then the handler.
 */
export async function withPersonalToken(
  req: Request,
  requiredScope: PatScope | null,
  handler: (auth: VerifiedPat, req: Request) => Promise<{ body: unknown; status?: number } | NextResponse>,
): Promise<NextResponse> {
  const authorization = req.headers.get("authorization");
  const auth = await verifyPersonalAccessToken(authorization);
  if (!auth) {
    // Failed attempts are the enumeration surface: budget them per IP and,
    // when the shape parsed, per presented selector.
    const ip = getTrustedClientIp(req.headers) || "unknown";
    const badIp = await durableRateLimit(`pat:bad:${ip}`, 30, 10 * 60 * 1000);
    const presented = (authorization ?? "").replace(/^Bearer\s+/i, "").trim();
    const selector = /^mesh_pat_([A-Za-z0-9_-]{12})\./.exec(presented)?.[1];
    if (selector) await durableRateLimit(`pat:bad-sel:${selector}`, 30, 10 * 60 * 1000);
    if (!badIp.allowed) return noStore({ error: "Too many failed attempts — wait a few minutes.", code: "rate-limited" }, 429);
    return unauthorized();
  }

  const perMinute = rateLimit(`pat:t:${auth.tokenId}`, PER_TOKEN_PER_MIN, 60 * 1000);
  if (!perMinute.allowed) {
    return noStore({ error: "Over the per-minute budget — slow the loop down.", code: "rate-limited" }, 429, rateHeaders(0));
  }
  const perHour = await durableRateLimit(`pat:t:${auth.tokenId}`, PER_TOKEN_PER_HOUR, 60 * 60 * 1000);
  if (!perHour.allowed) {
    return noStore({ error: "This token used its hourly budget — it refills on the hour.", code: "rate-limited" }, 429, rateHeaders(0));
  }
  const perUser = await durableRateLimit(`pat:u:${auth.userId}`, PER_USER_PER_HOUR, 60 * 60 * 1000);
  if (!perUser.allowed) {
    return noStore({ error: "Your account used its hourly API budget across all tokens.", code: "rate-limited" }, 429, rateHeaders(0));
  }

  if (requiredScope && !auth.scopes.includes(requiredScope)) {
    return noStore({ error: `This token doesn't carry the ${requiredScope} scope.`, code: "scope" }, 403);
  }

  const result = await handler(auth, req);
  if (result instanceof NextResponse) return result;
  return noStore(result.body, result.status ?? 200, rateHeaders(perMinute.remainingAttempts));
}

function rateHeaders(remaining: number): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(PER_TOKEN_PER_MIN),
    "X-RateLimit-Remaining": String(Math.max(0, remaining)),
  };
}

// ── Pagination ──────────────────────────────────────────────────

export function pageParams(req: Request): { limit: number; cursorId: string | null } {
  const url = new URL(req.url);
  const rawLimit = Number(url.searchParams.get("limit") ?? PAGE_LIMIT_DEFAULT);
  const limit = Number.isFinite(rawLimit) ? Math.min(PAGE_LIMIT_MAX, Math.max(1, Math.floor(rawLimit))) : PAGE_LIMIT_DEFAULT;
  const rawCursor = url.searchParams.get("cursor");
  let cursorId: string | null = null;
  if (rawCursor) {
    try {
      const decoded = Buffer.from(rawCursor, "base64url").toString("utf8");
      if (/^c[a-z0-9]{10,40}$/.test(decoded)) cursorId = decoded;
    } catch {
      cursorId = null;
    }
  }
  return { limit, cursorId };
}

function cursorFor<T extends { id: string }>(rows: T[], limit: number): string | null {
  if (rows.length < limit) return null;
  const last = rows[rows.length - 1];
  return last ? Buffer.from(last.id, "utf8").toString("base64url") : null;
}

// ── Resource helpers — every where is owner-pinned ──────────────

export async function profileResource(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, email: true, username: true, displayName: true, bio: true,
      location: true, website: true, avatarUrl: true, accentColor: true,
      isPublic: true, isVerified: true, createdAt: true,
      _count: { select: { followers: true, following: true, posts: true } },
    },
  });
  if (!user) return null;
  const { _count, ...fields } = user;
  return { ...fields, followerCount: _count.followers, followingCount: _count.following, postCount: _count.posts };
}

export async function postsPage(userId: string, cursorId: string | null, limit: number) {
  const rows = await prisma.post.findMany({
    where: { authorId: userId },
    select: { id: true, content: true, visibility: true, isNsfw: true, communityId: true, createdAt: true },
    orderBy: { id: "desc" },
    take: limit,
    ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
  });
  return { data: rows, nextCursor: cursorFor(rows, limit) };
}

export async function postResource(userId: string, postId: string) {
  return prisma.post.findFirst({
    where: { id: postId, authorId: userId },
    select: { id: true, content: true, visibility: true, isNsfw: true, communityId: true, createdAt: true },
  });
}

export async function commentsPage(userId: string, cursorId: string | null, limit: number) {
  const rows = await prisma.comment.findMany({
    where: { authorId: userId },
    select: { id: true, content: true, postId: true, createdAt: true },
    orderBy: { id: "desc" },
    take: limit,
    ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
  });
  return { data: rows, nextCursor: cursorFor(rows, limit) };
}

export async function reactionsPage(userId: string, cursorId: string | null, limit: number) {
  const rows = await prisma.reaction.findMany({
    where: { userId },
    select: { id: true, type: true, postId: true, createdAt: true },
    orderBy: { id: "desc" },
    take: limit,
    ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
  });
  return { data: rows, nextCursor: cursorFor(rows, limit) };
}

export async function savesPage(userId: string, cursorId: string | null, limit: number) {
  const rows = await prisma.savedPost.findMany({
    where: { userId },
    select: { id: true, postId: true, createdAt: true },
    orderBy: { id: "desc" },
    take: limit,
    ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
  });
  return { data: rows, nextCursor: cursorFor(rows, limit) };
}

export async function importedAccountsResource(userId: string) {
  // Metadata only — credentials never serialize toward a token.
  return prisma.connectedAccount.findMany({
    where: { userId },
    select: {
      id: true, platform: true, platformUsername: true, accountLabel: true,
      isActive: true, lastSyncAt: true, syncStatus: true, createdAt: true,
    },
    orderBy: { platform: "asc" },
  });
}

export async function importedPostsPage(userId: string, cursorId: string | null, limit: number) {
  const rows = await prisma.platformPost.findMany({
    where: { connectedAccount: { userId } },
    select: {
      id: true, platformPostId: true, title: true, content: true, url: true,
      postType: true, publishedAt: true, likeCount: true, commentCount: true,
      shareCount: true, viewCount: true, isNsfw: true,
      connectedAccount: { select: { platform: true } },
    },
    orderBy: { id: "desc" },
    take: limit,
    ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
  });
  return {
    data: rows.map(({ connectedAccount, ...row }) => ({ ...row, platform: connectedAccount.platform })),
    nextCursor: cursorFor(rows, limit),
  };
}

export async function importedCommentsPage(userId: string, cursorId: string | null, limit: number) {
  const rows = await prisma.platformComment.findMany({
    where: { connectedAccount: { userId }, isOwnComment: true },
    select: {
      id: true, platformCommentId: true, platformPostId: true, content: true,
      createdAt: true, connectedAccount: { select: { platform: true } },
    },
    orderBy: { id: "desc" },
    take: limit,
    ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
  });
  return {
    data: rows.map(({ connectedAccount, ...row }) => ({ ...row, platform: connectedAccount.platform })),
    nextCursor: cursorFor(rows, limit),
  };
}

export async function importedMediaPage(userId: string, cursorId: string | null, limit: number) {
  const rows = await prisma.platformMedia.findMany({
    where: { connectedAccount: { userId } },
    select: {
      id: true, platformMediaId: true, postId: true, mediaType: true, url: true,
      thumbnailUrl: true, connectedAccount: { select: { platform: true } },
    },
    orderBy: { id: "desc" },
    take: limit,
    ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
  });
  return {
    data: rows.map(({ connectedAccount, ...row }) => ({ ...row, platform: connectedAccount.platform })),
    nextCursor: cursorFor(rows, limit),
  };
}

export async function analyticsPage(userId: string, cursorId: string | null, limit: number) {
  // Stored snapshot rows on ownership alone — dump-identical portability.
  // The COMPUTED dashboard is deliberately not exposed here; any future
  // computed endpoint must call hasAnalyticsConsent (pat-check pins that
  // rule by import-surface).
  const rows = await prisma.platformAnalytics.findMany({
    where: { connectedAccount: { userId } },
    select: {
      id: true, date: true, followerCount: true, followingCount: true,
      postCount: true, totalLikes: true, totalComments: true, totalViews: true,
      connectedAccount: { select: { platform: true } },
    },
    orderBy: { id: "desc" },
    take: limit,
    ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
  });
  return {
    data: rows.map(({ connectedAccount, ...row }) => ({ ...row, platform: connectedAccount.platform })),
    nextCursor: cursorFor(rows, limit),
  };
}

export async function journalResource(userId: string) {
  // Through listJournal ONLY — ownership adjudication, grant re-read per
  // request, and the meshi-memory single-reader ratchet extends to this
  // caller. No grant is the owner's true state, not an error.
  const journal = await listJournal(userId);
  if (!journal) return { granted: false as const, entries: [] };
  return { granted: true as const, grantedAt: journal.grantedAt, entries: journal.entries };
}
