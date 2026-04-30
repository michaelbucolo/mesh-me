#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

loadLocalEnvFiles();

function loadLocalEnvFiles() {
  if (process.env.NODE_ENV === "production") return;

  for (const filename of [".env.local", ".env"]) {
    const filePath = path.join(root, filename);
    if (!fs.existsSync(filePath)) continue;

    const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex <= 0) continue;

      const key = trimmed.slice(0, separatorIndex).trim();
      if (process.env[key]) continue;

      let value = trimmed.slice(separatorIndex + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      process.env[key] = value;
    }
  }
}

const checks = [
  {
    id: "env-app-url",
    description: "NEXT_PUBLIC_APP_URL is configured",
    severity: "P0",
    run: () => Boolean(process.env.NEXT_PUBLIC_APP_URL),
    fix: "Set NEXT_PUBLIC_APP_URL in production environment variables.",
  },
  {
    id: "env-auth-secret",
    description: "AUTH_SECRET is configured and at least 32 characters",
    severity: "P0",
    run: () => {
      const secret = process.env.AUTH_SECRET || "";
      return secret.length >= 32;
    },
    fix: "Set AUTH_SECRET to a random 32+ character value.",
  },
  {
    id: "env-db-url",
    description: "DATABASE_URL is configured",
    severity: "P0",
    run: () => Boolean(process.env.DATABASE_URL),
    fix: "Set DATABASE_URL for the production database.",
  },
  {
    id: "env-example",
    description: ".env.example exists",
    severity: "P1",
    run: () => fs.existsSync(path.join(root, ".env.example")),
    fix: "Commit a current .env.example so teammates and deploy targets stay aligned.",
  },
  {
    id: "docs-launch-guide",
    description: "LAUNCH-GUIDE.md exists",
    severity: "P1",
    run: () => fs.existsSync(path.join(root, "LAUNCH-GUIDE.md")),
    fix: "Create and maintain LAUNCH-GUIDE.md for deployment instructions.",
  },
  {
    id: "docs-launch-checklist",
    description: "PUBLIC_LAUNCH_MASTER_CHECKLIST.md exists",
    severity: "P1",
    run: () => fs.existsSync(path.join(root, "PUBLIC_LAUNCH_MASTER_CHECKLIST.md")),
    fix: "Create the launch checklist and assign owners.",
  },
  {
    id: "docs-legal-privacy",
    description: "Privacy page source exists",
    severity: "P0",
    run: () => fs.existsSync(path.join(root, "src", "app", "privacy", "page.tsx")),
    fix: "Add a production privacy policy page.",
  },
  {
    id: "docs-legal-terms",
    description: "Terms page source exists",
    severity: "P0",
    run: () => fs.existsSync(path.join(root, "src", "app", "terms", "page.tsx")),
    fix: "Add a production terms page.",
  },
  {
    id: "api-health",
    description: "Health endpoint exists",
    severity: "P0",
    run: () => fs.existsSync(path.join(root, "src", "app", "api", "health", "route.ts")),
    fix: "Create /api/health so uptime checks do not depend on an authenticated route.",
  },
  {
    id: "api-feedback",
    description: "Feedback endpoint exists",
    severity: "P1",
    run: () => fs.existsSync(path.join(root, "src", "app", "api", "feedback", "route.ts")),
    fix: "Create /api/feedback to capture user issues.",
  },
  {
    id: "payments-webhook",
    description: "Stripe webhook endpoint exists",
    severity: "P1",
    run: () => fs.existsSync(path.join(root, "src", "app", "api", "stripe", "webhook", "route.ts")),
    fix: "Add a Stripe webhook handler before monetization launch.",
  },
  {
    id: "seo-robots",
    description: "Robots configuration exists",
    severity: "P1",
    run: () => fs.existsSync(path.join(root, "public", "robots.txt")) || fs.existsSync(path.join(root, "src", "app", "robots.ts")),
    fix: "Add robots.txt or src/app/robots.ts so crawlers get explicit instructions.",
  },
  {
    id: "seo-sitemap",
    description: "Sitemap configuration exists",
    severity: "P1",
    run: () => fs.existsSync(path.join(root, "src", "app", "sitemap.ts")) || fs.existsSync(path.join(root, "public", "sitemap.xml")),
    fix: "Add src/app/sitemap.ts or a static sitemap.xml.",
  },
  {
    id: "security-lib",
    description: "Security library exists",
    severity: "P0",
    run: () => fs.existsSync(path.join(root, "src", "lib", "security.ts")),
    fix: "Implement central security helpers in src/lib/security.ts.",
  },
  {
    id: "auth-lib",
    description: "Auth library exists",
    severity: "P0",
    run: () => fs.existsSync(path.join(root, "src", "lib", "auth.ts")),
    fix: "Implement authentication helpers in src/lib/auth.ts.",
  },
  {
    id: "prisma-schema",
    description: "Prisma schema exists",
    severity: "P0",
    run: () => fs.existsSync(path.join(root, "prisma", "schema.prisma")),
    fix: "Commit schema.prisma and keep migrations in sync.",
  },
  {
    id: "manifest",
    description: "PWA manifest exists",
    severity: "P1",
    run: () => fs.existsSync(path.join(root, "src", "app", "manifest.ts")),
    fix: "Add manifest.ts for installable web app behavior.",
  },
  {
    id: "mobile-icons",
    description: "At least one app icon exists",
    severity: "P1",
    run: () => fs.existsSync(path.join(root, "public", "icons", "icon-192x192.png")),
    fix: "Add PWA icon assets under public/icons.",
  },
];

const severityRank = {
  P0: 0,
  P1: 1,
  P2: 2,
};

checks.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

const rows = checks.map((check) => ({
  ...check,
  passed: safeRun(check.run),
}));

function safeRun(fn) {
  try {
    return Boolean(fn());
  } catch {
    return false;
  }
}

function color(label, value) {
  return `${value}${label}\x1b[0m`;
}

const ANSI = {
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
};

const failures = rows.filter((row) => !row.passed);
const p0Failures = failures.filter((row) => row.severity === "P0");

console.log(`${ANSI.cyan}mesh.me launch readiness report${"\x1b[0m"}`);
console.log(`Generated at: ${new Date().toISOString()}`);
console.log("");

for (const row of rows) {
  const status = row.passed
    ? color("PASS", ANSI.green)
    : row.severity === "P0"
      ? color("FAIL", ANSI.red)
      : color("WARN", ANSI.yellow);

  console.log(`[${status}] (${row.severity}) ${row.id} - ${row.description}`);
  if (!row.passed) {
    console.log(`       Fix: ${row.fix}`);
  }
}

console.log("");
console.log(`Total checks: ${rows.length}`);
console.log(`Passed: ${rows.length - failures.length}`);
console.log(`Failed/Warn: ${failures.length}`);
console.log(`P0 blockers: ${p0Failures.length}`);

if (p0Failures.length > 0) {
  console.error(`\n${ANSI.red}Launch blocked: resolve all P0 checks before public release.\x1b[0m`);
  process.exit(1);
}

if (failures.length > 0) {
  console.warn(`\n${ANSI.yellow}Launch warning: non-P0 checks remain. Proceed only with approval.\x1b[0m`);
  process.exit(0);
}

console.log(`\n${ANSI.green}Launch ready: all checks passed.\x1b[0m`);
