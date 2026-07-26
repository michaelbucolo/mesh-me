import type { LaneContext, PublicItem, PublicSupplyLane } from "../types";

/**
 * YOUTUBE — Data API v3, plain API key, no user account involved.
 *
 * ── WHY `chart=mostPopular` AND NOT SEARCH ──────────────────────────────────
 *
 * `search.list` is the obvious choice and the wrong one. Its quota is capped at
 * roughly 100 calls PER DAY FOR THE ENTIRE APPLICATION — not per user, per
 * Google Cloud project. A feed built on search would work for the first few
 * refreshes of the day and then serve nothing to everybody, which is the worst
 * possible failure: intermittent, quota-shaped, and invisible until someone
 * complains the Flow went quiet in the afternoon.
 *
 * `videos.list?chart=mostPopular` is one cheap call, returns fully hydrated
 * items including duration, and never runs dry.
 *
 * ── TWO TERMS OBLIGATIONS ENCODED HERE, NOT PROMISED ELSEWHERE ──────────────
 *
 * RETENTION. YouTube's Developer Policies treat data fetched without user auth
 * as "Non-Authorized Data", storable "but not longer than 30 calendar days",
 * with reasonable efforts to keep it consistent with current data. The lane
 * declares 24h rather than the 720h ceiling: refreshing daily satisfies the
 * consistency obligation as a side effect of satisfying retention, and nothing
 * in a scrolling feed benefits from month-old view counts.
 *
 * THE PLAYER. YouTube requires playback in its embedded player with per-item
 * attribution. So `mediaUrl` is deliberately left null and `url` is the
 * canonical watch URL: lib/video-embed.ts turns that into a youtube.com/embed
 * player, which is the compliant path AND the one the Flow already renders.
 * Handing this layer a direct file would be both a violation and a regression.
 */

/** ISO-8601 durations, as YouTube reports them: PT1M30S, PT45S, PT1H2M3S. */
function parseIso8601Duration(value: string | null | undefined): number | null {
  if (!value || typeof value !== "string") return null;
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(value.trim());
  if (!m) return null;
  const [, d, h, min, s] = m;
  if (!d && !h && !min && !s) return null;
  const total = Number(d ?? 0) * 86400 + Number(h ?? 0) * 3600 + Number(min ?? 0) * 60 + Number(s ?? 0);
  return Number.isFinite(total) && total > 0 ? total : null;
}

type YtThumb = { url?: string; width?: number };
type YtItem = {
  id?: string;
  snippet?: {
    title?: string;
    description?: string;
    channelTitle?: string;
    channelId?: string;
    publishedAt?: string;
    defaultAudioLanguage?: string;
    defaultLanguage?: string;
    thumbnails?: Record<string, YtThumb>;
  };
  contentDetails?: { duration?: string };
  status?: { madeForKids?: boolean };
  statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
};

/** Largest thumbnail offered. Keys vary by video, so pick by width, not name. */
function bestThumb(thumbnails: Record<string, YtThumb> | undefined): string | null {
  if (!thumbnails) return null;
  const best = Object.values(thumbnails)
    .filter((t): t is YtThumb & { url: string } => Boolean(t?.url))
    .sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0];
  return best?.url ?? null;
}

function toInt(value: string | undefined): number {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * Regions to pull. Several, because "most popular" is per-country and a single
 * region makes a global product feel like one country's product. Kept small
 * because each is a separate call against a shared daily quota.
 */
const REGIONS = ["US", "GB", "IN", "BR", "JP"];

async function fetchMostPopular(ctx: LaneContext): Promise<PublicItem[]> {
  const key = ctx.env("YOUTUBE_API_KEY");
  if (!key) return [];

  const perRegion = Math.max(4, Math.ceil(ctx.limit / REGIONS.length));
  const items: PublicItem[] = [];
  const seen = new Set<string>();

  for (const region of REGIONS) {
    if (items.length >= ctx.limit) break;
    const url =
      `https://www.googleapis.com/youtube/v3/videos` +
      `?part=snippet,contentDetails,statistics,status&chart=mostPopular` +
      `&regionCode=${region}&maxResults=${perRegion}&key=${encodeURIComponent(key)}`;

    // One region failing (an unsupported regionCode, a transient 5xx) must not
    // cost the other four. The lane's own errors are still surfaced by the
    // runner when EVERY region fails, because then `items` is empty.
    let payload: unknown;
    try {
      payload = await ctx.get(url);
    } catch {
      continue;
    }

    const list = (payload as { items?: YtItem[] })?.items;
    if (!Array.isArray(list)) continue;

    for (const raw of list) {
      const id = raw?.id;
      if (!id || seen.has(id)) continue;

      // MADE FOR KIDS IS SKIPPED ENTIRELY, NOT MERELY UNTRACKED.
      //
      // YouTube's Developer Policies require an API Client to look up the Made
      // For Kids status of every video it embeds, and to disable tracking for
      // those that are. mesh.me records watch time and completion on every Flow
      // item (FlowImpression) to feed ranking, so honouring that would mean a
      // per-item carve-out threaded through the beacon, the ranker and the
      // taste profile — a lot of surface, all of it easy to break silently, all
      // of it about children's data.
      //
      // Not ingesting them removes the obligation instead of managing it. The
      // cost is a handful of nursery-rhyme videos absent from a trending chart,
      // which is not a loss. This lane shipped without the `status` part at all,
      // so the check did not exist until now.
      //
      // IT FAILS CLOSED. The obvious spelling — `=== true` — admits anything
      // whose status is missing, so if YouTube ever drops the field or the
      // `status` part is edited out of the request above, children's content
      // starts flowing in and being tracked, silently and indefinitely. The
      // same reasoning as the refresh endpoint's secret two files away: absent
      // information must mean no, never yes. An unreadable status empties the
      // lane, which is loud, recoverable, and shows up as 0 items in the run
      // record — the failure you find in a day rather than in a subpoena.
      if (raw.status?.madeForKids !== false) continue;

      seen.add(id);

      const snippet = raw.snippet ?? {};
      items.push({
        platformPostId: id,
        title: snippet.title ?? null,
        content: snippet.description?.slice(0, 600) ?? null,
        // Canonical watch URL. video-embed.ts turns this into the embedded
        // player YouTube's terms require; a direct file would violate them.
        url: `https://www.youtube.com/watch?v=${id}`,
        postType: "video",
        thumbnailUrl: bestThumb(snippet.thumbnails),
        mediaUrl: null,
        durationSeconds: parseIso8601Duration(raw.contentDetails?.duration),
        lang: snippet.defaultAudioLanguage ?? snippet.defaultLanguage ?? null,
        authorName: snippet.channelTitle ?? null,
        authorUsername: snippet.channelTitle ?? null,
        authorAvatarUrl: null,
        authorUrl: snippet.channelId ? `https://www.youtube.com/channel/${snippet.channelId}` : null,
        viewCount: toInt(raw.statistics?.viewCount),
        likeCount: toInt(raw.statistics?.likeCount),
        commentCount: toInt(raw.statistics?.commentCount),
        publishedAt: snippet.publishedAt ? new Date(snippet.publishedAt) : null,
        // YouTube's own "most popular" chart excludes age-restricted content,
        // so there is nothing to mark here. The shared classifier in store.ts
        // still runs over title and description regardless.
        sourceMarkedMature: false,
      });
      if (items.length >= ctx.limit) break;
    }
  }

  return items;
}

export const youtubeMostPopular: PublicSupplyLane = {
  id: "youtube:mostPopular",
  platform: "youtube",
  label: "YouTube — trending",
  endpoint: "GET https://www.googleapis.com/youtube/v3/videos?chart=mostPopular (Data API v3)",
  authModel: "api_key",
  envKeys: ["YOUTUBE_API_KEY"],
  // Ceiling is 30 days for non-authorized data; daily refresh also satisfies
  // the "keep it consistent with current data" obligation. See header.
  retentionHours: 24,
  // Quota is per-project and shared with every other lane on this key.
  minIntervalSeconds: 60 * 60,
  attribution: "YouTube",
  fetch: fetchMostPopular,
};
