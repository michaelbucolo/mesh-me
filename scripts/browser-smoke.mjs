#!/usr/bin/env node

import fs from "node:fs";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import process from "node:process";

const args = new Set(process.argv.slice(2));
const jsonMode = args.has("--json");
const headed = args.has("--headed");

loadLocalEnvFiles();

const explicitBaseUrl = process.argv.find((arg) => arg.startsWith("--base-url="))?.slice("--base-url=".length);
const baseUrl = stripTrailingSlash(explicitBaseUrl || process.env.MESH_DIAGNOSTICS_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");

const results = [];
const errors = [];

const { chromium } = await importPlaywright();
const { createClient } = await import("@libsql/client");
const client = createClient({
  url: process.env.DATABASE_URL || "file:./prisma/dev.db",
  authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
});
const browser = await chromium.launch(browserLaunchOptions());

try {
  const knownUser = await findKnownUser();
  await runPublicEntryChecks(knownUser);
  if (knownUser) {
    await runAuthenticatedAppChecks(knownUser);
  } else {
    results.push({ phase: "authenticated-app", status: "skip", evidence: "No local user found for authenticated route smoke checks" });
  }
} finally {
  await browser.close();
}

if (jsonMode) {
  console.log(JSON.stringify({ ok: errors.length === 0, baseUrl, errors, results }, null, 2));
} else {
  printReport();
}

if (errors.length > 0) process.exit(1);

async function importPlaywright() {
  const require = createRequire(import.meta.url);
  try {
    return require("playwright");
  } catch (error) {
    console.error("Playwright is required for browser smoke tests.");
    console.error("Install it in this repo or run with a NODE_PATH that points to an existing Playwright install.");
    console.error(`Original error: ${error.message}`);
    process.exit(1);
  }
}

function browserLaunchOptions() {
  const options = { headless: !headed };
  const candidates = [
    process.env.BROWSER_EXECUTABLE_PATH,
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  ].filter(Boolean);

  const executablePath = candidates.find((candidate) => fs.existsSync(candidate));
  if (executablePath) options.executablePath = executablePath;
  return options;
}

function loadLocalEnvFiles() {
  if (process.env.NODE_ENV === "production") return;
  for (const filename of [".env.local", ".env"]) {
    if (!fs.existsSync(filename)) continue;
    const lines = fs.readFileSync(filename, "utf8").split(/\r?\n/);
    for (const line of lines) {
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

async function findKnownUser() {
  try {
    const onboarded = await client.execute("select id, username, email from User where onboarded = 1 order by createdAt asc limit 1");
    if (onboarded.rows.length) return onboarded.rows[0];
    const anyUser = await client.execute("select id, username, email from User order by createdAt asc limit 1");
    return anyUser.rows[0] || null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    results.push({
      phase: "database-fixture",
      status: "skip",
      evidence: `Could not read fixture user: ${message}`,
    });
    return null;
  }
}

async function runPublicEntryChecks(knownUser) {
  const viewports = [
    ["desktop", { width: 1440, height: 920, isMobile: false }],
    ["tablet", { width: 820, height: 1180, isMobile: false }],
    ["mobile", { width: 390, height: 844, isMobile: true }],
  ];

  for (const [label, viewport] of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      isMobile: viewport.isMobile,
      // Decorative entry animations render in software in CI and can starve
      // the page; run the smoke the way reduced-motion users experience it.
      reducedMotion: "reduce",
    });
    const page = await newObservedPage(context, label);
    try {
      await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
      // Hydration markers are a more reliable readiness signal than
      // `networkidle` in a live app with long-lived/prefetched requests.
      await page.waitForSelector("[data-testid=\"entry-identity-input\"]", { timeout: 45000 });
      await page.waitForSelector("[data-entry-ready=\"true\"]", { timeout: 45000 });
      await assertNoOverflow(page, `${label} login initial`);
      await assertText(page, "Who are you?", `${label} login heading`);

      const email = `browser-smoke-${Date.now()}-${label}@example.com`;
      await page.fill("[data-testid=\"entry-identity-input\"]", email, { timeout: 45000 });
      await page.click("[data-testid=\"entry-continue-button\"]", { timeout: 45000 });
      await page.waitForSelector("[data-testid=\"entry-signup-form\"]", { timeout: 45000 });
      await assertNoOverflow(page, `${label} inline signup`);
      const signupState = await page.evaluate(() => ({
        email: document.querySelector("[data-testid=\"entry-signup-email\"]")?.value || "",
        username: document.querySelector("[data-testid=\"entry-signup-username\"]")?.value || "",
        hasButton: Boolean(document.querySelector("[data-testid=\"entry-create-account-button\"]")),
      }));
      assert(signupState.email === email, `${label} signup did not prefill email`);
      assert(signupState.username.length >= 3, `${label} signup username suggestion missing`);
      assert(signupState.hasButton, `${label} signup button missing`);

      if (knownUser) {
        await page.getByText("I already have an account", { exact: true }).click({ timeout: 45000 });
        await page.waitForSelector("[data-testid=\"entry-identity-input\"]", { timeout: 45000 });
        await page.waitForSelector("[data-entry-ready=\"true\"]", { timeout: 45000 });
        await page.fill("[data-testid=\"entry-identity-input\"]", knownUser.username, { timeout: 45000 });
        await page.click("[data-testid=\"entry-continue-button\"]", { timeout: 45000 });
        await page.waitForSelector("[data-testid=\"entry-password-form\"]", { timeout: 45000 });
        await assertNoOverflow(page, `${label} password`);
      }

      results.push({ phase: "public-entry", viewport: label, status: "pass", evidence: "login, inline signup, and known-user password branch rendered" });
    } catch (error) {
      errors.push(`${label} public entry: ${error.message}`);
      results.push({ phase: "public-entry", viewport: label, status: "fail", evidence: error.message });
    } finally {
      await context.close();
    }
  }
}

async function runAuthenticatedAppChecks(user) {
  const sessionId = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  await client.execute({ sql: "insert into Session (id, userId, expiresAt) values (?, ?, ?)", args: [sessionId, user.id, expiresAt] });

  const routes = [
    "/mesh",
    "/feed",
    "/messages",
    "/analytics",
    "/notifications",
    "/profile",
    "/settings",
    "/privacy-controls",
    "/connected-accounts",
    "/meshpro",
    "/vault",
    "/super-app",
    "/search",
    "/communities",
    "/content-hub",
  ];

  const context = await browser.newContext({ viewport: { width: 1440, height: 920 }, reducedMotion: "reduce" });
  await context.addCookies([
    {
      name: "mesh_session",
      value: sessionId,
      domain: new URL(baseUrl).hostname,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      expires: Math.floor(Date.now() / 1000) + 30 * 60,
    },
  ]);

  const page = await newObservedPage(context, "authenticated");
  try {
    for (const route of routes) {
      await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
      const state = await page.evaluate(() => ({
        path: location.pathname,
        title: document.title,
        textLength: document.body.innerText.length,
        hasAppError: /Application error|Something went wrong|Unhandled Runtime Error/i.test(document.body.innerText),
        overflow: document.documentElement.scrollWidth > window.innerWidth + 2,
      }));
      assert(state.path !== "/login", `${route} redirected to login with test session`);
      assert(!state.hasAppError, `${route} rendered an app error`);
      assert(state.textLength > 20, `${route} rendered too little visible text`);
      assert(!state.overflow, `${route} has horizontal overflow`);
      results.push({ phase: "authenticated-route", route, status: "pass", evidence: `${state.path} rendered (${state.textLength} chars)` });
    }
  } catch (error) {
    errors.push(`authenticated route: ${error.message}`);
    results.push({ phase: "authenticated-route", status: "fail", evidence: error.message });
  } finally {
    await context.close();
    await client.execute({ sql: "delete from Session where id = ?", args: [sessionId] });
  }
}

async function newObservedPage(context, label) {
  const page = await context.newPage();
  page.on("pageerror", (error) => {
    errors.push(`${label} pageerror: ${error.message}`);
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(`${label} console: ${message.text()}`);
    }
  });
  return page;
}

async function assertNoOverflow(page, label) {
  const state = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  assert(state.scrollWidth <= state.innerWidth + 2, `${label} horizontal overflow: ${state.scrollWidth}px > ${state.innerWidth}px`);
}

async function assertText(page, text, label) {
  const found = await page.getByText(text, { exact: false }).count();
  assert(found > 0, `${label} missing text "${text}"`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function printReport() {
  console.log("mesh.me browser smoke report");
  console.log(`Generated at: ${new Date().toISOString()}`);
  console.log(`Base URL: ${baseUrl}`);
  console.log("");
  for (const row of results) {
    console.log(`[${row.status.toUpperCase()}] ${row.phase}${row.viewport ? `:${row.viewport}` : ""}${row.route ? ` ${row.route}` : ""} - ${row.evidence}`);
  }
  if (errors.length) {
    console.log("");
    console.log("Errors:");
    for (const error of errors) console.log(`- ${error}`);
  }
  console.log("");
  console.log(`Passed rows: ${results.filter((row) => row.status === "pass").length}`);
  console.log(`Errors: ${errors.length}`);
}
