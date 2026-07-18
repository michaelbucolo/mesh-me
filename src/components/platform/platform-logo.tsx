// Real third-party brand marks, drawn as tiny self-contained SVGs (CSP-safe,
// no external requests). One source of truth: DOM surfaces render
// <PlatformLogo/>, and the mesh canvas rasterizes the same SVG via
// platformLogoDataUri(). Marks are nominative use — they identify where a
// piece of content came from.

const TILE: Record<string, { bg: string; rx: number; inner: string }> = {
  youtube: {
    bg: "#FF0000",
    rx: 6,
    inner: `<path d="M10 8.4 16.4 12 10 15.6z" fill="#fff"/>`,
  },
  instagram: {
    bg: "#E4405F",
    rx: 7,
    inner:
      `<rect x="5.2" y="5.2" width="13.6" height="13.6" rx="4.4" fill="none" stroke="#fff" stroke-width="1.7"/>` +
      `<circle cx="12" cy="12" r="3.3" fill="none" stroke="#fff" stroke-width="1.7"/>` +
      `<circle cx="16.1" cy="7.9" r="1.05" fill="#fff"/>`,
  },
  tiktok: {
    bg: "#010101",
    rx: 6,
    inner:
      `<g fill="none" stroke-linecap="round" stroke-width="2">` +
      `<path d="M12.6 5.6v8.2a2.7 2.7 0 1 1-2.3-2.67M12.6 5.6c.3 2 1.8 3.4 3.8 3.6" stroke="#69C9D0" transform="translate(-.55 -.55)"/>` +
      `<path d="M12.6 5.6v8.2a2.7 2.7 0 1 1-2.3-2.67M12.6 5.6c.3 2 1.8 3.4 3.8 3.6" stroke="#EE1D52" transform="translate(.55 .55)"/>` +
      `<path d="M12.6 5.6v8.2a2.7 2.7 0 1 1-2.3-2.67M12.6 5.6c.3 2 1.8 3.4 3.8 3.6" stroke="#fff"/>` +
      `</g>`,
  },
  twitter: {
    bg: "#000000",
    rx: 6,
    inner:
      `<path d="M6.6 6h3.4l3 4.2L16.8 6h1.9l-4.8 5.5L19 18h-3.4l-3.3-4.6L8.3 18H6.4l5-5.8z" fill="#fff"/>`,
  },
  twitch: {
    bg: "#9146FF",
    rx: 6,
    inner:
      `<path d="M7.2 5.2h11v8.6l-3.6 3.6h-2.6l-2.4 2.4v-2.4H6.4V7z" fill="#fff"/>` +
      `<rect x="11" y="8" width="1.7" height="4.2" fill="#9146FF"/>` +
      `<rect x="14.4" y="8" width="1.7" height="4.2" fill="#9146FF"/>`,
  },
  spotify: {
    bg: "#1DB954",
    rx: 12,
    inner:
      `<g fill="none" stroke="#fff" stroke-linecap="round">` +
      `<path d="M7.4 10c3.3-1 6.9-.8 9.7.7" stroke-width="1.9"/>` +
      `<path d="M8 12.9c2.8-.8 5.7-.6 8.2.6" stroke-width="1.6"/>` +
      `<path d="M8.6 15.5c2.3-.6 4.6-.5 6.6.5" stroke-width="1.3"/>` +
      `</g>`,
  },
  soundcloud: {
    bg: "#FF5500",
    rx: 6,
    inner:
      `<g fill="#fff">` +
      `<rect x="5.4" y="12.6" width="1.3" height="4.2" rx=".65"/>` +
      `<rect x="7.6" y="11.4" width="1.3" height="5.4" rx=".65"/>` +
      `<rect x="9.8" y="10.4" width="1.3" height="6.4" rx=".65"/>` +
      `<path d="M12 9.4c.5-.3 1.1-.5 1.8-.5 1.8 0 3.3 1.3 3.6 3 .1 0 .3-.1.4-.1 1.1 0 2 .9 2 2s-.9 3-2 3H12z"/>` +
      `</g>`,
  },
  linkedin: {
    bg: "#0A66C2",
    rx: 5,
    inner:
      `<g fill="#fff"><rect x="6.4" y="10" width="2.3" height="8"/><circle cx="7.5" cy="7.3" r="1.35"/>` +
      `<path d="M10.6 10h2.2v1.1c.5-.8 1.4-1.3 2.5-1.3 2 0 3.1 1.3 3.1 3.5V18h-2.3v-4.2c0-1.1-.5-1.8-1.5-1.8s-1.7.7-1.7 1.9V18h-2.3z"/></g>`,
  },
  facebook: {
    bg: "#1877F2",
    rx: 12,
    inner:
      `<path d="M13.3 18.6v-5.1h1.8l.35-2.2h-2.15V9.9c0-.65.25-1.1 1.1-1.1h1.1V6.85c-.45-.05-1.05-.1-1.7-.1-1.75 0-2.9 1.05-2.9 3v1.55H9v2.2h1.9v5.1z" fill="#fff"/>`,
  },
  pinterest: {
    bg: "#E60023",
    rx: 12,
    inner:
      `<path d="M12.2 6c-3.1 0-5 2.1-5 4.3 0 1.3.5 2.4 1.6 2.9.2.1.3 0 .35-.2l.15-.6c.05-.2 0-.3-.1-.45-.35-.45-.6-1-.6-1.75 0-1.7 1.3-3.2 3.4-3.2 1.8 0 2.8 1.1 2.8 2.6 0 2-.9 3.6-2.2 3.6-.7 0-1.25-.6-1.1-1.3.2-.9.6-1.85.6-2.5 0-.55-.3-1-.95-1-.75 0-1.35.75-1.35 1.8 0 .65.2 1.1.2 1.1l-.9 3.8c-.25 1.1-.05 2.5 0 2.6.05.1.15.1.2.05.1-.1 1.1-1.35 1.45-2.6l.55-2.2c.3.55.95 1 1.75 1 2.3 0 3.85-2.1 3.85-4.9C17 8 15 6 12.2 6z" fill="#fff"/>`,
  },
  reddit: {
    bg: "#FF4500",
    rx: 12,
    inner:
      `<g fill="#fff"><circle cx="12" cy="7" r=".95"/><rect x="11.7" y="7.4" width=".6" height="2.2"/>` +
      `<ellipse cx="12" cy="13.4" rx="5.6" ry="3.7" fill="none" stroke="#fff" stroke-width="1.2"/>` +
      `<circle cx="9.7" cy="12.9" r="1.05"/><circle cx="14.3" cy="12.9" r="1.05"/>` +
      `<path d="M9.6 15.3c1.6 1 3.2 1 4.8 0" fill="none" stroke="#fff" stroke-width="1.1" stroke-linecap="round"/>` +
      `<circle cx="6.2" cy="11.4" r="1"/><circle cx="17.8" cy="11.4" r="1"/></g>`,
  },
  snapchat: {
    bg: "#FFFC00",
    rx: 6,
    inner:
      `<path d="M12 5.6c2.2 0 3.6 1.6 3.6 3.9v1.5c.6.5 1.3.8 2 .95-.25.8-.95 1.3-1.9 1.6.5.95 1.35 1.6 2.5 1.9-.95.85-2.2 1.35-3.55 1.35-.75.6-1.65.9-2.65.9s-1.9-.3-2.65-.9c-1.35 0-2.6-.5-3.55-1.35 1.15-.3 2-1 2.5-1.9-.95-.3-1.65-.8-1.9-1.6.7-.15 1.4-.45 2-.95V9.5c0-2.3 1.4-3.9 3.6-3.9z" fill="#fff" stroke="#1a1a1a" stroke-width=".55"/>`,
  },
  discord: {
    bg: "#5865F2",
    rx: 7,
    inner:
      `<path d="M7.3 8.6c1.4-.75 3-1.15 4.7-1.15s3.3.4 4.7 1.15c.95 1.7 1.35 3.5 1.15 5.3-1.2.95-2.55 1.55-4 1.85l-.5-.95a7 7 0 0 1-2.7 0l-.5.95c-1.45-.3-2.8-.9-4-1.85-.2-1.8.2-3.6 1.15-5.3z" fill="#fff"/>` +
      `<circle cx="10" cy="12" r="1.05" fill="#5865F2"/><circle cx="14" cy="12" r="1.05" fill="#5865F2"/>`,
  },
  threads: {
    bg: "#000000",
    rx: 12,
    inner:
      `<path d="M12.2 18.5c-3.4 0-5.7-2.4-5.7-6.4S8.8 5.5 12.2 5.5c2.7 0 4.6 1.4 5.3 3.7l-1.7.5c-.5-1.6-1.7-2.5-3.6-2.5-2.4 0-4 1.9-4 4.9s1.6 4.8 4 4.8c2 0 3.2-1 3.4-2.5-.6-.35-1.5-.55-2.5-.55-.75 0-1.4.3-1.4.95 0 .5.45.85 1.15.85l-.3 1.5c-1.6-.05-2.7-1-2.7-2.4 0-1.6 1.4-2.55 3.2-2.55.9 0 1.8.15 2.55.45 0-.1-.05-.25-.05-.35l1.75-.3c.1.5.15 1.05.15 1.6 0 3-1.9 4.9-5.35 4.9z" fill="#fff"/>`,
  },
  bluesky: {
    bg: "#0b1a33",
    rx: 12,
    inner:
      `<path d="M12 11.2C10.9 8.9 8.8 6.7 6.7 6.1c-1-.3-1.8.2-1.8 1.35 0 1.9.95 4.6 2.3 5.7-.95.2-1.7.85-1.7 1.9 0 1.55 1.6 2.75 3.3 2.75 1.3 0 2.55-1.5 3.2-3.2.65 1.7 1.9 3.2 3.2 3.2 1.7 0 3.3-1.2 3.3-2.75 0-1.05-.75-1.7-1.7-1.9 1.35-1.1 2.3-3.8 2.3-5.7 0-1.15-.8-1.65-1.8-1.35-2.1.6-4.2 2.8-5.3 5.1z" fill="#0085FF"/>`,
  },
};

function tileFor(platform: string) {
  const key = (platform || "").toLowerCase();
  if (key === "x") return TILE.twitter;
  return TILE[key] ?? null;
}

function svgFor(platform: string, size: number): string | null {
  const tile = tileFor(platform);
  if (!tile) return null;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">` +
    `<rect width="24" height="24" rx="${tile.rx}" fill="${tile.bg}"/>${tile.inner}</svg>`
  );
}

/** Data URI of the brand mark, for canvas rasterization. Null = no mark. */
export function platformLogoDataUri(platform: string, size = 48): string | null {
  const svg = svgFor(platform, size);
  return svg ? `data:image/svg+xml;utf8,${encodeURIComponent(svg)}` : null;
}

/**
 * The platform's real logo as an inline SVG tile; falls back to a colored
 * initial tile for platforms without a drawn mark.
 */
export function PlatformLogo({
  platform,
  size = 20,
  className,
}: {
  platform: string;
  size?: number;
  className?: string;
}) {
  const tile = tileFor(platform);
  if (!tile) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-md bg-[var(--mesh-panel-solid,#1c2333)] font-bold text-white ${className ?? ""}`}
        style={{ width: size, height: size, fontSize: Math.max(9, size * 0.48) }}
        title={platform}
        aria-label={platform}
      >
        {(platform || "?").charAt(0).toUpperCase()}
      </span>
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      role="img"
      aria-label={platform}
      dangerouslySetInnerHTML={{
        __html: `<rect width="24" height="24" rx="${tile.rx}" fill="${tile.bg}"/>${tile.inner}`,
      }}
    />
  );
}
