/**
 * LINKS IN BIO — and the only place their safety is decided.
 *
 * `UserLink { label, url }` has been in the schema with a `User` relation since
 * the beginning and had ZERO references anywhere in src/. This is the code that
 * finishes it.
 *
 * A user-supplied URL rendered as an anchor is one of the few genuinely
 * dangerous things a social profile does, so validation lives here, once, and
 * both the write path (the action) and the read path (rendering) go through it.
 * The rule that matters:
 *
 *   ONLY http: AND https: EVER.
 *
 * `javascript:alert(1)` in an href executes on click with the page's origin and
 * the viewer's session. `data:text/html,...` opens attacker-authored markup that
 * some browsers still treat as same-origin-ish. `vbscript:`, `file:`, and any
 * scheme a future browser invents are refused by the same allowlist, because it
 * is an allowlist and not a blocklist — a blocklist is a list of the attacks
 * somebody had already thought of.
 *
 * Normalising through the WHATWG `URL` parser rather than a regex is deliberate:
 * the parser is what the browser will use, so agreeing with it is the point.
 * `\/\/evil.com`, `java\nscript:`, tab-and-newline smuggling and percent-encoded
 * scheme tricks all collapse to something `URL` either rejects or resolves to a
 * scheme this function then refuses.
 */

/** The only two schemes a profile link may use. */
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

/** Bounded so a link cannot become a payload or wreck the layout. */
export const MAX_LINKS = 5;
export const MAX_LABEL_LENGTH = 30;
/** Not exported: nothing outside this module needs it, and an export
 *  nobody imports is just a second name to keep in sync. */
const MAX_URL_LENGTH = 2048;

export interface ProfileLink {
  label: string;
  url: string;
}

/**
 * Parse and normalise one link, or explain why it cannot be used.
 *
 * A bare `example.com` is accepted and becomes `https://example.com` — people
 * type links without a scheme constantly, and refusing that is a papercut, not
 * a security control. The scheme check still runs on the result, so a string
 * like `javascript:x` is NOT quietly turned into `https://javascript:x`: it
 * parses as a URL with a `javascript:` protocol and is refused.
 */
export function normalizeProfileLink(input: ProfileLink): { link: ProfileLink } | { error: string } {
  const label = input.label.trim().replace(/\s+/g, " ");
  const raw = input.url.trim();

  if (!label) return { error: "Every link needs a label." };
  if (label.length > MAX_LABEL_LENGTH) return { error: `Labels are ${MAX_LABEL_LENGTH} characters or fewer.` };
  if (!raw) return { error: "Every link needs a URL." };
  if (raw.length > MAX_URL_LENGTH) return { error: "That URL is too long." };
  // Control characters are how scheme filters get smuggled past ("java\nscript:").
  // The URL parser strips some of them, so refuse before it can.
  if (/[\u0000-\u001f\u007f]/.test(raw)) return { error: "That URL contains characters that aren't allowed." };

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    // No scheme at all — the common case for a typed link. Try https, and let
    // the protocol check below judge the result rather than assuming.
    try {
      parsed = new URL(`https://${raw}`);
    } catch {
      return { error: "That doesn't look like a web address." };
    }
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    return { error: "Links must start with http:// or https://" };
  }
  if (!parsed.hostname || !parsed.hostname.includes(".")) {
    return { error: "That doesn't look like a web address." };
  }
  // Credentials in a URL are a phishing shape ("https://paypal.com@evil.tld"),
  // and no legitimate profile link needs them.
  if (parsed.username || parsed.password) {
    return { error: "Links can't contain a username or password." };
  }

  return { link: { label, url: parsed.toString() } };
}

/**
 * Validate a whole set for saving. Returns the normalised list or the first
 * problem, so the editor can show one clear message instead of a pile.
 */
export function normalizeProfileLinks(input: ProfileLink[]): { links: ProfileLink[] } | { error: string } {
  const kept = input.filter((l) => l.label.trim() || l.url.trim());
  if (kept.length > MAX_LINKS) return { error: `You can add up to ${MAX_LINKS} links.` };

  const links: ProfileLink[] = [];
  const seen = new Set<string>();
  for (const candidate of kept) {
    const result = normalizeProfileLink(candidate);
    if ("error" in result) return result;
    // Same destination twice is a mistake, not a feature.
    if (seen.has(result.link.url)) return { error: "Two links point at the same address." };
    seen.add(result.link.url);
    links.push(result.link);
  }
  return { links };
}

/**
 * The href to actually render. Stored rows went through the checks above, but
 * this is the last gate before a value reaches an `href`, and a row could
 * predate a rule or arrive from a future import path. Returns null when the
 * link must not be rendered as a link at all.
 */
export function safeLinkHref(url: string): string | null {
  const result = normalizeProfileLink({ label: "x", url });
  return "error" in result ? null : result.link.url;
}

/** Host without `www.`, for showing where a link actually goes. */
export function linkDisplayHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
