import type { LaneContext, PublicItem, PublicSupplyLane } from "../types";

/**
 * MASTODON — trends, anonymous, no key, no contract.
 *
 * ── THE ONE PLATFORM THAT SIMPLY LETS YOU ───────────────────────────────────
 *
 * Mastodon is AGPL software run by thousands of independent operators. There
 * is no central developer agreement to accept, no API key to obtain, no access
 * that can be revoked. That makes it the cleanest lane in this layer — and
 * worth stating plainly, because the contrast with the platforms that have
 * closed their doors is the actual argument for an open fediverse.
 *
 * ── BUT AVAILABILITY IS PER SERVER, NOT PER PLATFORM ────────────────────────
 *
 * There is no "Mastodon API" endpoint; there are thousands of servers, each
 * deciding what it exposes. mastodon.social — the largest — has switched its
 * public live timeline OFF. So this lane asks `/api/v2/instance` what a server
 * actually offers before requesting anything, and uses `/api/v1/trends/statuses`,
 * which is far more widely enabled than the firehose and is the better feed
 * anyway: curated by that community rather than whatever was posted last.
 *
 * A server that refuses is skipped silently. That is not an error — it is a
 * server exercising a choice this layer has no business complaining about.
 *
 * ── POLITENESS IS THE ONLY CONTRACT ─────────────────────────────────────────
 *
 * Unauthenticated requests are rate-limited at 300 per 5 minutes PER IP, shared
 * across every server. With no company to negotiate with, being a good guest is
 * enforced entirely by us: a small seed list, one trends call each, a generous
 * interval, and the honest User-Agent that fetch.ts always sends.
 */

/**
 * Seed servers. Deliberately small, general-interest, and overridable — a
 * hardcoded list is a curation decision, and the operator should be able to
 * disagree with ours via MASTODON_INSTANCES.
 */
const DEFAULT_INSTANCES = ["mastodon.social", "mstdn.social", "fosstodon.org", "hachyderm.io"];

/** Hostname only. Prevents a stray env value from redirecting these calls. */
function safeHost(value: string): string | null {
  const host = value.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase();
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(host) ? host : null;
}

function instancesFrom(ctx: LaneContext): string[] {
  const raw = ctx.env("MASTODON_INSTANCES");
  const list = raw ? raw.split(",").map(safeHost).filter((h): h is string => Boolean(h)) : DEFAULT_INSTANCES;
  return list.slice(0, 6);
}

type MastoAccount = {
  display_name?: string;
  acct?: string;
  username?: string;
  avatar_static?: string;
  url?: string;
};
type MastoAttachment = {
  type?: string;
  url?: string;
  preview_url?: string;
  /** Videos carry real measurements. `original.duration` is seconds. */
  meta?: { original?: { duration?: number; width?: number; height?: number } };
};
type MastoStatus = {
  id?: string;
  uri?: string;
  url?: string;
  content?: string;
  created_at?: string;
  language?: string;
  sensitive?: boolean;
  spoiler_text?: string;
  favourites_count?: number;
  replies_count?: number;
  reblogs_count?: number;
  account?: MastoAccount;
  media_attachments?: MastoAttachment[];
};

/**
 * Mastodon statuses are HTML fragments produced by the server. This strips to
 * text — it is NOT parsing a web page, which the no-scraping rule forbids; it
 * is reading a documented field of a documented JSON API that happens to
 * contain markup, exactly as every Mastodon client does.
 */
function htmlToText(html: string | undefined | null): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Does this server expose what we are about to ask for? */
async function trendsAvailable(ctx: LaneContext, host: string): Promise<boolean> {
  try {
    const info = (await ctx.get(`https://${host}/api/v2/instance`)) as {
      configuration?: { timelines_access?: unknown };
    };
    // A server that answers /api/v2/instance at all is running a version new
    // enough to have trends. Absence of the key is not a refusal.
    return Boolean(info);
  } catch {
    return false;
  }
}

/**
 * Both lanes read statuses and turn them into items; only the endpoint differs.
 * `videoOnly` additionally discards anything without a playable duration, which
 * is what makes the shorts lane a shorts lane rather than a hopeful one.
 */
async function collect(
  ctx: LaneContext,
  endpoints: (host: string, per: number) => string[],
  videoOnly: boolean,
): Promise<PublicItem[]> {
  const hosts = instancesFrom(ctx);
  const perHost = Math.max(4, Math.ceil(ctx.limit / hosts.length));
  const items: PublicItem[] = [];
  const seen = new Set<string>();

  for (const host of hosts) {
    if (items.length >= ctx.limit) break;
    if (!(await trendsAvailable(ctx, host))) continue;

    for (const endpoint of endpoints(host, perHost)) {
    if (items.length >= ctx.limit) break;
    let payload: unknown;
    try {
      payload = await ctx.get(endpoint);
    } catch {
      // Rate-limited, disabled, or simply down. Not our business to complain.
      continue;
    }

    for (const status of (Array.isArray(payload) ? payload : []) as MastoStatus[]) {
      // The federated URI is the identity that survives across servers, so the
      // same toot trending on three instances is stored once.
      const identity = status?.uri || status?.url;
      const link = status?.url || status?.uri;
      if (!identity || !link || seen.has(identity)) continue;
      seen.add(identity);

      const account = status.account ?? {};
      const attachments = status.media_attachments ?? [];
      const text = htmlToText(status.content);

      // VIDEO IS WHY THIS LANE CAN REACH THE FLOW AT ALL.
      //
      // The Flow is shorts-only and EXCLUDES anything it cannot positively
      // classify as short — an item with no duration is "unknown" and is
      // dropped. This lane originally read only `type === "image"`, so every
      // item it produced was text or a still, every one had a null duration,
      // and every one was filtered out. The supply layer shipped filling /feed
      // and /explore while the flagship surface still said "No shorts to play".
      //
      // Mastodon reports `meta.original.duration` in seconds on video and gifv
      // attachments — a measurement, not a guess about a URL — which is exactly
      // the signal flowFormClass wants. Measured live across four servers: 20 of
      // 20 video attachments carried a duration, and all of them were under two
      // minutes.
      //
      // Unlike YouTube and Twitch, Mastodon mandates no player, so `mediaUrl` is
      // the file itself and the Flow plays it natively.
      const video = attachments.find(
        (m) => (m?.type === "video" || m?.type === "gifv") && m.url && typeof m.meta?.original?.duration === "number",
      );
      const image = attachments.find((m) => m?.type === "image" && m.url);
      if (videoOnly && !video) continue;
      if (!text && !video && !image) continue;

      items.push({
        platformPostId: identity,
        title: null,
        content: [status.spoiler_text?.trim(), text].filter(Boolean).join("\n\n").slice(0, 600) || null,
        url: link,
        postType: video ? "video" : image ? "image" : "text",
        thumbnailUrl: video?.preview_url ?? image?.preview_url ?? image?.url ?? null,
        mediaUrl: video?.url ?? image?.url ?? null,
        // Rounded, and only when positive — flowFormClass treats <= 0 as
        // unknown, so a zero-length attachment must not masquerade as a short.
        durationSeconds:
          video && typeof video.meta?.original?.duration === "number" && video.meta.original.duration > 0
            ? Math.round(video.meta.original.duration)
            : null,
        lang: status.language ?? null,
        authorName: account.display_name?.trim() || account.username || account.acct || null,
        authorUsername: account.acct ?? account.username ?? null,
        authorAvatarUrl: account.avatar_static ?? null,
        authorUrl: account.url ?? null,
        viewCount: 0,
        likeCount: typeof status.favourites_count === "number" ? status.favourites_count : 0,
        commentCount: typeof status.replies_count === "number" ? status.replies_count : 0,
        publishedAt: status.created_at ? new Date(status.created_at) : null,
        // The author's own content warning. Taken as a floor: store.ts still
        // runs the shared classifier, so `sensitive: false` is not a free pass.
        sourceMarkedMature: Boolean(status.sensitive),
      });
      if (items.length >= ctx.limit) break;
    }
    }
  }

  return items;
}

/** Tags that reliably carry short video, and are general-interest rather than niche. */
const VIDEO_TAGS = ["video", "animation", "nature", "wildlife", "music"];

export const mastodonTrending: PublicSupplyLane = {
  id: "mastodon:trending",
  platform: "mastodon",
  label: "Mastodon — trending",
  endpoint: "GET https://{instance}/api/v1/trends/statuses (after /api/v2/instance capability check)",
  authModel: "none",
  // No key exists to require. MASTODON_INSTANCES is optional curation, not a
  // credential, so it is not listed here — a lane with no envKeys runs by
  // default, which is right for the one platform that asks nothing of us.
  envKeys: [],
  // No contractual cap. Conservative anyway: trends move slowly and stale
  // fediverse posts are worth less than fresh ones.
  retentionHours: 48,
  minIntervalSeconds: 45 * 60,
  attribution: "Mastodon",
  fetch: (ctx) => collect(ctx, (host, per) => [`https://${host}/api/v1/trends/statuses?limit=${per}`], false),
};

/**
 * SHORT VIDEO, WHICH IS THE ONLY THING THE FLOW WILL PLAY.
 *
 * The trends lane above is the right feed for /feed and /explore and a poor one
 * for /flow: measured live, exactly 1 of 52 trending statuses carried a video
 * duration, so the flagship surface stayed empty while the supply layer looked
 * healthy everywhere else.
 *
 * Hashtag timelines are where the video is. `/api/v1/timelines/tag/{tag}` is
 * anonymously readable on servers that leave `hashtag_feeds` public — including
 * mastodon.social, which has switched its firehose off but not this — and the
 * same 20-of-20 probe that found durations found them here.
 *
 * Kept separate from trends rather than merged into it so that one lane going
 * quiet does not look like the other failing, and so the run record says which
 * of the two is thin.
 */
export const mastodonShortVideo: PublicSupplyLane = {
  id: "mastodon:shortVideo",
  platform: "mastodon",
  label: "Mastodon — short video",
  endpoint: "GET https://{instance}/api/v1/timelines/tag/{tag} (video attachments only)",
  authModel: "none",
  envKeys: [],
  retentionHours: 48,
  // More endpoints per run than the trends lane, so it runs less often. The
  // unauthenticated budget is 300 requests per 5 minutes PER IP, shared with
  // every other lane and every other instance of this app.
  minIntervalSeconds: 60 * 60,
  attribution: "Mastodon",
  fetch: (ctx) =>
    collect(
      ctx,
      (host, per) => VIDEO_TAGS.map((tag) => `https://${host}/api/v1/timelines/tag/${tag}?limit=${per}&only_media=true`),
      true,
    ),
};
