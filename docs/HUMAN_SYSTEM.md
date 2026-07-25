# MESH.ME — "PAPER & LAMPLIGHT"
### The final design system. Supersedes AURORA MESH, and supersedes the three exploratory directions (daylight / warm-dark / organic).

**Synthesis note.** The two judges split, and the split is instructive: one judged the *aesthetic* (daylight wins — it is the only direction that deletes the futuristic substrate instead of re-hueing it), the other judged the *migration* (warm-dark wins — it is the only direction that never opens a window where the app is unreadable, because `src/app/(app)/layout.tsx:58` hardcodes `bg-[#05070f]` and 298 `text-white` / `white/N` sites assume a dark shell).

Both are right, and they are not actually in conflict. The disagreement is entirely about *when the default theme flips*, not about what the product should look like. So this system takes **daylight's material thesis and its deletions**, ships **both themes at full fidelity from the first token PR**, and keeps `"dark"` as the default until the hardcoded-colour sweep has landed — at which point flipping is one line (`layout.tsx:50`) that the owner approves on its own, having seen both. The grafts the judges named are folded in (organic's growth-birth, mass contract, golden-angle phase, small-caps escape valve, big-file discipline; warm-dark's fuller dark ramp, shimmer retarget, `--glass-*` retarget, CI grep list, arrhythmia-as-degraded-signal).

Every repo claim below was verified in-tree on 2026-07-25: `globals.css` is 7,898 lines; 47 `animate-spin`; 304 `rounded-full`; 298 `text-white`/`white/N`; 87 `backdrop-blur`/`backdrop-filter`; `useScroll` 0 usages; `drag=` 0 usages; `--shadow-soft` referenced 16× and never declared; `layout.tsx:50` defaults to `"dark"`; `background.ts:63` sets `globalCompositeOperation = "lighter"`; `TIER_PARAMS[1]/[2]` set `shadows: false` and T2 sets `backgroundRefreshMs: Infinity`; `mesh-render-parity.ts:487` pins `PULSE_HUE = "#fda4af"`; `shared.ts:244` holds five atmospheres keyed `midnight/aurora/ember/ocean/dawn` with `atmosphereOf()` falling back to `midnight`.

---

## 1. THE FEELING

Mesh.me is a **warm desk with paper on it and threads pinned between the people you care about** — the same desk whether the room is full of late-morning light or lit by one lamp. Nothing in the product emits light; things *catch* it, and cast soft warm shadows because they have weight. The whole product is one material — paper with a faint tooth — under two lights. Colour is rare and always means something: a stamp, a mark, a warning, a heart. Ink is the default; pigment is the exception. Depth is one hairline and one shadow, never blur and never halo.

And it is **alive, without ever performing**. The rule that makes this system coherent is: *nothing loops except breath, and nothing moves unless something happened or someone is there.* Today the resting state of every screen is a control panel — 47 spinners, 20-plus infinite loops, an aurora that drifts forever on every gradient button — while every *human* motion is a transient. Invert it exactly. Delete the ambient machinery, then add far more motion than exists today, all of it consequential: scroll that has mass, cards that lift under your finger and undershoot when you let go, threads that go taut when you pull and slack when they break, numbers that land instead of crawling, lists that physically make room, a new connection that *draws itself* from one person to another. The finished thing should read as **made by hand and kept**, not rendered by a machine.

Three sentences a designer can hold: **Paper catches light, it never emits it. Weight is the only special effect. Breath is the only loop.**

---

## 2. THE TOKEN SET

Single source of truth: **`src/app/tokens.css`**, imported first by `globals.css`. Old token families (`--bg-*`, `--mesh-*`, `--ds-*`, `--glass-*`, `--shimmer-*`) are **retargeted as aliases, not deleted**, so ~800 existing call sites keep compiling; the alias block is deleted in the final slice.

Both themes are complete and CI-snapshotted from day one. `.dark` is the default class until Slice 13.

### 2.1 Colour — Daylight (light theme)

```css
:root, .light {
  /* Paper — surfaces */
  --paper-0:      #FBF8F2;   /* page */
  --paper-1:      #FFFDF8;   /* card / sheet */
  --paper-2:      #F4EFE6;   /* sunken, input well */
  --paper-3:      #EAE3D6;   /* rule fill, track, disabled surface */
  --paper-hover:  #F7F2E9;
  --paper-press:  #F1EBE0;

  /* Ink — text */
  --ink-1:        #1B1A17;   /* primary        16.1:1 on paper-0 */
  --ink-2:        #4A463F;   /* secondary       9.0:1 */
  --ink-3:        #6E685E;   /* tertiary        5.2:1  — floor for body/caption text */
  --ink-4:        #948C7F;   /* 3.1:1 — NON-TEXT ONLY: borders, dividers, disabled glyphs, decoration */
  --ink-inverse:  #FFFDF8;

  /* Lines */
  --rule:         rgba(27,26,23,.10);
  --rule-strong:  rgba(27,26,23,.18);
  --rule-hover:   rgba(27,26,23,.26);
  --rule-focus:   rgba(47,75,124,.55);

  /* Accent — pen ink (iron-gall blue-black). A pigment, never a light source. */
  --accent:       #2F4B7C;   /* 8.2:1 on paper-0 */
  --accent-hover: #24406E;
  --accent-press: #1D3660;
  --accent-ink:   #FFFDF8;   /* text on accent */
  --accent-wash:  rgba(47,75,124,.08);
  --accent-line:  rgba(47,75,124,.22);

  /* Pigments — meaning only, never decoration */
  --warm:         #C4633F;   /* terracotta: hearts, affection, Meshi, strum */
  --warm-wash:    rgba(196,99,63,.10);
  --success:      #4A7C59;   /* moss */
  --warning:      #B07A2B;   /* ochre */
  --danger:       #A8443A;   /* rust */
  --info:         #3F5D77;   /* riverstone */

  /* System */
  --scrim:        rgba(38,32,24,.32);
  --selection:    rgba(47,75,124,.20);
  --grain-alpha:  .035;
  --grain-blend:  multiply;

  /* Skeletons (retargets --shimmer-1/2/3) */
  --skeleton-1:   #F1EBE0;
  --skeleton-2:   #E9E1D4;
  --skeleton-3:   #F6F1E8;
}
```

### 2.2 Colour — Lamplight (dark theme)

Warm walnut, **red channel ≥ blue at every step** — the exact inverse of today's `#070912` (blue 1.7× red). This is a *room at night*, not space.

```css
.dark {
  /* Ink ramp — surfaces (8 steps, from warm-dark's ramp, re-anchored to Lamplight) */
  --ink-1000:     #0E0B09;   /* deepest — scrim base, input well */
  --ink-950:      #141110;
  --paper-2:      #141210;   /* sunken / input */
  --paper-0:      #1A1714;   /* page */
  --paper-1:      #211D19;   /* card / sheet */
  --paper-3:      #272320;   /* rule fill, track */
  --paper-hover:  #262119;
  --paper-press:  #2E2822;
  --ink-600:      #4A3D31;   /* heavy divider, chart gridline */

  /* Paper ramp — text */
  --ink-1:        #F2EDE4;   /* primary      13.9:1 on paper-0 */
  --ink-2:        #C0B8AB;   /* secondary     8.4:1 */
  --ink-3:        #948C80;   /* tertiary      5.0:1 — floor for text */
  --ink-4:        #6E6559;   /* 2.8:1 — NON-TEXT ONLY */
  --ink-inverse:  #141210;

  --rule:         rgba(242,237,228,.10);
  --rule-strong:  rgba(242,237,228,.18);
  --rule-hover:   rgba(242,237,228,.26);
  --rule-focus:   rgba(143,176,224,.55);

  --accent:       #8FB0E0;   /* 8.7:1 on paper-0 */
  --accent-hover: #A9C4EC;
  --accent-press: #7B9FD4;
  --accent-ink:   #141210;
  --accent-wash:  rgba(143,176,224,.10);
  --accent-line:  rgba(143,176,224,.26);

  --warm:         #E08A5F;
  --warm-wash:    rgba(224,138,95,.12);
  --success:      #8CBE97;
  --warning:      #E0B252;
  --danger:       #E0827A;
  --info:         #8FB3CE;

  --scrim:        rgba(14,11,9,.72);
  --selection:    rgba(143,176,224,.26);
  --grain-alpha:  .05;
  --grain-blend:  soft-light;

  --skeleton-1:   #211D19;
  --skeleton-2:   #2B241D;
  --skeleton-3:   #382E25;
}
```

**Contrast rules, enforced in review:** `--ink-4` in both themes is **decoration only** — borders, dividers, disabled glyphs, canvas hairlines. Any text token resolves to `--ink-3` or darker/lighter. Pigments (`--warm`, `--success`, `--warning`, `--danger`, `--info`) are AA at 14px+ on `--paper-0/1` only; on `--paper-2/3` they must be paired with an ink label.

### 2.3 Deleted outright

`--brand-gradient`, `--brand-gradient-vibrant`, `--mesh-aurora-line`, `--mesh-blue #6e8bff`, `--mesh-cyan #34e4ea`, `--mesh-ice`, `--accent-glow`, `--shadow-glow`, `--mesh-glow-blue`, the duplicate winning dark block at `globals.css:3990–4060`, and the five space atmosphere palettes (§5). The wordmark becomes solid `--ink-1` Fraunces 600 with the dot in `--accent` — no `background-clip`, no shimmer (`globals.css:6600`, `meshFormingShimmer :1197`).

### 2.4 Aliases (retarget, don't delete — removed in Slice 13)

```css
--bg-primary: var(--paper-0);      --bg-secondary: var(--paper-2);
--bg-card: var(--paper-1);         --bg-elevated: var(--paper-1);
--bg-tertiary: var(--paper-3);     --bg-hover: var(--paper-hover);
--bg-input: var(--paper-2);        --bg-overlay: var(--scrim);
--text-primary: var(--ink-1);      --text-secondary: var(--ink-2);
--text-tertiary: var(--ink-3);     --text-muted: var(--ink-3);
--border-primary: var(--rule);     --border-secondary: var(--rule-strong);
--border-hover: var(--rule-hover); --border-focus: var(--rule-focus);
/* Glass is retargeted to opaque matte, NOT deleted — 87 call sites keep compiling */
--glass-bg: var(--paper-1);        --glass-border: var(--rule);
--glass-blur: none;                --glass-highlight: transparent;
--shimmer-1: var(--skeleton-1);    --shimmer-2: var(--skeleton-2);
--shimmer-3: var(--skeleton-3);
```

### 2.5 Type scale

Loaded with `next/font/google` in `layout.tsx` — **there is no typeface in the product today**; `--font-inter` never loaded Inter and `--font-mono` points at an undefined var.

- **Display / headings — Fraunces** variable: `opsz` auto, `SOFT 30`, `WONK 1`, weights 400–600. The single strongest "human, not futuristic" signal available.
- **UI / body — Instrument Sans** variable, 400–600. Humanist skeleton, warm at 13–17px. (Fallback if numerals read tight: Figtree.)
- **Numerals / IDs / code — IBM Plex Mono** 400–500.
- **Long-form** (legal, help, about): Fraunces `opsz 14, 400`, 19px/1.65, measure 66ch.

```css
--font-display: "Fraunces", Georgia, serif;
--font-sans:    "Instrument Sans", ui-sans-serif, system-ui, sans-serif;
--font-mono:    "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;

--t-display: 3rem/1.06   600 -0.028em var(--font-display);
--t-h1:      2.375rem/1.12 600 -0.022em var(--font-display);
--t-h2:      1.875rem/1.18 600 -0.018em var(--font-display);
--t-h3:      1.5rem/1.25   600 -0.014em var(--font-display);
--t-h4:      1.25rem/1.35  600 -0.010em var(--font-sans);
--t-title:   1.0625rem/1.4 600 -0.006em var(--font-sans);
--t-lead:    1.0625rem/1.6 400  0        var(--font-sans);
--t-body:    0.9375rem/1.55 400 0        var(--font-sans);
--t-small:   0.84375rem/1.45 400 0       var(--font-sans);
--t-label:   0.8125rem/1.4  500 +0.005em var(--font-sans);
--t-caption: 0.78125rem/1.4 400 +0.005em var(--font-sans);  /* colour: --ink-3 */
--t-eyebrow: 0.8125rem/1.3  600 +0.02em  var(--font-sans);  /* font-variant-caps: all-small-caps */
```

**Weight ceiling 600.** Delete `font-weight:950` (`globals.css:3496`) and every 700/750/800.
**Tracking ceiling +0.02em**, and only on `--t-eyebrow`.
**`text-transform: uppercase` is banned** — CI grep. The 69 HUD kickers (`.mesh-kicker` at `:2479`, plus every `tracking-[0.2em]` literal) codemod to sentence-case `--t-label` in `--ink-3`. **The escape valve** (grafted from organic, and it must land *with* the type slice, not after): where a screen genuinely needs an eyebrow to lead a section, use `--t-eyebrow` — `font-variant-caps: all-small-caps; letter-spacing: .02em`. Small caps give hierarchy without the HUD read. Budget: **max one eyebrow per screen region**.
**`font-variant-numeric: tabular-nums`** on every count, metric, price, timestamp, and canvas label.

### 2.6 Space, shape, size

```css
/* 4px grid */
--sp-1: 4px;  --sp-2: 8px;  --sp-3: 12px; --sp-4: 16px;
--sp-5: 20px; --sp-6: 28px; --sp-7: 40px; --sp-8: 64px;

/* Radii — 14 competing values collapse to 5 + one reserved */
--r-xs:    4px;    /* chips, badges, inner inputs */
--r-sm:    6px;    /* inputs, small buttons */
--r-md:    10px;   /* buttons, list rows, menu items */
--r-lg:    14px;   /* cards, sheets */
--r-xl:    20px;   /* modals, drawers, hero */
--r-round: 999px;  /* RESERVED: avatars, presence dots, count badges, toggle knob/track, Meshi */

/* Control heights */
--h-sm: 32px; --h-md: 40px; --h-lg: 48px;

/* Layout */
--gutter: 24px;   /* 16px < 768px */
--measure-prose: 66ch;
--measure-feed: 60ch;
--col-feed: 680px;
--row-min: 56px;
--card-pad: 20px; /* 16px < 768px; 28px hero */
--section-gap: 28px;
--border-w: 1px;  /* always */
```

`ui/button.tsx:8` base changes `rounded-[var(--ds-radius-pill)]` → `rounded-[var(--r-md)]`. Delete `border-radius:.75rem !important` (`:5817`) and the second radius scale at `:5356–5361`. Target: `rounded-full` **304 → ≤40**, all inside the reserved allowlist.

### 2.7 Shadow & elevation

```css
/* Light */
--shadow-flat:   none;
--shadow-rest:   0 1px 1px rgba(38,32,24,.04), 0 2px 4px rgba(38,32,24,.05);
--shadow-raised: 0 2px 4px rgba(38,32,24,.05), 0 8px 16px -6px rgba(38,32,24,.10);
--shadow-lift:   0 4px 8px rgba(38,32,24,.06), 0 18px 32px -12px rgba(38,32,24,.14);
--shadow-float:  0 12px 24px rgba(38,32,24,.10), 0 40px 72px -24px rgba(38,32,24,.22);
--edge-light:    none;

/* Dark — same geometry, warm-black, plus one lit top edge */
.dark {
  --shadow-rest:   0 1px 1px rgba(0,0,0,.40), 0 2px 4px rgba(0,0,0,.34);
  --shadow-raised: 0 2px 4px rgba(0,0,0,.38), 0 8px 18px -6px rgba(0,0,0,.46);
  --shadow-lift:   0 4px 8px rgba(0,0,0,.40), 0 18px 34px -12px rgba(0,0,0,.52);
  --shadow-float:  0 12px 24px rgba(0,0,0,.44), 0 40px 78px -24px rgba(0,0,0,.60);
  --edge-light:    inset 0 1px 0 rgba(255,248,235,.05);
}

/* THIS FINALLY DECLARES THE 16 UNDEFINED REFERENCES (/admin ×4, community-space,
   communities/[slug], community-create — all currently render flat) */
--shadow-soft: var(--shadow-rest);
```

### 2.8 Motion tokens

```css
/* Easings — 6, named for physics, replacing 9 overlapping curves at :96–103 */
--ease-settle:     cubic-bezier(.22,.61,.36,1);    /* workhorse: anything that moves and stops */
--ease-lift:       cubic-bezier(.32,.72,0,1);      /* enter/exit: panels, sheets, pages */
--ease-give:       cubic-bezier(.2,.8,.2,1);       /* press and release */
--ease-anticipate: cubic-bezier(.45,-.12,.2,1.05); /* pull back, then throw. The ONE overshoot. */
--ease-fall:       cubic-bezier(.4,0,1,.6);        /* exits, gravity, going slack */
--ease-breath:     cubic-bezier(.45,.05,.55,.95);  /* the only loop */

/* Durations. Derived, not asserted: t ≈ 120ms + 0.28ms × (largest dimension px), cap 560. */
--dur-tap:    120ms;  /* ≤40px  — icon, dot, knob */
--dur-chip:   160ms;  /* ~80px  — chip, badge, toggle */
--dur-item:   200ms;  /* ~280px — row, control, menu item */
--dur-card:   320ms;  /* ~680px — card, feed row, popover */
--dur-panel:  420ms;  /* ~900px — sheet, drawer, rail */
--dur-page:   520ms;  /* full   — route transition (cap 560) */
--dur-breath: 5200ms;

/* THE MASS CONTRACT (grafted from organic — this is what stops the universal -2px
   hover from creeping back). Every interactive component declares its mass once. */
--mass: 1;                                   /* 1 chip · 2 row/card · 3 sheet/hero */
--lift: calc(-1px * var(--mass));            /* hover translate */
--dur:  calc(var(--dur-item) * var(--mass-k)); /* --mass-k: .8 | 1 | 1.3 */
--press-sm: .96;    /* ≤ 120px wide */
--press-lg: .985;   /* > 120px wide */
--stagger: 34ms;    /* cap 8 items */
--phase: calc(var(--i, 0) * 137ms);          /* golden angle — provably never re-syncs */
```

**Framer springs** (`src/lib/motion.ts`, the single export point):

```ts
export const spring = {
  tap:      { stiffness: 520, damping: 30, mass: 0.6 },   // buttons, chips, toggles
  item:     { stiffness: 260, damping: 26, mass: 1 },     // rows, cards, list entries
  panel:    { stiffness: 180, damping: 24, mass: 1.2 },   // sheets, drawers, rails
  reorder:  { stiffness: 300, damping: 30, mass: 1 },     // layout / popLayout
  knob:     { stiffness: 700, damping: 34, mass: 0.7 },   // toggle knob, 1.5px overshoot
  number:   { stiffness: 190, damping: 22, mass: 1 },     // counters — today's s70/d18 crawls
  navInk:   { stiffness: 420, damping: 34, mass: 1 },     // layoutId selection travel
  celebrate:{ stiffness: 420, damping: 20, mass: 0.8 },   // ζ≈.44, one visible bounce
  scroll:   { stiffness: 300, damping: 40, mass: 1 },     // useSpring over useVelocity
};
export const drag = {
  dragElastic: 0.12,
  dragTransition: { power: 0.25, timeConstant: 180, bounceStiffness: 300, bounceDamping: 32 },
};
```

**Reduced motion** (`prefers-reduced-motion: reduce`): every loop off; breath renders at its static midpoint; all transforms become opacity crossfades at 160ms; springs resolve in one frame; drag keeps function but loses elasticity; grain stays (it is material, not motion).

---

## 3. SURFACE & DEPTH — what replaces glass and glow

**The rule: depth is one hairline plus one warm shadow. Never blur. Never light.**

**Nine card idioms collapse to four elevations:**

| Idiom | Surface | Line | Shadow | Used for |
|---|---|---|---|---|
| `.well` | `--paper-2` | `inset 0 1px 0 var(--rule)` | none | inputs, code blocks, sunken groups |
| `.leaf` | `--paper-0` | `--rule` bottom only | none | list rows, table rows, settings rows |
| `.sheet` | `--paper-1` | `--rule` | `--shadow-rest` + `--edge-light` | cards, feed posts, panels |
| `.sheet-raised` | `--paper-1` | `--rule` | `--shadow-lift` + `--edge-light` | modals, menus, popovers, drawers |

Floating (`--shadow-float`) is reserved for the single topmost modal on screen. There is **never a border-only card**; elevation always moves surface *and* shadow together.

**Co-variance rule (mandatory).** Hover lift and shadow blur change together, in the same transition. A card that translates `-2px` without its shadow growing from `--shadow-rest` to `--shadow-raised` is not paper — it is a sticker. Lint the pair.

**`backdrop-filter` is banned** everywhere except the scrim behind a true modal. All 87 sites migrate to opaque `--paper-1`/`--paper-2`. (Sequencing note: the CI grep for this lands *after* the sweep — see Slice 12 — with the app-shell header allowlisted until its own slice, or CI is red on merge.)

**Grain replaces light.** One inlined SVG `feTurbulence baseFrequency=".82" numOctaves="4"` → monochrome 180×180 tile, on `body::after`, `position:fixed; inset:0; pointer-events:none; opacity: var(--grain-alpha); mix-blend-mode: var(--grain-blend)`. It replaces the fixed rainbow `body::before` at `globals.css:6573–6585` exactly. The *same tile* is blitted into the canvas background layer (§5) so DOM and canvas are visibly one material. Hero, empty-state and celebration surfaces get a second pass at `.06`.

**Edge light instead of glow.** In dark, elevated surfaces carry exactly one `inset 0 1px 0 rgba(255,248,235,.05)` top hairline. **That is the entire luminosity budget of the product.**

**Deleted:** `.mesh-ghosted` hologram filter (`:7682`), `.mesh-cursor-dot` reticle (`:7748`), the cursor spotlight + `rotateX/rotateY` card tilt (`:7304–7401`), the glowing nav bar (`:692`), the loader box-shadow starfield (`:4618–4679`), `mesh-background.tsx` (180 stars + a 190px cursor glow) and its three shell mounts, and the mascot's periwinkle `drop-shadow` (`:7438`) → `drop-shadow(0 6px 14px rgba(38,32,24,.18))` / dark `rgba(0,0,0,.45)`.

**Focus** is one token, everywhere: `outline: 2px solid var(--rule-focus); outline-offset: 2px`. No glow ring, no box-shadow ring.

---

## 4. MOTION VOCABULARY

### 4.A REPLACE THIS SCI-FI MOTION

Every item is a named deletion with a named replacement. There is no "tone it down".

| Kill | Where | Replace with |
|---|---|---|
| **47 × `animate-spin`** + 2 × framer `rotate:360` | 18 files | **`.paper-wait`** — three 3px ink dots, opacity .25→1 with a 3px rise, 1400ms `--ease-breath`, 160ms offsets. **No rotation anywhere in the product.** |
| Button loading spinner swap | `ui/button.tsx` | Button **keeps its label**; a 1.5px ink underline sweeps L→R→L beneath it at 900ms `--ease-settle`. |
| `meshPresencePing`, `meshPulse`, `connectionStatusPulse`, `meshCursorPulse`, 5 × `animate-pulse`, canvas `breathe`/`selPulse` (the 1.7–2.2s throb family) | global | **One breath** (§4.C). |
| `meshAuroraDrift` — 9s linear infinite on *every gradient button, forever* (`:6627`) | global | Deleted. Hover shifts `background-position` 6% over 400ms `--ease-settle` and **rests**. |
| `meshAuroraSweep` skew wipe | route change | Section cascade: `y:10→0`, opacity 0→1, `--dur-card`, `--stagger`, cap 8. |
| `meshTravelVeil` / `meshTravelText` hyperspace | route change | `layoutId` FLIP from the tapped element, `--dur-panel` `--ease-lift`. No blur, no letter-spacing animation. |
| `navSweep` + `navSweepTrail` comet | nav | **Nav ink**: a 2px `--ink-1` underline that *travels* between items via `layoutId="nav-ink"`, `spring.navInk`. **No comet, no trail, no glow.** |
| `feedPendingSweep` scanline | /feed | Pending posts sit in a `--well` strip with a static count; arrival uses the drop-in (§4.B #6). |
| `meshFormingShimmer` (`:1197`) | wordmark, empties | Deleted. |
| `meshiLoadOrbit` / `Spin` / `SpinRev` / `Scan` / `Shield`, mascot sonar rings | 12 route loaders | Meshi **idles**: weight shift `translateX ±2px, rotate ±1.2°` over 3.4s, blink every 4–9s jittered, gaze lag 120ms (already in `meshi-machine.ts`). The 12 per-route loaders are *kept* — only their animation changes. |
| `connectionStrandFlicker`, `connectionNodeFlicker`, `lostMeshDrift` marching ants | mesh, errors | **The strand goes slack**: control point +26px over 900ms `--ease-fall`, swings to rest, desaturates to graphite. Dashes freeze. |
| `drawStrandPulse` (`fx.ts:18` — affection as a travelling data packet) | canvas | **`drawStrandStrum`**: the heart *plucks* the thread. Amplitude ∝ affection, 6px, 620ms, damping .86, plus a real impulse into `STRAND_K`/`STRAND_DAMP`. Also delete the white radial glint at `fx.ts:98–103` — the wave crest thickens to 2.2px instead. |
| `drawBirthFx` rotating 4-point star + flash | canvas | **Growth** (§5) — the strand draws parent→child, then the node unfurls. |
| `one-mesh-hub` wire-flow + shockwave | marketing | `useInView` reveal, y+14, 420ms, once. |
| `.mesh-cursor-dot`, cursor spotlight, card tilt | global | Deleted. The cursor is the OS cursor. |
| Whole-canvas ambient sway | *proposed and rejected* | **Never build it.** See §7. |

**The inversion, stated as one lintable rule:** `repeat: Infinity` and CSS `animation-iteration-count: infinite` are banned except for `--breath` and `.paper-wait`. CI grep enforces it.

### 4.B ADD THIS LIFE — 18 pieces

The owner wants *more* motion. Every item below is consequential — it happens because you did something or because someone is there. None of it is ambient decoration.

1. **Scroll has mass** (app-wide; `useScroll` has **0 usages** today). `useScroll` + `useVelocity` → `useSpring(spring.scroll)`. Header 72→54px across scrollY 0–120; its shadow fades `none`→`--shadow-rest` over the same range; title 20→17px; hairline opacity 0→1.
2. **Velocity shadow lag.** Card shadow y-offset = `clamp(v/900, -6, 6)px`. Sheets visibly lag when you flick. *(Flagged: first cut if it reads gimmicky. Never implement it as skew or rotation.)*
3. **Pull-to-refresh is thread tension.** 0–88px drag stretches an SVG catenary strand; rubber-band `y = 34·(1−e^(−d/90))`; the thread thins and darkens as it strains; catches at 64px with a haptic tick; release snaps `spring{300,18}`, fires the strum, and new posts land via #6.
4. **Card lift and settle.** Hover: `--lift` + one shadow step, `--dur-item` `--ease-settle`. Release **undershoots 0.5px over 60ms** before resting. That undershoot is the whole personality of the system — it is what "weight" feels like.
5. **Press give, everywhere.** `--mesh-press-give` is defined in the repo and referenced **zero times**. Wire it into `ds-interactive`, Button, Input, Badge, and every row: `scale(var(--press-sm|--press-lg))` + 1px down + shadow tightens one step, `--dur-tap` `--ease-give`; release on `--ease-anticipate`.
6. **Section cascade on enter.** `staggerChildren: .034, delayChildren: .04`; child `y:10→0`, opacity 0→1, `--dur-card` `--ease-settle`; **cap 8** then the rest appear together.
7. **Feed drop-in.** `<AnimatePresence mode="popLayout">`; new posts drop from −12px on `spring.item`; neighbours shift on the layout spring; the first row makes room with a 180ms height spring *before* the new post lands.
8. **Toggle mass** (Settings — 2,415 lines, currently **one** animation). Knob travels on `spring.knob` with a 1.5px overshoot and squashes to `scaleX 1.12` mid-travel; track crossfades 160ms; enabling a section cascades its children at `--stagger`.
9. **Saves that land.** No toast for in-place saves. Button label → "Saved" on `--ease-give`; checkmark drawn by `strokeDashoffset` over 320ms; the row settles 3px down and back; the card's rule flashes `--accent-line` for 600ms; label fades to `--ink-3` at 2s.
10. **Numbers roll.** `.mesh-roll-in` is built and unused. Ship it on profile counts, analytics, billing — per-digit, 40ms digit stagger, `spring.number`, `tabular-nums`.
11. **Messages reorder physically.** `popLayout` on the conversation list; a new message springs its row to the top over `--dur-card` `--ease-lift`; unread badge pops on `spring.celebrate`; the built-but-unused `mesh-typing-wave` goes inline in the rail.
12. **Drag — first use in the product** (`drag=` has **0 usages**). Notification rows: `drag="x"`, `drag` config from §2.8, snap ±72px → archive/read, row folds `height→0` in 220ms `--ease-fall`; the row leans `rotate: x/40` and casts `--shadow-lift` while lifted. Also: flow drag-to-scrub, mesh rail chips drag-to-reorder.
13. **Composer throw.** On send, the draft follows the existing `spawnHeart` bezier to the feed head, 420ms `--ease-anticipate`, 4° rotate, then #7 inserts it. *(Flagged with #2 as the second cut candidate; drop the rotate first, keep the arc.)*
14. **Nav ink.** `layoutId="nav-ink"` — a 2px `--ink-1` underline travelling between items on `spring.navInk`. Same `layoutId` pattern for profile tabs, feed source tabs, settings nav, filter chips: **one selection object that moves**, never a fade.
15. **Status breathes** (the status page has zero motion today). Each service dot on `--breath` with its own `--phase`. **Degraded is arrhythmia, not colour first**: period drops to 3.1s, amplitude ×0.3, and the cycle alternates 3.1s/4.4s — a human reads broken rhythm faster than reduced amplitude — *then* it turns ochre. Down = still, with a slack strand.
16. **Reading strand** (legal, help, about — currently zero motion). A 2px ink line in the left margin fills with scroll and sags slightly under it; passed section headings darken `--ink-3`→`--ink-1`. Anchor the TOC to the section `id`s that already exist.
17. **Chrome parts the threads.** Feed `rail.tsx`'s screen rect feeds `sim/physics.ts` `DISTURB_RADIUS`, so opening a panel visibly pushes strands aside; hovering a rail chip pulls its strands taut (`STRAND_K 52→90` for 400ms, then release). **The UI gains physical presence in the mesh.** This is the best idea in the whole system and it costs almost nothing.
18. **Community space bloom.** Members spring outward from the community node on mount, radial stagger 18ms per ring, `spring.item`, arriving with the strand's sag. Plus: `meshShake` on form errors (±4px, 3 cycles, 320ms), and celebration = a 14-dot ochre/clay **pollen** fall (gravity + drag, ≤20° spin, 1.6s, lands and fades) — *never confetti, and never more than one per session*.

### 4.C BREATH — the only loop

```css
@keyframes breath {
  0%   { transform: scale(1);     opacity: .86; }
  38%  { transform: scale(1.012); opacity: 1;   }  /* inhale */
  44%  { transform: scale(1.012); opacity: 1;   }  /* hold */
  100% { transform: scale(1);     opacity: .86; }  /* exhale — longer than inhale */
}
.breath {
  animation: breath var(--dur-breath) var(--ease-breath) infinite;
  animation-delay: var(--phase);          /* calc(var(--i) * 137ms) */
}
```

Used for **presence dots, live status, avatar idle, the selected mesh node** — and nothing else. **Maximum 3 breathing elements per viewport.** Phase offset is the golden angle (137ms × index), which is deterministic (safe for snapshot tests and for `mesh-layout-determinism.ts`) and provably never re-syncs, unlike a random offset which can cluster.

---

## 5. THE MESH CANVAS — starfield to tabletop

The mesh is the signature and it stays the signature. It stops being outer space and becomes **a warm tabletop with people pinned to it and threads between them**. `sim/physics.ts` is not touched: gravity sag, strand disturb and spring settle are the best code in the repo, and they were always describing *thread*, not space — nothing sags in a vacuum. The conversion makes the physics finally coherent with its own skin.

**Identity is preserved by the three things people actually recognise:** the constellation layout (untouched — `layout.ts` unchanged), the sag of the threads (untouched), and the deterministic per-node character (kept, and *increased* — see ring jitter). What goes is the substrate, not the shape.

**5.1 Sky → paper** (`paint/background.ts`). Keep the cache/blit architecture, replace the contents. The radial space gradient becomes a soft vertical warm wash (light from above): light `#FCF9F2 → #F4EFE6 → #E7E1D3`, dark `#241C16 → #1A1714 → #100D0A`. **Delete `NEBULA_FIELD`, delete `globalCompositeOperation = "lighter"` (`:63`) — the single most futuristic line in the renderer — and delete the parallax star loop entirely.** Vignette `rgba(2,3,7,.45)` → warm paper edge `rgba(38,32,24,.06)`.

**5.2 Grain replaces light.** One 128×128 monochrome noise sprite generated once at init, tiled at device scale, alpha `.035` / `.05` — the *same* material as the DOM grain. Consequence: the sky becomes fully static, which makes `TIER_PARAMS[2].backgroundRefreshMs: Infinity` **correct rather than a visible fidelity cliff**, and makes the sky cheaper on every tier. This is the strongest engineering argument in the whole system and it is free.

**5.3 Atmospheres → papers** (`shared.ts:244`). **The record keys do not change.** `atmosphereOf()` falls back to `ATMOSPHERES.midnight` for any unknown id (`:252`), so renaming keys would silently reset every Pro user's stored `mesh-theme-preset`. Keep `midnight/aurora/ember/ocean/dawn` as the storage ids, change `label` and values, and export a `PAPER_ALIAS` map so new pickers can use readable ids. Emotional mapping is near 1:1:

| id (stable) | new label | light bg | dark bg | ink |
|---|---|---|---|---|
| `midnight` (free) | **Daylight** | `#FBF8F2 #F4EFE6 #EAE3D6` | `#1A1714 #151210 #100E0C` | `#6E685E` |
| `aurora` (Pro) | **Botanical** | `#F4F6EE #E9EEE0 #DCE4CF` | `#171A14 #12140F #0D0F0B` | `#5F6B52` |
| `ember` (Pro) | **Kraft** | `#F2E6D2 #E8D9BE #DBC8A6` | `#221A12 #1A140E #110C08` | `#7A6244` |
| `ocean` (Pro) | **Blueprint** | `#E8EEF4 #DAE3EE #C7D4E4` (+24px 4%-alpha grid) | `#141A20 #101519 #0B0E11` | `#4E637A` |
| `dawn` (Pro) | **Sunlit** | `#FAF0E4 #F2E2CE #E6D2B8` | `#241C18 #1A1411 #100C0A` | `#8A6247` |

The `AtmosphereSpec` type loses `nebulae` and `star`, gains `grain: number` and `ink: string`. Only `background.ts` consumes it.

**5.4 Nodes → paper chips** (`nodes.ts`). Delete the `#8aa1ff` radial self-glow (`:365–369`), the halo gradients (`:71, :122, :150`) and `shadowBlur: 22` (`:196`). A node becomes a matte disc, a 1px ink hairline, and a **downward** contact shadow: `shadowOffsetY = 2 + .02r`, `shadowBlur = 6 + .08r`, `rgba(38,32,24,.16)` / dark `rgba(0,0,0,.45)`. Emphasis is **shadow depth + scale, never halo**. Selection = a 1.5px ink ring in `--accent` + one shadow step + breath. People stay circular — round is reserved for people. Grafted from organic: the ring radius jitters ±0.6px from the existing deterministic `phase(id)` hash, so every node is drawn by the same hand, slightly differently. Half a pixel of variance is what stops warm minimalism from reading as generic, and id-hashing keeps it snapshot-safe.

> **Two hard engineering constraints the naive implementation gets wrong.**
> **(a) Per-node canvas shadows are a frame-rate cliff.** `ctx.shadowBlur` per node is expensive in canvas 2D. Pre-render node+shadow to an offscreen sprite per radius bucket (the `atlas.ts`/`caches.ts` machinery already exists) and blit. Benchmark at 200+ nodes on a mid-tier phone before the canvas slice defaults on.
> **(b) `TIER_PARAMS[1]` and `[2]` set `shadows: false`.** Today depth survives every tier because it comes from a radial gradient. If depth moves to `ctx.shadow*`, T1/T2 render flat discs. Therefore: **bake the contact shadow into the cached sprite**, not into live `ctx.shadow*` calls. Depth then survives all three tiers and costs nothing at T2.

**5.5 Strands → thread** (`edges.ts`). Stroke `--ink-3` at 55% alpha, 1.0–1.6px tapering toward the child, keeping the existing sag and depth alpha. Hovered chain darkens to `--ink-1` at 2px. Relationship dashes become *twine*: short dashes with a ½px wobble along arc length. Lost/degraded: goes slack (§4.A), never flickers.

**5.6 Growth replaces birth** — the single best idea across all three directions, and the judges agreed. Delete `drawBirthFx`'s rotating star. A new connection **draws itself**: the strand grows parent→child over 520ms `--ease-settle`, *then* the node unfurls `scale .5→1` on `--ease-anticipate`, then one 12%-alpha ink ring fades over 420ms. The connection becomes the subject of the animation, which is what the product is about.

**5.7 Labels.** Drop the pill chips where possible — draw text twice (a 3px paper-coloured stroke, then the ink fill) so it reads on grain without a chip. `tabular-nums`.

**5.8 Rest state.** Keep `DRIFT_AMP 7` but slow it 25% and jitter the phase per node from `phase(id)` — a desk in a breeze, not an orbit. Rail rect feeds `DISTURB_RADIUS` (§4.B #17).

**5.9 The two test gates that will go red if you forget them.**
- `scripts/mesh-render-parity.ts:487` pins `PULSE_HUE = "#fda4af"` as the sentinel proving the fx layer ran, asserted at `:490` (T0 draws it), `:494` (T1 keeps it), `:498` (T2 has it off). Deleting `drawStrandPulse` fails all three. **Re-point the sentinel to the strum's signature hue (`--warm` `#C4633F`) in the same commit.**
- `shadowSets()` at `:467–468` counts `ctx.shadow*` calls with assertions at `:489/:493/:497`. Baking node shadows into sprites changes those counts to zero at T0. **Update the assertion to check the sprite blit instead, in the same commit.**

---

## 6. MIGRATION — 14 slices

**Principles.** (1) The default theme stays `"dark"` until the hardcoded-colour sweep has landed — so no slice ever opens a window where the app is unreadable. (2) Both themes are built at full fidelity from Slice 1 and both are CI-snapshotted on every PR, so light-mode regressions cannot accumulate unseen. (3) The first three slices are ordered so that **if the sequence stalls after Slice 3, the product still reads as a finished change**, not half-paper and half-aurora. (4) Grafted from organic and non-negotiable: **never refactor one of the six 800–2,400-line files in the same PR as a visual change** (`settings-control-center.tsx` 2,415 · `flow-client.tsx` 1,792 · `mechat-thread.tsx` 1,298 · `explore-discovery.tsx` 935 · `post-card.tsx` 880 · `connected-accounts-client.tsx` 854).

**Slice −1 · Baseline.** Playwright snapshots of 25 routes × 2 themes × 2 viewports. No code change. This is the instrument for everything after it.

| # | Slice | Files | Verified by |
|---|---|---|---|
| **0** | **Delete the cascade winner.** Remove `globals.css:6566–7869` (the "AURORA MESH — loaded last, wins cascade" layer), the `body::before` aurora (`:6573`), `mesh-background.tsx` + its 3 shell mounts, the loader box-shadow starfield (`:4618–4679`), cursor tilt/spotlight/reticle (`:7304–7401`, `:7748`), `.mesh-ghosted` (`:7682`). **Pure deletion, zero component edits.** Re-activates three calming passes that already exist at `:274`, `:2830`, `:4146`. | `globals.css`, `mesh-background.tsx`, 3 layouts | Snapshot diff on all 25 routes; biggest visual delta per line changed in the project; trivially revertible |
| **1** | **One token file.** New `src/app/tokens.css` with both ramps; delete the duplicate dark block (`:3990–4060`); retarget `--bg-*`/`--mesh-*`/`--ds-*`/`--glass-*`/`--shimmer-*` as aliases; **declare `--shadow-soft`**; keep `layout.tsx:50` at `"dark"`. | `tokens.css`, `globals.css` | Both-theme snapshots; contrast script asserts every text token ≥4.5:1 and that `--ink-4` appears in no text rule; `/admin`, `/community-space`, `/communities/[slug]` visibly gain elevation |
| **2** | **Type.** `next/font` (Fraunces, Instrument Sans, IBM Plex Mono); scale; weight ceiling 600; `.mesh-kicker` rewrite + codemod of 69 kickers and every `tracking-[0.2em]`; **small-caps eyebrow ships here, not later**; tabular numerals. | `layout.tsx`, `globals.css`, ~40 components | CLS check; snapshot diff; grep proves 0 `uppercase`, 0 weights >600 |
| **3** | **Material & shape.** 4 elevations, 4 shadows, edge-light, grain tile, `backdrop-filter` → opaque (**allowlisting the app-shell header**), radius collapse 14→5, `ui/button.tsx:8` pill → `--r-md`, `rounded-full` allowlist codemod, focus token, co-variance rule. | `globals.css`, `ui/*`, codemod | Snapshots; `rounded-full` count 304 → ≤40; every hover rule that translates also changes shadow |
| **4** | **Motion foundation — inert.** `src/lib/motion.ts` (easings, durations, springs, mass, drag), `useScrollWeight`, `useBreath`, `<Reveal>`, `<Cascade>`, `<PaperWait>`, reduced-motion gate. **Adds no visible change on its own.** | new `lib/motion.ts` | Unit tests on the reduced-motion gate; snapshots unchanged by construction |
| **5** | **Kill the infinite.** Codemod 47 `animate-spin` → `<PaperWait>`; delete the throb family, `navSweep(+Trail)`, `meshAuroraDrift/Sweep`, `meshTravelVeil/Text`, `feedPendingSweep`, `meshFormingShimmer`, the Meshi orbit/spin/scan/shield set; ship breath; wire press-give. **Mostly deletions.** | `globals.css`, 18 files | Grep proves 0 `animate-spin`, 0 `repeat: Infinity` outside breath; manual pass over the 12 route loaders |
| **6** | **Canvas sky.** `background.ts` + the atmosphere table + grain sprite. Behind `?paper=1`. **Show this to the owner alone, before it defaults on** — the tabletop is the largest identity wager in the system. | `paint/background.ts`, `paint/shared.ts` | `mesh-render-parity` green; stored-preset test proves all five old ids still resolve; frame-time benchmark T0/T1/T2 |
| **7** | **Canvas bodies.** `nodes.ts` (sprite-baked contact shadow, ring jitter), `edges.ts` (thread, twine, slack), `fx.ts` (pulse→strum, birth→growth). **Re-point the parity sentinel and the shadow assertions in this commit.** | `paint/nodes.ts`, `edges.ts`, `fx.ts`, `scripts/mesh-render-parity.ts` | `npm run check` green; 200-node benchmark on mid-tier mobile; T1 visibly retains depth |
| **8** | **Primitives + app shell.** Button/Input/Modal/Badge/EmptyState (12 bespoke empties → 1), press-give, save-that-lands, `meshShake`; kill the double `<h1>`s (/feed, /notifications, /billing, /connected-accounts); fill `routeInfoMap` gaps (/trail, /account/delete, /one-account, /help); mobile nav labels; nav ink; scroll weight. **Unblocks every slice after it.** | `ui/*`, `(app)/layout.tsx`, nav | Snapshots; axe pass on heading order |
| **9** | **/feed.** 17 controls in 3 taxonomies → 3 source tabs + one overflow; 3 sticky bars (~180px) → 1 (~96px mobile chrome); byline capped at 3 chips; adds pull-to-refresh, drop-in, card lift. | feed route, `post-card.tsx` (visual only) | Snapshot; the testable density rule: **max 6 controls above the first item of any feed** |
| **10** | **/messages + /notifications.** popLayout reorder, typing wave, badge pop, drag-to-archive, 5 header actions → 2, rail chrome 200→96px. | messages, notifications (`mechat-thread.tsx` visual only) | Snapshot; drag tested at both snap thresholds |
| **11** | **/profile + /analytics + /settings.** Rolling counts, `layoutId` tabs, toggle mass, section cascade, save-that-lands, fix the mis-parented Meshi card. `settings-control-center.tsx` is split section-by-section **in its own commits**, never mixed with a visual change. | profile, analytics, settings | Snapshot; settings file split lands as a pure refactor commit with an identical snapshot |
| **12** | **The sweep — this is what unblocks light.** All 298 `text-white`/`white/N`, 66 raw dark hex literals, `bg-[#05070f]` on `(app)/layout.tsx:58`, /flow's 86 hardcoded whites, /trail's 38, /offline's raw `#05070f`; mesh chrome (rail→physics coupling, 8 rail pills → 4 + overflow); `backdrop-filter` allowlist removed and the CI grep switched on. | ~30 files, `flow-client.tsx` (visual only) | Grep proves 0 hardcoded colours in components; **light-theme snapshots go green for the first time** |
| **13** | **Flip and finish.** `layout.tsx:50` `"dark"` → `"light"` — **one line, its own PR, owner-approved after seeing both themes side by side.** Then: marketing/help/legal/status/about (reading strand, TOC, status breath + arrhythmia), delete the alias block, delete the `?paper=1` flag, delete dead CSS, tighten every guardrail. | `layout.tsx`, marketing routes, `tokens.css` | Full 25×2 snapshot; `globals.css` line count reported (target <3,000 from 7,898) |

**CI guardrails** (land in Slice 1 as warnings, become errors in Slice 5, except the `backdrop-filter` rule which errors in Slice 12). Grep-able strings, paste-ready:

```
rgba\(110, ?139, ?255       #6e8bff       #34e4ea       #05070f
backdrop-filter|backdrop-blur          (allowlist: modal scrim)
repeat: *Infinity|animation-iteration-count: *infinite   (allowlist: breath, paper-wait)
animate-spin|rotate: *360|transform: *rotate
font-weight: *(6[1-9][0-9]|[789][0-9]0)
text-transform: *uppercase
linear-gradient  (in any text-fill / background-clip rule)
box-shadow with a non-neutral hue
rounded-full  (allowlist: avatar|dot|badge|knob|meshi)
class(Name)?=".*(text-white|white/[0-9])   and raw #hex in components
```

**Do not sweep away.** These are already the human layer; the point of the sweep is to make them the default rather than the exception: the snapped-strand error/404 family, the 12 per-route Meshi loaders, the Mesh Gate's one-question login, the Trail's self-drawing SVG, MeChat's thread, Settings' master-detail IA, the mesh's layered chrome-dismissal manager, `heartBounce` and `bookmarkPop` (the only anticipation in the codebase — make them the model), `sim/physics.ts`, `layout.ts`, and `meshi-machine.ts`.

---

## 7. DO NOT — the list that must never come back

**Light and glow**
1. No `box-shadow` with a hue. Shadows are warm-black or nothing.
2. No glow, halo, bloom, aurora, or `globalCompositeOperation: "lighter"` — in DOM or canvas.
3. No `backdrop-filter` / frosted glass outside the modal scrim.
4. No neon, no cyan, no periwinkle `#6e8bff`, no `#34e4ea`. No colour that looks like it is powered.
5. No multi-stop gradients, and no gradient text fill. The wordmark is solid ink.
6. No glowing borders, glowing nav bars, glowing focus rings, or "edge light" that exceeds one 5%-alpha inset hairline.

**Motion**
7. **Nothing rotates.** No spinners, no `rotate: 360`, no orbiting, no scanning, no sonar rings, no shields.
8. Nothing loops except breath (5.2s, ≤3 per viewport) and `.paper-wait`.
9. No ambient motion that happens with nothing happening — no whole-canvas sway, no drifting particles, no perpetual background drift. This is the exact class of thing already rejected twice (the mascot glow, the mesh music). **A screen that moves on its own is the failure mode of this entire system.**
10. No sweeps, wipes, scanlines, comets, trails, marching ants, flicker, hyperspace, or letter-spacing animation.
11. No velocity-driven skew or rotation of lists. (Shadow lag, #2, is the only velocity effect, and it is the first cut.)
12. No confetti. One pollen fall, once, for a genuine milestone.
13. No overshoot above `--ease-anticipate`; the old `1.56` bounce never returns.

**Type and shape**
14. No `text-transform: uppercase` — the small-caps eyebrow is the only labelling device, max one per screen region.
15. No tracking above +0.02em, and no HUD kickers.
16. No weight above 600. No 950.
17. No pill radius outside the reserved allowlist (avatars, dots, badges, knobs, Meshi).
18. No fourth radius scale, no `!important` on `border-radius`, no arbitrary radius values.

**Texture and ornament** (the trap the "organic" direction fell into — decoration that performs is the same object as a mascot glow)
19. No deckle/torn edges, no `--r-leaf` asymmetric radii, no hand-cut card edges.
20. No decorative rotation jitter on stacked cards. (The ±0.6px canvas ring jitter is sub-pixel character, not visible tilt — that is the line.)
21. No skeuomorphic paper: no page-curl, no drop-shadowed "tape", no lined-notebook backgrounds, no coffee rings, no textures beyond the one grain tile.
22. No emoji in UI chrome, no illustration except Meshi.

**Structure**
23. Never more than one sticky bar per surface, 56px max.
24. Never more than 6 controls above the first item of a feed.
25. Never a border-only card; elevation always moves surface *and* shadow together.
26. Never a hover translate without a matching shadow change.
27. Never a toast for an in-place save.
28. Never hardcode a colour in a component. Ever again.
