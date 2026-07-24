// Loudness normalization for CONTENT audio — Flow reels, feed videos, MeChat
// attachments. Content arrives from many platforms mastered at wildly
// different levels: one reel whispers, the next blasts. Browsers can't do true
// LUFS normalization without decoding ahead of time, but a Web Audio dynamics
// pipeline (compressor tuned for leveling + makeup gain) gets most of the way
// there in real time: loud sources are pulled down hard, quiet sources get a
// gentle lift, and everything lands at one considered level.
//
// SAFETY FIRST — a silent reel is far worse than an unnormalized one:
// - `createMediaElementSource` permanently re-routes an element's audio
//   through the graph, and CORS-tainted media routed that way plays SILENCE.
//   So the graph only ever attaches to media we can prove is safe: same-origin
//   URLs (incl. blob:/data:), or cross-origin media the element fetched with
//   `crossOrigin="anonymous"` (that load only succeeds when the server grants
//   CORS, so by the time it plays the output is untainted). Everything else
//   keeps its native audio path untouched.
// - Every entry point is wrapped: if context creation, source creation, or
//   wiring fails for ANY reason, the element keeps playing with native audio
//   (or, if the source node already exists, gets wired straight to the
//   destination so sound still flows).
// - `createMediaElementSource` may only ever run ONCE per element — a WeakMap
//   caches the per-element decision so re-plays and re-renders never
//   double-attach.
//
// The "Normalize volume" preference (Settings → Appearance) is read live:
// localStorage + a same-tab event + the cross-tab storage event, so toggling
// applies without a reload. Turning it OFF retunes attached graphs to a
// transparent bypass (the routing itself can't be undone); turning it ON
// attaches to anything currently registered and playing.

const NORMALIZE_KEY = "meshNormalizeVolume";

/** Same-tab event fired whenever the preference flips, so graphs retune live. */
const NORMALIZE_EVENT = "meshNormalizeVolumeChanged";

/** Read the "Normalize volume" preference. Default ON. Safe on the server. */
export function isVolumeNormalizationEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(NORMALIZE_KEY) !== "0";
  } catch {
    return true;
  }
}

/** Persist the preference and fan it out (same tab now, other tabs via storage). */
export function setVolumeNormalizationEnabled(on: boolean): void {
  try {
    localStorage.setItem(NORMALIZE_KEY, on ? "1" : "0");
  } catch {
    // Storage may be unavailable; the session keeps the current behavior.
  }
  try {
    window.dispatchEvent(new Event(NORMALIZE_EVENT));
  } catch {
    // best-effort broadcast
  }
}

// Compressor settings tuned for loudness LEVELING (not musical glue): a low
// threshold with a wide knee catches nearly all program material, the steep
// ratio flattens the loud stuff toward one ceiling, fast attack tames spikes,
// and the makeup gain lifts the now-conservative level back to "present".
const LEVELING = { threshold: -24, knee: 30, ratio: 12, attack: 0.003, release: 0.25, makeup: 1.3 };
// Transparent bypass for when the pref is OFF but the element is already
// routed through the graph: 1:1 ratio and unity gain ≈ the native sound.
const TRANSPARENT = { threshold: 0, knee: 0, ratio: 1, attack: 0.003, release: 0.25, makeup: 1 };

type NormalizerNodes = { compressor: DynamicsCompressorNode; makeup: GainNode };
type ElementState = {
  /** Present once the element is routed through the graph. */
  nodes?: NormalizerNodes;
  /** Permanently unsafe to route (CORS) — never try again for this element. */
  skipped?: boolean;
};

// Per-element decisions. WeakMap so a discarded element (and its graph nodes,
// which nothing else references) is garbage-collected with it.
const states = new WeakMap<HTMLMediaElement, ElementState>();
// Everything that ever asked to be normalized, weakly held, so a pref flip can
// retune attached graphs and late-attach elements that played while OFF.
const registry = new Set<WeakRef<HTMLMediaElement>>();

let audioCtx: AudioContext | null = null;
let unlocked = false;
let listening = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) {
    audioCtx = new Ctor();
    // Browsers keep a context suspended until a user gesture; resume on
    // interaction so normalized audio Just Works from then on (muted autoplay
    // doesn't need the context running — unmuting is a gesture). The listeners
    // stay armed until a resume actually STICKS, so a rejected first attempt
    // can never strand a routed element in silence.
    const unlock = () => {
      unlocked = true;
      const ctx = audioCtx;
      if (!ctx) return;
      ctx
        .resume()
        .then(() => {
          if (ctx.state === "running") {
            window.removeEventListener("pointerdown", unlock);
            window.removeEventListener("keydown", unlock);
          }
        })
        .catch(() => {});
    };
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
  }
  return audioCtx;
}

/**
 * Is it provably safe to route this element's CURRENT source through the
 * graph? Same-origin (incl. blob:/data:) always is. Cross-origin is safe only
 * when the element fetched it under CORS (`crossOrigin="anonymous"`): that
 * load fails outright without server approval, so anything actually playing
 * is untainted. Cross-origin WITHOUT the attribute plays fine natively but
 * would output pure silence through the graph — never route it.
 * Returns null when there's no source yet (decide again at the next play).
 */
function canRouteSafely(el: HTMLMediaElement): boolean | null {
  const src = el.currentSrc || el.src;
  if (!src) return null;
  if (src.startsWith("blob:") || src.startsWith("data:")) return true;
  try {
    if (new URL(src, window.location.href).origin === window.location.origin) return true;
  } catch {
    return false;
  }
  return el.crossOrigin === "anonymous";
}

function applyTuning(nodes: NormalizerNodes, on: boolean): void {
  const t = on ? LEVELING : TRANSPARENT;
  nodes.compressor.threshold.value = t.threshold;
  nodes.compressor.knee.value = t.knee;
  nodes.compressor.ratio.value = t.ratio;
  nodes.compressor.attack.value = t.attack;
  nodes.compressor.release.value = t.release;
  // Ramp the makeup gain instead of stepping it so a live toggle never clicks.
  const ctx = nodes.makeup.context;
  nodes.makeup.gain.setTargetAtTime(t.makeup, ctx.currentTime, 0.05);
}

/** Route one element through source → compressor → makeup gain → destination. */
function tryAttach(el: HTMLMediaElement): void {
  const state = states.get(el) ?? {};
  if (state.nodes || state.skipped) return;
  const safe = canRouteSafely(el);
  if (safe === null) return; // no source yet — decide at the next play
  if (!safe) {
    // CORS-tainted through the graph = silence. Native audio stays untouched
    // for this element, forever (sources are fixed per mount in this app).
    states.set(el, { skipped: true });
    return;
  }
  const ctx = getCtx();
  if (!ctx) return;
  let source: MediaElementAudioSourceNode | null = null;
  try {
    source = ctx.createMediaElementSource(el);
    const compressor = ctx.createDynamicsCompressor();
    const makeup = ctx.createGain();
    makeup.gain.value = LEVELING.makeup;
    const nodes = { compressor, makeup };
    applyTuning(nodes, true);
    source.connect(compressor);
    compressor.connect(makeup);
    makeup.connect(ctx.destination);
    states.set(el, { nodes });
  } catch {
    // Source creation alone already re-routes the element's audio — if wiring
    // failed after that point, patch it straight to the destination so the
    // element is never left silent. If even that fails there was no re-route.
    if (source) {
      try {
        source.connect(ctx.destination);
        states.set(el, { skipped: true });
      } catch {
        // The element keeps its native audio path.
      }
    }
  }
}

/** Pref flipped: retune every attached graph, late-attach what played while OFF. */
function retuneAll(): void {
  const on = isVolumeNormalizationEnabled();
  for (const ref of registry) {
    const el = ref.deref();
    if (!el) {
      registry.delete(ref);
      continue;
    }
    try {
      const state = states.get(el);
      if (state?.nodes) applyTuning(state.nodes, on);
      else if (on && !el.paused) tryAttach(el);
    } catch {
      // Never let one element's failure break the others (or the toggle).
    }
  }
  if (on && audioCtx?.state === "suspended" && unlocked) audioCtx.resume().catch(() => {});
}

function listenOnce(): void {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener(NORMALIZE_EVENT, retuneAll);
  window.addEventListener("storage", (event) => {
    if (event.key === null || event.key === NORMALIZE_KEY) retuneAll();
  });
}

/**
 * Level this element's loudness. Call from the element's `play` event — never
 * on preload — so attachment always happens with the real source URL, under
 * the browser's own gesture accounting. Idempotent: safe to call on every
 * play. Guaranteed never to throw and never to break playback — when the
 * graph can't be used (no Web Audio, CORS-unsafe source, any wiring failure)
 * the element keeps its native audio.
 */
export function attachNormalizer(el: HTMLMediaElement): void {
  if (typeof window === "undefined" || !el) return;
  try {
    listenOnce();
    if (!states.has(el)) {
      states.set(el, {});
      registry.add(new WeakRef(el));
    }
    if (isVolumeNormalizationEnabled()) tryAttach(el);
    // Play is (almost always) gesture-driven — the right moment to resume a
    // context the autoplay policy left suspended.
    if (audioCtx?.state === "suspended") audioCtx.resume().catch(() => {});
  } catch {
    // Normalization is strictly best-effort; playback must never notice.
  }
}

/**
 * Cleanup guidance, as an explicit API: there is deliberately NOTHING to tear
 * down per element. A media-element graph lives exactly as long as its element
 * (`createMediaElementSource` can't be undone; the WeakMap/WeakRefs don't pin
 * anything, so GC reclaims element + nodes together), and the AudioContext is
 * shared and persists for the session. Calling this is always safe and does
 * not interrupt audio.
 */
export function detachSafe(el: HTMLMediaElement): void {
  void el; // element-lifetime graphs — intentionally a no-op
}
