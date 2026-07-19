// Deriving a client identifier for rate limiting from the raw leftmost
// `X-Forwarded-For` entry is unsafe: that value is fully client-controlled, so
// an attacker can rotate it to mint unlimited buckets. Instead we trust only the
// entries appended by our own proxies. `TRUSTED_PROXY_HOPS` is the number of
// trusted proxies in front of the app (default 1, e.g. a single edge proxy such
// as Vercel); the real client IP is that many entries in from the right.
export function getTrustedClientIp(headers: Headers): string {
  const hops = Math.max(1, Math.floor(Number(process.env.TRUSTED_PROXY_HOPS ?? "1")) || 1);

  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const parts = forwardedFor
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length > 0) {
      // Count in from the right: the last `hops` entries were written by our
      // trusted proxies and cannot be forged by the client.
      const index = Math.max(0, parts.length - hops);
      return parts[index] || "unknown";
    }
  }

  const realIp = headers.get("x-real-ip")?.trim();
  return realIp || "unknown";
}
