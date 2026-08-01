#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const packageJson = readJson("package.json");
const tsconfig = readJson("tsconfig.json");
const checks = [];

function relativePath(...segments) {
  return path.join(root, ...segments);
}

function exists(...segments) {
  return fs.existsSync(relativePath(...segments));
}

function read(...segments) {
  const filePath = relativePath(...segments);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function readJson(file) {
  const filePath = relativePath(file);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function addCheck(group, id, description, run) {
  checks.push({ group, id, description, run });
}

function hasDependency(name) {
  return Boolean(packageJson.dependencies?.[name] || packageJson.devDependencies?.[name]);
}

function getEnvExampleKeys() {
  return new Set(
    read(".env.example")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => line.slice(0, line.indexOf("=")).trim()),
  );
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertFiles(files) {
  const missing = files.filter((file) => !exists(...file.split("/")));
  assert(missing.length === 0, `Missing files: ${missing.join(", ")}`);
}

function assertDeps(deps) {
  const missing = deps.filter((dep) => !hasDependency(dep));
  assert(missing.length === 0, `Missing package dependencies: ${missing.join(", ")}`);
}

function assertEnvKeys(keys) {
  const envKeys = getEnvExampleKeys();
  const missing = keys.filter((key) => !envKeys.has(key));
  assert(missing.length === 0, `Missing .env.example keys: ${missing.join(", ")}`);
}

addCheck("Framework", "next-app-router", "Next.js App Router foundation exists", () => {
  assertDeps(["next", "react", "react-dom"]);
  assertFiles([
    "src/app/layout.tsx",
    "src/app/page.tsx",
    "src/app/globals.css",
    "src/proxy.ts",
    "next.config.ts",
  ]);
});

addCheck("TypeScript", "typescript-config", "TypeScript strict project config is present", () => {
  assertDeps(["typescript", "@types/node", "@types/react", "@types/react-dom"]);
  assert(tsconfig.compilerOptions?.strict === true, "tsconfig strict mode must stay enabled");
  assert(tsconfig.compilerOptions?.paths?.["@/*"]?.includes("./src/*"), "tsconfig must keep @/* mapped to ./src/*");
  assert(tsconfig.include?.some((entry) => entry.includes(".next")), "tsconfig must include generated Next.js types");
});

addCheck("Styling", "tailwind-v4", "Tailwind CSS v4 PostCSS setup exists", () => {
  assertDeps(["tailwindcss", "@tailwindcss/postcss"]);
  const postcssConfig = read("postcss.config.mjs");
  const globals = read("src", "app", "globals.css");
  assert(postcssConfig.includes("@tailwindcss/postcss"), "postcss.config.mjs must use @tailwindcss/postcss");
  assert(globals.includes("@import \"tailwindcss\""), "globals.css must import Tailwind CSS");
});

addCheck("Database", "prisma-libsql", "Prisma and libSQL database foundation exists", () => {
  assertDeps(["prisma", "@prisma/client", "@prisma/adapter-libsql", "@libsql/client"]);
  assertFiles(["prisma.config.ts", "prisma/schema.prisma", "src/lib/prisma.ts"]);
  const schema = read("prisma", "schema.prisma");
  const prismaClient = read("src", "lib", "prisma.ts");
  assert(schema.includes('provider = "sqlite"'), "Prisma datasource provider must remain sqlite for libSQL");
  assert(schema.includes('output   = "../src/generated/prisma"'), "Prisma client output must target src/generated/prisma");
  assert(prismaClient.includes("PrismaLibSql"), "src/lib/prisma.ts must use PrismaLibSql adapter");
});

addCheck("Database", "core-models", "Core social and identity models exist", () => {
  const schema = read("prisma", "schema.prisma");
  const requiredModels = [
    "model User",
    "model Session",
    "model EmailVerificationToken",
    "model UserNotificationPreference",
    "model Post",
    "model MessageThread",
    "model ConnectedAccount",
    "model MeshNode",
    "model MeshEdge",
    "model PlatformPermission",
  ];
  const missing = requiredModels.filter((model) => !schema.includes(model));
  assert(missing.length === 0, `Missing Prisma models: ${missing.join(", ")}`);
});

addCheck("Environment", "env-template", "Environment template covers required app, auth, database, billing, and OAuth keys", () => {
  assertFiles([".env.example"]);
  assertEnvKeys([
    "DATABASE_URL",
    "DATABASE_AUTH_TOKEN",
    "AUTH_SECRET",
    "APP_DATA_ENCRYPTION_KEY",
    "NEXT_PUBLIC_APP_URL",
    "MESH_DIAGNOSTICS_BASE_URL",
    "EMAIL_VERIFICATION_FROM_EMAIL",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "TWITTER_CLIENT_ID",
    "TWITTER_CLIENT_SECRET",
    "DISCORD_CLIENT_ID",
    "DISCORD_CLIENT_SECRET",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_MONTHLY_PRICE_ID",
    "STRIPE_YEARLY_PRICE_ID",
  ]);
});

addCheck("Routing", "public-routes", "Public route shell exists", () => {
  assertFiles([
    "src/app/login/page.tsx",
    "src/app/signup/page.tsx",
    "src/app/reset-password/page.tsx",
    "src/app/verify-email/page.tsx",
    "src/app/privacy/page.tsx",
    "src/app/terms/page.tsx",
    "src/app/not-found.tsx",
    "src/app/error.tsx",
    "src/app/global-error.tsx",
  ]);
});

addCheck("Routing", "app-routes", "Authenticated app routes exist", () => {
  assertFiles([
    "src/app/(app)/layout.tsx",
    "src/app/(app)/mesh/page.tsx",
    "src/app/(app)/feed/page.tsx",
    "src/app/(app)/messages/page.tsx",
    // /analytics is not a page: it is a permanent alias handled by
    // next.config redirects(). It used to be a server component that called
    // redirect(), which rendered the whole route and only then threw — and
    // during the initial RSC render that made Next's own app-router change its
    // hook count between renders (React #310) on every visit.
    "src/app/(app)/search/page.tsx",
    "src/app/(app)/notifications/page.tsx",
    "src/app/(app)/profile/page.tsx",
    "src/app/(app)/settings/page.tsx",
    "src/app/(app)/account/delete/page.tsx",
  ]);
});

addCheck("Routing", "redirect-aliases-in-config", "URL aliases redirect in config, not by rendering a page", () => {
  // A `page.tsx` whose entire body is `redirect(...)` renders the route —
  // layout, client boundary and all — and only then throws. Doing that during
  // the initial RSC render made Next's own app-router change its hook count
  // between renders: "Rendered more hooks than during the previous render"
  // (React #310), on both hard and soft navigation, every single visit. The
  // stack was entirely inside next/dist/client/components/app-router.js, with
  // nothing of ours in it, and the destinations were clean visited directly.
  //
  // next.config `redirects()` answers at the routing layer before React renders
  // anything, and issues a real 308. Aliases belong there.
  const offenders = [];

  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (entry.name !== "page.tsx") continue;
      const body = fs
        .readFileSync(full, "utf8")
        // Drop comments, so prose about redirect() is not a violation of it.
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/[^\n]*$/gm, "");
      if (!/\bredirect\s*\(/.test(body)) continue;
      // Only flag pages that do NOTHING but redirect. A page that redirects
      // conditionally — unauthenticated, not onboarded, wrong owner — is doing
      // real work and must stay a page.
      const doesRealWork = /\breturn\s*\(|<[A-Z]|\bawait\b|\bif\s*\(/.test(body);
      if (!doesRealWork) offenders.push(path.relative(root, full));
    }
  };
  walk(relativePath("src", "app"));

  assert(
    offenders.length === 0,
    `These pages exist only to redirect and belong in next.config redirects(): ${offenders.join(", ")}. ` +
      "Rendering a route in order to throw a redirect triggers React #310 in Next's app-router.",
  );

  return "no redirect-only pages; URL aliases live in next.config";
});

// The HTTP surface the app genuinely needs. Keep this to endpoints a client
// actually calls: three entries here — /api/auth/platforms,
// /api/account/email-verification and /api/feed — were endpoints NOTHING called,
// so this check was pinning dead code in place and would have failed anyone who
// tried to remove it. A foundation check that asserts the existence of an
// unreachable endpoint is enforcing the opposite of a foundation.
//
// The first two have no HTTP surface at all by design: the connected-accounts
// page resolves platforms server-side, and email verification goes through the
// `requestEmailVerification` server action the settings UI calls directly.
// The feed's real surface is /api/feed/paginated, which the timeline client
// fetches for page two onward.
addCheck("Routing", "api-routes", "Core API routes exist", () => {
  assertFiles([
    "src/app/api/health/route.ts",
    "src/app/api/auth/logout/route.ts",
    "src/app/api/feed/paginated/route.ts",
    "src/app/api/mesh/route.ts",
    "src/app/api/meshi/chat/route.ts",
    "src/app/api/messages/route.ts",
    "src/app/api/search/route.ts",
    "src/app/api/stripe/checkout/route.ts",
    "src/app/api/stripe/webhook/route.ts",
  ]);
});

addCheck("Tooling", "scripts", "Foundation scripts and validation scripts are wired", () => {
  assert(packageJson.scripts?.dev?.includes("next dev"), "npm run dev must run next dev");
  assert(packageJson.scripts?.build?.includes("prisma generate"), "npm run build must generate Prisma client before Next build");
  assert(packageJson.scripts?.lint?.includes("eslint"), "npm run lint must run ESLint");
  assert(packageJson.scripts?.check?.includes("foundation:check"), "npm run check must include foundation:check");
  assert(packageJson.scripts?.["foundation:check"]?.includes("foundation-check.mjs"), "foundation:check script must run scripts/foundation-check.mjs");
});

let currentGroup = "";
const failures = [];

for (const check of checks) {
  if (check.group !== currentGroup) {
    currentGroup = check.group;
    console.log(`\n${currentGroup}`);
  }

  try {
    check.run();
    console.log(`  PASS ${check.id} - ${check.description}`);
  } catch (error) {
    failures.push({ check, error });
    console.log(`  FAIL ${check.id} - ${error instanceof Error ? error.message : String(error)}`);
  }
}

console.log(`\nFoundation checks: ${checks.length}`);
console.log(`Passed: ${checks.length - failures.length}`);
console.log(`Failed: ${failures.length}`);

if (failures.length > 0) {
  process.exit(1);
}
