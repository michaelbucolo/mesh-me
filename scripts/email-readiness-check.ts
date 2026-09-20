import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mock } from "node:test";

async function main() {
  const directory = mkdtempSync(join(tmpdir(), "mesh-email-"));
  // Always isolate database and delivery, even with production env loaded.
  process.env.DATABASE_URL = `file:${join(directory, "test.db")}`;
  delete process.env.DATABASE_AUTH_TOKEN;
  execFileSync(process.execPath, ["scripts/ensure-schema.mjs"], { env: process.env, stdio: "pipe" });
  const { prisma } = await import("../src/lib/prisma");
  const { sendPasswordResetEmail, sendEmailVerificationEmail } = await import("../src/lib/account-email");
  const { consumePasswordResetToken, consumeEmailVerificationToken, createPasswordSessionRecord, replaceAccountPassword } = await import("../src/lib/auth-token-store");
  let checks = 0;
  const check = (actual: unknown, expected: unknown, message: string) => { assert.deepEqual(actual, expected, message); checks++; };
  const privateMarker = "private-fixture-never-log";
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const logs: unknown[][] = [];
  let respond: (init?: RequestInit) => Promise<Response> = async () => new Response(null, { status: 200 });
  const fetchMock = mock.method(globalThis, "fetch", async (url: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(url), init });
    return respond(init);
  });
  const logMock = mock.method(console, "error", (...args: unknown[]) => { logs.push(args); });
  const address = `${privateMarker}@example.invalid`;
  const link = `https://www.meshs.me/verify-email?token=${privateMarker}&quoted=\"<'`;
  const body = () => JSON.parse(String(requests.at(-1)?.init?.body)) as Record<string, string>;
  try {
    for (const key of ["RESEND_API_KEY", "RESEND_FROM_EMAIL", "PASSWORD_RESET_FROM_EMAIL", "EMAIL_VERIFICATION_FROM_EMAIL"]) delete process.env[key];
    check(await sendPasswordResetEmail(address, link), false, "Unconfigured recovery does not claim delivery");
    check(await sendEmailVerificationEmail(address, link), false, "Unconfigured verification does not claim delivery");
    check(requests.length, 0, "Missing configuration never reaches the network");
    process.env.RESEND_API_KEY = `  re_${privateMarker}  `;
    process.env.RESEND_FROM_EMAIL = "  Mesh.me <hello@example.invalid>  ";
    check(await sendEmailVerificationEmail(address, link), true, "Verification accepts a successful provider response");
    check(requests.at(-1)?.url, "https://api.resend.com/emails", "Delivery uses the expected provider");
    check(new Headers(requests.at(-1)?.init?.headers).get("Authorization"), `Bearer re_${privateMarker}`, "API credentials are trimmed");
    check(body().from, "Mesh.me <hello@example.invalid>", "Default sender is trimmed");
    check(body().to, address, "Delivery retains its intended recipient");
    check(body().text.includes(link), true, "Plain text keeps the complete verification link");
    check(body().html.includes("&amp;quoted=&quot;&lt;&#39;"), true, "HTML link attributes are escaped");
    check(requests.at(-1)?.init?.signal instanceof AbortSignal, true, "Delivery has a cancellation signal");
    process.env.PASSWORD_RESET_FROM_EMAIL = "  Mesh.me <security@example.invalid>  ";
    await sendPasswordResetEmail(address, link);
    check(body().from, "Mesh.me <security@example.invalid>", "Recovery uses its sender override");
    process.env.EMAIL_VERIFICATION_FROM_EMAIL = "  Mesh.me <verify@example.invalid>  ";
    await sendEmailVerificationEmail(address, link);
    check(body().from, "Mesh.me <verify@example.invalid>", "Verification uses its sender override");
    process.env.EMAIL_VERIFICATION_FROM_EMAIL = "   ";
    process.env.RESEND_FROM_EMAIL = "   ";
    await sendEmailVerificationEmail(address, link);
    check(body().from, "Mesh.me <security@example.invalid>", "Blank sender configuration falls back correctly");
    let errorBodyRead = false;
    respond = async () => {
      const response = new Response(privateMarker, { status: 422 });
      response.text = async () => { errorBodyRead = true; return privateMarker; };
      return response;
    };
    check(await sendEmailVerificationEmail(address, link), false, "A provider rejection reports failed verification delivery");
    check(await sendPasswordResetEmail(address, link), false, "Rejected recovery delivery resolves without throwing");
    check(errorBodyRead, false, "Private provider response text is not read for logging");
    respond = async () => { throw new Error(privateMarker); };
    check(await sendPasswordResetEmail(address, link), false, "Provider outage does not throw from public recovery");
    check(await sendEmailVerificationEmail(address, link), false, "Provider outage reports verification failure");
    let timeoutMilliseconds: number | undefined;
    const timeoutMock = mock.method(AbortSignal, "timeout", (milliseconds: number) => {
      timeoutMilliseconds = milliseconds;
      return AbortSignal.abort(new DOMException(privateMarker, "TimeoutError"));
    });
    try {
      respond = async (init) => { init?.signal?.throwIfAborted(); return new Response(null, { status: 200 }); };
      check(await sendPasswordResetEmail(address, link), false, "Timed-out delivery resolves safely");
      check(timeoutMilliseconds, 8_000, "Provider calls have an eight-second deadline");
    } finally { timeoutMock.mock.restore(); }
    check(JSON.stringify(logs).includes(privateMarker), false, "Logs exclude addresses, credentials, tokens, and exception details");
    fetchMock.mock.restore();
    logMock.mock.restore();

    const user = await prisma.user.create({ data: { username: "recoveryfixture", displayName: "Recovery fixture", email: "recovery@example.invalid", passwordHash: "old-hash" } });
    const other = await prisma.user.create({ data: { username: "otherfixture", displayName: "Other fixture", email: "other@example.invalid", passwordHash: "other-hash" } });
    const expiresAt = new Date(Date.now() + 60_000);
    await prisma.user.update({ where: { id: user.id }, data: { resetToken: "race-token", resetTokenExpiry: expiresAt } });
    await prisma.session.createMany({ data: [{ userId: user.id, expiresAt }, { userId: other.id, expiresAt }] });
    const results = await Promise.all([
      consumePasswordResetToken(user.id, "race-token", "first-hash"),
      consumePasswordResetToken(user.id, "race-token", "second-hash"),
    ]);
    check(results.filter(Boolean).length, 1, "Concurrent reset submissions consume a token only once");
    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    check(updated.passwordHash, results[0] ? "first-hash" : "second-hash", "Only the winning password takes effect");
    check(updated.resetToken, null, "Consumed reset token is cleared");
    check(await prisma.session.count({ where: { userId: user.id } }), 0, "Reset revokes every owner session");
    check(await prisma.session.count({ where: { userId: other.id } }), 1, "Reset preserves unrelated sessions");
    check(await consumePasswordResetToken(user.id, "race-token", "replayed-hash"), false, "Consumed reset links cannot be replayed");
    await prisma.user.update({ where: { id: user.id }, data: { resetToken: "expired-token", resetTokenExpiry: new Date(0) } });
    check(await consumePasswordResetToken(user.id, "expired-token", "expired-hash"), false, "Expired reset links cannot change a password");
    await prisma.user.update({ where: { id: user.id }, data: { resetToken: "rollback-token", resetTokenExpiry: expiresAt } });
    await prisma.session.create({ data: { userId: user.id, expiresAt } });
    await prisma.$executeRawUnsafe('CREATE TRIGGER prevent_session_delete BEFORE DELETE ON Session BEGIN SELECT RAISE(ABORT, \'isolated session deletion failure\'); END');
    await assert.rejects(consumePasswordResetToken(user.id, "rollback-token", "must-rollback")); checks++;
    check((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).resetToken, "rollback-token", "Session revocation failure rolls back token consumption");
    check((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).passwordHash, updated.passwordHash, "Session revocation failure rolls back password replacement");
    await prisma.$executeRawUnsafe('DROP TRIGGER prevent_session_delete');

    check(await consumePasswordResetToken(user.id, "rollback-token", "rotated-hash"), true, "A valid reset succeeds once revocation is available");
    check(await createPasswordSessionRecord(user.id, updated.passwordHash, "stale-login", expiresAt), false, "An in-flight old-password login cannot create a session after reset");
    check(await prisma.session.count({ where: { id: "stale-login" } }), 0, "Rejected stale login writes no session");
    check(await createPasswordSessionRecord(user.id, "rotated-hash", "current-login", expiresAt), true, "Current password can still create a session");
    check((await prisma.session.findUniqueOrThrow({ where: { id: "current-login" } })).expiresAt.getTime(), expiresAt.getTime(), "Conditional session insertion preserves DateTime expiry semantics");
    check(await prisma.session.count({ where: { id: "current-login", expiresAt: { gt: new Date() } } }), 1, "Password sessions match Prisma's active DateTime range filter");
    await createPasswordSessionRecord(user.id, "rotated-hash", "expired-login", new Date(0));
    check(await prisma.session.count({ where: { id: "expired-login", expiresAt: { lte: new Date() } } }), 1, "Expired password sessions match Prisma's expiration filter");
    const expiredSessionCleanup = await prisma.session.deleteMany({ where: { expiresAt: { lte: new Date() } } });
    check(expiredSessionCleanup.count, 1, "Maintenance deletes only expired password sessions");
    check(await prisma.session.count({ where: { id: "current-login" } }), 1, "Maintenance preserves active password sessions");
    check(await prisma.session.count({ where: { userId: other.id } }), 1, "Maintenance also preserves unrelated active ORM-created sessions");
    await prisma.user.update({ where: { id: user.id }, data: { resetToken: "race-login-reset", resetTokenExpiry: expiresAt } });
    const loginResetRace = await Promise.all([
      createPasswordSessionRecord(user.id, "rotated-hash", "racing-login", expiresAt),
      consumePasswordResetToken(user.id, "race-login-reset", "after-login-race"),
    ]);
    check(loginResetRace[1], true, "Reset succeeds while an old-password login races it");
    check(await prisma.session.count({ where: { userId: user.id } }), 0, "Neither existing nor racing old-password sessions survive reset");
    await prisma.user.update({ where: { id: user.id }, data: { resetToken: "outstanding-reset", resetTokenExpiry: expiresAt } });
    await createPasswordSessionRecord(user.id, "after-login-race", "before-change", expiresAt);
    check(await replaceAccountPassword(user.id, "after-login-race", "changed-password"), true, "A current reauthentication can change the password");
    check(await prisma.session.count({ where: { userId: user.id } }), 0, "Normal password changes also revoke existing sessions atomically");
    check((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).resetToken, null, "Normal password changes revoke previously issued reset links");
    check(await replaceAccountPassword(user.id, "after-login-race", "stale-change"), false, "A stale password change cannot overwrite a newer password");
    check((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).passwordHash, "changed-password", "Rejected stale password changes preserve the new password");
    await prisma.user.update({ where: { id: user.id }, data: { isSuspended: true } });
    check(await createPasswordSessionRecord(user.id, "changed-password", "suspended-login", expiresAt), false, "A suspension racing sign-in prevents session insertion");
    await prisma.user.update({ where: { id: user.id }, data: { isSuspended: false } });

    const makeVerification = (tokenHash: string, email: string, expiration = expiresAt) => prisma.emailVerificationToken.create({ data: { userId: user.id, tokenHash, email, expiresAt: expiration } });
    await makeVerification("primary-token", user.email);
    check(await consumeEmailVerificationToken("primary-token"), { success: true, email: user.email }, "Primary mailbox proof verifies a legacy account without a UserEmail row");
    check((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).emailVerified, true, "Primary verification updates account status");
    check((await prisma.userEmail.findUniqueOrThrow({ where: { email: user.email } })).isVerified, true, "Primary verification creates its verified ownership record");
    check("error" in await consumeEmailVerificationToken("primary-token"), true, "Verification links are single-use");
    await makeVerification("removed-token", "removed@example.invalid");
    check("error" in await consumeEmailVerificationToken("removed-token"), true, "A removed secondary address cannot be recreated by an old link");
    check(await prisma.userEmail.count({ where: { email: "removed@example.invalid" } }), 0, "Rejected verification creates no ownership record");
    await prisma.userEmail.create({ data: { userId: other.id, email: "taken@example.invalid" } });
    await makeVerification("taken-token", "taken@example.invalid");
    check("error" in await consumeEmailVerificationToken("taken-token"), true, "A reassigned email cannot be claimed by an old link");
    check((await prisma.userEmail.findUniqueOrThrow({ where: { email: "taken@example.invalid" } })).isVerified, false, "Rejected proof does not verify another account's address");
    await prisma.userEmail.create({ data: { userId: user.id, email: "secondary@example.invalid" } });
    await makeVerification("secondary-token", "secondary@example.invalid");
    const verificationRace = await Promise.all([consumeEmailVerificationToken("secondary-token"), consumeEmailVerificationToken("secondary-token")]);
    check(verificationRace.filter((result) => "success" in result).length, 1, "Concurrent verification consumes a token only once");
    await makeVerification("expired-verification", user.email, new Date(0));
    check("error" in await consumeEmailVerificationToken("expired-verification"), true, "Expired verification cannot be consumed");
    console.log(`Email readiness: ${checks} isolated transport and database assertions passed.`);
  } finally {
    fetchMock.mock.restore();
    logMock.mock.restore();
    await prisma.$disconnect();
    rmSync(directory, { recursive: true, force: true });
  }
}
main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
