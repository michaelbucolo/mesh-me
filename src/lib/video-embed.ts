/**
 * Turn a platform page URL into an embeddable, autoplayable player URL.
 * Connected posts usually arrive with a *page* link (a YouTube watch URL, a
 * Vimeo page) rather than a playable file — this is how those still play
 * natively inside mesh.me instead of sitting there as a thumbnail.
 */

const YT_PATTERNS = [
  /(?:youtube\.com\/watch\?(?:.*&)?v=)([\w-]{6,})/i,
  /(?:youtu\.be\/)([\w-]{6,})/i,
  /(?:youtube\.com\/shorts\/)([\w-]{6,})/i,
  /(?:youtube\.com\/embed\/)([\w-]{6,})/i,
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

  const twitchClip = /clips\.twitch\.tv\/([\w-]+)/i.exec(url);
  if (twitchClip && typeof window !== "undefined") {
    return `https://clips.twitch.tv/embed?clip=${twitchClip[1]}&parent=${window.location.hostname}&autoplay=${autoplay}&muted=${muted}`;
  }

  return null;
}
