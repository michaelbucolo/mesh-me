# FINAL BUILD SPEC — "Meshi is your hand on the page"

**Base:** HEAD `ddcafed`. **Design system:** `/tmp/claude-0/-home-user-mesh-me/175cdc81-94c5-53bd-b0ec-580d6376a048/scratchpad/human-SYSTEM.md` — **it exists, 524 lines.** THE DESK's headline correction was a false alarm (it searched the repo root only). Item 4.B **#12 is drag on notification rows**; §4.B #15 and #16 are prescribed by name at `:376` and `:377`. **Slice 1 copies this file to `docs/HUMAN_SYSTEM.md`** so the first review of this work is conducted against a text a reviewer can open.

**Uncommitted work already in the tree that this spec must merge with, not re-propose:** `src/components/mesh/paint/theme.ts` (new — reads resolved custom properties off the document root, with Lamplight/Daylight constants as Node fallbacks so `mesh-render-parity` stays deterministic), plus modifications to `background.ts`, `caches.ts`, `nodes.ts`, `shared.ts`, and a new `--canvas-shadow` token in `tokens.css`. §5.1–5.4 of the design system is roughly half-built. Slice 8 extends it.

---

## 1. THE FEELING

**Meshi is at the end of your arm.** Not a widget in a corner, not an illustration on a page — the thing your hand moves, on every platform, in every state, so the product's character is the one object you are already looking at 100% of the time.

**Nothing on this screen moves unless someone made it move.** Your finger, another person, or a fact that changed. A screen that performs while you sit still is the failure this whole build exists to end — and it is what is still shipping today, in `meshi-float.tsx:1892-1924` and `empty-state.tsx:22-23`.

**The warmth is weight, not light.** Paper with a tooth you can see, cards that have an edge and lift when you touch them, one terracotta pigment reserved for affection, and a small creature with a contact shadow standing on it. Nothing emits; things catch light and cast shadow because they have mass.

---

## 2. MESHI AS THE CURSOR

### 2.1 The technique: two layers, and `cursor: none` appears nowhere in the product

All three judges reject `cursor: none` in any form, including A CHARACTER's `data-meshi-cursor` attribute gate. That decision is final and it is the load-bearing invariant of this section: **there is no code path, anywhere, in any state, in which the user has no pointer.**

**Layer 0 — the floor. A native `cursor: url()` image, always present.**

- **Format: PNG, not SVG.** WebKit does not support SVG cursor images; `capacitor.config.ts:8-12` ships an iOS WKWebView against the hosted site and Safari is a first-class desktop target. An SVG data-URI floor silently falls back to `auto` on exactly the platforms that matter most for "on all platforms."
- **Size: 24 × 24 CSS px, single resolution, no `image-set()`.** Chrome and Firefox on Windows ignore custom cursors above 32 × 32 device px, so a 2× variant risks the cursor vanishing. Slight softness on HiDPI is an acceptable cost; a missing cursor is not.
- **Contents:** a 1.5px `--ink-1` **aim dot** at (6, 6) — the hotspot — plus a soft 11px warm-black ellipse at (13, 15), α ≤ 0.18. That ellipse is **Meshi's contact shadow**, and it is the only thing the floor draws besides the dot.
- **Why a shadow and not a second Meshi:** THE DESK proposed a 32px Meshi in the `url()` layer *and* a second 32px DOM Meshi trailing behind it. Judge 3 is right that this is double-vision by construction, not a slow-device edge case. The floor is Meshi's *shadow*; the body is the DOM sprite. A shadow that is briefly alone (over an iframe, behind a modal, before hydration) reads as "Meshi stepped away," not as a rendering fault. `tokens.css:8` already states the thesis: *"Nothing emits light; things catch it, and cast a soft warm shadow because they have weight."*
- **Present in the first paint.** Ship a static default at `public/cursor/meshi-shadow-24.png`, referenced by pure CSS. JS later swaps in a cosmetic-specific variant (rasterized from the mascot's own SVG paths via `XMLSerializer` → `Image` → canvas → `toDataURL('image/png')`, cached in a module `Map` keyed on `color|hat|hair|accessory|eye|badge|outfit`) by writing `--meshi-cursor` on `:root`. `MeshiFloat` is deliberately delayed 650ms after first paint (`root-client-effects.tsx:47`); the cursor must not inherit that gap, and pure CSS is how it doesn't.

**Layer 1 — the body. One DOM `MeshiMascot`, 28px, portalled to `document.body`.**

`position: fixed`, `pointer-events: none`, `z-index: 100` (above shortcuts `z-[90]`, toast `z-[60]`, modal `z-50`), `aria-hidden="true"`, `role="presentation"`, `data-meshi-cursor`, rendered with `meshi-mascot.tsx:1172`'s `cursor-pointer` class suppressed and `interactive={false}`.

### 2.2 Position, geometry, and why there is no trailing offset

**The anchor is rigid.** The sprite's transform is written to the raw pointer position every frame. It is exactly **one frame** behind the hardware pointer — at typical mouse speeds (500–1500 px/s) that is 6–13px, and at rest it is exactly zero. That is Judge 1's "2–6px behind at speed, dead-on at rest" without inventing an easing constant, and it is Judge 3's "geometry stable when the pointer is at rest" without a velocity-derived offset that collapses to zero and causes the two drawings to overlap.

**THE DESK's 18–26px trail along the negative velocity vector is rejected outright.** A pointer that is not where you are pointing is a defect, and the design itself conceded the two layers "can separate far enough to look like two cursors."

**Occlusion is solved by fixed geometry, not by lag.** The sprite's bounding box bottom-left corner sits at pointer + (4px right, −6px up), so the 28px body occupies x ∈ [+4, +32], y ∈ [−34, −6] relative to the aim dot — **entirely up-and-right, never over the target under the hotspot**. This is why the standard arrow works: tip at the aim point, mass away from it.

**Personality comes from lean, gaze and squash — the things that are *allowed* to lag.** Reuse `meshi-machine.ts` verbatim; it is pure, DOM-free and contract-tested by `scripts/mesh-live-contract.ts:383-407`, and `human-SYSTEM.md:482` explicitly protects it from the sweep:

- `stepLean` (`:158-161`) — ±16° bank into travel. The body banks; the head never tilts.
- `stepLook` / `lookUnit` (`:123-151`) writing `--meshi-look-x/y`, which `meshi-mascot.tsx:1264-1277` already consumes. Off-mesh gaze target is the element under the pointer, cached on `pointerover` (fires on element change, not per pixel) — **never `elementFromPoint` on the hot path**.
- `travelSquash` (`meshi-mascot.tsx:1222-1241`) comes free from the existing velocity sensor.
- `MAX_MESHI_SPEED_PX_S = 680` (`:77`) applies to *lean and gaze* only, never to position.

### 2.3 States and suppression — every row closes a named failure

`globals.css:212-270`'s `@media (pointer: fine) { @layer base { … } }` block is **retargeted, not paralleled**. Its header comment is rewritten in the same commit.

**`cursor` is an inherited property, and `globals.css:264-268` sets `cursor: text` on `[contenteditable]` only — `input` and `textarea` keep the UA I-beam by omission.** So the rule must be:

```css
@media (pointer: fine) {
  :root { cursor: var(--meshi-cursor, url("/cursor/meshi-shadow-24.png") 6 6), auto; }
  :is(input, textarea, select, [contenteditable], [data-native-cursor], iframe, embed, object) {
    cursor: auto;
  }
}
@media (forced-colors: active) { :root { cursor: auto; } }
```

Never a blanket `body { cursor }` rule. THE ONE MESHI's "native I-beam, untouched" claim ships broken without the explicit restore.

| Context | Floor | DOM sprite |
|---|---|---|
| Default surface | shadow + aim dot | live |
| Interactive (`a[href]`, `button`, `[role=button]`, the `:is()` list at `:216-253`) | native `pointer` **retained** | takes the `grab` prop, leans 3px forward |
| `input`, `textarea`, `select`, `[contenteditable]` | native I-beam | **suppressed entirely**, 140ms fade |
| Active text-selection drag | native | **suppressed** |
| `:disabled`, `[aria-disabled]` (`:257-262`) | native `not-allowed` | `surprised`, holds position |
| Over `iframe` / `embed` / `object` | native | **suppressed** (`pointerover` on the element + window `blur`) |
| Modal / sheet scrim open | shadow + dot | **suppressed** |
| Native popup (`<select>`, OS drag, context menu) | native | suppressed by window `blur` |
| `prefers-reduced-motion: reduce` | shadow + dot | **stays, rigid** — no lean, no gaze, no squash, no blink |
| `meshiEnabled === "false"` | `cursor: auto` — floor image removed too | not mounted |
| `forced-colors: active` | `cursor: auto` | not mounted |
| Mesh canvas | shadow + dot (the `cursor-none` at `mesh-surface.tsx:300` is **deleted**) | the world-space cursor Meshi owns it; global sprite hides |

**Text-field behaviour is inverted, not tuned.** `meshi-float.tsx:1129-1136`'s `handleFocusIn` currently matches `input, textarea, select, button, a, [role='button'], [data-meshi-follow]` and **moves Meshi to sit beside the focused element**. Tolerable at 48px in a corner; hostile at cursor scale over a caret. THE ONE MESHI's replacement — Meshi loitering at 40% opacity beside the field — is also rejected (Judge 3: a character next to your caret is a moving distraction during the highest-precision task in the product, and 40% opacity is ambiguous, not unobtrusive). **On editable focus the sprite is suppressed entirely.**

**Reduced motion does not mean "no Meshi."** Judge 3's must-reject. The sprite stays and becomes rigid — Meshi still moves, but only because your hand moved it, which is the only motion in the system that was never optional. `<MotionConfig reducedMotion="user">` (`layout.tsx:189-195`) covers the springs; the media query must be **subscribed** via `change`, not read once. Fix the five one-shot readers in the same commit: `meshi-mascot.tsx:947`, `hearts.ts:29/:51/:79`, `pluck-ring.tsx:37`, `emote-wheel.tsx:34`. `use-live-presence.ts:92-103` is the only correct reader and is the pattern.

**The live defect this closes.** `mesh-surface.tsx:300` applies `cursor-none` on pointer fineness alone; `.mesh-cursor-dot` is `width:0;height:0` (`globals.css:7088-7097`); `showCursorMeshi` is false when `prefs.enabled` is false (`meshi-layer.tsx:171`, `use-meshi-preferences.ts:88`). Today, **fine pointer + someone else's mesh + Meshi disabled = no cursor at all** — the exact failure PR #359 was titled to prevent. Verified: `cursor-none` appears in exactly one place in `src/`.

### 2.4 Touch — "on all platforms" is a presence problem before it is a cursor problem

On a phone Meshi **does not exist** outside the mesh canvas. `meshi-float.tsx:1671` is `className="meshi-float-shell fixed z-40 hidden md:block"`; `:1116` gates pointer-follow on `pointerType === "mouse" && innerWidth >= 900`; `:1142` gates click-follow on `>= 768`; `app-shell.tsx:268` renders the owner's **initials in a circle** in the mobile top bar; `mobile-nav.tsx` has zero Meshi references.

1. **Delete `hidden md:block` and both JS width gates.**
2. **Meshi is transient on contact and returns to a dock.** On coarse `pointerdown`, the sprite springs to the contact point on `spring.tap` and fires `impactFeedback("LIGHT")` (`src/lib/native/haptics.ts` — used in 10 places app-wide today; this is the entire mobile aliveness budget, and it is nearly unspent). While down it tracks the finger rigidly. On `pointerup` it plays whatever verb the tap caused, then eases back to dock over `--dur-panel`.
   **THE DESK's "settles ~20px below-right of where you lifted, and stays" is rejected** (Judge 3): `pointer-events: none` stops it blocking taps; it does not stop a 28px mascot permanently covering the thing you just acted on, relocating itself to wherever your attention currently is.
3. **Dock bottom-LEFT**, `left: 12px; bottom: calc(5rem + env(safe-area-inset-bottom) + 12px)` — `MESHI_AVOID_SELECTOR` already knows `.mobile-bottom-nav` and `.mobile-compose-fab` own bottom-right.
4. **During scroll**, hold the dock position and lean into scroll velocity — this is OwnerMode `centered` (`meshi-machine.ts:184`), which the mesh already proves and which is not desktop-specific.
5. **`app-shell.tsx:268`**: `ownerInitials` → `<UserMeshi size={28} />`. On a phone that is the first Meshi ever visible off the mesh.
6. **visionOS / Quest** (`spatial-init.tsx:5-30`): a third modality. No floor image, no sprite, Meshi docks. Gaze-and-pinch pointers are not ours to replace.
7. **Fix the mobile strum.** `use-mesh-frame.ts:165-179` feeds `stepStrum` from `rt.cursorWorldTarget`, which is force-overwritten to `{vx:.5, vy:.5}` on coarse pointers (`use-mesh-input.ts:287-288`, `:410-411`; `use-meshi-dom-sync.ts:276-283`). A phone user can only strum a strand **by accident, while panning**. Feed the live touch point from `rt.pointers`. The best tactile idea in the product, currently unreachable by a finger.

### 2.5 Keyboard — the story none of the three designs wrote

`handleFocusIn`'s selector includes `button, a, [role='button']`, which makes it **the only keyboard-reachable Meshi behaviour in the product today**. Deleting it with no replacement quietly means "Meshi is for mouse users."

Replacement: the cursor provider tracks input modality. When the last input was a key and a `:focus-visible` element exists, the sprite eases to that element's edge at the same fixed up-and-right offset, **clamped so it never overlaps the focus indicator** (`globals.css:194-207`: `outline: 2px solid var(--accent); outline-offset: 2px` → keep ≥ 8px clear), takes the matching prop, and plays the verb on activation. Caused by your Tab key.

### 2.6 Accessibility contract

- `aria-hidden="true"` + `role="presentation"` on the cursor sprite and every decorative Meshi. Meshi mood changes never reach a live region.
- **`MeshiMascot` has zero `aria-` attributes and zero `role` in 1,377 lines** (verified), and its root at `:1171-1186` is a `cursor-pointer` `motion.div` with `onClick`, `onMouseEnter`, `onMouseMove`, `onMouseLeave`, no `role`, no `tabIndex`, no key handler. That is an existing WCAG 2.1.1 / 4.1.2 failure, currently masked only because `avatar.tsx:86-88` wraps it in `role="img"` + `aria-label` (which makes descendants presentational). **Fix before pointing `Avatar` at it across 37 call sites:** when `onClick` is present, render `role="button"`, `tabIndex={0}`, `onKeyDown` for Enter/Space, and require an `aria-label`; when absent, `role="presentation"` + `aria-hidden`.
- `meshiEnabled` is the real off switch, it kills **both** layers, it must be prominent in Settings, and it is the first thing offered to anyone reporting difficulty.
- **The residual, un-mitigable cost, stated to the owner rather than buried:** a `cursor: url()` image silently overrides OS pointer accommodations — enlarged pointer, high-contrast pointer, shake-to-locate. `forced-colors: active` covers only the contrast case; **no CSS query exposes the other two**. The trade — the product's identity in exchange for overriding a pointer accommodation on fine-pointer devices — is the owner's decision, made explicitly.

### 2.7 Performance — this ships as a net deletion or it does not ship

**New: `src/lib/pointer-source.ts`** (module singleton, no React) + **`src/hooks/use-pointer.ts`** (a `useSyncExternalStore` wrapper). `src/hooks/` contains only `use-keyboard.ts` and `use-meshi-preferences.ts` today — there is no shared pointer primitive.

One `pointermove` / `pointerdown` / `pointerup` / `pointerleave`, `{passive:true}`, rAF-coalesced, publishing `{x, y, vx, vy, t, type, down, isFine, overEditable}`. It also owns **one frame bus** (`onFrame(cb)`), and it performs **one batched `getBoundingClientRect` pass at 22Hz** for every registered mascot.

Deleted by it:

- **`meshi-mascot.tsx:945-987` — the real cost, which two of the three designs missed.** A `requestAnimationFrame` loop **per mounted animated mascot**, calling `getBoundingClientRect()` at ~22Hz, across 34 `<MeshiMascot>` render sites with `animate` defaulting to `true` (`:900`). On a mesh with 5 visitors that is 7 concurrent private rAF loops on top of the scheduler's.
- **`meshi-mascot.tsx:1029-1046`** — a global `mousemove` registered **per instance**, calling `getBoundingClientRect()` on **every event**, unbatched.
- `meshi-float.tsx:1069` (idle timer), `:1145` (follow), `:1278` (magnetic lean).
- `mesh-border-constellation.tsx:104`.

**Net: 5 global listeners + N per-instance listeners + N per-instance rAF loops → 1 listener, 1 rAF, 0 forced reflows per move.** This is the only framing under which a cursor ships: it must arrive measurably faster than HEAD.

**Do not construct a second mesh scheduler.** `core/scheduler.ts:70` counts `liveLoops` module-globally and `:122-127` throws in dev on a second loop. `pointer-source` owns a plain rAF (which does not touch that counter), and **suspends it with `cancelAnimationFrame` — not an early return — whenever `rt.scheduler` exists**; for that duration the mesh's `domSync` phase (`use-meshi-dom-sync.ts:198-199`) calls `pointerSource.tick(dt)`. Handoff at the canvas boundary is by inverse projection into `rt.cursorWorldPos`, so there is no jump.

**Budget:** transform-only. One `style.transform` write and two custom-property writes per frame on one compositor-promoted fixed element. **Zero layout reads on the hot path.** Target ≤ 0.6ms, assert ≤ 1.5ms so the mesh's 6ms sim+paint SLO still fits in 16.7ms.

**Fix the governor, or the canvas silently takes the blame.** `core/motion.ts:175-181` (budget path) reads `simPlusPaint.p95`, but `:203-214` (cadence path) demotes after 60 frames of smoothed **raw rAF-to-rAF dt** — a whole-main-thread number the canvas does not own — with `PROMOTE_LOCK_MS` 30s. Gate the cadence demotion on `simPlusPaint` too.

**Do NOT pass `minTier: 0`.** All three designs proposed it; Judge 2 is right that `mesh-render-parity.ts:589-591` asserts *"probe floor is permanent (never promotes past the pin)"* — the floor is a deliberate, contract-documented decision, and defeating it lets genuinely weak devices climb to T0 and thrash. The real bug is the probe: `motion.ts:66`'s `(dpr >= 3 && cores <= 6)` branch fires on every modern iPhone because `navigator.deviceMemory` is `undefined` on iOS and defaults to 8. **Fix:** only apply the DPR branch when `deviceMemory` is actually reported —

```ts
const memReported = (navigator as {deviceMemory?: number}).deviceMemory;
const mem = memReported ?? 8;
if (cores <= 2 || mem <= 2) return 2;
if (cores <= 4 || mem <= 4 || (memReported !== undefined && dpr >= 3 && cores <= 6)) return 1;
return 0;
```

**Add the measurement that does not exist.** `FRAME_BUDGET_MS = 6` ("2019 mid-tier phone") is a comment asserted by nothing; no harness throttles CPU. New `scripts/frame-budget.mjs`: Playwright + `Emulation.setCPUThrottlingRate(4)`, read `window.__meshFrameStats()` (`scheduler.ts:171-176`) after 5s on `/mesh` and `/feed`, assert `simPlusPaint.p95 ≤ 6` and cursor phase ≤ 1.5ms.

### 2.8 Overturn the three documents, explicitly, in the PR body

1. `globals.css:214-216`: *"No overlay gimmicks… everywhere else the OS cursor is the most precise, accessible pointer there is."* → rewritten in the same commit.
2. PR #359 (`9f54666`): three stated reasons. **Two are now false** — "the canvas owns its bespoke reticle" (`.mesh-cursor-dot` is 0×0) and "reactive surfaces carry the premium feel elsewhere" (`reactive-surfaces.tsx`, 97 lines, deleted by #364). The third — iframes and boundary flicker — is exactly what the always-present `url()` floor answers, and boundary flicker cannot occur because no component re-declares a cursor.
3. `human-SYSTEM.md:355` (*"Deleted. The cursor is the OS cursor."*) → **"The cursor is Meshi over its own shadow. The shadow is a native `cursor: url()` so the pointer can never be missing; the I-beam is never replaced; `cursor: none` appears nowhere in the product."** Add the cursor to §4.B as **#19**, with its cause named, or the next sweep deletes it as off-system.

### 2.9 Files

**Create**
```
src/lib/pointer-source.ts            one listener, one rAF, one batched rect pass, one frame bus
src/hooks/use-pointer.ts             useSyncExternalStore wrapper
src/components/meshi/meshi-cursor.tsx        the sprite + provider (portal, suppression, modality)
src/lib/meshi-cursor-image.ts        SVG→PNG rasterizer, cosmetic-keyed cache, writes --meshi-cursor
public/cursor/meshi-shadow-24.png    static first-paint floor
src/lib/meshi-bus.ts                 the cause bus (§3.2)
scripts/frame-budget.mjs             CPU-throttled frame gate
```
**Modify**
```
src/app/globals.css                  :212-270 retarget + header rewrite; delete .mesh-soft-glow (:487-506)
src/components/mesh/scene/mesh-surface.tsx:300      delete cursor-none
src/components/mesh/live/meshi-layer.tsx            raise owner Meshi z-order; keep .mesh-cursor-dot as the hover anchor
src/components/meshi/meshi-mascot.tsx               a11y semantics; delete per-instance rAF+mousemove; delete showGlow, speaking, onMoodChange; delete MeshiLogo
src/components/meshi/meshi-float.tsx                delete hidden md:block, width gates, halos, mood timer, MESHI_BURST_COLORS; invert handleFocusIn; subscribe to pointer-source
src/components/layout/app-shell.tsx:268             initials → UserMeshi
src/components/auth/mesh-border-constellation.tsx:104   subscribe to pointer-source
src/components/mesh/core/motion.ts                  probeStartTier fix; cadence gated on simPlusPaint
src/components/mesh/scene/use-mesh-input.ts         coarse strum uses rt.pointers
src/components/mesh/live/use-meshi-dom-sync.ts      drive pointer-source.tick during mesh mount
scripts/browser-smoke.mjs                           cursor assertions
src/app/layout.tsx / theme-provider.tsx             --meshi custom property on boot
docs/HUMAN_SYSTEM.md                                the design system, in the repo
```

---

## 3. MESHI AS THE PRODUCT

### 3.1 One drawing

**Delete `MeshiLogo` (`meshi-mascot.tsx:1363-1375`).** Verified: 13 lines — a `<circle>` and a face path. No hat, hair, accessory, badge, outfit, prop, blink, gaze, springs or physics. It is what `Avatar` renders at `ui/avatar.tsx:96` and `:99`, hardcoded `color="blue"`, across **37 `<Avatar>` call sites**, plus `/admin:126`, `/about:35`, `/help:29`, `/support:20`, `connection-snapped-error.tsx:98`, `lost-mesh-not-found.tsx:84`. `user-meshi.tsx:6-12` states the invariant it violates in its own docstring.

Point `Avatar` at the real `MeshiMascot`. **`animate={false}` and `interactive={false}` are the defaults** — Judge 2's reject stands: a conversation list renders md avatars 20–50 rows deep, and `animate` by size class would be 20–50 spring sets. With both false, the velocity loop and the eye-follow subscriber early-return entirely. Add an explicit `alive` opt-in used at **at most 3 per viewport** (§4.C's budget): profile header, thread header, the mesh self node.

**Fold the third drawing in:** `dynamic-favicon.tsx:11-130` re-implements the face in canvas 2D with its own 8-colour map and per-mood switch, already diverging from the SVG art. Rasterize the same SVG the cursor uses.

**Delete the dead API in the same sweep:** `showGlow` (declared, eslint-disabled, never read at `meshi-mascot.tsx:903-904`, threaded through **22 call sites** — verified), `speaking`'s three expanding pulse rings (`:1204-1220`, no caller passes it — these are ambient rings, the rejected glow by another name), and `onMoodChange`. A rejected feature surviving as live-looking API is an invitation to re-enable it.

### 3.2 What Meshi reacts to, and how the events reach it

Today `src/lib/meshi-events.ts` is **8 lines and one event** (verified in full): `meshi:open`, payload = which panel. Grepping the tree for `dispatchEvent(new CustomEvent` returns four events total. Nothing in this product can tell Meshi that anything happened, so `meshi-float.tsx:1045-1090` *infers* the world from raw `mousemove`/`keydown`/`scroll` and `:1160-1170` cycles `PAGE_AMBIENT_MOODS` on an 8-second `setInterval`.

**New `src/lib/meshi-bus.ts` — local-only, never broadcast:**

```ts
export type MeshiCause =
  | { verb: "heart" | "star" | "spark" | "wow" | "wave" | "fling"; at?: DOMRect }
  | { verb: "saved" | "sent" | "arrived" | "error" | "milestone" | "completed"; at?: DOMRect };
export function meshiCause(c: MeshiCause): void;
```

The first six are **exactly `ACTION_VERBS`** (`action-bus.ts:34`, verified), so on the mesh they pass straight through to `rt.pendingAction`, `spawnHeart`, `spawnBurst` and `deriveBroadcastMood`'s 4s branch. **Hard constraint:** `scripts/mesh-live-contract.ts:80-83` asserts `ACTION_VERBS.length === 6` and that `strum` is specifically *not* a known verb; the six outcome verbs must never enter the wire set, and **cursor position is never broadcast** — the heartbeat budget is already 80–95% consumed at the moving floor (`:229-242`).

**Six orphaned faces get causes.** `SVG_FACES` defines 16 expressions (`meshi-mascot.tsx:16-117`); the mood ladders can produce 10 (`mood.ts:20`, `:74-77`, `:105-118`).

| cause | face | body |
|---|---|---|
| `heart` | `love` | throws a heart along the existing bezier |
| `saved` | `happy` | 3px settle |
| `sent` | `excited` | throw arc |
| `arrived` | `wink` | glance toward the arrival |
| `error` | **`surprised`** | recoils 6px away from the failed control |
| `milestone` | **`celebrating`** | one pollen fall, once per session |
| `completed` (multi-step flow) | **`cool`** | — |
| pet 3× / 8× on a docked or `alive` avatar | **`petted`** / `giggle`, **`shy`** | existing ladder at `:1049-1094` |

`synergy1017` stays an unwired easter egg.

**Delete the ambient half in the same commit as the bus.** `PAGE_AMBIENT_MOODS` + the 8s `setInterval`; the three concurrent `repeat: Infinity` loops at `meshi-float.tsx:1892-1924` (4s bob/rotate, 4s halo carrying `shadow-[0_10px_32px_rgba(96,165,250,0.18)]` + `backdrop-blur`, 5s `--accent`/5 outer halo); the `animate-pulse` dots at `meshi-actions-menu.tsx:72` and `meshi-chat.tsx:215`; `.mesh-owner-meshi.is-online`'s 5s `meshOwnerFloat` (`globals.css:6768-6773`); `MESHI_BURST_COLORS = ["#6e8bff","#34e4ea","#8b5cf6"]` and `MESHI_HEART_COLOR = "#ec4899"` (`:541-542`).

**What survives:** the blink (`:1009-1026`, 2000–6000ms jittered), the 3.5s body breathe (`:1237-1240`), the six wearable springs and travel squash, the pet ladder, Zzz-sleep. **At cursor scale the spontaneous 8–15s idle gesture (`:1102-1151`) is disabled** — a mascot that glances and shimmies on its own every eight seconds in the middle of the screen is DO-NOT #9 with a face. It may stay on the docked instance.

### 3.3 Invert the avoid-set — partially

`MESHI_AVOID_SELECTOR` (`meshi-float.tsx:106-131`) makes Meshi flee 21 kinds of element via five-point `elementsFromPoint` sampling (`:492-510`). On a dense screen Meshi's dominant behaviour is running away from the UI, which is why it reads as furniture. **Keep exactly three exclusions** — `.mobile-bottom-nav`, `.app-command-bar`, and an open dialog's content box — delete the other 18 and the `elementsFromPoint` sampling with them. **Total inversion is rejected** (Judge 3): Meshi must arrive *offset* from a causing rect, never on it, and "Meshi is between the user and the control they are reading" is a revert condition, not a tuning issue.

### 3.4 Guide

**First run on the mesh.** `mesh/ui/tips-card.tsx:29-51` is a full-screen scrim with one sentence — "Drag to look around, scroll to zoom, click anything to open it." The mesh supports six more gestures (long-press pluck at 420ms opening a Like/Save/Share/Mute ring; the 5-verb emote wheel; flick-to-throw at >700 screen px/s within 140ms; sweep-to-strum; pinch; double-tap) and none are mentioned; they live in an 11px 50%-opacity trailing paragraph behind `?` (`shortcuts-sheet.tsx:74-86`), desktop only.

Replace the modal: **Meshi demonstrates.** Walks to a strand and strums it; grabs a node, plucks it, lets go; throws a heart. Three demos, ~1.5s each, interrupted by the first real touch. Every verb is already callable — `sim/strum.ts:146-158`, `sim/toys.ts:45-88`, `live/hearts.ts:14-39` — and Meshi already has world position, glide, moods and gaze. Add Meshi to `mesh-forming-loader.tsx` (422 lines weaving the literal first frame of the main product, with zero Meshi references).

**Empty states.** `ui/empty-state.tsx:22-33` is a Lucide glyph in a grey box, and its comment reads *"A soft aurora glow breathes behind the icon so blank screens feel inviting rather than dead"* — rendering `.mesh-soft-glow`, a 12rem radial of `--accent-glow` (aliased to a 10%-alpha wash) on `meshGlowPulse 4.5s infinite`. **That is the rejected feature, written down and shipped, and it is simultaneously invisible.** Delete the class and the comment. Replace the glyph with the viewer's own Meshi holding that surface's prop — `LOADER_ACTIONS` (`meshi-loader.tsx:52-131`) already defines 8 prop+mood variants per surface, `PAGE_PROPS` (`:854-865`) maps route→prop. Nine bespoke empties (`explore-discovery.tsx:628`, `feed-timeline-client.tsx:658`, `profile-view.tsx:541`, `community-space.tsx:345`, `search-client.tsx:171`, `notifications-client.tsx:323` + three shared) collapse onto it. DO-NOT #22 makes Meshi the only sanctioned illustration and the product skips it in every zero-data moment.

**Errors and gates.** One `MeshiState` component on `--paper-0` with the viewer's real prefs and a mood matched to the state. Retires `color="blue"`, `bg-red-400`, `backdrop-blur-xl` and the `feGaussianBlur` filter at `lost-mesh-not-found.tsx:41/:43/:50-60/:84` and `connection-snapped-error.tsx:54/:98`, and gives `mesh/ui/gates.tsx:70/:85/:147` — currently `text-white/70` on `bg-[#04050c]` — a face. The product's most emotional failure ("your world is unreachable") is white text on a black rectangle.

**Meshi does not narrate.** Rejected unanimously. Tooltips stay tooltips; Meshi reacts with a prop swap, a lean, a face. Meshi speaks in first person in exactly three contexts — empty states, errors, one milestone per session. Never in chrome, never in a control label, never unprompted over content, no tip-of-the-day.

### 3.5 Main event

**On its own mesh, Meshi is currently an ornament.** Verified z-stack: owner Meshi `z-[6]` (`meshi-layer.tsx:245`) — the lowest layer in the scene — visitors `z-10` (`:90`), hearts in flight `z-[15]` (`:197`), cursor Meshi `z-20`, anchor `z-40`. It is 54px against a self node painted as a 62px avatar orb with a 133px indigo glow and a hand-built profile panel (`paint/nodes.ts:356`, `:365-380`, `:404-531`). The product draws the person twice and gives top billing to the abstract circle.

- Raise the owner Meshi above the node and visitor layers.
- The self node's canvas body becomes a contact shadow and a name; delete the `#8aa1ff`/`#6e8bff`/`#8b5cf6` self-glow stack (`nodes.ts:365-377`) — 30 lines painting a light source `tokens.css:7-8` forbids.
- Hang the profile panel off Meshi rather than replacing it.

**Loaders: keep all 15 and all 13 personalities, delete every rotation.** `meshiLoadOrbit 7s linear infinite` is a literal `rotate(360deg)` (`globals.css:4079-4088`), plus `meshiLoadSpin`/`SpinRev` (`:4306-4307`), `meshiLoadScan`, `meshiLoadShield`, `meshiLoadShimmer` (`:4288-4293`). Replace with things Meshi *does* — the constellation weaves without turning, search sweeps the glass by hand. Delete the four never-drawn nodes still mounted at `meshi-loader.tsx:379-388` against `globals.css:4262-4267`'s `display:none`. Retires six infinite loops. Replace the **47 `animate-spin`** (verified count) with a 16px Meshi doing the matching `la-*` motion — the largest "Meshi is everywhere" win available, and it is a codemod.

**The shell.** `mesh-border-constellation.tsx:8-18` is a 340-line canvas whose `energy` field is bumped on every keystroke, flinging a spark from the caret — a mesh reacting to a human hand, shipped, and **only logged-out users ever see it**. Replace `UserMeshiBadge` in the sidebar (`app-shell.tsx:274`) with a small live weave: 5–9 of your actual closest nodes on the real strand physics, your Meshi standing in it, strands taut when someone comes online and slack when they leave. The shell already runs the presence heartbeat from every surface (`:401-443`), so it already knows. Reacts to real events only. (Slice 9 — lowest priority, highest risk.)

---

## 4. THE LIFE LAYER

### 4.0 Two primitives that structurally block everything

**`src/lib/motion.ts` does not exist** (verified). Create it with the nine springs from §2.8 plus the drag config. **Knip trap:** `dead-code:check` runs inside `npm run check` (`package.json:12`), so every export must land with its first consumer in the same commit.

**Nothing scrolls the window.** `app-shell.tsx:446` is `h-dvh max-h-dvh overflow-hidden`, `:544`'s `<main>` is also `overflow-hidden`, and the only scroller on every authenticated route is `:547` `<div className="mesh-content flex-1 overflow-y-auto">` (`:465`'s sidebar nav is a second, separate one). `useScroll` has **0 usages** (verified). A bare `useScroll()` returns a permanently-zero `scrollY` on /feed, /messages, /profile, /settings — five of the eighteen pieces silently do nothing and look broken. **Ship `ScrollContainerContext` out of AppShell first**; every scroll piece is `useScroll({ container })`.

**All 19 motion tokens at `tokens.css:238-262` have zero call sites** (verified). Every piece below spends them.

### 4.1 The 18, adjudicated

| # | Verdict | Cause | What moves | Timing | File |
|---|---|---|---|---|---|
| 1 Scroll has mass | **ADOPT**, gated on `ScrollContainerContext` | your thumb | header 72→54px, shadow `none`→`--shadow-rest`, hairline 0→1 over scrollY 0–120 | `spring.scroll` | `app-shell.tsx` |
| 2 Velocity shadow lag | **REJECT** | *the list's inertia — no hand* | — | — | — |
| 3 Pull-to-refresh as thread tension | **ADOPT**, late | your drag | catenary stretch, `y = 34·(1−e^(−d/90))`, catch at 64px + haptic, Meshi is the weight on the thread | release `spring{300,18}` | `feed-timeline-client.tsx`, unify with `/flow` |
| 4 Card lift + 0.5px undershoot | **ADOPT** | pointer over card | `translateY(var(--lift))` + one shadow step, undershoot 0.5px/60ms | `--dur-item --ease-settle` | `globals.css` — **collapse the duplicate `.ds-interactive` at `:4986` and `:6271`** (verified: the second silently overrides) |
| 5 Press give | **ADOPT** | your finger | `scale(--press-sm/--press-lg)` + 1px down + shadow tightens | `--dur-tap --ease-give`; release `--ease-anticipate` | `.ds-interactive`, Button, Input, Badge, rows |
| 6 Section cascade | **ADOPT** | route enter | `y:10→0`, opacity 0→1, cap 8 | `--dur-card`, `--stagger` | `<Cascade>` |
| 7 Feed drop-in | **ADOPT** | a real 30s poll for new-post count → a "N new" strip you click | drop from −12px; first row makes room 180ms *before* landing | `spring.item` | `feed-timeline-client.tsx` |
| 8 Toggle mass | **ADOPT — best ratio in the product** | your finger | knob 1.5px overshoot + `scaleX 1.12` squash mid-travel; track crossfade; section enable cascades children | `spring.knob`, `--dur-chip` | `settings-control-center.tsx:2299-2337` (2,415 lines, **zero** framer, one keyframe) |
| 9 Saves that land | **ADOPT** | your click | label settles, checkmark by `strokeDashoffset`, row 3px down and back, rule flashes `--accent-line`; **Meshi plays `celebrating`** | 320ms / 600ms | Button, `meshi-bus` |
| 10 Numbers roll | **ADOPT** | the follow you performed | per-digit, 40ms stagger, `tabular-nums` | `spring.number` | `profile-view.tsx:208-226` (static server spans that do not change without reload), `follow-button.tsx:32-51` (52 lines, no motion) |
| 11 Messages reorder | **ADOPT** | someone sent you something | `popLayout`; row springs to top; rows below make room; badge pops | `--dur-card --ease-lift`, `spring.celebrate` | `mechat-conversation-list.tsx` (702 lines, zero motion) |
| 12 Drag | **ADOPT** — *this is the item THE DESK lost* | your drag | notification row `drag="x"`, `rotate: x/40`, `--shadow-lift`; snap ±72px → **Meshi springs to the row edge and catches it**; row folds `height→0` | 220ms `--ease-fall` | `notifications-client.tsx` |
| 13 Composer throw | **ADOPT with change** | your send | **Meshi throws it** along the existing `spawnHeart` bezier; **no 4° rotate** | 420ms `--ease-anticipate` | new `src/lib/arc.ts` extracted from `hearts.ts:14-99` |
| 14 Nav ink | **ADOPT** | your click | one 2px `--ink-1` underline *travels* via `layoutId="nav-ink"` | `spring.navInk` | `feed-timeline-client.tsx:519-530` (plain `<Link>`s + class swap); pattern already works at `notifications-client.tsx:269` |
| 15 Status breathes | **ADOPT** — *overruling THE DESK* | a service that is up | dot on `--breath` with per-index `--phase`; **degraded = arrhythmia** (3.1s, ×0.3 amplitude, alternating 3.1/4.4s) *before* colour; **plus** one 180ms settle tick each time a poll lands | `--dur-breath` 5200ms | `status/page.tsx` (151 lines, no client JS); retire the three `shadow-[0_0_14px_rgba(...)]` halos at `:36-55` in the same commit |
| 16 Reading strand | **ADOPT** — *overruling THE DESK* | your scroll | 2px ink line in the left margin fills and sags; passed headings darken `--ink-3`→`--ink-1`; **the real mascot at its head** | scroll-linked | `/help`, `/about`, legal — both currently render dead `MeshiLogo` and `help-center-search.tsx` (193 lines) has zero motion |
| 17 Chrome parts the threads | **ADOPT — 60% already shipped** | a panel opening / a person walking through | rail's screen rect joins `StrandDisturbance[]`; rail-chip hover pulls strands taut (`STRAND_K 52→90`, 400ms) | — | `use-mesh-frame.ts:148-157` already feeds every Meshi into `physics.ts:54-64` |
| 18 Bloom + shake + pollen | **ADOPT** | join / form error / milestone | members spring outward, 18ms radial stagger; `.mesh-shake` ±4px ×3; 14-dot `--warm` pollen, gravity + drag, ≤20° spin, lands and fades | 320ms / 1.6s | revive the dead `meshShake` at `globals.css:437`; login already re-invented it as `meshGateShake` |

**One rejection: #2.** The design system flags it as the first cut, the pointer-velocity budget is fully spent on Meshi's lean and travel squash, and no hand causes it — the list's inertia does. Two competing velocity effects is one too many.

### 4.2 Five additions

- **A1 · `src/lib/meshi-bus.ts`** — §3.2.
- **A2 · Reactions leave the canvas.** A like on /feed throws a real heart from Meshi to the button and **the count ticks on landing** — the mesh already does this including the strand pulse home to the maker (`use-meshi-dom-sync.ts:100-194`). /feed today runs `animate-heart-bounce` (`post-card.tsx:768`) and stops. Extract `src/lib/arc.ts`; keep the bounce.
- **A3 · The strand leaves the canvas.** `src/components/strand/` as SVG: `<Strand taut>`, `strum()`, `drawStrand(from,to)`. **/connected-accounts** — the surface whose entire subject is a connection being made or broken, where neither event is drawn (`:241/:316/:327/:391` produce a spinner and a text change) — draws a strand on connect and goes slack on disconnect. Deletes `connectionStrandFlicker`, `connectionNodeFlicker`, `connectionHangingStrand`, `connectionStatusPulse` (`globals.css:1392/:1403/:1413/:1438`, keyframes `:1525-1590`). **/trail** already tracks `hoveredNode` (`trail-client.tsx:331`) and does nothing physical with it — pull taut under the pointer, sag on release. Cheapest rehearsal of #17.
- **A4 · Presence is a body.** `FeedPostPresence` (`feed-timeline-client.tsx:647`) renders other people's Meshis on a post with no motion at all. Reuse `meshiArrive`/`meshiRing`/`meshiLeave` (`globals.css:7040-7067`).
- **A5 · The loop allowlist gate — ships WITH the removals, never before.** The design system claims a CI grep exists (`§4.A`); **it does not**. Verified at HEAD: **47 `animate-spin`, 23 `repeat: Infinity`, 46 `infinite` in globals.css**, two literal `animate={{ rotate: 360 }}` (`flow-client.tsx:107`, `flow-reels.tsx:67`), 20 dead `@keyframes`. New `scripts/loop-check.ts`, added to `npm run check`, permitting `infinite`/`repeat: Infinity` **only** on selectors matching `.breath` or `.paper-wait`, **plus an explicit named carve-out in code for `meshi-mascot.tsx`'s body-breathe (`:1237-1240`) and blink (`:1009-1026`)**. If "a character breathing" is not written into the gate, the next sweep deletes Meshi's pulse. Banning loops before the replacement exists is exactly what produced the current stillness.

### 4.3 Mesh-side

Delete the four free-running sines and reinvest: node drift orbit (`physics.ts:148-167`) including `driftScaleFor` and the Pro "lively" 1.9× multiplier that **sells ambient motion as an upsell**; orb breath (`nodes.ts:667`, `:763`); the online-presence breathing ring (`:784-797`); the selection pulse (`:851-855`). In their place: a heart's arrival visibly **recoils** the target node; a new node yanks its parent's strand taut before settling; the presence ring becomes a **one-shot ripple** at the moment someone comes online. Net line-count reduction, far more motion. (§5.8 of the doc keeps a slowed, id-jittered drift — take the doc's version if the owner prefers a desk in a breeze; the Pro multiplier goes either way.)

---

## 5. WARMTH

### 5.1 The honest numbers

I recomputed every ratio. **Judge 1 is right and all three designs were wrong.** Current Lamplight card-on-page (`#211d19` on `#1a1714`) is **1.066:1**; the proposals published as "1.24–1.28:1" actually compute to **1.10:1**. Daylight is **1.043:1** today.

Verified: `var(--warm)` — **0 call sites**. `var(--info)`, `var(--warning)`, `var(--warm-wash)` — 0. `--grain-alpha` / `--grain-blend` — declared at `tokens.css:59-60` and `:114-115`, **4 references, all inside tokens.css itself**. `@keyframes breath` — 0. `src/lib/motion.ts` — absent.

### 5.2 Render the grain — the single highest-leverage change here

One inlined SVG `feTurbulence baseFrequency=".82" numOctaves="4"` → 180×180 monochrome PNG tile, on `body::after`: `position: fixed; inset: 0; pointer-events: none; opacity: var(--grain-alpha); mix-blend-mode: var(--grain-blend); z-index: 1;`. One layer, never animated. Blit the **same tile** into the canvas background (§5.2 of the doc — this is what makes `TIER_PARAMS[2].backgroundRefreshMs: Infinity` correct rather than a fidelity cliff). Grain is static texture; DO-NOT #9 does not touch it, and it is the one thing that lets desaturated warm colour read as paper rather than as a dark box.

### 5.3 Open the paper — computed, not asserted

**Lamplight** (`tokens.css:74-91`):

| token | now | proposed | measured |
|---|---|---|---|
| `--paper-0` | `#1a1714` | **`#211a15`** | channel spread 6 → 12 |
| `--paper-1` | `#211d19` | **`#332920`** | **1.21:1 vs page** (was 1.066) |
| `--paper-2` | `#141210` | **`#171310`** | sunken still sinks |
| `--paper-3` | `#272320` | **`#3a2f25`** | |
| `--paper-hover` / `--paper-press` | `#262119` / `#2e2822` | **`#3b3026`** / **`#453828`** | |
| `--ink-3` | `#948c80` | **`#a29a8e`** | 6.17:1 / 5.11:1 / 4.68:1 on paper-0/1/3 ✓ |

`--ink-1`, `--ink-2`, `--ink-4` and all six pigments hold on the new papers (I computed each: ink-4 stays at 3.00:1 on paper-0 — it **must** fail AA or `contrast-check` fails).

**Daylight** (`tokens.css:19-54`):

| token | now | proposed | measured |
|---|---|---|---|
| `--paper-0` | `#fbf8f2` | **`#f4ecdd`** | spread 9 → 23; **1.15:1 vs card** (was 1.043) |
| `--paper-1` | `#fffdf8` | unchanged | |
| `--paper-2` | `#f4efe6` | **`#ede3d0`** | |
| `--paper-3` | `#eae3d6` | **`#e8dfcd`** | |
| `--ink-3` | `#6b655b` | **`#676157`** | 5.22 / 6.03 / 4.63 on paper-0/1/3 ✓ |
| `--warm` | `#b05939` | **`#a24f32`** | 4.83:1 (was 4.13 on the new paper — **would have failed**) |
| `--warning` | `#976925` | **`#8a5f1e`** | 4.79:1 |
| `--success` | `#4a7c59` | **`#3f6b4c`** | 5.23:1 |

**This is the real cost of darkening Daylight's page and it is why "just lift the paper" was not a free change.** Update `--warm-wash`'s rgb to match. Frame it as a **separation fix** — hues, theme names and the material thesis unchanged, only lightness and spread — and rewrite the measured numbers in `tokens.css`'s own comments. `contrast:check` runs inside `npm run check` and reads `tokens.css` directly; if it goes red, move `--ink-3` and `--paper-3` together, not independently.

### 5.4 Spend the terracotta

`--warm` gets its first call sites ever, and **exactly five jobs**: the like heart (retiring `text-rose-400`/`rose-500` at `post-card.tsx:765`, `:875`), the strum shimmer, Meshi's ground/contact shadow **tint only where it is a shadow pointing down** (see §6), the pollen speck, and the mesh's in-flight hearts (`use-meshi-dom-sync.ts:129` `rgba(129,140,248,.55)` and `:181` `rgba(244,63,94,.6)`).

**Delete `--ds-danger #EF4444` / `--ds-success #22C55E` / `--ds-warning #F59E0B`** (`globals.css:4942-4950`, 64 call sites) and retarget onto the token pigments. `ui/toast.tsx:51-73` currently mixes Tailwind `emerald-300`/`red-300` icons with neon `--ds-*` borders — two palettes in one 100-line component.

**Events get pigment.** `notifications-client.tsx:380` gives 11 categories exactly two colours: someone loving your post, someone following you, a security alert and a community invite are chromatically identical. Map: affection → `--warm`; arrival → that person's pigment; security → `--info`; milestone → `--warning`; destructive → `--danger`. **Colour that appears because something happened is consequential by definition.**

**Test gate:** `mesh-render-parity.ts:487` pins `PULSE_HUE = "#fda4af"`, asserted at `:490/:494/:498`. Re-point it to `--warm` in the same commit. `mesh:render-parity` is **not** in `npm run check` — run it explicitly.

### 5.5 Meshi joins the material

`COLOR_THEMES` (`meshi-mascot.tsx:794-810`) is 14 raw Tailwind hexes including `#06b6d4` — DO-NOT #4 by name. `MESHI_COLOR` (`meshi-loader.tsx:135-149`), `MODE_PALETTE` (`:33-41`) and `dynamic-favicon.tsx:11-20` duplicate them three more times. Meshi's default `#3b82f6` is hue 217° at S91%; `--accent #8fb0e0` is hue 216° at S52% — the same hue at wildly different saturation, which is the worst of both: it neither contrasts with the page nor belongs to it.

Re-cut all 14 into the product's chroma band, **keeping hue identity**, declared in `tokens.css`, deleting the three duplicate maps:

| id | old | Daylight | Lamplight |
|---|---|---|---|
| blue | `#3b82f6` | `#3a5f96` | `#7e9fd0` |
| purple | `#8b5cf6` | `#6a5590` | `#a492c8` |
| pink | `#ec4899` | `#b0567a` | `#d68ca6` |
| green | `#22c55e` | `#3f6b4c` | `#8cbe97` |
| orange | `#f97316` | `#a24f32` | `#e08a5f` |
| cyan | `#06b6d4` | `#3f6e77` | `#88b4bc` |
| gold | `#eab308` | `#8a5f1e` | `#e0b252` |
| rose (Pro) | `#f43f5e` | `#a8443a` | `#e0827a` |
| arctic (Pro) | `#7dd3fc` | `#5a7e96` | `#a8c4d6` |
| crimson (Pro) | `#dc2626` | `#8e3a31` | `#c9705f` |
| emerald (Pro) | `#059669` | `#3d6b4c` | `#7fae8a` |
| midnight (Pro) | `#312e81` | `#2f3560` | `#7a7fa8` |
| obsidian (Pro) | `#475569` | `#4a463f` | `#8e8578` |
| rainbow | `#ec4899` | two-stop `#a24f32`→`#3a5f96` | same |

green / orange / gold land exactly on `--success` / `--warm` / `--warning`.

**`DEFAULTS.color` stays `"blue"`** (`use-meshi-preferences.ts:49`). Judges 1 and 2 both reject silently re-skinning the identity of every user who never picked a colour. If terracotta should be the default, that is a separate, owner-approved decision applying to new accounts only.

**Write `--meshi` to `:root` on boot.** Auditing every `setProperty` in `src/` returns only `theme-provider.tsx:119-129`, `layout.tsx:71-82`, and the mesh's `--meshi-look-x/y`: **Meshi's colour is never written to a CSS custom property.** Choosing orange today changes the mascot SVG, the favicon, the presence payload and a ~300ms loading screen, and nothing else.

**`--meshi` owns fills and marks only.** It does **not** own the focus ring, the caret, or `::selection` — Judge 3's must-reject: focus indicators must meet WCAG 1.4.11 (3:1), and `contrast-check.ts` reads `tokens.css` statically and cannot see a runtime value, so that would ship an unverifiable per-user accessibility failure. Focus stays `--accent` (`globals.css:194-207`). `--meshi` owns: your own MeChat bubbles, your node ring, your saved/streak marks, Meshi's own body.

### 5.6 Colour that belongs to people

**Ship `User.accentColor`.** `prisma/schema.prisma:21` has it; `settings-control-center.tsx:986-1002` renders a picker plus hex field; `actions.ts:1581-1599` validates and writes it; `queries.ts:328/:1549` returns it. **Verified: the only files referencing it outside generated Prisma are the settings page, the settings control center, `actions.ts` and `queries.ts` — a write-only field.** Render it: profile header rule and tab indicator, avatar ring, name-link hover, their node ring, their side of a MeChat thread. **Clamp incoming hex into the chroma/luminance band on read** so `#00ff00` lands as moss.

**Every avatarless person is byte-identical** — 9 hardcoded `color="blue"` sites (verified), including `avatar.tsx:96/:99` across 37 call sites, the brand mark, the 404 and the error screen. The canvas flattens the same way: `scene-model.ts:333` gives every person `isMutual ? "#a78bfa" : "#818cf8"` — two indigos for the entire human population of your mesh. Derive a per-person pigment by djb2 hash into the 14-swatch wheel, the way `physics.ts:19-23` already derives per-node phase. **Confine it to objects that ARE the person** — avatar fill, a 2px ring, their node, their bubble tint — never containers, borders or chips. Snapshot-safe, no DB work. If the wheel reads as neon in a 30-row feed, cut it from 14 to 6.

MeChat "theirs" bubbles are hardcoded `#26262e` (`globals.css:6196-6207`) — blue 46 > red 38, the coldest colour in a warm-walnut product, on the person you talk to most. → `--paper-3`, tinted 8% toward their pigment.

### 5.7 The frame around the product

`theme-provider.tsx:80-84` writes `#f7f9fc` / `#0f141b` into every `<meta name="theme-color">` — `#0f141b` is a cold blue-grey, so on every phone the OS status bar framing the app is the pre-#365 palette. `lib/brand.ts:36-47` still carries the entire retired system (`#58a6ff`, `#22c55e`, `#f59e0b`, `#ef4444`) and feeds the OG/Twitter image routes, so **every shared mesh.me link previews in a palette that no longer exists**. `(app)/layout.tsx:58-74`'s guest shell hardcodes `bg-[#05070f]`, `text-white`, `bg-white`/`text-black` CTA — the first screen a non-user ever sees is cold black-and-white with zero paper and zero Meshi. Point both at the tokens; rebuild the OG image on paper with Meshi in it. Highest-leverage warmth surface in the product.

### 5.8 The mesh joins the product

**Merge with the uncommitted `paint/theme.ts` work**, do not re-propose it. Remaining: `bg-[#04050c]` on `mesh-surface.tsx:287` and `gates.tsx:70/:85/:147`; delete `NEBULA_FIELD`, `globalCompositeOperation = "lighter"` (`background.ts:63`) and the parallax star loop; the five purchasable "Atmospheres" become papers on **stable storage ids** (`shared.ts:252` falls back to `midnight`, so renaming keys silently resets every Pro user's preset); one `MESH_FONT` constant through the painter (17 sites in `paint/nodes.ts` + `shared.ts:176` all paint `ui-sans-serif, system-ui` — Fraunces reached everything except the product's main object) and the two remaining `700` weights at `nodes.ts:219/:422`; export `BRANCH_META`'s recut pigments to the DOM as `--pig-people` / `--pig-communities` / `--pig-posts` / `--pig-platforms` so the feed's source chips, the communities grid and the notification categories inherit the same colours the mesh uses.

---

## 6. THE LINE

Every one of these is a revert condition, not a tuning note.

1. **`cursor: none` appears nowhere in the product.** No attribute gate, no paint-gated set, no exceptions. Delete `mesh-surface.tsx:300`.
2. **The cursor's shadow carries no hue.** Warm-black or nothing — not `--warm`, not `--meshi`, not the user's colour. **α ≤ 0.18, offset ≥ +2px down, never centred, never animated.** Centred and tinted is the mascot glow with a new name. Extend the CI grep to cover the cursor image and the `--meshi-cursor` string.
3. **Meshi's aliveness at cursor scale is: blink, lean, gaze, squash.** No idle bob, no halo, no ring, no orbit, no pulse, no trail, no comet, no spontaneous idle gesture. **Acceptance test, written into the PR: if any reviewer can point at a frame where the cursor Meshi moved and the pointer did not, the feature is wrong.**
4. **No timer may change Meshi's face, prop, position or mood.** Ever.
5. **Meshi never narrates.** No tooltip replacement, no tip-of-the-day, no "did you know", nothing unprompted over content. First person in exactly three contexts: empty state, error, one milestone per session.
6. **Meshi is never between the user and the control they are reading.** `pointer-events: none` is absolute; arrivals are offset from the causing rect; the three avoid-exclusions stay.
7. **The I-beam is never replaced**, and the sprite is suppressed — not dimmed — on editable focus, during selection drag, over iframes, and behind a scrim.
8. **A pigment event changes ONE property** — a fill OR a ruleline, never both — and is gone within `--dur-page` (520ms). Colour that outlives its cause is decoration.
9. **`--warm` has five jobs.** If more than ~2% of a screen's pixels are warm, it has become atmosphere. (/feed today is 1.44% pigment total.)
10. **One pollen fall per session. Never confetti. Nothing rotates.**
11. **Ambient decoration is never sold.** No Pro atmosphere upsell, no 1.9× "lively" drift multiplier.
12. **No new verb reaches the wire.** `ACTION_VERBS.length === 6`; cursor position is never broadcast.
13. **`--meshi` never owns the focus ring, caret or `::selection`.**
14. **The PR body carries the cause table.** Every moving thing with the human action, the other person, or the event that caused it. Any row whose cause column reads "a timer" or "the page loaded" does not ship. This is the artifact the last three PRs did not have.

---

## 7. BUILD ORDER

Each slice is one PR, independently revertible, leaving the product better than the slice before.

### Slice 1 — "Meshi is your cursor, on every platform" *(the owner-visible answer)*

Three ordered commits in one PR.

**1a — Delete the rejected feature that is still shipping.** `meshi-float.tsx:1892-1924` (blue halo `rgba(96,165,250,0.18)` + `backdrop-blur` + second `--accent`/5 ring + 4s bob, all `repeat: Infinity`), `MESHI_BURST_COLORS`/`MESHI_HEART_COLOR` (`:541-542`), `PAGE_AMBIENT_MOODS` + the 8s `setInterval` (`:85-97`, `:1160-1170`), `animate-pulse` dots (`meshi-actions-menu.tsx:72`, `meshi-chat.tsx:215`), `meshOwnerFloat` (`globals.css:6768-6773`), `.mesh-soft-glow` + its comment (`empty-state.tsx:22-23`, `globals.css:487-506`), the `showGlow` prop and its 22 call sites, `speaking`, `onMoodChange`. **Land `src/lib/meshi-bus.ts` with its first six causes in the same commit** — deleting the only thing that currently changes Meshi's face and landing the replacement a PR later reproduces exactly the #364/#365/#366 sequencing that produced this task.

**1b — `pointer-source.ts` + `use-pointer.ts`, as a net deletion.** Remove the per-instance rAF (`meshi-mascot.tsx:945-987`) and the per-instance `mousemove` (`:1029-1046`); rewire the four remaining global listeners. Fix `probeStartTier`; gate cadence demotion on `simPlusPaint`. Fix `MeshiMascot`'s a11y semantics. Subscribe reduced-motion via `change` in all six readers.

**1c — The cursor.** Floor + sprite + suppression table + touch presence (`hidden md:block`, both width gates, `app-shell.tsx:268`, dock bottom-left, haptics) + `mesh-surface.tsx:300` + inverted `handleFocusIn` + keyboard modality + the three-doc overturn + `docs/HUMAN_SYSTEM.md`.

**Verify:** `npm run check` green. `npm run test:browser` with new assertions — on every route, on the **default** path, `getComputedStyle(document.documentElement).cursor !== 'none'`; under `reducedMotion: 'reduce'` (already the sweep's context, `browser-smoke.mjs:197`) the sprite is rigid and present; no horizontal overflow (`:218`, which a fixed overlay can break); zero new `console.error` (`:235-247`). `scripts/frame-budget.mjs` at 4× CPU throttle: `simPlusPaint.p95 ≤ 6`, cursor phase ≤ 1.5ms, **and pointer-move cost strictly below HEAD**. Manual: Safari desktop + iOS WKWebView + Windows Chrome/Firefox confirm the PNG floor renders (this is the WebKit trap — verify per-browser before merge).

### Slice 2 — One drawing
Delete `MeshiLogo`; point `Avatar` at `MeshiMascot` (`animate={false}` default, `alive` opt-in ≤3/viewport); fold `dynamic-favicon.tsx` onto the same SVG; `MeshiState` for gates and errors; empty states get Meshi + prop.
**Verify:** `dead-code:check`; 0 `MeshiLogo` references; axe pass on `role="img"` avatars; snapshot diff on /feed, /messages, /profile, 404, mesh gates.

### Slice 3 — Grain, paper separation, terracotta
`body::after` grain; the token table in §5.3 with all comments rewritten to measured values; `--warm`'s first five call sites; delete `--ds-danger/success/warning` and retarget 64 sites.
**Verify:** `contrast:check` green (it will catch any hex I got wrong). Both-theme snapshots on 25 routes. Report the real card-on-page ratio in the PR: **1.066 → 1.21 (Lamplight), 1.043 → 1.15 (Daylight)** — not 1.25.

### Slice 4 — Motion foundation + the loop gate
`src/lib/motion.ts` (each export with its first consumer), `ScrollContainerContext`, `@keyframes breath` + `.breath`, `.paper-wait`, `scripts/loop-check.ts` **shipped with the ~67 removals**: 47 `animate-spin` → Meshi doing `la-*`, 23 `repeat: Infinity`, the loader's six rotations, the four dead loader DOM nodes, the 20 dead keyframes, `feedPendingSweep`, the four `connection*` flickers.
**Verify:** `loop-check` green with only `.breath`, `.paper-wait` and the two named mascot carve-outs. `dead-code:check` green. Manual pass over all 15 route loaders.

### Slice 5 — Best-ratio interactions
#8 toggle mass (~100 interactions, one component), #5 press give, #4 lift + undershoot with the duplicate `.ds-interactive` collapsed and both surviving cursor spotlights deleted (`site-route-map.tsx:72-97`, `explore-discovery.tsx:775-799` + `:838-842`), #14 nav ink, #15 status breath + arrhythmia + tick.
**Verify:** snapshots; grep proves 0 `rgba(110,139,255` / `#6e8bff` / `#34e4ea` / `mix-blend-plus-lighter` in `src/`.

### Slice 6 — Consequence on the social surfaces
#10 numbers roll + #9 saves that land + `follow-button` (the most social act in the product currently produces no motion), #11 popLayout conversation list, #12 drag-to-archive with Meshi catching the row, A2 hearts leave the canvas, A4 presence bodies.
**Verify:** drag tested at both ±72px thresholds; snapshot; manual two-account test that an incoming message reorders the list.

### Slice 7 — Scroll, feed, forms
#1 scroll mass, #6 cascade, #7 drop-in behind a real 30s poll, #3 pull-to-refresh (unified with /flow), #13 Meshi throws the post, #18 shake + bloom + pollen, #16 reading strand.
**Verify:** `useScroll({container})` proven non-zero on /feed, /messages, /profile, /settings.

### Slice 8 — The mesh
Merge with the uncommitted `paint/theme.ts` work; finish §5.1–5.8; #17 rail rect into `StrandDisturbance[]`; mobile strum; owner Meshi above the world; self node as contact shadow + name; delete the four free-running sines; Meshi teaches the gestures; Meshi into `mesh-forming-loader.tsx`.
**Verify:** `npm run mesh:render-parity` **explicitly** with `PULSE_HUE` re-pointed to `--warm` and `shadowSets()` converted to a sprite-blit check **in the same commit**; `npm run mesh:live-contract`; `mesh:layout-check`; stored-preset test proves all five atmosphere ids still resolve; 200-node benchmark at 4× throttle.

### Slice 9 — People own colour, and the shell weave
`User.accentColor` rendered with a chroma clamp; per-person pigment hash; MeChat bubble tint; theme-color + `brand.ts` + guest shell + OG image; the sidebar live weave (highest risk, lowest priority — cut it if slice 8 spent the budget).
**Verify:** `contrast:check`; a clamp unit test proving `#00ff00` lands in band; OG route snapshot.

### Slice 10 — Chore
`.mesh-soft-glow` remnants, the alias block, dead CSS, `globals.css` line count reported.

---

## 8. WHAT COULD GO WRONG

**1 · The cursor ships and the product feels *slower*, which is worse than bland.**
Bland is a taste argument; slow is a quality defect, and a one-frame-late Meshi under the hand is the most visible place in the product to pay it. The rigid anchor plus the always-present floor is the design answer, but it is only true if slice 1b actually lands as a net deletion. The failure mode is subtle: `use-pointer.ts` gets written, but two of the five listeners survive "for now," the per-instance rAF stays because it is threaded through six springs, and the cursor arrives on top of the existing cost. Then the mesh's cadence governor (`motion.ts:203-214`) demotes the canvas on a whole-main-thread signal it does not own, with a 30-second lock, and the owner's report is "the mesh got worse" with nothing to point at. **Guard:** slice 1b merges only if `scripts/frame-budget.mjs` shows pointer-move cost strictly below HEAD, measured, not argued.

**2 · The volume gets compressed into one PR and the gates catch it where it hurts.**
Fourteen adopted 4.B pieces, five additions, a palette shift and a global cursor is a guaranteed revert, and the CI shape makes it worse rather than better: `dead-code:check` (knip) fails any `motion.ts` export landed ahead of its consumer, and the two suites booby-trapped against exactly this work — `mesh:render-parity`'s `PULSE_HUE` sentinel and `shadowSets() > 0` at T0 — are **not in `npm run check`**, so a big-bang lands green locally and red where it matters. The slice order above is not a preference; slices 4, 5 and 8 each have a gate that fails if their companion change is in a different commit.

**3 · The character survives the deletions and quietly re-grows the thing that was rejected.**
This is the one I would bet on. "A character being alive is not decoration" is true, and it is also the exact sentence that will justify a sparkle trail in March, a hover aura in April, a badge that rotates in May — each individually defensible, collectively the aurora again, now with a face and at cursor scale where it is on screen 100% of the time. The evidence that this is not hypothetical is in HEAD right now: `empty-state.tsx:22-23` ships the sentence *"a soft aurora glow breathes behind the icon so blank screens feel inviting rather than dead"* — the rejected feature, written down, disobeyed, and invisible at 10% alpha — and `meshi-float.tsx:1911` ships a blue glow on the mascot that both #363 and #364 missed. **The only defences that hold are mechanical, not editorial:** the allowlist gate with the two mascot carve-outs named *in code*, the hue grep extended to the cursor image string, the "if the pointer did not move, Meshi did not move" acceptance test, and the cause table in every PR body. If the next person cannot answer "whose hand caused this?" in one sentence, the answer is that it does not ship.