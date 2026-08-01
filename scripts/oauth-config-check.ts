/**
 * AN OAUTH CONFIG THAT IS WRONG FAILS AFTER THE USER HAS ALREADY SAID YES.
 *
 * Every defect this gate covers has the same shape and the same cost: the
 * connect flow looks perfect, the person authorizes their real account at the
 * provider, and only THEN does the exchange or the profile parse fail. They
 * granted access and got an error for it. None of it is visible until a real
 * provider is on the other end, which is why these survived so long:
 *
 *   - Pinterest sent its client credentials in the POST body. The v5 token
 *     endpoint accepts them only as an HTTP Basic header, so every Pinterest
 *     connect died at invalid_client.
 *   - TikTok declared no idField, so the callback looked for "id" on a user
 *     object that only carries open_id — platformId was always null, and with
 *     one account already stored, a SECOND TikTok connect overwrote the first
 *     account's tokens under the first account's name.
 *   - TikTok also asked its profile endpoint for `username`, a field gated
 *     behind a scope the app never requested, so the whole call returned
 *     scope_permission_missed and nothing at all was stored.
 *   - LinkedIn declared no idField either, and /v2/userinfo is OpenID Connect:
 *     the subject is "sub", never "id".
 *
 * So: assert the config against itself. A field the callback will read must be
 * a field the request actually asks for.
 *
 * ── WHAT THIS CANNOT PROVE ───────────────────────────────────────────────────
 *
 * That a provider accepts our request. It reads our own declarations, not the
 * network — it cannot know that a provider changed its auth method last week.
 * It catches the class where the config contradicts ITSELF, which is where
 * these four came from.
 */

import { OAUTH_CONFIGS, type OAuthConfig } from "../src/lib/oauth";
import { MESH_PLATFORM_IDS } from "../src/lib/platforms";

const failures: string[] = [];
const fail = (section: string, detail: string) => failures.push(`[${section}] ${detail}`);
let checks = 0;
const ok = () => { checks += 1; };

const entries = Object.entries(OAUTH_CONFIGS) as [string, OAuthConfig][];

// ── 1. The roster and the configs agree ─────────────────────────────────────
{
  for (const [id, config] of entries) {
    if (config.platform !== id) {
      fail("1 roster", `OAUTH_CONFIGS["${id}"].platform is "${config.platform}" — the key and the value must match, because both are used as the storage id`);
    } else ok();
    if (!MESH_PLATFORM_IDS.includes(id)) {
      fail("1 roster", `"${id}" has an OAuth config but is not on the allow-list in lib/platforms.ts, so it can never be offered`);
    } else ok();
  }
}

// ── 2. A field we will READ must be a field we ASK for ──────────────────────
//
// Only checked when the profile URL actually enumerates fields (a `fields=` or
// `$select=` query). An endpoint that returns a fixed document — LinkedIn's
// userinfo, Reddit's /api/v1/me — declares nothing to cross-check, so the rule
// stays silent rather than inventing a failure.
{
  for (const [id, config] of entries) {
    let requested: string[] | null = null;
    try {
      const url = new URL(config.profileUrl);
      const raw = url.searchParams.get("fields") ?? url.searchParams.get("$select");
      if (raw) requested = raw.split(",").map((f) => f.trim()).filter(Boolean);
    } catch {
      fail("2 fields", `${id}: profileUrl is not a valid URL`);
      continue;
    }
    if (!requested) { ok(); continue; }

    // The reader walks dotted paths; only the first segment can be a requested
    // top-level field.
    const head = (path: string) => path.split(".")[0];

    const idField = config.idField ?? "id";
    if (!requested.includes(head(idField))) {
      fail(
        "2 fields",
        `${id}: idField is "${idField}" but the profile request only asks for [${requested.join(", ")}]. ` +
          `The callback reads \`config.idField || "id"\`, so this resolves to nothing and platformId stays null — ` +
          `which is also how a second account silently overwrites the first.`,
      );
    } else ok();

    if (!requested.includes(head(config.usernameField))) {
      fail(
        "2 fields",
        `${id}: usernameField is "${config.usernameField}" but the profile request only asks for [${requested.join(", ")}]`,
      );
    } else ok();
  }
}

// ── 3. Providers that only accept HTTP Basic must say so ────────────────────
//
// Named individually because there is no way to derive this from a URL — it is
// a fact about each provider's token endpoint, and getting it wrong is silent
// until a real secret is exchanged.
{
  const BASIC_ONLY = new Set(["pinterest", "reddit", "snapchat", "twitter"]);
  for (const [id, config] of entries) {
    if (!BASIC_ONLY.has(id)) { ok(); continue; }
    // Reddit is additionally hard-coded in buildTokenRequest, so either signal
    // counts for it.
    const declared = config.tokenAuthMethod === "client_secret_basic" || id === "reddit";
    if (!declared) {
      fail(
        "3 token auth",
        `${id}: token endpoint requires HTTP Basic credentials, but tokenAuthMethod is ` +
          `${config.tokenAuthMethod ? `"${config.tokenAuthMethod}"` : "unset"}, so buildTokenRequest will put the ` +
          `client id and secret in the POST body and the provider will answer invalid_client — after the user has consented.`,
      );
    } else ok();
  }
}

// ── 4. OpenID Connect userinfo identifies with "sub", never "id" ────────────
//
// Section 2's cross-check goes quiet for endpoints that enumerate no fields,
// and LinkedIn's /v2/userinfo is exactly that — which is how its missing
// idField survived. But the answer is not guesswork: OIDC (Core 1.0 §5.3)
// specifies that userinfo returns the subject identifier as `sub`, so any
// config pointed at a userinfo endpoint has a knowable correct value.
{
  for (const [id, config] of entries) {
    if (!/\/userinfo(\?|$)/.test(config.profileUrl)) { ok(); continue; }
    if (config.idField !== "sub") {
      fail(
        "4 oidc",
        `${id}: profileUrl is an OpenID Connect userinfo endpoint, which returns the subject as "sub", but idField is ` +
          `${config.idField ? `"${config.idField}"` : 'unset (so the callback falls back to "id")'} — a key the response never contains, ` +
          `leaving platformId null on every connect.`,
      );
    } else ok();
  }
}

// ── 5. Every config is complete enough to attempt a connection ──────────────
{
  for (const [id, config] of entries) {
    for (const field of ["authUrl", "tokenUrl", "profileUrl"] as const) {
      const value = config[field];
      if (!value || !/^https:\/\//.test(value)) {
        fail("4 shape", `${id}: ${field} must be an https URL (got ${JSON.stringify(value)})`);
      } else ok();
    }
    if (!config.clientIdEnv || !config.clientSecretEnv) {
      fail("4 shape", `${id}: both clientIdEnv and clientSecretEnv must be named, or One Account cannot tell anyone what to configure`);
    } else ok();
    if (config.scopes.length === 0) ok();
    else if (config.scopes.some((s) => !s.trim())) {
      fail("4 shape", `${id}: has an empty scope entry`);
    } else ok();
  }
}

if (failures.length) {
  console.error(`\noauth-config: ${failures.length} failure(s) across ${checks + failures.length} assertions\n`);
  for (const f of failures) console.error("  " + f);
  console.error("");
  process.exit(1);
}
console.log(
  `oauth-config OK — ${checks} assertions across ${entries.length} providers. Each config agrees with itself:\n` +
    "  the key matches the stored platform id and the allow-list, every field the callback will READ is a field the\n" +
    "  profile request actually ASKS for (the bug that left TikTok and LinkedIn with a null platformId, and let a\n" +
    "  second TikTok account overwrite the first), the providers whose token endpoints take only HTTP Basic say so\n" +
    "  (the bug that killed every Pinterest connect at invalid_client), and every endpoint is a complete https URL.\n" +
    "  Does NOT cover: whether a provider ACCEPTS the request — this reads our declarations, not the network.",
);
