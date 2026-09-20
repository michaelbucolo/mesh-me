import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createCipheriv, randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";

const KEY_NAMES = ["APP_DATA_ENCRYPTION_KEY", "MESHME_TOKEN_ENCRYPTION_KEY", "MESHME_SECRET_KEY"] as const;
function configureKeys(primary?: string, legacy?: string) {
  for (const name of KEY_NAMES) delete process.env[name];
  if (primary !== undefined) process.env.APP_DATA_ENCRYPTION_KEY = primary;
  if (legacy !== undefined) process.env.MESHME_TOKEN_ENCRYPTION_KEY = legacy;
}
function encryptFixture(key: Buffer, plaintext: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return ["enc:v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(":");
}

async function main() {
  const directory = mkdtempSync(join(tmpdir(), "mesh-recovery-"));
  // Override connections and keys before importing application modules. Every
  // database mutation in this suite targets the disposable fixture database.
  process.env.DATABASE_URL = `file:${join(directory, "test.db")}`;
  delete process.env.DATABASE_AUTH_TOKEN;
  delete process.env.PRISMA_QUERY_LOG;
  Reflect.set(process.env, "NODE_ENV", "production");
  configureKeys();
  let disconnect: (() => Promise<void>) | undefined;
  let checks = 0;
  const check = (actual: unknown, expected: unknown, message: string) => {
    assert.ok(isDeepStrictEqual(actual, expected), message); checks++;
  };
  try {
    execFileSync(process.execPath, ["scripts/ensure-schema.mjs"], { env: process.env, stdio: "pipe" });
    const { prisma } = await import("../src/lib/prisma");
    disconnect = () => prisma.$disconnect();
    const { getCredentialStorageAudit, CREDENTIAL_AUDIT_LIMITS: limits } = await import("../src/lib/credential-storage-audit");
    const complete = async () => {
      const audit = await getCredentialStorageAudit();
      check(audit.recovery.status, "complete", "A bounded complete snapshot has complete recovery results");
      if (audit.recovery.status !== "complete") throw new Error("Incomplete fixture scan");
      return { audit, recovery: audit.recovery };
    };
    const empty = await complete();
    check([empty.audit.status, empty.recovery.ciphertexts, empty.recovery.currentKey.usable], ["empty", 0, false], "Empty storage and absent keys do not invent recovery evidence");
    const owner = await prisma.user.create({ data: { username: "recovery_fixture", email: "recovery@example.invalid", displayName: "Recovery fixture", passwordHash: "no-login" } });
    const primary = randomBytes(32);
    const legacy = randomBytes(32);
    const wrong = randomBytes(32);
    const plaintexts = ["fixture-access-private", "fixture-refresh-private", "fixture-secret-private", "fixture-legacy-private"];
    const [access, refresh, secret] = plaintexts.slice(0, 3).map((value) => encryptFixture(primary, value));
    const legacyValue = encryptFixture(legacy, plaintexts[3]);
    const parts = access.split(":");
    const corruptParts = [...parts];
    const tag = Buffer.from(corruptParts[3], "base64url"); tag[0] ^= 1; corruptParts[3] = tag.toString("base64url");
    const accounts = [
      { isActive: false, accessToken: access, refreshToken: refresh },
      { isActive: true, accessToken: legacyValue, refreshToken: corruptParts.join(":") },
      { isActive: false, accessToken: "enc:v1:", refreshToken: `${access}:extra` },
      { isActive: true, accessToken: ["enc", "v1", Buffer.alloc(11).toString("base64url"), parts[3], parts[4]].join(":"), refreshToken: "fixture-plaintext-private" },
    ];
    const methods = [secret, ["enc", "v1", parts[2], `!${parts[3]}`, parts[4]].join(":"), ["enc", "v1", `${parts[2]}=`, parts[3], parts[4]].join(":")];
    await prisma.connectedAccount.createMany({ data: accounts.map((row) => ({ userId: owner.id, platform: "fixture", ...row })) });
    await prisma.twoFactorMethod.createMany({ data: methods.map((value) => ({ userId: owner.id, method: "totp", isEnabled: false, secret: value })) });
    const snapshot = async () => ({ accounts: await prisma.connectedAccount.findMany({ orderBy: { id: "asc" } }), methods: await prisma.twoFactorMethod.findMany({ orderBy: { id: "asc" } }) });
    const before = await snapshot();
    const results = [];
    configureKeys(primary.toString("hex"), legacy.toString("hex"));
    const correct = await complete(); results.push(correct.audit);
    check([correct.recovery.ciphertexts, correct.recovery.structurallyValid, correct.recovery.malformed], [10, 5, 5], "Envelope validation distinguishes bad structure from authenticated-decryption failure");
    check([correct.audit.connectedAccounts?.totalRows, correct.audit.connectedAccounts?.inactiveRows, correct.audit.twoFactorMethods?.totalRows], [4, 2, 3], "Inactive accounts and disabled historical two-factor rows are included");
    check([correct.recovery.currentKey.authenticated, correct.recovery.currentKey.failed], [3, 2], "Current key authenticates access, refresh and two-factor fixtures but rejects other keys and corruption");
    check(correct.recovery.candidates.some((candidate) => candidate.source === "MESHME_TOKEN_ENCRYPTION_KEY" && candidate.authenticated === 1 && candidate.failed === 4), true, "A configured legacy key authenticates only its historical subset");
    for (const value of [primary.toString("base64"), `  ${primary.toString("hex")}\n`]) {
      configureKeys(value);
      const current = await complete(); results.push(current.audit);
      check([current.recovery.currentKey.usable, current.recovery.currentKey.authenticated], [true, 3], "Production parsing still accepts canonical base64 and actual trailing whitespace");
    }
    for (const value of [`"${primary.toString("hex")}"`, `'${primary.toString("hex")}'`, `${primary.toString("hex")}\\n`, `${primary.toString("hex")}\\r\\n`, `"${primary.toString("hex")}\\n"`, `"${primary.toString("hex")}"\\n`]) {
      configureKeys(value);
      const formatted = await complete(); results.push(formatted.audit);
      check([formatted.recovery.currentKey.usable, formatted.recovery.currentKey.authenticated, formatted.recovery.currentKey.failed], [false, 0, 0], "Malformed current key is not silently repaired for production use");
      check(formatted.recovery.candidates.some((candidate) => candidate.authenticated === 3 && candidate.failed === 2), true, "One bounded quote/newline correction yields aggregate authentication evidence");
      check(process.env.APP_DATA_ENCRYPTION_KEY, value, "Diagnostics never rewrite configured key values");
    }
    configureKeys(wrong.toString("hex"));
    const wrongResult = await complete(); results.push(wrongResult.audit);
    check([wrongResult.recovery.currentKey.authenticated, wrongResult.recovery.currentKey.failed, wrongResult.recovery.candidates.length], [0, 5, 0], "A usable wrong key yields no successes and is not duplicated as a candidate");
    configureKeys("change-me-please", primary.toString("hex"));
    const masked = await complete(); results.push(masked.audit);
    check(masked.recovery.currentKey.usable, false, "An invalid primary continues masking aliases under runtime precedence");
    check(masked.recovery.candidates.some((candidate) => candidate.authenticated === 3), true, "Masked existing aliases can be diagnosed without enabling fallback");
    configureKeys();
    const missing = await complete(); results.push(missing.audit);
    check([missing.recovery.structurallyValid, missing.recovery.malformed, missing.recovery.currentKey.failed], [5, 5, 0], "Structure diagnosis works without key material and reports no fabricated authentication failures");
    const serialized = JSON.stringify(results);
    const privateValues = [...plaintexts, ...accounts.flatMap((row) => [row.accessToken, row.refreshToken]), ...methods, ...[primary, legacy, wrong].flatMap((key) => [key.toString("hex"), key.toString("base64")]), owner.id];
    check(privateValues.every((value) => !serialized.includes(value)), true, "No plaintext, ciphertext, key material or owner identifiers leave the diagnostic");
    check(await snapshot(), before, "Diagnostics leave stored bytes, timestamps and account flags unchanged");

    await prisma.$executeRaw`ALTER TABLE TwoFactorMethod RENAME TO UnavailableRecoveryMethods`;
    try {
      const failed = await getCredentialStorageAudit();
      check([failed.status, failed.recovery.status, failed.connectedAccounts, failed.twoFactorMethods], ["unavailable", "not_scanned", null, null], "Database failure never returns empty or partial recovery success");
    } finally { await prisma.$executeRaw`ALTER TABLE UnavailableRecoveryMethods RENAME TO TwoFactorMethod`; }

    await prisma.connectedAccount.deleteMany({}); await prisma.twoFactorMethod.deleteMany({});
    const add = async (amount: number, value: string) => {
      for (let offset = 0; offset < amount; offset += 100) await prisma.connectedAccount.createMany({ data: Array.from({ length: Math.min(100, amount - offset) }, () => ({ userId: owner.id, platform: "bound-fixture", isActive: false, accessToken: value })) });
    };
    for (const [amount, value] of [
      [1, `enc:v1:${"A".repeat(limits.maxPayloadBytes)}`],
      [limits.maxPayloads + 1, access],
      [Math.floor(limits.maxTotalBytes / limits.maxPayloadBytes) + 1, `enc:v1:${"A".repeat(limits.maxPayloadBytes - 7)}`],
    ] as const) {
      await add(amount, value);
      const bounded = await getCredentialStorageAudit();
      check([bounded.status, bounded.connectedAccounts?.accessToken.ciphertext, bounded.recovery.status], ["payloads_present", amount, "not_scanned"], "Per-field, total-byte and payload-count bounds retain complete aggregate counts without partial scans");
      check(Object.keys(bounded.recovery).sort(), ["reason", "status"], "Refused scans expose no partial crypto counts");
      await prisma.connectedAccount.deleteMany({});
    }

    // A successful reconnect can leave unreadable old refresh ciphertext.
    // The real refresh function must preserve those bytes while renewing a
    // usable access token on a provider that supports long-lived-token refresh.
    configureKeys(primary.toString("hex"));
    process.env.INSTAGRAM_APP_ID = "fixture-client"; process.env.INSTAGRAM_APP_SECRET = "fixture-secret";
    process.env.DISCORD_CLIENT_ID = "fixture-client"; process.env.DISCORD_CLIENT_SECRET = "fixture-secret";
    const { refreshConnectedAccountToken } = await import("../src/lib/oauth-token-refresh");
    const { decryptSecret } = await import("../src/lib/secret-store");
    const originalFetch = globalThis.fetch;
    let requests = 0;
    globalThis.fetch = async (input, init) => {
      requests++;
      const url = new URL(String(input));
      check(url.hostname === "graph.instagram.com" || url.hostname === "discord.com", true, "Only expected fixture provider requests are issued");
      if (url.hostname === "graph.instagram.com") check(url.searchParams.get("access_token"), plaintexts[0], "Long-lived refresh uses only the decryptable access token");
      else check(new URLSearchParams(String(init?.body)).get("refresh_token"), plaintexts[1], "A readable refresh token retains its normal provider exchange path");
      return Response.json({ access_token: "fixture-renewed-access", expires_in: 3600 });
    };
    try {
      const recovered = await prisma.connectedAccount.create({ data: { userId: owner.id, platform: "instagram", accessToken: access, refreshToken: legacyValue } });
      check(await refreshConnectedAccountToken(recovered.id), "refreshed", "Unreadable legacy refresh payload does not block a supported access-token renewal");
      const afterRefresh = await prisma.connectedAccount.findUniqueOrThrow({ where: { id: recovered.id } });
      check([decryptSecret(afterRefresh.accessToken), afterRefresh.refreshToken], ["fixture-renewed-access", legacyValue], "Renewal stores a fresh encrypted access token and preserves historical refresh bytes");
      const unsupported = await prisma.connectedAccount.create({ data: { userId: owner.id, platform: "discord", accessToken: access, refreshToken: legacyValue } });
      check(await refreshConnectedAccountToken(unsupported.id), "needs_reconnect", "Unreadable refresh fails closed where access-token renewal is unsupported");
      check(requests, 1, "Unreadable refresh material is never sent to a provider");
      const unsupportedAfter = await prisma.connectedAccount.findUniqueOrThrow({ where: { id: unsupported.id } });
      check([unsupportedAfter.accessToken, unsupportedAfter.refreshToken], [access, legacyValue], "Failed refresh preserves both stored credentials");
      await prisma.connectedAccount.update({ where: { id: unsupported.id }, data: { refreshToken: refresh } });
      check(await refreshConnectedAccountToken(unsupported.id), "refreshed", "A readable refresh token still follows the existing successful path");
      check((await prisma.connectedAccount.findUniqueOrThrow({ where: { id: unsupported.id } })).refreshToken, refresh, "A provider response without refresh rotation preserves the readable old token");
    } finally { globalThis.fetch = originalFetch; }
    console.log(`credential recovery: ${checks} assertions passed (isolated database; mocked provider transport)`);
  } finally {
    await disconnect?.(); configureKeys(); rmSync(directory, { recursive: true, force: true });
  }
}
main().catch((error: unknown) => {
  console.error(error instanceof assert.AssertionError ? error.message : "Credential recovery check failed; sensitive diagnostic details withheld.");
  process.exitCode = 1;
});
