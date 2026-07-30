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
 *     (which is DISABLED until the field validates) → password →
 *     `entry-submit-button`. Not the same button.
 *   - `pressSequentially`, not `fill` — the form validates per keystroke.
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
  await page.goto(`${base}/login`, { waitUntil: "domcontentloaded" });
  await page.locator('[data-testid="entry-identity-input"]').pressSequentially(creds.id, { delay: 8 });
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-testid="entry-continue-button"]');
    return el && !el.disabled;
  });
  await page.locator('[data-testid="entry-continue-button"]').click();
  await page.locator('[data-testid="entry-password-input"]').waitFor({ state: "visible" });
  await page.locator('[data-testid="entry-password-input"]').pressSequentially(creds.pw, { delay: 8 });
  await page.locator('[data-testid="entry-submit-button"]').click();
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
