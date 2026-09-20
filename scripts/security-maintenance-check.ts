import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

async function main() {
  const directory = mkdtempSync(join(tmpdir(), "mesh-maintenance-"));
  process.env.DATABASE_URL = `file:${join(directory, "test.db")}`;
  delete process.env.DATABASE_AUTH_TOKEN;
  process.env.VERCEL_ENV = "preview";
  execFileSync(process.execPath, ["scripts/ensure-schema.mjs"], { env: process.env, stdio: "pipe" });
  const { prisma } = await import("../src/lib/prisma");
  const { pruneExpiredSecurityData } = await import("../src/lib/security-maintenance");
  const { GET } = await import("../src/app/api/maintenance/route");
  let checks = 0;
  const check = (actual: unknown, expected: unknown, label: string) => { assert.deepEqual(actual, expected, label); checks++; };
  const now = new Date();
  const expired = new Date(now.getTime() - 60_000);
  const active = new Date(now.getTime() + 3_600_000);
  try {
    const users = await Promise.all([expired, active].map((resetTokenExpiry, index) => prisma.user.create({ data: {
      username: `maintenance${index}`, displayName: "Isolated fixture", email: `maintenance${index}@example.invalid`,
      passwordHash: "isolated-no-login", resetToken: `reset-${index}`, resetTokenExpiry,
    } })));
    for (const user of users) {
      await prisma.session.createMany({ data: [expired, active].map((expiresAt) => ({ userId: user.id, expiresAt })) });
      await prisma.emailVerificationToken.createMany({ data: [expired, active].map((expiresAt, index) => ({ userId: user.id, email: user.email, tokenHash: `${user.id}-${index}`, expiresAt })) });
      await prisma.post.create({ data: { authorId: user.id, content: "Preserved post" } });
    }
    delete process.env.CRON_SECRET;
    const request = (authorization?: string) => new Request("https://example.invalid/api/maintenance", { headers: authorization ? { authorization } : {} });
    check((await GET(request())).status, 401, "Missing configuration fails closed");
    process.env.CRON_SECRET = "isolated-cron-test-value";
    check((await GET(request())).status, 401, "Missing credential fails closed");
    check((await GET(request("Bearer invalid"))).status, 401, "Wrong credential fails closed");
    check(await prisma.session.count(), 4, "Unauthorized requests have no mutation");
    check(await pruneExpiredSecurityData(now), { sessions: 2, verificationTokens: 2, passwordResetTokens: 1 }, "Only expired credentials are removed");
    check(await prisma.session.count(), 2, "Active sessions survive");
    check(await prisma.emailVerificationToken.count(), 2, "Active verification links survive");
    check((await prisma.user.findUniqueOrThrow({ where: { id: users[0].id } })).resetToken, null, "Expired reset link is cleared");
    check((await prisma.user.findUniqueOrThrow({ where: { id: users[1].id } })).resetToken, "reset-1", "Active reset link survives");
    check(await prisma.user.count(), 2, "Accounts survive cleanup");
    check(await prisma.post.count(), 2, "Posts survive cleanup");
    check(await pruneExpiredSecurityData(now), { sessions: 0, verificationTokens: 0, passwordResetTokens: 0 }, "Repeat execution is idempotent");
    const response = await GET(request("Bearer isolated-cron-test-value"));
    check(response.status, 200, "Authenticated cron can execute");
    check(await response.json(), { ok: true, removed: { sessions: 0, verificationTokens: 0, passwordResetTokens: 0 } }, "Response contains counts only");
    await assert.rejects(pruneExpiredSecurityData(new Date(NaN))); checks++;
    for (const [id, time] of [["legacy-expired", expired.getTime()], ["legacy-active", active.getTime()], ["unparseable", "invalid-date"]] as const) {
      await prisma.$executeRaw`INSERT INTO "Session" ("id", "userId", "expiresAt", "createdAt") VALUES (${id}, ${users[0].id}, ${time}, ${now})`;
      await prisma.$executeRaw`INSERT INTO "EmailVerificationToken" ("id", "userId", "email", "tokenHash", "expiresAt", "createdAt") VALUES (${id}, ${users[0].id}, ${users[0].email}, ${id}, ${time}, ${now})`;
    }
    await prisma.$executeRaw`UPDATE "User" SET "resetToken" = 'legacy-reset', "resetTokenExpiry" = ${active.getTime()} WHERE "id" = ${users[1].id}`;
    check(await pruneExpiredSecurityData(now), { sessions: 1, verificationTokens: 1, passwordResetTokens: 0 }, "Mixed numeric/text dates remove only known expired credentials");
    check(await prisma.session.count({ where: { id: "legacy-active" } }), 1, "Future numeric session survives");
    check(await prisma.emailVerificationToken.count({ where: { id: "legacy-active" } }), 1, "Future numeric verification survives");
    check((await prisma.user.findUniqueOrThrow({ where: { id: users[1].id } })).resetToken, "legacy-reset", "Future numeric reset survives");
    check(await prisma.session.count({ where: { id: "unparseable" } }), 1, "Unknown date is retained for review");
    await prisma.$executeRaw`UPDATE "User" SET "resetTokenExpiry" = ${expired.getTime()} WHERE "id" = ${users[1].id}`;
    check((await pruneExpiredSecurityData(now)).passwordResetTokens, 1, "Expired numeric reset is cleared");
    await prisma.session.create({ data: { userId: users[0].id, expiresAt: expired } });
    await prisma.$executeRawUnsafe("CREATE TRIGGER block_token_prune BEFORE DELETE ON EmailVerificationToken BEGIN SELECT RAISE(ABORT, 'isolated failure'); END");
    await prisma.emailVerificationToken.create({ data: { userId: users[0].id, email: users[0].email, tokenHash: "rollback", expiresAt: expired } });
    await assert.rejects(pruneExpiredSecurityData(now)); checks++;
    check(await prisma.session.count(), 5, "A cleanup failure rolls back earlier deletes");
    console.log(`security-maintenance: ${checks} isolated assertions passed.`);
  } finally {
    await prisma.$disconnect();
    rmSync(directory, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
