// NOBODY MAY BE SENT TO A CONSENT SCREEN THIS DEPLOYMENT CANNOT HONOUR.
//
// An OAuth redirect is not a page navigation. The person signs in at the
// provider and GRANTS A REAL THIRD-PARTY AUTHORIZATION — one that stays live on
// their account afterwards whether or not mesh.me kept anything. So a failure
// discovered after the redirect is not an error message; it is a grant they now
// have to hunt down and revoke, and every retry leaves another one behind.
//
// This has happened twice, for two different preconditions:
//
//   1. THE CLIENT SECRET. The start route tested only the client id. A
//      deployment with the id set and the secret missing walked the user all
//      the way to consent, had them approve, and failed in the callback where
//      the secret is finally needed. Fixed by checking getOAuthMissingEnv.
//
//   2. THE ENCRYPTION KEY. Reported from production on every platform: the
//      token exchange SUCCEEDS, and then the callback refuses to store the
//      token because there is no key to encrypt it with —
//      "Nothing was saved." Fixed by checking hasSecretEncryptionKey.
//
// Both were found by a person losing something, not by a test. The pattern is
// the same each time — a precondition that is knowable with zero I/O before the
// redirect, checked after it — so this gate asserts the shape rather than the
// two instances, and the START route is where it has to hold.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");

// COMMENTS ARE NOT CODE, AND THIS GATE LEARNED THAT THE HARD WAY.
//
// The first version matched `hasSecretEncryptionKey()` against the raw file. It
// passed a mutation that deleted the check entirely — because the explanatory
// comment two lines above the branch says "hasSecretEncryptionKey() is a pure
// shape check…", and the regex found THAT. The gate was reading its own prose
// and reporting the guarantee intact.
//
// Every match below is against comment-stripped source. Blanking rather than
// deleting keeps byte offsets stable, which section 2 relies on to prove the
// checks come BEFORE the redirect.
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => " ".repeat(m.length))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, lead) => lead + " ".repeat(m.length - lead.length));
}

const read = (p: string) => stripComments(readFileSync(join(ROOT, p), "utf8"));

const START = "src/app/api/auth/[platform]/route.ts";
const CALLBACK = "src/app/api/auth/[platform]/callback/route.ts";
let checks = 0;

const start = read(START);

// ── 1. Both known preconditions are tested in the START route ───────────────
{
  assert.match(
    start,
    /getOAuthMissingEnv\(config\)/,
    `${START} no longer checks getOAuthMissingEnv before redirecting.\n` +
      "  A deployment missing the client SECRET would send someone to consent and fail in the\n" +
      "  callback, after they had already approved.",
  );
  checks += 1;

  assert.match(
    start,
    /hasSecretEncryptionKey\(\)/,
    `${START} no longer checks hasSecretEncryptionKey before redirecting.\n` +
      "  Without an encryption key the token exchange succeeds and the CALLBACK then refuses to\n" +
      "  store the token — so the person granted mesh.me real access to their account, got\n" +
      '  "Nothing was saved", and now has a live authorization to revoke by hand.\n' +
      "  This was reported from production on every platform.",
  );
  checks += 1;
}

// ── 2. …and tested BEFORE the redirect, not after ───────────────────────────
//
// Position matters and is the whole point. A check that runs after the
// provider redirect is built is a check that runs too late.
{
  const authRedirect = start.search(/NextResponse\.redirect\(\s*authUrl\s*\)/);
  assert.ok(authRedirect > 0, `${START}: could not find the redirect to the provider (authUrl).`);

  for (const [name, needle] of [
    ["getOAuthMissingEnv", "getOAuthMissingEnv(config)"],
    ["hasSecretEncryptionKey", "hasSecretEncryptionKey()"],
  ] as const) {
    const at = start.indexOf(needle);
    assert.ok(
      at >= 0 && at < authRedirect,
      `${START}: ${name} is checked at index ${at}, at or after the provider redirect at ` +
        `${authRedirect}.\n  Every precondition must be resolved BEFORE anyone is sent to a consent screen.`,
    );
    checks += 1;
  }
}

// ── 3. The callback keeps its own check — belt AND braces ───────────────────
//
// The start route is a courtesy to the user; the callback is the thing that
// must not write a plaintext token. Removing either is a regression, and the
// two failures are different: the first wastes a grant, the second leaks.
{
  const callback = read(CALLBACK);
  assert.match(
    callback,
    /hasSecretEncryptionKey\(\)/,
    `${CALLBACK} no longer checks hasSecretEncryptionKey.\n` +
      "  The start-route check is a courtesy — this one is what stops an OAuth token being\n" +
      "  persisted in cleartext. It must fail closed here regardless of what the UI did.",
  );
  checks += 1;

  assert.match(
    callback,
    /APP_DATA_ENCRYPTION_KEY/,
    `${CALLBACK} stopped naming APP_DATA_ENCRYPTION_KEY.\n` +
      '  It used to say "Please contact support", which names nothing and leaves an operator with\n' +
      "  no next step. The variable name IS the fix instruction.",
  );
  checks += 1;
}

// ── 4. The page agrees with the route ───────────────────────────────────────
//
// Two places deciding whether a platform is connectable is how a button that
// cannot work goes on being offered. The page must read the same predicate.
{
  const page = read("src/app/(app)/connected-accounts/page.tsx");
  assert.match(
    page,
    /hasSecretEncryptionKey\(\)/,
    "the connect page does not read hasSecretEncryptionKey.\n" +
      "  Then it renders twelve live connect buttons on a deployment where none of them can\n" +
      "  complete, and the only way to find out is to spend a real authorization.",
  );
  checks += 1;
}

console.log(
  `oauth-precondition OK — ${checks} assertions: the start route resolves BOTH known preconditions\n` +
    "  (provider credentials, and the server encryption key) before anyone reaches a consent\n" +
    "  screen; the callback still fails closed on its own; and the connect page reads the same\n" +
    "  predicate, so it cannot offer a button the route will refuse.\n" +
    "  Does NOT cover: a third precondition nobody has discovered yet. Both of these were found\n" +
    "  by a person losing an authorization, not by a test.",
);
