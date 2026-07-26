/**
 * PROFILE LINKS — the scheme allowlist, and the gate it sits behind.
 *
 * A user-supplied URL rendered into an `href` is one of the few genuinely
 * dangerous things a social profile does. `javascript:` in an href runs on click
 * with the page's origin and the viewer's session; `data:text/html` opens
 * attacker-authored markup. This asserts the two properties that keep that shut:
 *
 *   1. lib/profile-links.ts allows http: and https: and NOTHING else, decided by
 *      an allowlist rather than a blocklist, and every hostile shape is refused
 *      by running the real function on real inputs.
 *   2. Every anchor built from a user link carries rel="noopener noreferrer
 *      nofollow", and the read path re-validates rather than trusting the row.
 *
 * Behavioural, not textual: an earlier gate in this repo checked a function by
 * regex over its own source, which verified the SPELLING and passed any refactor
 * that kept the words. These run the code.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeProfileLink, normalizeProfileLinks, safeLinkHref, MAX_LINKS } from "../src/lib/profile-links";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const strip = (s: string) =>
  s.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const failures: string[] = [];
const fail = (section: string, detail: string) => failures.push(`[${section}] ${detail}`);
let checks = 0;
const ok = () => { checks += 1; };

// ── 1. Hostile schemes are refused, by the real function ─────────────────────
const HOSTILE = [
  "javascript:alert(1)",
  "JavaScript:alert(1)",
  "  javascript:alert(1)",
  "java\tscript:alert(1)",
  "java\nscript:alert(1)",
  "data:text/html,<script>alert(1)</script>",
  "data:text/html;base64,PHNjcmlwdD4=",
  "vbscript:msgbox(1)",
  "file:///etc/passwd",
  "about:blank",
  "blob:https://x.com/abc",
  "filesystem:https://x.com/temporary/",
  "chrome://settings",
  "intent://scan/#Intent;scheme=x;end",
  "ws://evil.tld",
  "mailto:a@b.c",
  "tel:+15551234",
  // Phishing shapes: the visible host is not the real host.
  "https://user:pass@evil.tld",
  "https://paypal.com@evil.tld",
  // THE ONES ONLY THE ALLOWLIST CAN STOP. Every payload above also fails the
  // "must have a dotted hostname" check, so an earlier version of this gate
  // passed even with `javascript:` ADDED to ALLOWED_PROTOCOLS — the mutation
  // test caught that. These carry a real hostname, so the protocol allowlist is
  // the only thing standing between them and an href.
  "javascript://evil.com/%0aalert(1)",
  "jAvAsCrIpT://evil.com/%0aalert(1)",
  "javascript://comment%0aalert(1)",
  "data://evil.com/x",
  "vbscript://evil.com/x",
];
for (const url of HOSTILE) {
  const parsed = normalizeProfileLink({ label: "x", url });
  if (!("error" in parsed)) {
    fail("1 schemes", `normalizeProfileLink ACCEPTED ${JSON.stringify(url)} -> ${JSON.stringify(parsed.link)}`);
  } else ok();
  if (safeLinkHref(url) !== null) {
    fail("1 schemes", `safeLinkHref returned an href for ${JSON.stringify(url)} — that value would reach a live anchor`);
  } else ok();
}

// A gate that only ever refuses proves nothing; real links must still work.
const LEGITIMATE: [string, string][] = [
  ["Portfolio", "https://example.com"],
  ["Bare host", "example.com"],
  ["Deep link", "https://example.com/a/b?c=d#e"],
  ["Plain http", "http://example.com"],
  ["Unicode host", "https://例え.jp"],
];
for (const [label, url] of LEGITIMATE) {
  const parsed = normalizeProfileLink({ label, url });
  if ("error" in parsed) fail("1 schemes", `refused a legitimate link ${JSON.stringify(url)}: ${parsed.error}`);
  else ok();
}

// ── 2. The set is bounded and de-duplicated ──────────────────────────────────
{
  // The VALUE, not just "a cap exists". Building MAX_LINKS + 1 rows scales with
  // the constant, so raising the cap to 5000 kept that assertion passing — the
  // mutation test caught it. A profile link row is unbounded user text rendered
  // into the page, so the ceiling is the control.
  if (MAX_LINKS > 10) fail("2 bounds", `MAX_LINKS is ${MAX_LINKS}; a links-in-bio row is user content and must stay small`);
  else ok();

  const tooMany = Array.from({ length: MAX_LINKS + 1 }, (_, i) => ({ label: `L${i}`, url: `https://e${i}.com` }));
  if (!("error" in normalizeProfileLinks(tooMany))) fail("2 bounds", `more than ${MAX_LINKS} links was accepted`);
  else ok();

  const dupes = [{ label: "A", url: "https://example.com" }, { label: "B", url: "example.com" }];
  if (!("error" in normalizeProfileLinks(dupes))) fail("2 bounds", "two links to the same destination were accepted");
  else ok();
}

// ── 3. Every anchor built from a user link is safe ───────────────────────────
{
  const view = strip(read("src/app/(app)/profile/profile-view.tsx"));
  // Both surfaces that render a user link: the header row and the Links tab.
  const anchors = [...view.matchAll(/<a\b[\s\S]*?>/g)].map((m) => m[0]);
  const linkAnchors = anchors.filter((a) => /href=\{(?:safeHref\()?link\.url\)?\}/.test(a));
  if (linkAnchors.length < 2) {
    fail("3 anchors", `found ${linkAnchors.length} anchors built from link.url; expected the header row and the Links tab`);
  } else ok();
  for (const a of linkAnchors) {
    if (!/rel="[^"]*\bnofollow\b/.test(a)) fail("3 anchors", "a user-link anchor is missing rel=nofollow");
    else ok();
    if (!/rel="[^"]*\bnoopener\b/.test(a) || !/rel="[^"]*\bnoreferrer\b/.test(a)) {
      fail("3 anchors", "a user-link anchor opening in a new tab is missing noopener/noreferrer");
    } else ok();
  }

  // The read path must re-validate, not trust the stored row.
  const queries = strip(read("src/lib/queries.ts"));
  if (!/safeLinkHref\(/.test(queries)) {
    fail("3 anchors", "queries.ts no longer re-validates link URLs on the way out");
  } else ok();

  // And the write path must go through the one validator.
  const actions = strip(read("src/lib/actions.ts"));
  if (!/normalizeProfileLinks\(/.test(actions)) {
    fail("3 anchors", "saveProfileLinks no longer runs rows through normalizeProfileLinks");
  } else ok();
  // Authorization: the row is keyed on the session user, never on a client id.
  if (!/userLink\.deleteMany\(\{\s*where:\s*\{\s*userId:\s*user\.id\s*\}/.test(actions)) {
    fail("3 anchors", "saveProfileLinks does not scope its delete to the session user's own rows");
  } else ok();
}

if (failures.length) {
  console.error(`\nprofile-links: ${failures.length} failure(s) across ${checks + failures.length} assertions\n`);
  for (const f of failures) console.error("  " + f);
  console.error("");
  process.exit(1);
}
console.log(`profile-links: ${checks} assertions passed — http(s) only, bounded, and every anchor is rel-safe.`);
