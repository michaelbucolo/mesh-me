#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

// This suite signs in and changes a fixture's device preferences. Never point
// it at a hosted service, or allow production credentials into its reports.
const base = new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");
assert(["localhost", "127.0.0.1", "[::1]"].includes(base.hostname), "Browser release checks require a loopback server");
assert(base.protocol === "http:" && !base.username && !base.password, "Use a local HTTP server without URL credentials");
assert(base.pathname === "/" && !base.search && !base.hash, "Use an origin, not a page URL");
assert(process.env.DATABASE_URL?.startsWith("file:"), "A disposable file database is required");
assert(!process.env.DATABASE_AUTH_TOKEN && !process.env.VERCEL, "Hosted credentials and deployments are forbidden");
assert(process.env.MESH_BROWSER_FIXTURE === "local-seed", "Explicit local-seed fixture acknowledgement is required");
const engine = process.env.MESH_BROWSER || "chromium";
assert(["chromium", "webkit"].includes(engine), "Unsupported browser engine");
const playwright = await import("playwright");
const browser = await playwright[engine].launch();
const output = path.resolve("browser-results", engine);
await fs.mkdir(output, { recursive: true });
const results = [];
const runtimeErrors = [];
const origin = base.origin;
const viewports = [
  ["small-phone", { width: 320, height: 568 }],
  ["phone", { width: 390, height: 844 }],
  ["tablet", { width: 820, height: 1180 }],
  ["desktop", { width: 1440, height: 920 }],
];
const routes = ["/mesh", "/feed", "/flow", "/messages", "/notifications", "/profile/jordandev", "/settings", "/privacy-controls", "/connected-accounts", "/meshpro", "/search", "/communities", "/saved", "/analytics", "/meshimap"];

function observe(page, label) {
  page.on("pageerror", (error) => runtimeErrors.push({ label, route: new URL(page.url()).pathname, message: error.message }));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (/Permissions policy violation/.test(text)) return; // Intentionally disabled device features.
    const source = message.location().url;
    // A third-party fixture image being unavailable is not an app exception.
    // First-party resource errors and every JavaScript exception still fail.
    if (/Failed to load resource/.test(text) && source && !source.startsWith(origin)) return;
    runtimeErrors.push({ label, route: new URL(page.url()).pathname, message: text });
  });
}

async function check(label, page, run) {
  const start = Date.now();
  try {
    await run();
    results.push({ label, status: "pass", durationMs: Date.now() - start });
  } catch (error) {
    results.push({ label, status: "fail", error: error.message, durationMs: Date.now() - start });
  }
  await page.screenshot({ path: path.join(output, `${label.replace(/[^a-z0-9-]/gi, "-")}.png`), animations: "disabled" }).catch(() => {});
  const result = results.at(-1);
  console.log(`[${result.status.toUpperCase()}] ${label}${result.error ? `: ${result.error}` : ""}`);
}

async function layout(page) {
  const sizes = await page.evaluate(() => {
    const scroller = document.querySelector(".mesh-content");
    return {
      width: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      contentWidth: scroller?.clientWidth,
      contentScrollWidth: scroller?.scrollWidth,
    };
  });
  assert(sizes.documentWidth <= sizes.width + 2, `Document overflows: ${JSON.stringify(sizes)}`);
  if (sizes.contentWidth) assert(sizes.contentScrollWidth <= sizes.contentWidth + 2, `Content overflows: ${JSON.stringify(sizes)}`);
}

async function visit(page, route, authenticated = false) {
  const response = await page.goto(`${origin}${route}`, { waitUntil: "domcontentloaded", timeout: 45000 });
  assert(response && response.status() < 400, `${route}: HTTP ${response?.status()}`);
  if (authenticated) {
    await page.locator("#mesh-main-content").waitFor({ timeout: 30000 });
    await page.waitForFunction(() => {
      const content = document.querySelector(".mesh-content");
      return content && !content.querySelector(".paper-wait-route") && (content.textContent.trim().length > 10 || content.querySelector("canvas,svg"));
    }, { timeout: 30000 });
    assert.equal(new URL(page.url()).pathname, route, `${route} redirected instead of rendering its requested surface`);
  } else if (route === "/login" || route === "/signup") {
    await page.locator('[data-entry-ready="true"]').waitFor({ timeout: 30000 });
  }
  // Let layout/paint commit without waiting for networkidle: presence and
  // media can legitimately keep a social application's network busy.
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const body = await page.locator("body").innerText();
  assert(!/Application error|Unhandled Runtime Error|Something went wrong/i.test(body), `${route} rendered an error boundary`);
  await layout(page);
}

try {
  // Exercise the actual password flow and secure session cookie, not a
  // fabricated database session. The fixture is an ordinary, non-admin user.
  const loginContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const login = await loginContext.newPage();
  observe(login, "sign-in");
  await check("real-sign-in", login, async () => {
    await login.goto(`${origin}/login?next=%2Ffeed`, { waitUntil: "domcontentloaded" });
    await login.locator('[data-entry-ready="true"]').waitFor();
    await login.getByTestId("entry-identity-input").fill("jordandev");
    await login.getByTestId("entry-continue-button").click();
    const form = login.getByTestId("entry-password-form");
    await form.waitFor();
    await form.locator('input[type="password"]').fill(process.env.SEED_USER_PASSWORD || "password123");
    await form.locator('button[type="submit"]').click();
    await login.waitForURL(`${origin}/feed`, { timeout: 45000 });
    await login.locator("#mesh-main-content").waitFor();
    const cookie = (await loginContext.cookies()).find((item) => item.name === "__Host-mesh_session");
    assert(cookie?.secure && cookie.httpOnly && cookie.path === "/" && cookie.sameSite === "Lax", "Production-mode secure session cookie missing");
    await layout(login);
  });
  assert(results.at(-1).status === "pass", "Real sign-in failed; authenticated coverage cannot be claimed");
  const session = await loginContext.storageState(); // Memory only: never upload cookies or credentials.
  await loginContext.close();

  for (const [label, viewport] of viewports) {
    const guestContext = await browser.newContext({ viewport, reducedMotion: "reduce", isMobile: viewport.width < 500 });
    const guest = await guestContext.newPage();
    observe(guest, `${label}-guest`);
    await check(`${label}-entry`, guest, async () => {
      await visit(guest, "/login");
      await guest.getByTestId("entry-open-signup-button").click();
      await guest.getByTestId("entry-signup-form").waitFor();
      await layout(guest);
      await guest.getByText("I already have an account", { exact: true }).click();
      await guest.getByTestId("entry-identity-input").waitFor();
      await guest.getByRole("button", { name: "Forgot password", exact: true }).click();
      await guest.getByRole("heading", { name: /reset|password|access|recover/i }).waitFor();
      await layout(guest);
    });
    await check(`${label}-guest-explore`, guest, () => visit(guest, "/explore"));
    await check(`${label}-protected-route`, guest, async () => {
      await guest.goto(`${origin}/messages`, { waitUntil: "domcontentloaded" });
      await guest.waitForURL((url) => url.pathname === "/login");
      assert.equal(new URL(guest.url()).searchParams.get("next"), "/messages");
    });
    await guestContext.close();

    const context = await browser.newContext({ viewport, reducedMotion: "reduce", isMobile: viewport.width < 500, storageState: session });
    const page = await context.newPage();
    observe(page, label);
    for (const route of routes) await check(`${label}${route.replaceAll("/", "-")}`, page, () => visit(page, route, true));
    if (label === "desktop") {
      await check("desktop-theme-persistence", page, async () => {
        await visit(page, "/settings", true);
        await page.getByRole("button", { name: "Switch to light theme", exact: true }).click();
        await page.waitForFunction(() => document.documentElement.classList.contains("light"));
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => document.documentElement.classList.contains("light"));
        await layout(page);
      });
    }
    await context.close();
  }
} catch (error) {
  results.push({ label: "suite", status: "fail", error: error.message });
} finally {
  await browser.close();
  const report = { engine, passed: results.filter((row) => row.status === "pass").length, failed: results.filter((row) => row.status === "fail").length, results, runtimeErrors };
  await fs.writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (report.failed || runtimeErrors.length) process.exitCode = 1;
}
