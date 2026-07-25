/**
 * Where this app lives, as one answer.
 *
 * Four modules resolved this independently — oauth.ts, stripe.ts, brand.ts and
 * video-embed.ts — each with a slightly different fallback chain. Three of them
 * degraded safely. The fourth fell back to `localhost` and produced a real bug
 * (see `embedParentHost` in video-embed.ts). That is what a second source of
 * truth costs: it is not that the duplicate is wrong on the day it is written,
 * it is that only one of them gets fixed.
 *
 * ── THE SERVER/CLIENT TRAP ──
 *
 * Only `NEXT_PUBLIC_*` variables are inlined into the browser bundle. Every
 * other `process.env` read — `VERCEL_URL`, `NEXTAUTH_URL`, `VERCEL_ENV` — is
 * `undefined` in the browser and populated on the server. So any resolver that
 * consults them returns a DIFFERENT answer on each side of a render.
 *
 * That is fine for server-only callers (OAuth redirect URIs, Stripe return
 * URLs, email links) and fatal for anything rendered on both sides. Hence two
 * functions here, deliberately not one:
 *
 *   - `resolveServerOrigin()` — richest chain, server-only. Never call from a
 *     component that also renders on the client.
 *   - `publicAppHost()` — only values guaranteed identical in both places.
 */

/** The canonical production origin. One definition. */
export const PRODUCTION_APP_URL = "https://www.meshs.me";
/** Not exported: derived from the origin above so the two can never disagree. */
const PRODUCTION_APP_HOST = new URL(PRODUCTION_APP_URL).hostname;

function normalizeBaseUrl(value: string): string {
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return withProtocol.replace(/\/+$/, "");
}

/**
 * The app's origin, for SERVER-SIDE use: OAuth callbacks, Stripe return URLs,
 * verification and reset links. Reads non-public env vars, so the answer is
 * only correct on the server.
 */
export function resolveServerOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.NEXTAUTH_URL?.trim();
  if (explicit) return normalizeBaseUrl(explicit);
  if (process.env.VERCEL_ENV === "production") return PRODUCTION_APP_URL;
  const vercel =
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || process.env.VERCEL_URL?.trim();
  if (vercel) return normalizeBaseUrl(vercel);
  return "http://localhost:3000";
}

/**
 * The app's HOST, for anything that renders on BOTH the server and the client
 * and must produce the same string in each — a Twitch `parent` parameter, a
 * canonical link in markup, anything a hydration diff would catch.
 *
 * Deliberately consults only two things, both inlined into the client bundle by
 * Next and therefore identical on both sides:
 *   1. NEXT_PUBLIC_APP_URL — the configured answer.
 *   2. NODE_ENV — to tell development from everything else.
 *
 * It does NOT fall back to `window.location.hostname`. That is the trap: on the
 * server there is no window, so the two renders disagree, which is exactly the
 * mismatch the caller was trying to avoid.
 */
export function publicAppHost(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) {
    try {
      return new URL(/^https?:\/\//i.test(configured) ? configured : `https://${configured}`).hostname;
    } catch {
      // Malformed config falls through to the constant rather than to window.
    }
  }
  if (process.env.NODE_ENV === "development") return "localhost";
  return PRODUCTION_APP_HOST;
}
