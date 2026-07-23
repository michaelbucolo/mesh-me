// Public web-profile URLs for a connected platform account, so mesh.me can be a
// real "all your socials in one place" hub — the connected-platform badges on a
// profile deep-link out to the person's actual Instagram / YouTube / TikTok /…
// page instead of a dead label.
//
// The username is sanitized to a conservative handle charset before it's placed
// in the URL, so a hostile stored value can't traverse paths or escape into a
// different host (important for the sub-domain templates below).

const UNSAFE_HANDLE = /[^a-zA-Z0-9._-]/g;

function safeHandle(username: string | null | undefined): string | null {
  if (!username) return null;
  const h = username.trim().replace(/^@+/, "").replace(UNSAFE_HANDLE, "");
  return h.length > 0 ? h : null;
}

/**
 * Public profile URL for `platform` + `username`, or null when the platform has
 * no clean public URL (e.g. Discord) or needs info we don't store (e.g. a
 * Mastodon instance). Callers should render a plain, non-linked badge on null.
 */
export function platformProfileUrl(
  platform: string,
  username: string | null | undefined,
): string | null {
  const u = safeHandle(username);
  if (!u) return null;
  switch (platform) {
    case "instagram":
      return `https://instagram.com/${u}`;
    case "youtube":
      return `https://youtube.com/@${u}`;
    case "twitter":
      return `https://x.com/${u}`;
    case "tiktok":
      return `https://tiktok.com/@${u}`;
    case "twitch":
      return `https://twitch.tv/${u}`;
    case "facebook":
      return `https://facebook.com/${u}`;
    case "github":
      return `https://github.com/${u}`;
    case "spotify":
      return `https://open.spotify.com/user/${u}`;
    case "linkedin":
      return `https://linkedin.com/in/${u}`;
    case "reddit":
      return `https://reddit.com/user/${u}`;
    case "pinterest":
      return `https://pinterest.com/${u}`;
    case "snapchat":
      return `https://snapchat.com/add/${u}`;
    case "threads":
      return `https://threads.net/@${u}`;
    case "soundcloud":
      return `https://soundcloud.com/${u}`;
    case "patreon":
      return `https://patreon.com/${u}`;
    case "dribbble":
      return `https://dribbble.com/${u}`;
    case "bluesky":
      return `https://bsky.app/profile/${u}`;
    case "medium":
      return `https://medium.com/@${u}`;
    case "devto":
      return `https://dev.to/${u}`;
    case "behance":
      return `https://behance.net/${u}`;
    case "substack":
      return `https://${u}.substack.com`;
    case "tumblr":
      return `https://${u}.tumblr.com`;
    default:
      // discord, mastodon (instance-specific), applemusic, messaging apps, …
      return null;
  }
}
