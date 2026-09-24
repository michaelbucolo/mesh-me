#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

// Real authentication against disposable fixtures only. Production cookies
// keep their Secure/__Host- requirements; the test origin uses loopback TLS.
const base = new URL(process.env.NEXT_PUBLIC_APP_URL || "https://127.0.0.1:3443");
assert.equal(base.origin, "https://127.0.0.1:3443", "Browser release checks require the isolated TLS origin");
assert(!base.username && !base.password && base.pathname === "/" && !base.search && !base.hash, "Use a bare origin");
assert(process.env.DATABASE_URL?.startsWith("file:"), "A disposable file database is required");
assert(!process.env.DATABASE_AUTH_TOKEN && !process.env.VERCEL, "Hosted credentials and deployments are forbidden");
assert.equal(process.env.MESH_BROWSER_FIXTURE, "local-seed", "Explicit local-seed fixture acknowledgement is required");
const engine = process.env.MESH_BROWSER || "chromium";
assert(["chromium", "webkit"].includes(engine), "Unsupported browser engine");
const playwright = await import("playwright");
const browser = await playwright[engine].launch();
const output = path.resolve("browser-results", engine);
await fs.mkdir(output, { recursive: true });
const results = [];
const runtimeErrors = [];
const faultPages = new WeakSet();
const origin = base.origin;
const viewports = [
  ["small-phone", { width: 320, height: 568 }],
  ["phone", { width: 390, height: 844 }],
  ["tablet", { width: 820, height: 1180 }],
  ["desktop", { width: 1440, height: 920 }],
];
const routes = ["/mesh", "/feed", "/flow", "/messages", "/notifications", "/profile/jordandev", "/settings", "/privacy-controls", "/connected-accounts", "/meshpro", "/search", "/communities", "/saved", "/analytics", "/meshimap"];

async function context(options) {
  // This exception trusts only our ephemeral self-signed loopback fixture,
  // never a public/production target (the strict origin guard above runs first).
  const value = await browser.newContext({ ignoreHTTPSErrors: true, ...options });
  value.setDefaultTimeout(15000);
  return value;
}

function observe(page, label) {
  page.on("pageerror", (error) => runtimeErrors.push({ label, route: new URL(page.url()).pathname, message: error.message }));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (/Permissions policy violation/.test(text)) return; // Intentionally disabled device features.
    // WebKit reports this progressive-enhancement advisory as console.error.
    // It does not support Chromium's virtual-keyboard viewport hint.
    if (engine === "webkit" && text === 'Viewport argument key "interactive-widget" not recognized and ignored.') return;
    const source = message.location().url;
    if (/Failed to load resource/.test(text)) {
      if (source && !source.startsWith(origin)) return; // Third-party seed image, not application JavaScript.
      if (faultPages.has(page) && source && new URL(source).pathname === "/login" && /503/.test(text)) return; // Explicitly injected transport failure.
    }
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
    return { width: window.innerWidth, documentWidth: document.documentElement.scrollWidth, contentWidth: scroller?.clientWidth, contentScrollWidth: scroller?.scrollWidth };
  });
  assert(sizes.documentWidth <= sizes.width + 2, `Document overflows: ${JSON.stringify(sizes)}`);
  if (sizes.contentWidth) assert(sizes.contentScrollWidth <= sizes.contentWidth + 2, `Content overflows: ${JSON.stringify(sizes)}`);
}

async function settle(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  // Observe post-hydration effects and deferred client components, not just SSR.
  await page.waitForTimeout(350);
}

async function visit(page, route, authenticated = false) {
  const response = await page.goto(`${origin}${route}`, { waitUntil: "domcontentloaded", timeout: 45000 });
  assert(response && response.status() < 400, `${route}: HTTP ${response?.status()}`);
  if (authenticated) {
    await page.locator("#mesh-main-content").waitFor({ timeout: 30000 });
    await page.waitForFunction(() => {
      const content = document.querySelector(".mesh-content");
      return content && !content.querySelector(".paper-wait-route") && (content.textContent.trim().length > 10 || content.querySelector("canvas,svg"));
    }, null, { timeout: 30000 });
    assert.equal(new URL(page.url()).pathname, route, `${route} redirected instead of rendering its requested surface`);
  } else if (route === "/login" || route === "/signup") {
    await page.locator('[data-entry-ready="true"]').waitFor({ timeout: 30000 });
  }
  await settle(page);
  const body = await page.locator("body").innerText();
  assert(!/Application error|Unhandled Runtime Error|Something went wrong/i.test(body), `${route} rendered an error boundary`);
  await layout(page);
}

async function submitTwiceWithFault(page, form, alertText) {
  let calls = 0;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const matcher = `${origin}/login**`;
  const interceptor = async (route) => {
    const request = route.request();
    if (request.method() !== "POST" || !request.headers()["next-action"]) return route.continue();
    calls += 1;
    await gate;
    await route.fulfill({ status: 503, contentType: "text/plain", body: "Injected local test failure" });
  };
  faultPages.add(page);
  await page.route(matcher, interceptor);
  try {
    // Same-tick submissions exercise the synchronous lock, not just the
    // disabled attribute painted on the next React render.
    await form.evaluate((element) => {
      element.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      element.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await page.waitForFunction(() => document.querySelector('form[aria-busy="true"]'));
    assert(await form.locator('button[type="submit"]').isDisabled(), "Pending submit remained interactive");
    assert(await page.getByRole("button", { name: "Forgot password", exact: true }).isDisabled(), "Pending action could change entry stage");
    release();
    await page.getByRole("alert").filter({ hasText: alertText }).waitFor();
    await settle(page);
    assert.equal(calls, 1, "Repeated submission sent more than one server action");
    assert(!(await form.locator('button[type="submit"]').isDisabled()), "Failed action did not unlock retry");
  } finally {
    release();
    await page.unroute(matcher, interceptor);
    faultPages.delete(page);
  }
}

try {
  const loginContext = await context({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const login = await loginContext.newPage();
  observe(login, "sign-in");
  await visit(login, "/login");
  await check("identity-failure-retry-and-double-submit", login, async () => {
    await login.getByTestId("entry-identity-input").fill("jordandev");
    await submitTwiceWithFault(login, login.locator('form').first(), "Check your connection");
    assert.equal(await login.getByTestId("entry-identity-input").inputValue(), "jordandev", "Identity was lost after failure");
    await login.getByTestId("entry-continue-button").click();
    await login.getByTestId("entry-password-form").waitFor();
  });
  await check("password-failure-retains-details", login, async () => {
    const form = login.getByTestId("entry-password-form");
    await form.getByTestId("entry-password-input").fill(process.env.SEED_USER_PASSWORD || "password123");
    await submitTwiceWithFault(login, form, "Your details are still here");
    assert((await form.getByTestId("entry-password-input").inputValue()) === (process.env.SEED_USER_PASSWORD || "password123"), "Password was lost after transport failure");
  });
  await check("real-sign-in-and-late-autofill", login, async () => {
    await login.goto(`${origin}/login?next=%2Ffeed`, { waitUntil: "domcontentloaded" });
    await login.locator('[data-entry-ready="true"]').waitFor();
    const identity = login.getByTestId("entry-identity-input");
    await identity.fill("stale_autofill_value");
    // Simulate a password manager changing DOM values without onChange.
    await identity.evaluate((element) => { element.value = "jordandev"; element.form.requestSubmit(); });
    const form = login.getByTestId("entry-password-form");
    await form.waitFor();
    const password = form.getByTestId("entry-password-input");
    await password.fill("stale-autofill-value");
    await password.evaluate((element, value) => { element.value = value; element.form.requestSubmit(); }, process.env.SEED_USER_PASSWORD || "password123");
    await login.waitForURL(`${origin}/feed`, { timeout: 45000 });
    await login.locator("#mesh-main-content").waitFor();
    const cookie = (await loginContext.cookies()).find((item) => item.name === "__Host-mesh_session");
    assert(cookie?.secure && cookie.httpOnly && cookie.path === "/" && cookie.sameSite === "Lax", "Production-mode secure session cookie missing");
    await settle(login);
    await layout(login);
  });
  assert(results.at(-1).status === "pass", "Real sign-in failed; authenticated coverage cannot be claimed");
  const session = await loginContext.storageState(); // Memory only: never upload cookies or credentials.
  await loginContext.close();

  for (const [label, viewport] of viewports) {
    const guestContext = await context({ viewport, reducedMotion: "reduce", isMobile: viewport.width < 500 });
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
      await guest.getByRole("heading", { name: "Reset password", exact: true }).waitFor();
      await layout(guest);
    });
    await check(`${label}-guest-explore`, guest, () => visit(guest, "/explore"));
    await check(`${label}-protected-route`, guest, async () => {
      await guest.goto(`${origin}/messages`, { waitUntil: "domcontentloaded" });
      await guest.waitForURL((url) => url.pathname === "/login");
      assert.equal(new URL(guest.url()).searchParams.get("next"), "/messages");
    });
    await guestContext.close();

    const signedIn = await context({ viewport, reducedMotion: "reduce", isMobile: viewport.width < 500, storageState: session });
    const page = await signedIn.newPage();
    observe(page, label);
    for (const route of routes) await check(`${label}${route.replaceAll("/", "-")}`, page, () => visit(page, route, true));
    if (label === "desktop") {
      await check("desktop-theme-persistence", page, async () => {
        await visit(page, "/settings", true);
        await page.getByRole("button", { name: "Switch to light theme", exact: true }).click();
        await page.waitForFunction(() => document.documentElement.classList.contains("light"));
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => document.documentElement.classList.contains("light"));
        await settle(page);
        await layout(page);
        await page.getByRole("button", { name: "Switch to dark theme", exact: true }).waitFor();
      });
      await check("desktop-corrupt-custom-theme-recovery", page, async () => {
        await page.evaluate(() => localStorage.setItem("mesh-theme-custom", '{"accent":null}'));
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.getByRole("button", { name: "Switch to dark theme", exact: true }).waitFor();
        await settle(page);
        assert(!(await page.locator("html").getAttribute("data-custom-theme")), "Invalid custom theme was applied");
        await layout(page);
      });
    }
    await signedIn.close();
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
