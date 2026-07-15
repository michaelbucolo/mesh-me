#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { performance } from "node:perf_hooks";
import { createClient } from "@libsql/client";

loadLocalEnvFiles();

const args = new Set(process.argv.slice(2));
const jsonMode = args.has("--json");
const baseUrl = stripTrailingSlash(
  process.argv.find((arg) => arg.startsWith("--base-url="))?.slice("--base-url=".length)
    || process.env.MESH_STRESS_BASE_URL
    || process.env.MESH_DIAGNOSTICS_BASE_URL
    || process.env.NEXT_PUBLIC_APP_URL
    || "http://localhost:3000",
);
const rounds = Number(process.argv.find((arg) => arg.startsWith("--rounds="))?.slice("--rounds=".length) || 2);
const concurrency = Number(process.argv.find((arg) => arg.startsWith("--concurrency="))?.slice("--concurrency=".length) || 6);

const deviceProfiles = [
  {
    name: "desktop",
    viewport: "1440x920",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
  },
  {
    name: "ipad",
    viewport: "820x1180",
    userAgent: "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  },
  {
    name: "mobile",
    viewport: "390x844",
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  },
];

const publicRoutes = [
  "/",
  "/login",
  "/signup",
  "/reset-password",
  "/help",
  "/support",
  "/privacy",
  "/terms",
  "/trust",
  "/status",
  "/manifest.webmanifest",
  "/robots.txt",
  "/sitemap.xml",
];

const appRoutes = [
  "/mesh",
  "/flow",
  "/innovation",
  "/messages",
  "/search",
  "/profile",
  "/settings",
  "/notifications",
  "/connected-accounts",
  "/privacy-controls",
  "/account/delete",
  "/billing",
  "/meshpro",
  "/vault",
  "/communities",
  "/content-hub",
  "/feature-requests",
  "/feedback",
  "/super-app",
  "/marketplace",
  "/analytics",
];

const apiRoutes = [
  "/api/health",
  "/api/system-status",
  "/api/trust/status",
  "/api/status",
  "/api/mesh",
  "/api/feed?limit=20",
  "/api/feed/paginated?limit=10",
  "/api/messages",
  "/api/notifications",
  "/api/layout/unread-counts",
  "/api/search?q=mesh",
  "/api/platform-capabilities",
  "/api/connected-accounts",
  "/api/settings",
  "/api/account/sessions",
  "/api/account/alter-egos",
  "/api/vault",
];

const blockers = [];
const warnings = [];
const results = [];
const sessions = [];
const startedAt = performance.now();

const db = createClient({
  url: (process.env.DATABASE_URL || "file:./prisma/dev.db").trim(),
  authToken: normalizeEnvSecret(process.env.DATABASE_AUTH_TOKEN),
});

try {
  const user = await findUser();
  if (!user) throw new Error("No onboarded user exists for authenticated live stress checks.");

  for (const device of deviceProfiles) {
    const sessionId = await createSession(user.id);
    sessions.push(sessionId);
    await runDevice(device, sessionId);
  }

  summarize();
} finally {
  await cleanupSessions();
  db.close();
}

function loadLocalEnvFiles() {
  for (const filename of [".env.local", ".env"]) {
    const filePath = path.join(process.cwd(), filename);
    if (!fs.existsSync(filePath)) continue;

    for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separator = trimmed.indexOf("=");
      if (separator <= 0) continue;
      const key = trimmed.slice(0, separator).trim();
      if (process.env[key]) continue;
      let value = trimmed.slice(separator + 1).trim();
      if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[key] = value.replace(/\\n/g, "\n");
    }
  }
}

function normalizeEnvSecret(value) {
  return value?.replace(/\\n/g, "\n").trim();
}

function stripTrailingSlash(value) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

async function findUser() {
  const result = await db.execute("select id, username from User where onboarded = 1 and isSuspended = 0 order by createdAt asc limit 1");
  return result.rows[0] || null;
}

async function createSession(userId) {
  const sessionId = crypto.randomBytes(32).toString("hex");
  await db.execute({
    sql: "insert into Session (id, userId, expiresAt, createdAt) values (?, ?, ?, ?)",
    args: [
      sessionId,
      userId,
      new Date(Date.now() + 45 * 60 * 1000).toISOString(),
      new Date().toISOString(),
    ],
  });
  return sessionId;
}

async function cleanupSessions() {
  await Promise.all(sessions.map((sessionId) => (
    db.execute({ sql: "delete from Session where id = ?", args: [sessionId] }).catch(() => {})
  )));
}

async function runDevice(device, sessionId) {
  const tasks = [];
  for (let round = 0; round < rounds; round += 1) {
    for (const pathname of publicRoutes) tasks.push({ device, pathname, authenticated: false, round });
    for (const pathname of appRoutes) tasks.push({ device, pathname, authenticated: true, round, sessionId });
    for (const pathname of apiRoutes) tasks.push({ device, pathname, authenticated: pathname !== "/api/health" && pathname !== "/api/system-status" && pathname !== "/api/trust/status", round, sessionId });
  }

  for (let index = 0; index < tasks.length; index += concurrency) {
    await Promise.all(tasks.slice(index, index + concurrency).map(runRequest));
  }
}

async function runRequest(task) {
  const started = performance.now();
  const headers = {
    "user-agent": task.device.userAgent,
    "x-mesh-stress-device": task.device.name,
    "x-mesh-stress-viewport": task.device.viewport,
  };
  if (task.authenticated) {
    headers.cookie = `${baseUrl.startsWith("https://") ? "__Host-mesh_session" : "mesh_session"}=${task.sessionId}`;
  }

  let status = 0;
  let bytes = 0;
  let contentType = "";
  let ok = false;
  let error = null;

  try {
    const response = await fetch(new URL(task.pathname, baseUrl), {
      redirect: "manual",
      headers,
    });
    status = response.status;
    contentType = response.headers.get("content-type") || "";
    const body = await response.arrayBuffer();
    bytes = body.byteLength;
    ok = isExpectedStatus(task.pathname, status, task.authenticated);
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught);
  }

  const ms = Math.round(performance.now() - started);
  const result = { device: task.device.name, route: task.pathname, round: task.round, status, bytes, ms, contentType, ok, error };
  results.push(result);

  if (error) blockers.push(`${task.device.name} ${task.pathname} network error: ${error}`);
  if (!ok) blockers.push(`${task.device.name} ${task.pathname} returned ${status}`);
  if (status >= 500) blockers.push(`${task.device.name} ${task.pathname} server error ${status}`);
  if (bytes > 750_000) warnings.push(`${task.device.name} ${task.pathname} large payload ${formatBytes(bytes)}`);
  if (ms > 5_000) warnings.push(`${task.device.name} ${task.pathname} slow response ${ms}ms`);
}

function isExpectedStatus(pathname, status, authenticated) {
  if (status >= 500) return false;
  if (pathname === "/") return status === 200 || status === 307;
  if (authenticated) return status === 200 || status === 204 || status === 307;
  return status === 200 || status === 307;
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index];
}

function summarize() {
  const routeGroups = new Map();
  for (const result of results) {
    const key = `${result.device} ${result.route}`;
    const existing = routeGroups.get(key) || [];
    existing.push(result);
    routeGroups.set(key, existing);
  }

  const slowest = [...routeGroups.entries()]
    .map(([key, items]) => ({
      key,
      count: items.length,
      p95: percentile(items.map((item) => item.ms), 95),
      maxBytes: Math.max(...items.map((item) => item.bytes)),
      statuses: [...new Set(items.map((item) => item.status))].join(","),
    }))
    .sort((a, b) => b.p95 - a.p95)
    .slice(0, 18);

  const report = {
    ok: blockers.length === 0,
    baseUrl,
    rounds,
    concurrency,
    durationMs: Math.round(performance.now() - startedAt),
    requestCount: results.length,
    blockers: [...new Set(blockers)],
    warnings: [...new Set(warnings)].slice(0, 80),
    slowest,
  };

  if (jsonMode) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`mesh.me live stress report`);
    console.log(`Base URL: ${baseUrl}`);
    console.log(`Requests: ${report.requestCount}`);
    console.log(`Duration: ${report.durationMs}ms`);
    console.log(`Blockers: ${report.blockers.length}`);
    console.log(`Warnings: ${report.warnings.length}`);
    console.log("");
    console.log("Slowest route/device groups:");
    for (const item of slowest) {
      console.log(`  ${item.key} p95=${item.p95}ms max=${formatBytes(item.maxBytes)} statuses=${item.statuses}`);
    }
    if (report.blockers.length) {
      console.log("");
      console.log("Blockers:");
      for (const blocker of report.blockers) console.log(`  - ${blocker}`);
    }
    if (report.warnings.length) {
      console.log("");
      console.log("Warnings:");
      for (const warning of report.warnings.slice(0, 20)) console.log(`  - ${warning}`);
    }
  }

  if (blockers.length) process.exitCode = 1;
}

function formatBytes(value) {
  if (value > 1_000_000) return `${(value / 1_000_000).toFixed(2)} MB`;
  if (value > 1_000) return `${(value / 1_000).toFixed(1)} KB`;
  return `${value} B`;
}
