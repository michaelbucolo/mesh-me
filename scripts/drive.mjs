/**
 * SHARED BROWSER HARNESS for the redesign audit.
 *
 * Every pitfall below cost a wasted run at some point; none of them are
 * obvious, so they are encoded here rather than re-learned per agent.
 *
 *   - Chromium lives at an explicit path; `playwright` resolves only from the
 *     repo root, so scripts must run with cwd=/home/user/mesh-me.
 *   - EXTERNAL REQUESTS MUST BE BLOCKED. `page.screenshot()` hangs forever on
 *     "waiting for fonts to load" otherwise.
 *   - Login is TWO STEPS with different testids: identity → `entry-continue-button`
 *     → password → `entry-submit-button`. Not the same button.
 *   - The step buttons are NEVER `disabled`. They are gated with `opacity: 0` +
 *     `pointer-events: none` until the field validates, so `!el.disabled` is
 *     vacuously true from the first paint and every run that waited on it went
 *     straight to a 30s click timeout — "element is visible, enabled and stable"
 *     while the input underneath swallowed the click. Wait on what actually
 *     decides: pointer-events and opacity. `actionable()` below is that wait.
 *   - `pressSequentially`, not `fill` — the form validates per keystroke.
 *   - KEYSTROKES BEFORE HYDRATION ARE LOST. The identity field is autofocused,
 *     so the browser invites typing the instant the HTML lands, but React
 *     re-asserts its own empty state when it hydrates and the field comes back
 *     blank. Typing once and trusting it is how this harness broke. `type()`
 *     retypes until the value sticks, which is also what a real person does.
 *   - `domcontentloaded`, never `networkidle` (live presence sockets never idle).
 *   - Theme is a class on <html> read from localStorage key `mesh-theme`
 *     (values `light` / `dark`), applied pre-hydration. It must be set in an
 *     init script BEFORE the first navigation.
 *   - A fixed sleep is NOT readiness. Several surfaces render a loading state
 *     for 3-4s; measuring then reports an empty page as a defect. `ready()`
 *     waits for real prose.
 *
 * Usage:
 *   import { drive } from "./scratchpad/drive.mjs";
 *   const { page, browser, ready, shot } = await drive({ theme: "dark", width: 1440 });
 */
import { chromium } from "playwright";

const CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const CREDS = { id: "alex@mesh.me", pw: "password123" };

export async function drive({ theme = "light", width = 1440, height = 900, port = process.env.PORT || "3500", creds = CREDS } = {}) {
  const browser = await chromium.launch({ executablePath: CHROME });
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 });
  const page = await context.newPage();

  await page.route("**/*", (r) => (r.request().url().includes("localhost") ? r.continue() : r.abort()));
  await page.addInitScript((t) => {
    try { localStorage.setItem("mesh-theme", t); } catch {}
  }, theme);

  const base = `http://localhost:${port}`;

  /** Type into a gate field and confirm it stuck. See the hydration note above. */
  async function type(testId, value) {
    const field = page.locator(`[data-testid="${testId}"]`);
    await field.waitFor({ state: "visible", timeout: 20000 });
    for (let attempt = 0; attempt < 24; attempt += 1) {
      await field.fill("");
      await field.pressSequentially(value, { delay: 8 });
      if ((await field.inputValue()) === value) return;
      await page.waitForTimeout(250);
    }
    throw new Error(`[drive] ${testId} never kept the value it was given — the gate is discarding input.`);
  }

  /** Wait for a gate button to be genuinely clickable, not merely present. */
  async function actionable(testId) {
    await page.waitForFunction((id) => {
      const el = document.querySelector(`[data-testid="${id}"]`);
      if (!el || el.disabled) return false;
      const style = getComputedStyle(el);
      return style.pointerEvents !== "none" && Number(style.opacity) > 0.5;
    }, testId, { timeout: 20000 });
    await page.locator(`[data-testid="${testId}"]`).click();
  }

  await page.goto(`${base}/login`, { waitUntil: "domcontentloaded" });
  await type("entry-identity-input", creds.id);
  await actionable("entry-continue-button");
  await type("entry-password-input", creds.pw);
  await actionable("entry-submit-button");
  await page.waitForURL(/\/(mesh|flow|home|onboarding)?$/, { timeout: 30000 }).catch(() => {});

  /** Navigate and wait for the page to have actually rendered prose. */
  async function go(route) {
    await page.goto(base + route, { waitUntil: "domcontentloaded" }).catch(() => {});
    return ready();
  }

  /** True once ≥20 leaf elements carry real text. Returns false on timeout —
   *  ALWAYS check it. A false here means "not measured", not "clean". */
  async function ready(timeout = 20000) {
    return page
      .waitForFunction(() => {
        let n = 0;
        for (const el of document.querySelectorAll("p, span, h1, h2, h3, li, label, a, button")) {
          if (el.children.length) continue;
          if ((el.textContent || "").trim().length >= 2) n++;
          if (n >= 20) return true;
        }
        return false;
      }, { timeout, polling: 300 })
      .then(() => true)
      .catch(() => false);
  }

  async function shot(path, { fullPage = true } = {}) {
    await page.screenshot({ path, fullPage });
    return path;
  }

  return { browser, context, page, base, go, ready, shot };
}

/* A contrast() helper lived here and nothing imported it — `npm run check`'s
   dead-export rule caught it immediately. Contrast is already measured properly
   by scripts/contrast-check.ts against the token set; a second implementation
   here would have been the third spelling of a measurement this codebase has
   already been bitten by twice. Measure inside page.evaluate() where you need
   it, or use the real gate. */
