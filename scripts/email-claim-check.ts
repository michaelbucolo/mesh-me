/**
 * EMAIL CLAIM GATE — `npm run email-claim:check`
 *
 * `UserEmail.email` is globally unique, and exactly one path can write into
 * that namespace WITHOUT anyone proving anything: "add another email" in
 * Settings takes any string containing "@", writes `isVerified: false`, and
 * sends no token. Every reader treated that row as an authoritative claim, so
 * one request permanently locked the real owner out of BOTH doors:
 *
 *   - signUp answered "Email already in use", forever.
 *   - signInWithIdentity did not consult UserEmail at all, fell through to a
 *     nested create, collided, and threw — and the callback rendered the raw
 *     database error on the victim's login page.
 *
 * THE RULE, in one sentence: an unverified, non-primary UserEmail row is a
 * PENDING claim and must never outrank someone establishing a stronger one.
 *
 * ── WHAT THIS CANNOT PROVE ───────────────────────────────────────────────────
 * Source text. It pins that every writer into the namespace goes through the
 * shared resolver and that the callback stops forwarding arbitrary error text;
 * it does not prove the resolver's SQL behaves — that is verified separately
 * against a live database.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const CLAIM_MODULE = "src/lib/email-claim.ts";
const claim = read(CLAIM_MODULE);

// ── 1. One resolver, and it distinguishes proven from pending ────────────────
assert.match(
  claim,
  /export async function claimEmailAddress\b/,
  `${CLAIM_MODULE} must export claimEmailAddress — the clearing form, for paths where` +
    " somebody IS proving ownership (signup, federated sign-in).",
);
assert.match(
  claim,
  /export async function emailClaimHeldBy\b/,
  `${CLAIM_MODULE} must export emailClaimHeldBy — the read-only form, for paths where` +
    " nobody is proving anything and displacing a pending row would just make the" +
    " squatting mutual.",
);
// Both halves of "a real claim" have to be honoured, or the fix becomes a hole:
// clearing a VERIFIED row would hand away a proven address, and clearing a
// PRIMARY one would break the account that signs in with it.
for (const [flag, why] of [
  ["isVerified", "somebody clicked a link sent to that mailbox"],
  ["isPrimary", "it is the address an account signs in with"],
] as const) {
  assert.match(
    claim,
    new RegExp(String.raw`if \(existing\.${flag}\) return \{ held: true`),
    `claimEmailAddress must treat \`${flag}\` as a real claim and refuse — ${why}.\n` +
      "  Clearing it would turn a lockout fix into an account-takeover primitive.",
  );
}
assert.match(
  claim,
  /^import "server-only";/m,
  `${CLAIM_MODULE} must be server-only — a client-side ownership check is not a check.`,
);

// ── 2. Every writer into the namespace goes through it ───────────────────────
//
// Pinned per file with the form each must use, because the two forms are NOT
// interchangeable: using the read-only one in signup restores the lockout, and
// using the clearing one in the add-email route lets anyone knock a pending
// address off someone else's account.
const NAMESPACE_WRITERS: Record<string, { fn: string; why: string }> = {
  "src/lib/actions.ts": {
    fn: "claimEmailAddress",
    why: "signUp — the person is establishing an account with this as their primary",
  },
  "src/lib/identity-auth.ts": {
    fn: "claimEmailAddress",
    why: "signInWithIdentity — Google/Apple has asserted the address, the strongest claim available",
  },
  "src/app/api/account/emails/route.ts": {
    fn: "emailClaimHeldBy",
    why: "add-another-email — writes isVerified:false with no token, so it proves nothing either",
  },
  "src/lib/account-merge.ts": {
    fn: "claimEmailAddress",
    why: "merge alias — approval from BOTH accounts' logins, so a third party's pending row must not cost the person their address",
  },
};

const sourceFiles = execFileSync("git", ["ls-files", "src"], { cwd: ROOT, encoding: "utf8" })
  .split("\n")
  .filter((f) => f && existsSync(join(ROOT, f)))
  .filter((f) => (f.endsWith(".ts") || f.endsWith(".tsx")) && !f.startsWith("src/generated/"));

// Any file that creates a UserEmail row writes into the globally unique
// namespace and therefore needs the rule. `verifyEmailToken` is the one
// exception and is asserted separately below.
const writers = sourceFiles.filter((f) => /userEmail\.create\(|emails:\s*\{\s*create:/.test(read(f)));
assert.deepEqual(
  writers.sort(),
  Object.keys(NAMESPACE_WRITERS).sort(),
  "A file writes into the globally unique UserEmail namespace without this gate knowing:\n" +
    writers.map((f) => `    ${f}`).join("\n") +
    `\n  Add it to NAMESPACE_WRITERS in scripts/email-claim-check.ts with which form of the\n` +
    "  claim rule it uses. An unverified row must never lock the real owner out of the product,\n" +
    "  and that only holds if every writer agrees on what an unverified row means.",
);
for (const [file, { fn, why }] of Object.entries(NAMESPACE_WRITERS)) {
  const body = read(file);
  assert.match(
    body,
    new RegExp(String.raw`\b${fn}\(`),
    `${file} must resolve the address through ${fn}() (${why}).`,
  );
  // The two forms are not interchangeable — see above.
  const other = fn === "claimEmailAddress" ? "emailClaimHeldBy" : "claimEmailAddress";
  assert.ok(
    !new RegExp(String.raw`\b${other}\(`).test(body),
    `${file} uses ${other}() where ${fn}() is required (${why}).\n` +
      "  The forms are not interchangeable: the read-only one in signup restores the lockout,\n" +
      "  and the clearing one in the add-email route lets anyone knock a pending address off\n" +
      "  somebody else's account.",
  );
}
// The bare pre-check that USED to stand in for the rule must be gone from the
// two account-creation paths, or the old blanket refusal silently runs first.
//
// Scoped to those function bodies, NOT the whole file: sign-in legitimately
// looks an address up in UserEmail to resolve an identifier to a user, and one
// of those reads already handles `!isVerified` correctly. Forbidding the lookup
// outright would be forbidding the wrong thing — the defect was never the read,
// it was treating every row the read returned as proof of ownership.
function bodyOf(source: string, declaration: string): string {
  const start = source.indexOf(declaration);
  assert.notEqual(start, -1, `${declaration} not found`);
  // Stop at the next top-level declaration of ANY kind. Slicing only to the
  // next `export` swallowed the module-private helper that follows signUp, so
  // the sign-in lookup 200 lines away read as if it were inside signUp.
  const next = /\n(?:export\s+)?(?:async\s+)?function\s/.exec(source.slice(start + 1));
  return next ? source.slice(start, start + 1 + next.index) : source.slice(start);
}
const CREATION_PATHS: Array<[string, string]> = [
  ["src/lib/actions.ts", "export async function signUp("],
  ["src/lib/identity-auth.ts", "export async function signInWithIdentity("],
];
for (const [file, declaration] of CREATION_PATHS) {
  const body = bodyOf(read(file), declaration);
  assert.ok(
    !/userEmail\.findUnique\(/.test(body),
    `${declaration.trim()} in ${file} still short-circuits on a bare UserEmail lookup.\n` +
      "  That check cannot tell a proven claim from a pending one — which is the entire defect —\n" +
      "  so it has to go through claimEmailAddress() instead.",
  );
  assert.match(
    body,
    /claimEmailAddress\(/,
    `${declaration.trim()} in ${file} must call claimEmailAddress() before creating the account.`,
  );
}

// ── 3. The login page stops rendering arbitrary error text ───────────────────
//
// `failure(message)` puts the string in `?error=` and /login renders it.
// Forwarding `error.message` unconditionally shipped raw DriverAdapterError
// internals to a visitor who could do nothing about them.
const callback = read("src/app/api/auth/identity/[provider]/callback/route.ts");
assert.ok(
  !/failure\(\s*error instanceof Error \? error\.message/.test(callback),
  "the identity callback must not forward arbitrary `error.message` to the login page.\n" +
    "  That string is rendered to the visitor, and on production's remote libSQL a UserEmail\n" +
    "  collision arrives as a raw driver error with no P2002 code.",
);
assert.match(
  callback,
  /IDENTITY_USER_FACING_ERRORS\.has\(/,
  "the identity callback must show only the refusals identity-auth authored for a human,\n" +
    "  via IDENTITY_USER_FACING_ERRORS. Everything else is logged and reported generically.",
);
const identity = read("src/lib/identity-auth.ts");
assert.match(
  identity,
  /export const IDENTITY_USER_FACING_ERRORS: ReadonlySet<string>/,
  "src/lib/identity-auth.ts must export IDENTITY_USER_FACING_ERRORS — the set of messages it\n" +
    "  wrote deliberately, as opposed to whatever the database raised.",
);
// Every member must be a named constant that is actually thrown, so the set
// cannot drift into listing a message no code produces (or vice versa).
const setBlock = /IDENTITY_USER_FACING_ERRORS: ReadonlySet<string> = new Set\(\[([\s\S]*?)\]\)/.exec(identity)?.[1];
assert.ok(setBlock, "IDENTITY_USER_FACING_ERRORS initializer not found");
const members = [...setBlock.matchAll(/^\s*([A-Z_]+),/gm)].map((m) => m[1]);
assert.ok(members.length >= 2, `expected at least 2 user-facing identity errors, found ${members.length}`);
for (const name of members) {
  assert.match(
    identity,
    new RegExp(String.raw`throw new Error\(${name}\)`),
    `${name} is listed in IDENTITY_USER_FACING_ERRORS but never thrown — the set would be\n` +
      "  claiming to whitelist a message that does not exist.",
  );
}

console.log(
  `email claim contract OK — all ${writers.length} writers into the unique UserEmail namespace go\n` +
    "  through one resolver, verified and primary rows still hold, and the login page shows only\n" +
    `  the ${members.length} refusals identity-auth authored rather than raw database text.\n` +
    "  Does NOT cover: that the resolver's queries behave — verified separately against a live DB.",
);
