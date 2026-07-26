import type { LaneContext, PublicItem, PublicSupplyLane } from "../types";

/**
 * BLUESKY — public AppView, unauthenticated, no key at all.
 *
 * ── THE OPT-OUT IS THE IMPORTANT PART OF THIS FILE ──────────────────────────
 *
 * Bluesky is a public network, and it gives its users a way to say "public, but
 * not to logged-out strangers": the `!no-unauthenticated` label. mesh.me is
 * reading unauthenticated, so to those users we ARE the logged-out stranger,
 * and re-publishing their posts into a feed they never heard of is exactly what
 * that label exists to prevent.
 *
 * `respectsNoUnauthenticated` below drops those posts. Nobody would notice if
 * it were missing — the API returns the content either way, and no error is
 * raised. That is precisely why it is written down, checked, and explained: a
 * privacy control that only works when someone remembers it is not a control.
 *
 * The label can sit on the post or on its author, so both are checked. When in
 * doubt the item is dropped: on a feed with millions of public posts, the cost
 * of dropping one is nil and the cost of showing one is somebody's trust.
 *
 * ── WHY "What's Hot" AND NOT THE FIREHOSE ───────────────────────────────────
 *
 * The Jetstream firehose is open and would give far more volume, but it is an
 * unfiltered stream of everything anyone posts — no curation, no moderation
 * pass, no relevance. `app.bsky.feed.getFeed` against the What's Hot generator
 * returns a feed the network itself curates, which is both better content and a
 * far smaller moderation burden to inherit.
 */

/** Bluesky's public AppView. No credential; that is the design, not an omission. */
const APPVIEW = "https://public.api.bsky.app/xrpc";

/** The Bluesky team's "What's Hot" feed generator. */
const WHATS_HOT = "at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot";

/** The label a Bluesky user applies to opt out of logged-out visibility. */
const NO_UNAUTHENTICATED = "!no-unauthenticated";

type BskyLabel = { val?: string };
type BskyAuthor = {
  did?: string;
  handle?: string;
  displayName?: string;
  avatar?: string;
  labels?: BskyLabel[];
};
type BskyImage = { thumb?: string; fullsize?: string; alt?: string };
type BskyPost = {
  uri?: string;
  cid?: string;
  author?: BskyAuthor;
  record?: { text?: string; createdAt?: string; langs?: string[] };
  embed?: { images?: BskyImage[]; $type?: string };
  replyCount?: number;
  repostCount?: number;
  likeCount?: number;
  indexedAt?: string;
  labels?: BskyLabel[];
};

/**
 * Has this post, or its author, opted out of being shown to logged-out
 * viewers? Returns TRUE only when it is safe to show.
 */
function respectsNoUnauthenticated(post: {
  labels?: BskyLabel[];
  author?: { labels?: BskyLabel[] };
}): boolean {
  const carries = (labels: BskyLabel[] | undefined) =>
    Array.isArray(labels) && labels.some((l) => l?.val === NO_UNAUTHENTICATED);
  return !carries(post.labels) && !carries(post.author?.labels);
}

/** Any moderation label at all marks the item mature for our purposes. */
function hasModerationLabel(post: BskyPost): boolean {
  const vals = [...(post.labels ?? []), ...(post.author?.labels ?? [])].map((l) => l?.val ?? "");
  // Bluesky's standard self-applied content labels.
  return vals.some((v) => ["porn", "sexual", "nudity", "graphic-media", "nsfw"].includes(v));
}

/** at://did:plc:xxx/app.bsky.feed.post/RKEY -> the web permalink. */
function permalink(uri: string | undefined, handle: string | undefined): string | null {
  if (!uri) return null;
  const rkey = uri.split("/").pop();
  if (!rkey) return null;
  const who = handle || uri.split("/")[2];
  return who ? `https://bsky.app/profile/${who}/post/${rkey}` : null;
}

async function fetchWhatsHot(ctx: LaneContext): Promise<PublicItem[]> {
  const url = `${APPVIEW}/app.bsky.feed.getFeed?feed=${encodeURIComponent(WHATS_HOT)}&limit=${Math.min(ctx.limit, 50)}`;

  const payload = (await ctx.get(url)) as { feed?: Array<{ post?: BskyPost }> };
  const entries = Array.isArray(payload?.feed) ? payload.feed : [];

  const items: PublicItem[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    const post = entry?.post;
    const uri = post?.uri;
    if (!post || !uri || seen.has(uri)) continue;

    // The opt-out, honoured before anything else is considered.
    if (!respectsNoUnauthenticated(post)) continue;

    const author = post.author ?? {};
    const link = permalink(uri, author.handle);
    const text = post.record?.text?.trim() ?? "";
    const image = post.embed?.images?.[0];
    if (!link || (!text && !image)) continue;
    seen.add(uri);

    items.push({
      platformPostId: uri,
      title: null,
      content: text.slice(0, 600) || null,
      url: link,
      postType: image ? "image" : "text",
      thumbnailUrl: image?.thumb ?? null,
      mediaUrl: image?.fullsize ?? null,
      durationSeconds: null,
      lang: post.record?.langs?.[0] ?? null,
      authorName: author.displayName?.trim() || author.handle || null,
      authorUsername: author.handle ?? null,
      authorAvatarUrl: author.avatar ?? null,
      authorUrl: author.handle ? `https://bsky.app/profile/${author.handle}` : null,
      viewCount: 0,
      likeCount: typeof post.likeCount === "number" ? post.likeCount : 0,
      commentCount: typeof post.replyCount === "number" ? post.replyCount : 0,
      publishedAt: post.record?.createdAt ? new Date(post.record.createdAt) : post.indexedAt ? new Date(post.indexedAt) : null,
      sourceMarkedMature: hasModerationLabel(post),
    });
    if (items.length >= ctx.limit) break;
  }

  return items;
}

export const blueskyWhatsHot: PublicSupplyLane = {
  id: "bluesky:whatsHot",
  platform: "bluesky",
  label: "Bluesky — what's hot",
  endpoint: "GET https://public.api.bsky.app/xrpc/app.bsky.feed.getFeed (unauthenticated AppView)",
  authModel: "none",
  envKeys: [],
  // No contractual retention cap — Bluesky is explicitly a public network with
  // no developer agreement restricting third-party readers. Short anyway: a
  // "what's hot" feed is worthless once it is not hot.
  retentionHours: 24,
  minIntervalSeconds: 30 * 60,
  attribution: "Bluesky",
  fetch: fetchWhatsHot,
};
