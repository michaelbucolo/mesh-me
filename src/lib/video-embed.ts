/**
 * Turn a platform page URL into an embeddable, autoplayable player URL.
 * Connected posts usually arrive with a *page* link (a YouTube watch URL, a
 * Vimeo page) rather than a playable file — this is how those still play
 * natively inside mesh.me instead of sitting there as a thumbnail.
 */

// The host to hand Twitch as the required `parent`. Read from the build-inlined
// NEXT_PUBLIC_APP_URL so it's identical on the server and client renders (no
// hydration mismatch) and Twitch clips embed in server components too; fall back
// to the live location, then localhost for dev.
function embedParentHost(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) {
    try {
      return new URL(configured).hostname;
    } catch {
      // ignore malformed config and fall through
    }
  }
  if (typeof window !== "undefined") return window.location.hostname;
  return "localhost";
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
