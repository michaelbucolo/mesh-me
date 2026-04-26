#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

const read = (relativePath) => {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) return "";
  return fs.readFileSync(fullPath, "utf8");
};

const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));

const checks = [
  {
    phase: "Phase 1: Trust Foundation",
    id: "privacy-enforcement-lib",
    description: "Shared privacy policy enforcement module exists",
    run: () => exists("src/lib/privacy-policy.ts"),
  },
  {
    phase: "Phase 1: Trust Foundation",
    id: "token-encryption",
    description: "Token encryption helpers exist",
    run: () => exists("src/lib/encryption.ts") && exists("src/lib/secret-store.ts"),
  },
  {
    phase: "Phase 1: Trust Foundation",
    id: "two-factor-api",
    description: "2FA API route exists",
    run: () => exists("src/app/api/account/two-factor/route.ts"),
  },
  {
    phase: "Phase 2: Unified Data Model",
    id: "mesh-node-model",
    description: "Prisma schema includes MeshNode model",
    run: () => /model\s+MeshNode\b/.test(read("prisma/schema.prisma")),
  },
  {
    phase: "Phase 2: Unified Data Model",
    id: "mesh-edge-model",
    description: "Prisma schema includes MeshEdge model",
    run: () => /model\s+MeshEdge\b/.test(read("prisma/schema.prisma")),
  },
  {
    phase: "Phase 2: Unified Data Model",
    id: "synced-content-model",
    description: "Prisma schema includes SyncedContent model",
    run: () => /model\s+SyncedContent\b/.test(read("prisma/schema.prisma")),
  },
  {
    phase: "Phase 2: Unified Data Model",
    id: "platform-permission-model",
    description: "Prisma schema includes PlatformPermission model",
    run: () => /model\s+PlatformPermission\b/.test(read("prisma/schema.prisma")),
  },
  {
    phase: "Phase 3: Analytics Control Center",
    id: "analytics-page",
    description: "Analytics app page exists",
    run: () => exists("src/app/(app)/analytics/page.tsx"),
  },
  {
    phase: "Phase 3: Analytics Control Center",
    id: "data-controls-api",
    description: "Data controls API exists",
    run: () => exists("src/app/api/data-controls/route.ts"),
  },
  {
    phase: "Phase 4: Mesh and Feed Over Unified Data",
    id: "mesh-page",
    description: "Mesh page exists",
    run: () => exists("src/app/(app)/mesh/page.tsx"),
  },
  {
    phase: "Phase 4: Mesh and Feed Over Unified Data",
    id: "feed-page",
    description: "Feed page exists",
    run: () => exists("src/app/(app)/feed/page.tsx"),
  },
  {
    phase: "Phase 5: MeChat and Group Sessions",
    id: "messages-page",
    description: "Messages area exists",
    run: () => exists("src/app/(app)/messages/page.tsx"),
  },
  {
    phase: "Phase 5: MeChat and Group Sessions",
    id: "mechat-sessions-api",
    description: "MeChat sessions API exists",
    run: () => exists("src/app/api/mechat/sessions/route.ts"),
  },
  {
    phase: "Phase 6: Meshi",
    id: "meshi-engine",
    description: "Meshi engine module exists",
    run: () => exists("src/lib/meshi-engine.ts"),
  },
  {
    phase: "Phase 6: Meshi",
    id: "meshi-chat-api",
    description: "Meshi chat API exists",
    run: () => exists("src/app/api/meshi/chat/route.ts"),
  },
  {
    phase: "Phase 7: Mobile and Notification Hub",
    id: "native-modules",
    description: "Native integration modules exist",
    run: () => exists("src/lib/native/index.ts") && exists("capacitor.config.ts"),
  },
  {
    phase: "Phase 7: Mobile and Notification Hub",
    id: "notifications-page",
    description: "Notifications page exists",
    run: () => exists("src/app/(app)/notifications/page.tsx"),
  },
  {
    phase: "Phase 8: Super-App Replacement Readiness",
    id: "super-app-page",
    description: "Super-app dashboard exists",
    run: () => exists("src/app/(app)/super-app/page.tsx"),
  },
  {
    phase: "Phase 8: Super-App Replacement Readiness",
    id: "migration-plan-api",
    description: "Migration plan API exists",
    run: () => exists("src/app/api/super-app/migration-plan/route.ts"),
  },
  {
    phase: "Phase 8: Super-App Replacement Readiness",
    id: "readiness-api",
    description: "Readiness API exists",
    run: () => exists("src/app/api/super-app/readiness/route.ts"),
  },
];

const byPhase = new Map();
for (const check of checks) {
  const passed = safeRun(check.run);
  const row = { ...check, passed };
  if (!byPhase.has(check.phase)) byPhase.set(check.phase, []);
  byPhase.get(check.phase).push(row);
}

let total = 0;
let passedTotal = 0;

console.log("mesh.me engineering roadmap readiness");
console.log(`Generated at: ${new Date().toISOString()}\n`);

for (const [phase, phaseChecks] of byPhase.entries()) {
  const phasePassed = phaseChecks.filter((c) => c.passed).length;
  total += phaseChecks.length;
  passedTotal += phasePassed;

  const percent = Math.round((phasePassed / phaseChecks.length) * 100);
  console.log(`${phase} — ${phasePassed}/${phaseChecks.length} (${percent}%)`);

  for (const check of phaseChecks) {
    const icon = check.passed ? "✓" : "✗";
    console.log(`  [${icon}] ${check.id}: ${check.description}`);
  }

  console.log("");
}

const overall = Math.round((passedTotal / total) * 100);
console.log(`Overall completion signal: ${passedTotal}/${total} (${overall}%)`);

process.exit(0);

function safeRun(fn) {
  try {
    return Boolean(fn());
  } catch {
    return false;
  }
}
