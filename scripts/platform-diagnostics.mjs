#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { performance } from "node:perf_hooks";

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const jsonMode = args.has("--json");
const strictMode = args.has("--strict");
const skipHttp = args.has("--skip-http");
const explicitBaseUrl = process.argv.find((arg) => arg.startsWith("--base-url="))?.slice("--base-url=".length);

loadLocalEnvFiles();

const baseUrl = stripTrailingSlash(explicitBaseUrl || process.env.MESH_DIAGNOSTICS_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");
const startedAt = performance.now();
const results = [];

const ANSI = {
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
  reset: "\x1b[0m",
};

const colorsEnabled = !jsonMode && !process.env.NO_COLOR;

function loadLocalEnvFiles() {
  if (process.env.NODE_ENV === "production") return;

  for (const filename of [".env.local", ".env"]) {
    const filePath = path.join(root, filename);
    if (!fs.existsSync(filePath)) continue;

    for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex <= 0) continue;
      const key = trimmed.slice(0, separatorIndex).trim();
      if (process.env[key]) continue;
      let value = trimmed.slice(separatorIndex + 1).trim();
      if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }
}

function stripTrailingSlash(value) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function read(relativePath) {
  const fullPath = path.join(root, relativePath);
  return fs.existsSync(fullPath) ? fs.readFileSync(fullPath, "utf8") : "";
}

function listFilesRecursive(directory, predicate = () => true) {
  const fullDirectory = path.join(root, directory);
  if (!fs.existsSync(fullDirectory)) return [];

  const files = [];
  const visit = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath);
      } else if (predicate(fullPath)) {
        files.push(fullPath);
      }
    }
  };

  visit(fullDirectory);
  return files;
}

function relativePath(fullPath) {
  return path.relative(root, fullPath).replaceAll(path.sep, "/");
}

function color(value, name) {
  if (!colorsEnabled) return value;
  return `${ANSI[name]}${value}${ANSI.reset}`;
}

async function record(check, status, evidence, details = {}) {
  results.push({
    id: check.id,
    group: check.group,
    severity: check.severity,
    status,
    description: check.description,
    evidence,
    fix: check.fix,
    ...details,
  });
}

async function runCheck(check) {
  const checkStartedAt = performance.now();
  try {
    const output = await check.run();
    const durationMs = Math.round(performance.now() - checkStartedAt);
    if (output?.skip) {
      await record(check, "skip", output.evidence || "Skipped", { durationMs });
      return;
    }
    await record(check, output?.warn ? "warn" : "pass", output?.evidence || "Passed", { durationMs });
  } catch (error) {
    const durationMs = Math.round(performance.now() - checkStartedAt);
    await record(check, "fail", error instanceof Error ? error.message : String(error), { durationMs });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function get(pathname, options = {}) {
  const response = await fetch(new URL(pathname, baseUrl), {
    redirect: options.redirect || "manual",
    method: options.method || "GET",
    headers: options.headers,
    body: options.body,
  });
  return response;
}

async function textResponse(pathname, expectedStatus = 200) {
  const response = await get(pathname, { redirect: "manual" });
  const text = await response.text();
  assert(response.status === expectedStatus, `${pathname} returned ${response.status}, expected ${expectedStatus}`);
  assert(text.length > 100, `${pathname} rendered an unexpectedly small response (${text.length} chars)`);
  return { response, text };
}

async function canReachBaseUrl() {
  if (skipHttp) return false;
  try {
    const response = await fetch(new URL("/api/health", baseUrl), { redirect: "manual" });
    return response.status < 500;
  } catch {
    return false;
  }
}

const httpReachable = await canReachBaseUrl();

const checks = [
  {
    group: "Environment",
    id: "node-runtime",
    severity: "P1",
    description: "Node runtime is modern enough for Next.js diagnostics",
    fix: "Use the bundled Node runtime or Node 20+.",
    run: async () => {
      const major = Number(process.versions.node.split(".")[0]);
      assert(major >= 20, `Node ${process.versions.node} detected; expected Node 20+`);
      return { evidence: `Node ${process.versions.node}` };
    },
  },
  {
    group: "Environment",
    id: "env-database-url",
    severity: "P0",
    description: "DATABASE_URL is configured",
    fix: "Set DATABASE_URL before running app, build, or diagnostics.",
    run: async () => {
      assert(Boolean(process.env.DATABASE_URL), "DATABASE_URL is missing");
      return { evidence: maskConnectionString(process.env.DATABASE_URL) };
    },
  },
  {
    group: "Environment",
    id: "env-auth-secret",
    severity: "P0",
    description: "AUTH_SECRET is at least 32 characters",
    fix: "Set AUTH_SECRET to a random value with at least 32 characters.",
    run: async () => {
      const secret = process.env.AUTH_SECRET || "";
      assert(secret.length >= 32, `AUTH_SECRET length is ${secret.length}; expected 32+`);
      return { evidence: `AUTH_SECRET length ${secret.length}` };
    },
  },
  {
    group: "Environment",
    id: "base-url",
    severity: "P1",
    description: "Diagnostics base URL is set",
    fix: "Set MESH_DIAGNOSTICS_BASE_URL or NEXT_PUBLIC_APP_URL when testing another target.",
    run: async () => ({ evidence: baseUrl }),
  },
  {
    group: "Source",
    id: "core-app-routes",
    severity: "P0",
    description: "Core app pages exist",
    fix: "Restore missing app routes before troubleshooting runtime behavior.",
    run: async () => {
      const required = [
        "src/app/login/page.tsx",
        "src/app/(app)/mesh/page.tsx",
        "src/app/(app)/feed/page.tsx",
        "src/app/(app)/messages/page.tsx",
        // Analytics is a tab on the profile, not a top-level route; /analytics
        // is a permanent alias in next.config redirects().
        "src/app/(app)/profile/page.tsx",
        "src/app/(app)/settings/page.tsx",
      ];
      const missing = required.filter((file) => !exists(file));
      assert(missing.length === 0, `Missing routes: ${missing.join(", ")}`);
      return { evidence: `${required.length} core routes present` };
    },
  },
  {
    group: "Source",
    id: "auth-and-security-surface",
    severity: "P0",
    description: "Auth, proxy, request guard, and security helpers exist",
    fix: "Restore src/lib/auth.ts, src/proxy.ts, src/lib/security.ts, and src/lib/request-guard.ts.",
    run: async () => {
      const required = ["src/lib/auth.ts", "src/proxy.ts", "src/lib/security.ts", "src/lib/request-guard.ts"];
      const missing = required.filter((file) => !exists(file));
      assert(missing.length === 0, `Missing security files: ${missing.join(", ")}`);
      const actionsSource = read("src/lib/actions.ts");
      const schemaSource = read("prisma/schema.prisma");
      const proxySource = read("src/proxy.ts");
      const expectedAuthTokens = [
        "hashPassword",
        "verifyPassword",
        // Account lockout is enforced by the durable, DB-backed
        // checkDurableLockout (durable-rate-limit.ts), called from the login
        // flow in actions.ts — the earlier in-memory checkAccountLockout was
        // replaced by it.
        "checkDurableLockout",
        "requestPasswordReset",
        "resetPassword",
        "requestEmailVerification",
        "verifyEmailToken",
        "model EmailVerificationToken",
        "src/app/api/account/email-verification/route.ts",
      ];
      const joinedSource = `${actionsSource}\n${schemaSource}\n${proxySource}`;
      const missingAuthTokens = expectedAuthTokens.filter((token) => !joinedSource.includes(token) && !exists(...token.split("/")));
      assert(missingAuthTokens.length === 0, `Missing auth hardening markers: ${missingAuthTokens.join(", ")}`);
      return { evidence: `${required.length} security files present with password reset and email verification` };
    },
  },
  {
    group: "Source",
    id: "platform-authorization-catalog",
    severity: "P1",
    description: "Social platform authorization catalog covers OAuth, manual fallback, and permission sync",
    fix: "Restore src/lib/oauth.ts, src/lib/platform-permissions.ts, and /api/auth/platforms.",
    run: async () => {
      const oauthSource = read("src/lib/oauth.ts");
      const permissionSource = read("src/lib/platform-permissions.ts");
      const catalogRoute = read("src/app/api/auth/platforms/route.ts");
      const requiredProviders = ["youtube", "instagram", "twitter", "threads", "facebook", "discord", "tiktok", "soundcloud", "patreon", "dribbble"];
      const missingProviders = requiredProviders.filter((provider) => !oauthSource.includes(`platform: "${provider}"`));
      assert(missingProviders.length === 0, `Missing OAuth providers: ${missingProviders.join(", ")}`);
      assert(permissionSource.includes("syncConnectedAccountPermissions"), "Permission sync helper is missing");
      assert(catalogRoute.includes("missingEnv"), "Authorization diagnostics route is missing configured/missing env reporting");
      return { evidence: `${requiredProviders.length} high-priority OAuth providers configured` };
    },
  },
  {
    group: "Source",
    id: "unified-entry-flow",
    severity: "P1",
    description: "Login page contains unified sign-in/sign-up test hooks",
    fix: "Restore data-testid hooks in MeshEntryExperience so browser smoke tests can diagnose auth entry flows.",
    run: async () => {
      const source = read("src/components/auth/mesh-entry-experience.tsx");
      const required = [
        "entry-identity-input",
        "entry-password-form",
        "entry-signup-form",
        "entry-create-account-button",
      ];
      const missing = required.filter((token) => !source.includes(token));
      assert(missing.length === 0, `Missing test hooks: ${missing.join(", ")}`);
      return { evidence: `${required.length} entry-flow hooks present` };
    },
  },
  {
    group: "Source",
    id: "onboarding-flow",
    severity: "P1",
    description: "Onboarding captures identity, Meshi, privacy, notifications, interface style, and first platform setup",
    fix: "Restore the protected onboarding page, guided client component, and notification preference persistence.",
    run: async () => {
      const page = read("src/app/onboarding/page.tsx");
      const component = read("src/components/onboarding/onboarding-flow.tsx");
      const actions = read("src/lib/actions.ts");
      const schema = read("prisma/schema.prisma");
      const required = [
        "OnboardingFlow",
        'id: "account"',
        'id: "meshi"',
        'id: "privacy"',
        'id: "notifications"',
        'id: "style"',
        'id: "apps"',
        "onboarding-step-${item.id}",
        "completeOnboarding",
        "userNotificationPreference",
        "model UserNotificationPreference",
      ];
      const source = `${page}\n${component}\n${actions}\n${schema}`;
      const missing = required.filter((token) => !source.includes(token));
      assert(missing.length === 0, `Missing onboarding coverage: ${missing.join(", ")}`);
      return { evidence: "Full guided onboarding surface and persistence are present" };
    },
  },
  {
    group: "Source",
    id: "mesh-testability",
    severity: "P1",
    description: "The Mesh has stable testability/accessibility hooks",
    fix: "Keep the Mesh canvas, controls, and diagnostics-visible states accessible to browser tests.",
    run: async () => {
      const source =
        read("src/components/mesh/scene/mesh-surface.tsx") +
        read("src/components/mesh/ui/rail.tsx") +
        read("src/components/mesh/mesh-desktop-chrome.tsx");
      const required = ['data-testid="mesh-scene"', 'data-testid="mesh-canvas"', 'data-testid="mesh-action-bar"', "aria-label", "MeshScene"];
      const missing = required.filter((token) => !source.includes(token));
      assert(missing.length === 0, `Missing Mesh testability markers: ${missing.join(", ")}`);
      return { evidence: "Mesh component exposes stable diagnostics markers" };
    },
  },
  {
    group: "Source",
    id: "api-route-contracts",
    severity: "P0",
    description: "Mutating API routes enforce same-origin protection and keep signed webhook verification separate",
    fix: "Add isSameOriginRequest to mutating API routes. Signed webhook routes must verify their provider signature instead.",
    run: async () => {
      const routeFiles = listFilesRecursive("src/app/api", (file) => file.endsWith(`${path.sep}route.ts`));
      const mutatingMethods = /export\s+async\s+function\s+(POST|PUT|PATCH|DELETE)\b/;
      const missingGuard = [];
      const webhookRoute = "src/app/api/stripe/webhook/route.ts";
      // The Meta signed_request exemption below only holds while the shared
      // helper still performs real HMAC + timing-safe verification — otherwise a
      // stubbed helper would silently pass this P0 gate. Verify it once here so a
      // weakened helper re-flags the routes that rely on it.
      const metaHelperSource = read("src/lib/meta-signed-request.ts");
      const metaHelperVerified = metaHelperSource.includes("createHmac") && metaHelperSource.includes("timingSafeEqual");

      for (const file of routeFiles) {
        const source = fs.readFileSync(file, "utf8");
        if (!mutatingMethods.test(source)) continue;
        const rel = relativePath(file);
        if (rel === webhookRoute) {
          assert(source.includes("stripe.webhooks.constructEvent"), "Stripe webhook must verify signatures with constructEvent");
          continue;
        }
        const signedWebhook = source.includes("verifySignature") && source.includes("timingSafeEqual") && source.includes("createHmac");
        if (signedWebhook) continue;
        // Meta (Facebook/Instagram/Threads) Deauthorize + Data Deletion callbacks
        // are server-to-server POSTs from Meta, so they cannot demand same-origin.
        // They verify Meta's `signed_request` via verifyMetaSignedRequest — trust
        // that exemption only while the helper itself still does HMAC-SHA256 +
        // timingSafeEqual (src/lib/meta-signed-request.ts).
        if (source.includes("verifyMetaSignedRequest")) {
          assert(metaHelperVerified, `${rel} relies on verifyMetaSignedRequest, but src/lib/meta-signed-request.ts no longer does HMAC + timing-safe verification`);
          continue;
        }
        // OAuth callbacks are cross-site by design (Apple returns via form_post),
        // so they cannot demand same-origin proof. Their CSRF protection is
        // validating the returned state against the flow cookie we issued.
        const oauthStateValidated = source.includes("identity_state_") && source.includes("expectedState !== params.state");
        if (oauthStateValidated) continue;
        if (!source.includes("isSameOriginRequest")) missingGuard.push(rel);
      }

      assert(missingGuard.length === 0, `Missing same-origin guards: ${missingGuard.join(", ")}`);
      return { evidence: `${routeFiles.length} API route files scanned` };
    },
  },
  {
    group: "Source",
    id: "external-api-contracts",
    severity: "P0",
    description: "Stripe, platform sync, and platform action endpoints use explicit contracts",
    fix: "Keep Stripe API pinned, validate platform action payloads, and reject local-only source-platform mutations.",
    run: async () => {
      const stripeSource = read("src/lib/stripe.ts");
      const checkoutSource = read("src/app/api/stripe/checkout/route.ts");
      const portalSource = read("src/app/api/stripe/portal/route.ts");
      const webhookSource = read("src/app/api/stripe/webhook/route.ts");
      const validationSource = read("src/lib/api-validation.ts");
      const platformContentSource = read("src/app/api/platform-content/route.ts");
      const syncSource = read("src/app/api/sync/route.ts") + read("src/app/api/connected-accounts/[id]/sync/route.ts");
      const platformSyncSource = read("src/lib/platform-sync.ts");

      assert(stripeSource.includes('apiVersion: "2026-03-25.dahlia"'), "Stripe API version is not pinned to the SDK-supported latest version");
      assert(stripeSource.includes("maxNetworkRetries") && stripeSource.includes("timeout"), "Stripe client retry/timeout config is missing");
      assert(checkoutSource.includes('mode: "subscription"'), "Checkout must use subscription mode for MeshPro");
      assert(portalSource.includes("billingPortal.sessions.create"), "Customer Portal session creation is missing");
      assert(webhookSource.includes("stripe.webhooks.constructEvent") && webhookSource.includes("STRIPE_WEBHOOK_SECRET"), "Stripe webhook signature verification is missing");
      assert(validationSource.includes("VALID_SYNC_TYPES") && validationSource.includes("VALID_PLATFORM_CONTENT_ACTIONS"), "API validation contract helpers are missing");
      assert(platformContentSource.includes("readRequiredString") && platformContentSource.includes("parsePaginationParams") && platformContentSource.includes("isVisibilityValue"), "Platform content endpoint is missing payload or pagination validation");
      assert(syncSource.includes("isSyncType"), "Sync endpoints must validate syncType");
      assert(platformSyncSource.includes("Delete failed - platform may not support this action"), "Platform deletes must not silently remove local data when source deletion fails");
      assert(platformSyncSource.includes("Platform does not support liking or the request failed"), "Platform reactions must confirm source API success");
      return { evidence: "Stripe, sync, and platform action contracts verified" };
    },
  },
  {
    group: "Database",
    id: "database-connectivity",
    severity: "P0",
    description: "Database responds to a direct query",
    fix: "Verify DATABASE_URL, Prisma adapter config, and local libSQL file availability.",
    run: async () => {
      const { createClient } = await import("@libsql/client");
      const client = createClient({
        url: process.env.DATABASE_URL,
        authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
      });
      const response = await client.execute("select 1 as ok");
      assert(Number(response.rows[0]?.ok) === 1, "Database did not return expected select result");
      return { evidence: "select 1 returned ok" };
    },
  },
  {
    group: "Database",
    id: "auth-fixture-user",
    severity: "P1",
    description: "At least one local user exists for authenticated smoke tests",
    fix: "Seed a local user before running authenticated browser smoke tests.",
    run: async () => {
      const { createClient } = await import("@libsql/client");
      const client = createClient({
        url: process.env.DATABASE_URL,
        authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
      });
      const response = await client.execute("select id, username from User limit 1");
      assert(response.rows.length > 0, "No User rows found");
      return { evidence: `Found user ${response.rows[0].username || response.rows[0].id}` };
    },
  },
  {
    group: "HTTP",
    id: "http-server-reachable",
    severity: "P1",
    description: "A running app server is reachable",
    fix: "Run npm run dev or npm run start, then rerun diagnostics.",
    run: async () => {
      if (skipHttp) return { skip: true, evidence: "HTTP checks disabled with --skip-http" };
      assert(httpReachable, `${baseUrl} is not reachable`);
      return { evidence: `${baseUrl} responded` };
    },
  },
  {
    group: "HTTP",
    id: "api-health",
    severity: "P0",
    description: "/api/health returns ok JSON",
    fix: "Check database availability and src/app/api/health/route.ts.",
    run: async () => {
      if (!httpReachable) return { skip: true, evidence: "Server not reachable" };
      const response = await get("/api/health");
      const body = await response.json().catch(() => null);
      assert(response.status === 200, `/api/health returned ${response.status}`);
      assert(body?.ok === true, `/api/health body was ${JSON.stringify(body)}`);
      return { evidence: "200 ok=true" };
    },
  },
  {
    group: "HTTP",
    id: "security-headers",
    severity: "P0",
    description: "Login response includes security headers",
    fix: "Check next.config.ts headers() and src/proxy.ts hardenResponse().",
    run: async () => {
      if (!httpReachable) return { skip: true, evidence: "Server not reachable" };
      const response = await get("/login");
      const required = {
        "content-security-policy": "default-src 'self'",
        "x-frame-options": "DENY",
        "x-content-type-options": "nosniff",
        "referrer-policy": "no-referrer",
        "permissions-policy": "camera=()",
      };
      const missing = [];
      for (const [header, expected] of Object.entries(required)) {
        const value = response.headers.get(header);
        if (!value || !value.includes(expected)) missing.push(header);
      }
      assert(missing.length === 0, `Missing or weak headers: ${missing.join(", ")}`);
      assert(!response.headers.get("permissions-policy")?.includes("bluetooth="), "Permissions-Policy contains the unsupported bluetooth directive");
      return { evidence: Object.keys(required).join(", ") };
    },
  },
  {
    group: "HTTP",
    id: "public-pages",
    severity: "P1",
    description: "Public pages render without authentication",
    fix: "Check the failing public route and shared public shell components.",
    run: async () => {
      if (!httpReachable) return { skip: true, evidence: "Server not reachable" };
      // /roadmap and /vision are NOT here: next.config.ts redirects both to
      // /about with `permanent: true`, so probing them for a 200 reported a
      // permanent P1 warning for behaviour that is intentional. Same staleness
      // as the /api/feedback probe below — a check that can never go green
      // teaches people to scroll past the whole report.
      const routes = ["/", "/login", "/verify-email", "/about", "/features", "/privacy", "/terms", "/trust"];
      const failures = [];
      for (const route of routes) {
        try {
          await textResponse(route, 200);
        } catch (error) {
          failures.push(`${route}: ${error.message}`);
        }
      }
      assert(failures.length === 0, failures.join("; "));
      return { evidence: `${routes.length} public pages returned 200` };
    },
  },
  {
    group: "HTTP",
    id: "protected-page-redirect",
    severity: "P0",
    description: "Protected pages redirect anonymous users to /login",
    fix: "Check protectedPagePrefixes and session cookie validation in src/proxy.ts.",
    run: async () => {
      if (!httpReachable) return { skip: true, evidence: "Server not reachable" };
      const response = await get("/mesh");
      const location = response.headers.get("location") || "";
      assert([302, 303, 307, 308].includes(response.status), `/mesh returned ${response.status}`);
      assert(location.includes("/login"), `/mesh redirect location was ${location || "<empty>"}`);
      assert(location.includes("next=%2Fmesh") || location.includes("next=/mesh"), `/mesh redirect did not preserve next path: ${location}`);
      return { evidence: `${response.status} -> ${location}` };
    },
  },
  {
    group: "HTTP",
    id: "protected-api-auth",
    severity: "P0",
    description: "Protected APIs reject anonymous access",
    fix: "Check protectedApiPrefixes and API auth guards.",
    run: async () => {
      if (!httpReachable) return { skip: true, evidence: "Server not reachable" };
      const response = await get("/api/mesh");
      assert(response.status === 401, `/api/mesh returned ${response.status}, expected 401`);
      return { evidence: "GET /api/mesh returned 401" };
    },
  },
  {
    group: "HTTP",
    id: "mutation-origin-guard",
    severity: "P0",
    description: "Protected mutations reject requests without same-origin proof",
    fix: "Check src/proxy.ts and src/lib/request-guard.ts.",
    run: async () => {
      if (!httpReachable) return { skip: true, evidence: "Server not reachable" };
      // /api/bug-reports, not /api/feedback. The feedback route was deleted in
      // c3803e1 ("no leftover wings") and this probe kept pointing at it, so a
      // P0 that exists to prove the origin guard works was really only proving
      // that a 404 is not a 403. It went unnoticed because the check SKIPS when
      // no server is reachable, which is the usual state in CI.
      //
      // The replacement has to satisfy two conditions, and most guarded routes
      // fail the second: it uses isSameOriginRequest, AND it is not listed in
      // proxy.ts's protectedApiPrefixes — otherwise the proxy answers 401 first
      // and the route's own 403 never runs, so the guard would go untested while
      // the assertion still passed for the wrong reason.
      const response = await get("/api/bug-reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "diagnostics" }),
      });
      assert(response.status === 403, `/api/bug-reports returned ${response.status}, expected 403`);
      return { evidence: "POST /api/bug-reports returned 403 without same-origin headers" };
    },
  },
  {
    group: "HTTP",
    id: "social-images",
    severity: "P1",
    description: "Open Graph and X/Twitter social images render",
    fix: "Check src/app/opengraph-image.tsx and src/app/twitter-image.tsx for ImageResponse-compatible layout styles.",
    run: async () => {
      if (!httpReachable) return { skip: true, evidence: "Server not reachable" };
      const routes = ["/opengraph-image", "/twitter-image"];
      const failures = [];
      for (const route of routes) {
        const response = await get(route);
        const contentType = response.headers.get("content-type") || "";
        const body = await response.arrayBuffer();
        if (response.status !== 200 || !contentType.startsWith("image/png") || body.byteLength < 1_000) {
          failures.push(`${route}: ${response.status} ${contentType || "no content type"} ${body.byteLength} bytes`);
        }
      }
      assert(failures.length === 0, failures.join("; "));
      return { evidence: `${routes.length} social images returned valid PNG responses` };
    },
  },
  {
    group: "HTTP",
    id: "pwa-and-seo",
    severity: "P1",
    description: "PWA and crawler metadata routes respond",
    fix: "Check manifest.webmanifest, robots.txt, and sitemap.xml routes.",
    run: async () => {
      if (!httpReachable) return { skip: true, evidence: "Server not reachable" };
      const routes = ["/manifest.webmanifest", "/robots.txt", "/sitemap.xml"];
      const failures = [];
      for (const route of routes) {
        const response = await get(route);
        if (response.status !== 200) failures.push(`${route}: ${response.status}`);
      }
      assert(failures.length === 0, failures.join("; "));
      return { evidence: `${routes.length} metadata routes returned 200` };
    },
  },
];

for (const check of checks) {
  await runCheck(check);
}

const durationMs = Math.round(performance.now() - startedAt);
const failures = results.filter((row) => row.status === "fail");
const p0Failures = failures.filter((row) => row.severity === "P0");
const warnings = results.filter((row) => row.status === "warn");
const skipped = results.filter((row) => row.status === "skip");

if (jsonMode) {
  console.log(JSON.stringify({
    ok: p0Failures.length === 0 && (!strictMode || failures.length === 0),
    baseUrl,
    durationMs,
    totals: {
      checks: results.length,
      passed: results.filter((row) => row.status === "pass").length,
      failed: failures.length,
      warnings: warnings.length,
      skipped: skipped.length,
      p0Failures: p0Failures.length,
    },
    results,
  }, null, 2));
} else {
  printReport();
}

if (p0Failures.length > 0 || (strictMode && failures.length > 0)) {
  process.exit(1);
}

function printReport() {
  console.log(color("mesh.me diagnostics report", "cyan"));
  console.log(`Generated at: ${new Date().toISOString()}`);
  console.log(`Base URL: ${baseUrl}`);
  console.log("");

  let currentGroup = "";
  for (const row of results) {
    if (row.group !== currentGroup) {
      currentGroup = row.group;
      console.log(color(currentGroup, "cyan"));
    }

    const status =
      row.status === "pass" ? color("PASS", "green")
        : row.status === "skip" ? color("SKIP", "dim")
          : row.status === "warn" ? color("WARN", "yellow")
            : row.severity === "P0" ? color("FAIL", "red")
              : color("WARN", "yellow");

    console.log(`  [${status}] (${row.severity}) ${row.id} - ${row.description}`);
    console.log(`      Evidence: ${row.evidence}`);
    if (row.status === "fail") console.log(`      Next: ${row.fix}`);
  }

  console.log("");
  console.log(`Total checks: ${results.length}`);
  console.log(`Passed: ${results.filter((row) => row.status === "pass").length}`);
  console.log(`Failed: ${failures.length}`);
  console.log(`Warnings: ${warnings.length}`);
  console.log(`Skipped: ${skipped.length}`);
  console.log(`P0 blockers: ${p0Failures.length}`);
  console.log(`Duration: ${durationMs}ms`);

  if (p0Failures.length > 0) {
    console.log("");
    console.log(color("Diagnostics failed: resolve all P0 blockers first.", "red"));
  } else if (failures.length > 0) {
    console.log("");
    console.log(color("Diagnostics completed with non-P0 issues.", "yellow"));
  } else {
    console.log("");
    console.log(color("Diagnostics passed.", "green"));
  }
}

function maskConnectionString(value = "") {
  if (!value) return "<empty>";
  if (value.startsWith("file:")) return value;
  try {
    const parsed = new URL(value);
    if (parsed.password) parsed.password = "***";
    if (parsed.username) parsed.username = "***";
    return parsed.toString();
  } catch {
    return "<configured>";
  }
}
