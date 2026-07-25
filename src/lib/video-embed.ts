/**
 * Turn a platform page URL into an embeddable, autoplayable player URL.
 * Connected posts usually arrive with a *page* link (a YouTube watch URL, a
 * Vimeo page) rather than a playable file — this is how those still play
 * natively inside mesh.me instead of sitting there as a thumbnail.
 */

import { publicAppHost } from "./app-url";

// The host to hand Twitch as the required `parent`. It must be byte-identical
// on the server and client renders, which is why it comes from `publicAppHost()`
// and not from an ad-hoc chain here.
//
// This used to fall back to `window.location.hostname`, then to `"localhost"`.
// With NEXT_PUBLIC_APP_URL unset that meant the server rendered
// `parent=localhost` while the client rendered the real host: a hydration
// mismatch, AND a player Twitch refuses to load, because `localhost` is not the
// domain the page is served from. The comment above that fallback said it
// existed to keep the two renders identical — the fallback was the thing
// breaking it.
function embedParentHost(): string {
  return publicAppHost();
}

const YT_PATTERNS = [
  /(?:youtube\.com\/watch\?(?:.*&)?v=)([\w-]{6,})/i,
  /(?:youtu\.be\/)([\w-]{6,})/i,
  /(?:youtube\.com\/shorts\/)([\w-]{6,})/i,
  /(?:youtube\.com\/embed\/)([\w-]{6,})/i,
  /(?:youtube\.com\/live\/)([\w-]{6,})/i,
];

export function getVideoEmbedUrl(
  url: string | null | undefined,
  opts: { autoplay?: boolean; muted?: boolean; loop?: boolean } = {},
): string | null {
  if (!url) return null;
  const { autoplay = true, muted = true, loop = false } = opts;

  for (const pattern of YT_PATTERNS) {
    const match = pattern.exec(url);
    if (match) {
      const id = match[1];
      const params = new URLSearchParams({
        autoplay: autoplay ? "1" : "0",
        mute: muted ? "1" : "0",
        playsinline: "1",
        rel: "0",
        modestbranding: "1",
      });
      if (loop) {
        params.set("loop", "1");
        params.set("playlist", id);
      }
      return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`;
    }
  }

  const vimeo = /vimeo\.com\/(\d{6,})/i.exec(url);
  if (vimeo) {
    const params = new URLSearchParams({
      autoplay: autoplay ? "1" : "0",
      muted: muted ? "1" : "0",
      loop: loop ? "1" : "0",
      playsinline: "1",
    });
    return `https://player.vimeo.com/video/${vimeo[1]}?${params.toString()}`;
  }

  // Twitch clips are shared two ways: clips.twitch.tv/<slug> and
  // twitch.tv/<channel>/clip/<slug>. Match both, or the second form never
  // embeds and just sits there as a dead thumbnail. `parent` must be the live
  // host (required by Twitch), and autoplay needs muted=true per browser policy.
  const twitchClip = /(?:clips\.twitch\.tv\/|(?:www\.)?twitch\.tv\/[\w.-]+\/clip\/)([A-Za-z0-9_-]+)/i.exec(url);
  if (twitchClip) {
    const params = new URLSearchParams({
      clip: twitchClip[1],
      parent: embedParentHost(),
      autoplay: autoplay ? "true" : "false",
      muted: muted ? "true" : "false",
    });
    return `https://clips.twitch.tv/embed?${params.toString()}`;
  }

  const tiktok = /tiktok\.com\/@[\w.-]+\/video\/(\d+)/i.exec(url);
  if (tiktok) {
    return `https://www.tiktok.com/embed/v2/${tiktok[1]}?autoplay=${autoplay ? 1 : 0}`;
  }

  // Instagram's embed endpoint renders the post in place (it controls its own
  // playback; autoplay isn't offered) — still the post itself, not a link out.
  const instagram = /instagram\.com\/(p|reel|reels|tv)\/([\w-]+)/i.exec(url);
  if (instagram) {
    const kind = instagram[1] === "reels" ? "reel" : instagram[1];
    return `https://www.instagram.com/${kind}/${instagram[2]}/embed/`;
  }

  return null;
}
