import type { NextConfig } from "next";

function isPublicHttpsAppUrl() {
  const raw = process.env.NEXT_PUBLIC_APP_URL;
  if (!raw) return process.env.VERCEL === "1";

  try {
    const url = new URL(raw);
    const hostname = url.hostname.toLowerCase();
    const isLocal =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1";

    return url.protocol === "https:" && !isLocal;
  } catch {
    return process.env.VERCEL === "1";
  }
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Retired experiment-era surfaces land somewhere real instead of 404ing.
  async redirects() {
    return [
      { source: "/marketplace", destination: "/meshpro", permanent: true },
      { source: "/content-hub", destination: "/connected-accounts", permanent: true },
      { source: "/spaces", destination: "/communities", permanent: true },
      { source: "/super-app", destination: "/connected-accounts", permanent: true },
      { source: "/vault", destination: "/profile", permanent: true },
      { source: "/innovation", destination: "/mesh", permanent: true },
      { source: "/meshi-voice", destination: "/mesh", permanent: true },
      { source: "/feedback", destination: "/support", permanent: true },
      { source: "/feature-requests", destination: "/support", permanent: true },
      { source: "/roadmap", destination: "/about", permanent: true },
      { source: "/vision", destination: "/about", permanent: true },
    ];
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns", "framer-motion"],
  },
  images: {
    // SSRF hardening: the Next image optimizer fetches its `url` param
    // server-side, so a wildcard `remotePatterns` turns /_next/image into an
    // open proxy and a blind-SSRF probe against internal hosts (it sits outside
    // the middleware matcher, so it's unauthenticated). User-supplied media
    // URLs (post media, community icons, profile sites) flow to <Image>, so we
    // must not let the server fetch arbitrary hosts. `unoptimized` renders
    // images directly in the browser (no server fetch), and with no
    // `remotePatterns` configured the optimizer endpoint rejects remote URLs.
    unoptimized: true,
  },
  async headers() {
    const isDev = process.env.NODE_ENV === "development";
    const useHttpsOnlyHeaders = !isDev && isPublicHttpsAppUrl();
    const csp = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://js.stripe.com`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://api.stripe.com https://checkout.stripe.com",
      "frame-src 'self' https://js.stripe.com https://checkout.stripe.com https://www.youtube-nocookie.com https://player.vimeo.com https://clips.twitch.tv https://player.twitch.tv https://www.tiktok.com https://www.instagram.com",
      "media-src 'self' blob: https:",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      useHttpsOnlyHeaders ? "upgrade-insecure-requests" : "",
    ].filter(Boolean).join("; ");

    const headers = [
      // In production the proxy owns the Content-Security-Policy end to end
      // (per-request nonce for pages, a locked-down policy for API routes);
      // emitting it here too would ship two competing policies. Development
      // doesn't run the nonce path, so the static policy applies there.
      ...(isDev ? [{ key: "Content-Security-Policy", value: csp }] : []),
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-XSS-Protection", value: "0" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "Permissions-Policy", value: "accelerometer=(), autoplay=(self \"https://www.youtube-nocookie.com\" \"https://player.vimeo.com\" \"https://clips.twitch.tv\" \"https://player.twitch.tv\"), browsing-topics=(), camera=(), clipboard-read=(), display-capture=(), encrypted-media=(self \"https://www.youtube-nocookie.com\" \"https://player.vimeo.com\"), geolocation=(), gyroscope=(), hid=(), interest-cohort=(), magnetometer=(), microphone=(), midi=(), payment=(), publickey-credentials-get=(self), screen-wake-lock=(), serial=(), sync-xhr=(), usb=(), xr-spatial-tracking=()" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
      { key: "Origin-Agent-Cluster", value: "?1" },
      { key: "X-DNS-Prefetch-Control", value: "off" },
      { key: "X-Download-Options", value: "noopen" },
      { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
    ];

    if (useHttpsOnlyHeaders) {
      headers.splice(1, 0, { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" });
    }

    return [
      {
        source: "/(.*)",
        headers,
      },
    ];
  },
};

export default nextConfig;
