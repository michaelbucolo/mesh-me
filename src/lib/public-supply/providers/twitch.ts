import { appTokenPost, cachedAppToken } from "../fetch";
import type { LaneContext, PublicItem, PublicSupplyLane } from "../types";

/**
 * TWITCH — Helix, app access token, no user account involved.
 *
 * ── "APP TOKEN" IS NOT "USER TOKEN" ─────────────────────────────────────────
 *
 * This lane mints a token from client_credentials: it authenticates MESH.ME
 * the application, carries no scopes, and can read nothing private. It is not
 * borrowed from a viewer, it is not stored in ConnectedAccount, and it never
 * touches a person's Twitch identity. That distinction is the whole reason
 * this can populate a stranger's Flow without them connecting anything.
 *
 * ── 24 HOURS. NOT NEGOTIABLE. ───────────────────────────────────────────────
 *
 * Twitch's Developer Services Agreement (Schedule 1 §C) permits caching Twitch
 * content "for only a twenty-four hour time period" absent written
 * authorisation. So `retentionHours: 24`, and store.ts writes `expiresAt` from
 * it, reads filter on it, and the sweep deletes past it. This is the tightest
 * retention of any lane and the reason retention is a per-lane number rather
 * than one global constant.
 *
 * ── CLIPS, NOT STREAMS ──────────────────────────────────────────────────────
 *
 * A live stream is not a feed item: by the time anyone scrolls to it the
 * broadcaster may be offline, and the card would be a dead link. Clips are
 * finite, have a real duration, and are the short-form Twitch content the Flow
 * is actually for. `/helix/clips` needs a game_id, so this walks
 * `/helix/games/top` first — two calls, both cheap.
 *
 * ── THE PLAYER IS MANDATORY ─────────────────────────────────────────────────
 *
 * Twitch requires its embedded player and "a clear path to the source".
 * `mediaUrl` stays null and `url` is the clip page; lib/video-embed.ts turns
 * that into a clips.twitch.tv embed with the required `parent`.
 */

const TOKEN_URL = "https://id.twitch.tv/oauth2/token";

async function appToken(ctx: LaneContext): Promise<string | null> {
  const clientId = ctx.env("TWITCH_CLIENT_ID");
  const clientSecret = ctx.env("TWITCH_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;

  // Cached in memory for its real lifetime — see fetch.ts for why this is not
  // persisted. Keyed by client id so rotating credentials mints a fresh token
  // instead of serving a stale one.
  return cachedAppToken(`twitch:${clientId}`, async () => {
    const payload = (await appTokenPost(TOKEN_URL, {
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    })) as { access_token?: string; expires_in?: number };
    if (!payload?.access_token) throw new Error("twitch: no app token in response");
    return { token: payload.access_token, expiresInSeconds: Number(payload.expires_in ?? 3600) };
  });
}

type TwitchGame = { id?: string; name?: string };
type TwitchClip = {
  id?: string;
  url?: string;
  title?: string;
  broadcaster_name?: string;
  creator_name?: string;
  thumbnail_url?: string;
  view_count?: number;
  duration?: number;
  language?: string;
  created_at?: string;
  is_featured?: boolean;
};

function headers(clientId: string, token: string): Record<string, string> {
  return { "Client-Id": clientId, Authorization: `Bearer ${token}` };
}

async function fetchTopClips(ctx: LaneContext): Promise<PublicItem[]> {
  const clientId = ctx.env("TWITCH_CLIENT_ID");
  const token = await appToken(ctx);
  if (!clientId || !token) return [];

  const games = (await ctx.get("https://api.twitch.tv/helix/games/top?first=5", {
    headers: headers(clientId, token),
  })) as { data?: TwitchGame[] };

  const topGames = (games?.data ?? []).filter((g): g is TwitchGame & { id: string } => Boolean(g?.id));
  if (topGames.length === 0) return [];

  // Clips from the last day only. Anything older is both less interesting and
  // closer to the 24h retention edge before it is even stored.
  const startedAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const perGame = Math.max(3, Math.ceil(ctx.limit / topGames.length));

  const items: PublicItem[] = [];
  const seen = new Set<string>();

  for (const game of topGames) {
    if (items.length >= ctx.limit) break;
    const url =
      `https://api.twitch.tv/helix/clips?game_id=${encodeURIComponent(game.id)}` +
      `&first=${perGame}&started_at=${encodeURIComponent(startedAt)}`;

    let payload: unknown;
    try {
      payload = await ctx.get(url, { headers: headers(clientId, token) });
    } catch {
      // One category failing must not cost the rest.
      continue;
    }

    for (const clip of ((payload as { data?: TwitchClip[] })?.data ?? [])) {
      const id = clip?.id;
      if (!id || seen.has(id) || !clip.url) continue;
      seen.add(id);

      items.push({
        platformPostId: id,
        title: clip.title ?? null,
        content: game.name ? `${game.name} · ${clip.broadcaster_name ?? ""}`.trim() : null,
        url: clip.url,
        postType: "clip",
        // Twitch templates its thumbnails; the placeholder must be substituted
        // or the URL 404s.
        thumbnailUrl: clip.thumbnail_url?.replace("%{width}", "480").replace("%{height}", "272") ?? null,
        mediaUrl: null,
        // Twitch reports clip length in seconds directly — the Flow's
        // shorts-only rule can classify these without guessing.
        durationSeconds: typeof clip.duration === "number" && clip.duration > 0 ? Math.round(clip.duration) : null,
        lang: clip.language ?? null,
        authorName: clip.broadcaster_name ?? null,
        authorUsername: clip.broadcaster_name ?? null,
        authorAvatarUrl: null,
        authorUrl: clip.broadcaster_name ? `https://www.twitch.tv/${encodeURIComponent(clip.broadcaster_name)}` : null,
        viewCount: typeof clip.view_count === "number" ? clip.view_count : 0,
        likeCount: 0,
        commentCount: 0,
        publishedAt: clip.created_at ? new Date(clip.created_at) : null,
        sourceMarkedMature: false,
      });
      if (items.length >= ctx.limit) break;
    }
  }

  return items;
}

export const twitchTopClips: PublicSupplyLane = {
  id: "twitch:topClips",
  platform: "twitch",
  label: "Twitch — top clips",
  endpoint: "GET https://api.twitch.tv/helix/clips (app access token via client_credentials)",
  authModel: "app_token",
  envKeys: ["TWITCH_CLIENT_ID", "TWITCH_CLIENT_SECRET"],
  // Contractual ceiling, not a tuning choice. See the header.
  retentionHours: 24,
  minIntervalSeconds: 30 * 60,
  attribution: "Twitch",
  fetch: fetchTopClips,
};
