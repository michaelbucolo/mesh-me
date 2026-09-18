import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Stripe from "stripe";

async function main() {
  const directory = mkdtempSync(join(tmpdir(), "mesh-launch-"));
  // Never contact a configured database or payment account from this suite.
  process.env.DATABASE_URL = `file:${join(directory, "test.db")}`;
  delete process.env.DATABASE_AUTH_TOKEN;
  process.env.VERCEL_ENV = "preview";
  process.env.STRIPE_SECRET_KEY = "sk_test_isolated_fixture";
  process.env.STRIPE_MONTHLY_PRICE_ID = "price_mesh_monthly_fixture";
  execFileSync(process.execPath, ["scripts/ensure-schema.mjs"], { env: process.env, stdio: "pipe" });
  const { prisma } = await import("../src/lib/prisma");
  let checks = 0;
  const check = (actual: unknown, expected: unknown, message: string) => {
    assert.deepEqual(actual, expected, message); checks++;
  };
  try {
    const storage = new Map<string, string>();
    let storageBlocked = false;
    const fakeWindow = Object.assign(new EventTarget(), { localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => { if (storageBlocked) throw new Error("Storage blocked"); storage.set(key, value); },
    } });
    Object.defineProperty(globalThis, "window", { configurable: true, value: fakeWindow });
    try {
      const preferences = await import("../src/lib/interaction-preferences");
      const sounds = await import("../src/lib/sound");
      check(sounds.isSoundEnabled(), false, "New devices stay quiet until they opt in");
      sounds.setSoundEnabled(true);
      check(sounds.isSoundEnabled(), true, "An explicit sound choice persists");
      storageBlocked = true;
      sounds.setSoundEnabled(false);
      check(sounds.isSoundEnabled(), false, "Muted choices work even when old storage is readable but writes fail");
      let notifications = 0;
      const unsubscribe = preferences.subscribeInteractionPreferences(() => { notifications++; });
      fakeWindow.dispatchEvent(new Event("storage"));
      check(sounds.isSoundEnabled(), true, "Cross-tab changes invalidate temporary overrides");
      preferences.setHapticsEnabled(false);
      check(preferences.isHapticsEnabled(), false, "Haptics can be disabled when storage is blocked");
      check(notifications, 2, "Settings subscribers observe cross-tab and same-tab choices");
      unsubscribe();
      preferences.setSoundLevel(4);
      check(preferences.getSoundLevel(), 1, "Sound volume is bounded");
      preferences.setSoundLevel(-1);
      check(preferences.getSoundLevel(), 0, "Zero volume remains available");
    } finally { Reflect.deleteProperty(globalThis, "window"); }

    const { durableRateLimit } = await import("../src/lib/durable-rate-limit");
    const burst = await Promise.all(Array.from({ length: 40 }, () => durableRateLimit("burst", 5, 60000)));
    check(burst.filter((result) => result.allowed).length, 5, "Concurrent requests cannot multiply a shared limit");
    check(burst.every((result) => result.remainingAttempts >= 0 && result.resetInMs > 0), true, "Rate-limit results have a usable retry time");
    check((await prisma.rateLimitHit.findUniqueOrThrow({ where: { key: "burst" } })).count, 6, "Denied requests saturate the counter");
    await prisma.rateLimitHit.update({ where: { key: "burst" }, data: { resetAt: new Date(0) } });
    const nextBurst = await Promise.all(Array.from({ length: 12 }, () => durableRateLimit("burst", 5, 60000)));
    check(nextBurst.filter((result) => result.allowed).length, 5, "An expired bucket resets only once under concurrency");
    check((await durableRateLimit("different", 5, 60000)).remainingAttempts, 4, "Separate keys retain separate budgets");

    const { getStripeClient } = await import("../src/lib/stripe");
    const stripe = getStripeClient()!;
    const subscriptions = new Map<string, Stripe.Subscription>();
    const sessions = new Map<string, Stripe.Checkout.Session>();
    const canceled: string[] = [];
    stripe.subscriptions.retrieve = (async (id: string) => {
      const subscription = subscriptions.get(id);
      if (!subscription) throw new Error(`Unexpected subscription lookup: ${id}`);
      return subscription;
    }) as typeof stripe.subscriptions.retrieve;
    stripe.subscriptions.cancel = (async (id: string) => {
      canceled.push(id);
      const subscription = subscriptions.get(id)!;
      subscription.status = "canceled";
      return subscription;
    }) as typeof stripe.subscriptions.cancel;
    stripe.checkout.sessions.retrieve = (async (id: string) => {
      const session = sessions.get(id);
      if (!session) throw new Error(`Unexpected checkout lookup: ${id}`);
      return session;
    }) as typeof stripe.checkout.sessions.retrieve;
    const { applyMeshProGiftSession, getMeshProBillingState, syncMeshProCheckoutSessionForUser, syncMeshProSubscription } = await import("../src/lib/stripe-billing");
    const { cancelAccountSubscriptions } = await import("../src/lib/account-billing");
    const makeUser = (username: string) => prisma.user.create({ data: { username, email: `${username}@example.invalid`, displayName: username, passwordHash: "fixture-no-password" } });
    const buyer = await makeUser("buyer");
    const recipient = await makeUser("recipient");
    const { getCredentialStorageAudit } = await import("../src/lib/credential-storage-audit");
    const emptyAudit = await getCredentialStorageAudit();
    check(emptyAudit.status, "empty", "An empty database reports no current credential payloads");
    check(emptyAudit.connectedAccounts, {
      totalRows: 0, inactiveRows: 0,
      accessToken: { empty: 0, ciphertext: 0, otherNonempty: 0 },
      refreshToken: { empty: 0, ciphertext: 0, otherNonempty: 0 },
    }, "An empty account table produces exact zero counts");
    check(emptyAudit.twoFactorMethods, { totalRows: 0, secret: { empty: 0, ciphertext: 0, otherNonempty: 0 } }, "Historical two-factor storage is also counted");
    check(emptyAudit.summary, "No currently stored credential payloads were found.", "The empty result is scoped to current payloads");
    check(emptyAudit.detail.includes("Backups and external copies are not checked."), true, "The audit does not clear uninspected backups");

    const accountFixtures = [
      { isActive: true, accessToken: null, refreshToken: "" },
      { isActive: false, accessToken: "enc:v1:fixture-access", refreshToken: "enc:v1:" },
      { isActive: false, accessToken: "fixture-legacy-access", refreshToken: " " },
      { isActive: true, accessToken: "", refreshToken: null },
      { isActive: false, accessToken: "ENC:v1:fixture-unknown", refreshToken: "enc:v2:fixture-unknown" },
    ];
    await prisma.connectedAccount.createMany({ data: accountFixtures.map((values) => ({ userId: buyer.id, platform: "audit-fixture", ...values })) });
    const methodFixtures = [null, "", "enc:v1:fixture-secret", "fixture-legacy-secret", " "];
    await prisma.twoFactorMethod.createMany({ data: methodFixtures.map((secret) => ({ userId: buyer.id, method: "totp", secret, isEnabled: false })) });
    // Invalid current key configuration must not erase historical ciphertext
    // from the audit or become evidence that replacement is safe.
    process.env.APP_DATA_ENCRYPTION_KEY = "change-me-please";
    const storedAudit = await getCredentialStorageAudit();
    check(storedAudit.status, "payloads_present", "An invalid current key cannot clear existing credentials");
    check(storedAudit.connectedAccounts, {
      totalRows: 5, inactiveRows: 3,
      accessToken: { empty: 2, ciphertext: 1, otherNonempty: 2 },
      refreshToken: { empty: 2, ciphertext: 1, otherNonempty: 2 },
    }, "Inactive accounts, malformed prefixes, legacy values and whitespace are retained in the aggregate");
    check(storedAudit.twoFactorMethods, { totalRows: 5, secret: { empty: 2, ciphertext: 1, otherNonempty: 2 } }, "Disabled historical two-factor payloads are included");
    check(storedAudit.detail.includes("does not verify decryption or determine whether key replacement is safe"), true, "Prefix counts do not assert decryptability or replacement safety");
    const serializedAudit = JSON.stringify(storedAudit);
    check(["fixture-access", "fixture-legacy-access", "fixture-unknown", "fixture-secret", "fixture-legacy-secret"].some((value) => serializedAudit.includes(value)), false, "Only counts, never credential payloads, leave the audit");
    check(await prisma.connectedAccount.count({ where: { userId: buyer.id, OR: accountFixtures } }), 5, "Auditing preserves every account credential and active state");
    check(await prisma.twoFactorMethod.count({ where: { userId: buyer.id, isEnabled: false, OR: methodFixtures.map((secret) => ({ secret })) } }), 5, "Auditing preserves every historical two-factor payload");
    await prisma.connectedAccount.deleteMany({ where: { userId: buyer.id } });
    const twoFactorOnlyAudit = await getCredentialStorageAudit();
    check(twoFactorOnlyAudit.status, "payloads_present", "Two-factor payloads alone prevent an empty result");
    await prisma.twoFactorMethod.deleteMany({ where: { userId: buyer.id } });
    await prisma.connectedAccount.createMany({ data: [
      { userId: buyer.id, platform: "audit-empty", accessToken: null, refreshToken: "", isActive: false },
      { userId: buyer.id, platform: "audit-empty", accessToken: "", refreshToken: null, isActive: true },
    ] });
    const emptyFieldsAudit = await getCredentialStorageAudit();
    check(emptyFieldsAudit.status, "empty", "Rows with only null and empty fields contain no credential payloads");
    check(emptyFieldsAudit.connectedAccounts?.accessToken.empty, 2, "Null and empty-string values both count as empty");
    await prisma.connectedAccount.deleteMany({ where: { userId: buyer.id } });

    // Temporarily hide a table in this isolated database to exercise a real
    // failed read; failures must not be rendered as zero stored credentials.
    await prisma.$executeRaw`ALTER TABLE TwoFactorMethod RENAME TO AuditUnavailableMethods`;
    try {
      const failedAudit = await getCredentialStorageAudit();
      check(failedAudit.status, "unavailable", "A failed aggregate read is never reported as empty");
      check([failedAudit.connectedAccounts, failedAudit.twoFactorMethods], [null, null], "Unavailable reads return no misleading partial counts");
      check(failedAudit.summary, "Credential storage could not be checked.", "A database failure has a plain, non-sensitive status");
    } finally {
      await prisma.$executeRaw`ALTER TABLE AuditUnavailableMethods RENAME TO TwoFactorMethod`;
    }

    const gift = (id: string, overrides: Partial<Stripe.Checkout.Session> = {}) => ({
      id, object: "checkout.session", mode: "payment", status: "complete", payment_status: "paid",
      metadata: { product: "meshpro-gift", recipientUserId: recipient.id, purchaserUserId: buyer.id, months: "1" },
      ...overrides,
    }) as Stripe.Checkout.Session;
    for (const overrides of [
      { payment_status: "unpaid" }, { status: "open" }, { mode: "subscription" },
      { metadata: { ...gift("unused").metadata, months: "1junk" } },
    ]) {
      await applyMeshProGiftSession(gift("cs_test_invalid", overrides as Partial<Stripe.Checkout.Session>));
      check(await prisma.meshProGift.count(), 0, "Unpaid, incomplete, wrong-mode or malformed gifts cannot grant access");
    }
    const farFuture = new Date(Date.UTC(new Date().getUTCFullYear() + 5, 0, 31, 12));
    await prisma.user.update({ where: { id: recipient.id }, data: { meshProGiftUntil: farFuture } });
    await applyMeshProGiftSession(gift("cs_test_once"));
    const first = (await prisma.user.findUniqueOrThrow({ where: { id: recipient.id } })).meshProGiftUntil!;
    check(first.getUTCMonth(), 1, "Month-end gifts clamp to February, not March");
    await applyMeshProGiftSession(gift("cs_test_once"));
    check((await prisma.user.findUniqueOrThrow({ where: { id: recipient.id } })).meshProGiftUntil, first, "Webhook redelivery cannot extend a gift twice");
    await Promise.all([applyMeshProGiftSession(gift("cs_test_parallel_a")), applyMeshProGiftSession(gift("cs_test_parallel_b"))]);
    check((await prisma.user.findUniqueOrThrow({ where: { id: recipient.id } })).meshProGiftUntil?.getUTCMonth(), 3, "Concurrent different gifts stack both months");
    check((await prisma.user.findUniqueOrThrow({ where: { id: buyer.id } })).isMeshPro, false, "Buying a gift never grants the purchaser MeshPro");
    check(await prisma.meshProGift.count(), 3, "Each successful gift has exactly one receipt");

    const subscription = (id: string, status: Stripe.Subscription.Status, product = "meshpro") => ({
      id, object: "subscription", status, customer: "cus_fixture", metadata: { product, userId: buyer.id },
      items: { data: [{ price: { id: "price_mesh_monthly_fixture", unit_amount: 499, currency: "usd", recurring: { interval: "month" } }, current_period_end: 2000000000 }] },
    }) as unknown as Stripe.Subscription;
    const current = subscription("sub_current", "active");
    subscriptions.set(current.id, current);
    await syncMeshProSubscription(current);
    check((await prisma.user.findUniqueOrThrow({ where: { id: buyer.id } })).isMeshPro, true, "An active owned subscription grants access");
    await syncMeshProSubscription(subscription("sub_patron", "canceled", "patron"));
    check((await prisma.user.findUniqueOrThrow({ where: { id: buyer.id } })).isMeshPro, true, "Patron cancellation cannot revoke MeshPro");
    await syncMeshProSubscription(subscription("sub_previous", "canceled"));
    check((await prisma.user.findUniqueOrThrow({ where: { id: buyer.id } })).stripeSubscriptionId, current.id, "Old cancellations cannot revoke a replacement subscription");
    current.status = "past_due";
    const state = await getMeshProBillingState(buyer.id);
    check(state?.isMeshPro, false, "Billing renders the newly reconciled entitlement");
    check((await prisma.user.findUniqueOrThrow({ where: { id: buyer.id } })).stripeSubscriptionId, current.id, "Past-due customers keep their billing relationship for recovery");
    const foreign = subscription("sub_unrelated", "active");
    foreign.metadata = {};
    foreign.items.data[0].price.id = "price_unrelated";
    check(await syncMeshProSubscription(foreign, buyer.id), null, "Metadata-free unrelated products cannot confer MeshPro through a shared customer");
    const checkout = gift("cs_test_checkout", {
      mode: "subscription", subscription: current,
      metadata: { product: "meshpro", userId: buyer.id },
    });
    sessions.set(checkout.id, checkout);
    check((await syncMeshProCheckoutSessionForUser(checkout.id, recipient.id)).ok, false, "Another account cannot claim a checkout");
    check((await syncMeshProCheckoutSessionForUser(checkout.id, buyer.id)).ok, false, "A past-due subscription cannot return a success confirmation");
    checkout.mode = "payment";
    check((await syncMeshProCheckoutSessionForUser(checkout.id, buyer.id)).ok, false, "A one-time payment cannot grant lifetime MeshPro");
    checkout.mode = "subscription"; checkout.payment_status = "unpaid"; current.status = "active";
    check((await syncMeshProCheckoutSessionForUser(checkout.id, buyer.id)).ok, false, "An unsettled checkout cannot confirm access");
    checkout.payment_status = "paid";
    check((await syncMeshProCheckoutSessionForUser(checkout.id, buyer.id)).ok, true, "A paid, active, owned subscription confirms access");

    const patron = subscription("sub_patron", "active", "patron");
    subscriptions.set(patron.id, patron);
    await prisma.patronStint.create({ data: { userId: buyer.id, stripeSubscriptionId: patron.id, monthlyCents: 200 } });
    check(await cancelAccountSubscriptions({ id: buyer.id, stripeSubscriptionId: current.id }), true, "Account deletion cancels every recurring product");
    check(canceled.sort(), [current.id, patron.id].sort(), "Both MeshPro and Patron stop billing");
    check(await cancelAccountSubscriptions({ id: buyer.id, stripeSubscriptionId: current.id }), true, "Retrying deletion tolerates already-canceled subscriptions");
    check(canceled.length, 2, "Deletion retries do not cancel twice");
    process.env.VERCEL_ENV = "production";
    check(getStripeClient(), null, "A production deployment cannot use test-mode payment credentials");
    check(await cancelAccountSubscriptions({ id: buyer.id, stripeSubscriptionId: current.id }), false, "Without usable payment credentials an account's bills cannot be silently orphaned");

    const firstFixture = await prisma.user.create({ data: { username: "meshmetester1", displayName: "Mesh Tester One", email: "fixture-one@example.invalid", passwordHash: "no-login" } });
    const secondFixture = await prisma.user.create({ data: { username: "meshmetester2", displayName: "Mesh Tester Two", email: "fixture-two@example.invalid", passwordHash: "no-login" } });
    const fixturePost = await prisma.post.create({ data: { authorId: firstFixture.id, content: "Hello from tester one! Testing the mesh." } });
    await prisma.comment.create({ data: { authorId: secondFixture.id, postId: fixturePost.id, content: "Nice post! From tester two." } });
    const runCleanup = (args: string[] = []) => execFileSync(process.execPath, ["--conditions=react-server", "--import", "tsx", "scripts/cleanup-test-accounts.ts", ...args], { env: process.env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    const review = JSON.parse(runCleanup());
    check(review.mode, "review", "Fixture cleanup is read-only by default");
    check(review.accounts.filter((account: { eligible: boolean }) => account.eligible).length, 2, "Only positively identified fixtures are candidates");
    check(await prisma.user.count({ where: { id: { in: [firstFixture.id, secondFixture.id] } } }), 2, "A review never deletes an account");
    await prisma.user.update({ where: { id: secondFixture.id }, data: { isAdmin: true } });
    check(JSON.parse(runCleanup()).accounts.find((account: { id: string }) => account.id === secondFixture.id).eligible, false, "Administrative accounts are protected from fixture cleanup");
    await prisma.user.update({ where: { id: secondFixture.id }, data: { isAdmin: false, stripeCustomerId: "cus_protected" } });
    const billingProtectedReview = JSON.parse(runCleanup()).accounts.find((account: { id: string }) => account.id === secondFixture.id);
    check(billingProtectedReview.eligible, false, "Payment history protects an account even with matching fixture evidence");
    check(billingProtectedReview.reason, "Protected: billing customer reference", "A protected billing reference is explained without exposing its value or account identifiers");
    await prisma.user.update({ where: { id: secondFixture.id }, data: { stripeCustomerId: null } });
    assert.throws(() => runCleanup([`--delete-id=${secondFixture.id}`, "--confirm-username=wrong"])); checks++;
    runCleanup([`--delete-id=${secondFixture.id}`, "--confirm-username=meshmetester2"]);
    check(await prisma.user.findUnique({ where: { id: secondFixture.id } }), null, "Exact confirmed fixture deletion removes its account");
    check(await prisma.comment.count({ where: { authorId: secondFixture.id } }), 0, "Fixture deletion removes its comments");
    runCleanup([`--delete-id=${firstFixture.id}`, "--confirm-username=meshmetester1"]);
    check(await prisma.post.findUnique({ where: { id: fixturePost.id } }), null, "Fixture deletion cascades to its posts");
    check(Boolean(await prisma.user.findUnique({ where: { id: buyer.id } })), true, "Fixture cleanup preserves other accounts");

    const runOwnerSetup = (overrides: Partial<NodeJS.ProcessEnv> = {}) => execFileSync(process.execPath, ["scripts/bootstrap-owner-admin.mjs"], {
      env: { ...process.env, VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "main", MESH_BOOTSTRAP_ADMIN_USERNAME: "", ...overrides },
      encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    });
    runOwnerSetup();
    check(await prisma.user.count({ where: { isAdmin: true } }), 0, "Owner setup is disabled without privileged deployment configuration");
    assert.throws(() => runOwnerSetup({ MESH_BOOTSTRAP_ADMIN_USERNAME: buyer.username, VERCEL_ENV: "preview" })); checks++;
    assert.throws(() => runOwnerSetup({ MESH_BOOTSTRAP_ADMIN_USERNAME: buyer.username, VERCEL_GIT_COMMIT_REF: "feature" })); checks++;
    assert.throws(() => runOwnerSetup({ MESH_BOOTSTRAP_ADMIN_USERNAME: "missing_account" })); checks++;
    await prisma.user.update({ where: { id: buyer.id }, data: { isSuspended: true } });
    assert.throws(() => runOwnerSetup({ MESH_BOOTSTRAP_ADMIN_USERNAME: buyer.username })); checks++;
    await prisma.user.update({ where: { id: buyer.id }, data: { isSuspended: false } });
    runOwnerSetup({ MESH_BOOTSTRAP_ADMIN_USERNAME: buyer.username, DATABASE_URL: `  ${process.env.DATABASE_URL}  ` });
    check((await prisma.user.findUniqueOrThrow({ where: { id: buyer.id } })).isAdmin, true, "Owner setup promotes only the configured existing account");
    check(await prisma.user.count({ where: { isAdmin: true } }), 1, "Other accounts retain their roles");
    check(await prisma.adminLog.count({ where: { action: "bootstrap_owner_admin", adminId: buyer.id } }), 1, "Owner setup records the change atomically");
    runOwnerSetup({ MESH_BOOTSTRAP_ADMIN_USERNAME: buyer.username });
    check(await prisma.adminLog.count({ where: { action: "bootstrap_owner_admin" } }), 1, "Rebuilds are idempotent");
    assert.throws(() => runOwnerSetup({ MESH_BOOTSTRAP_ADMIN_USERNAME: recipient.username })); checks++;
    await prisma.user.update({ where: { id: buyer.id }, data: { isAdmin: false } });
    assert.throws(() => runOwnerSetup({ MESH_BOOTSTRAP_ADMIN_USERNAME: recipient.username })); checks++;
    check(await prisma.user.count({ where: { isAdmin: true } }), 0, "A completed bootstrap cannot be reused after role revocation");
    const invalidDatabase = "unsupported-audit-fixture://sentinel-connection-url";
    const invalidToken = "sentinel-token-must-stay-private";
    const failedSetup = spawnSync(process.execPath, ["scripts/bootstrap-owner-admin.mjs"], {
      env: { ...process.env, VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "main", MESH_BOOTSTRAP_ADMIN_USERNAME: buyer.username, DATABASE_URL: invalidDatabase, DATABASE_AUTH_TOKEN: invalidToken },
      encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    });
    check(failedSetup.status, 1, "Invalid database configuration fails owner setup");
    const failedSetupOutput = `${failedSetup.stdout}${failedSetup.stderr}`.trim();
    check(failedSetupOutput, "[owner-setup] Database operation failed. Check the connection configuration; credential details have been withheld.", "Database errors expose only the fixed diagnostic");
    check(failedSetupOutput.includes(invalidDatabase) || failedSetupOutput.includes(invalidToken), false, "Owner setup errors never echo connection URLs or tokens");
    console.log(`launch behavior: ${checks} assertions passed (isolated database; mocked payment transport)`);
  } finally {
    await prisma.$disconnect();
    rmSync(directory, { recursive: true, force: true });
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
