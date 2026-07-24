// Platform sound design — every sound is synthesized on-device with the Web
// Audio API (no assets, CSP-safe, zero network). The palette is deliberately
// soft, short, and WARM: little rounded taps and gentle chimes that CONFIRM an
// action without ever announcing the app. Everything routes through one master
// bus (level + soft limiter) and a gentle lowpass, so the whole set sits at a
// single considered, non-distracting level and can never spike or sound harsh.
// All sounds respect the user's "Sounds" setting and the browser's autoplay
// rules (the context unlocks on the first gesture).

export type SoundName =
  | "pop" // selecting something / small positive tap
  | "heart" // throwing a like — quick airy swish up
  | "land" // the like landing — tiny bright tick
  | "chime" // someone arrives / success moment
  | "leave" // someone departs — soft low blip
  | "whoosh" // traveling between meshes / big transitions
  | "send" // a message leaving
  | "ding" // a toast / gentle notice
  | "ghost"; // ghost mode toggling — hollow breath

const SOUND_KEY = "meshSoundsEnabled";

export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(SOUND_KEY) !== "0";
  } catch {
    return true;
  }
}

/**
 * Whether the user has ever made an EXPLICIT sound choice (settings toggle or
 * the mesh's one-time "Sound on?" opt-in). The mesh's playful layer treats an
 * unset preference as quiet-by-default while the rest of the app keeps its
 * historical default — one preference, two defaults, zero extra toggles.
 */
export function hasSoundPreference(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(SOUND_KEY) !== null;
  } catch {
    return false;
  }
}

export function setSoundEnabled(on: boolean): void {
  try {
    localStorage.setItem(SOUND_KEY, on ? "1" : "0");
  } catch {
    // Storage may be unavailable; the session keeps the current behavior.
  }
}

let audioCtx: AudioContext | null = null;
let master: GainNode | null = null;
let unlocked = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) {
    audioCtx = new Ctor();
    // Browsers keep a context suspended until a user gesture; resume on the
    // first interaction so sounds Just Work from then on.
    const unlock = () => {
      audioCtx?.resume().catch(() => {});
      unlocked = true;
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
  }
  return audioCtx;
}

/**
 * The shared master bus: a low overall gain feeding a gentle soft-knee limiter.
 * Routing every voice through this is what makes the palette feel *designed* —
 * one restrained level, glued together, with a ceiling that catches any spike
 * so nothing is ever harsh or startling.
 */
function getMaster(ctx: AudioContext): GainNode {
  if (master && master.context === ctx) return master;
  const g = ctx.createGain();
  g.gain.value = 0.85; // everything sits softly under this — subtle but present
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -20;
  comp.knee.value = 26;
  comp.ratio.value = 3.2;
  comp.attack.value = 0.003;
  comp.release.value = 0.22;
  g.connect(comp);
  comp.connect(ctx.destination);
  master = g;
  return g;
}

/** One enveloped oscillator voice, warmed by a gentle lowpass. */
function voice(
  ctx: AudioContext,
  opts: {
    type: OscillatorType;
    from: number;
    to?: number;
    at: number;
    dur: number;
    peak: number;
    /** Lowpass cutoff (Hz) — lower is warmer/darker. Defaults to a soft 4.2k. */
    lp?: number;
    /** Cents of detune, for a touch of body without a second oscillator. */
    detune?: number;
  },
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = opts.type;
  if (opts.detune) osc.detune.value = opts.detune;
  osc.frequency.setValueAtTime(opts.from, opts.at);
  if (opts.to && opts.to !== opts.from) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.to), opts.at + opts.dur);
  }
  // Soft, click-free attack and a smooth natural release tail.
  const attack = Math.min(0.014, opts.dur * 0.35);
  gain.gain.setValueAtTime(0.0001, opts.at);
  gain.gain.exponentialRampToValueAtTime(opts.peak, opts.at + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, opts.at + opts.dur);
  // Gentle lowpass rolls off the digital "beep" harshness → a rounded, premium
  // timbre even from a bare oscillator.
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = opts.lp ?? 4200;
  lp.Q.value = 0.5;
  osc.connect(lp);
  lp.connect(gain);
  gain.connect(getMaster(ctx));
  osc.start(opts.at);
  osc.stop(opts.at + opts.dur + 0.03);
}

/** A short breath of filtered noise (for whooshes and swishes). */
function breath(
  ctx: AudioContext,
  opts: { at: number; dur: number; peak: number; fromHz: number; toHz: number; q?: number },
): void {
  const len = Math.ceil(ctx.sampleRate * opts.dur);
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  // A soft bandpass shapes the air, and a lowpass above it tames the top-end
  // hiss so a swish reads as "breath", never "static".
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = opts.q ?? 0.7;
  filter.frequency.setValueAtTime(opts.fromHz, opts.at);
  filter.frequency.exponentialRampToValueAtTime(Math.max(1, opts.toHz), opts.at + opts.dur);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = Math.max(opts.fromHz, opts.toHz) + 1400;
  const gain = ctx.createGain();
  // Ease in and out so there are no edges on the noise burst.
  gain.gain.setValueAtTime(0.0001, opts.at);
  gain.gain.exponentialRampToValueAtTime(opts.peak, opts.at + opts.dur * 0.3);
  gain.gain.exponentialRampToValueAtTime(0.0001, opts.at + opts.dur);
  src.connect(filter);
  filter.connect(lp);
  lp.connect(gain);
  gain.connect(getMaster(ctx));
  src.start(opts.at);
  src.stop(opts.at + opts.dur + 0.03);
}

/**
 * Play one of the named platform sounds. Silent no-op when sounds are off,
 * unsupported, or the context hasn't been unlocked by a gesture yet.
 */
export function playSound(name: SoundName): void {
  if (!isSoundEnabled()) return;
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    if (!unlocked) return;
    ctx.resume().catch(() => {});
  }
  const t = ctx.currentTime + 0.005;
  switch (name) {
    case "pop":
      // A soft, rounded tap — warm body, no click.
      voice(ctx, { type: "sine", from: 470, to: 700, at: t, dur: 0.085, peak: 0.05, lp: 3400 });
      break;
    case "heart":
      // A gentle airy lift — a breath rising under a soft tone.
      breath(ctx, { at: t, dur: 0.15, peak: 0.03, fromHz: 760, toHz: 2100, q: 0.6 });
      voice(ctx, { type: "sine", from: 600, to: 1080, at: t, dur: 0.14, peak: 0.03, lp: 3800 });
      break;
    case "land":
      // A tiny warm tick where the heart settles.
      voice(ctx, { type: "triangle", from: 1180, at: t, dur: 0.06, peak: 0.038, lp: 4600 });
      voice(ctx, { type: "sine", from: 1760, at: t + 0.028, dur: 0.05, peak: 0.02, lp: 5200 });
      break;
    case "chime":
      // Two soft notes a perfect fifth apart — a pleasant, unobtrusive success.
      voice(ctx, { type: "sine", from: 784, at: t, dur: 0.3, peak: 0.032, lp: 5200, detune: -3 });
      voice(ctx, { type: "sine", from: 1176, at: t + 0.075, dur: 0.32, peak: 0.024, lp: 5400 });
      break;
    case "leave":
      // A soft low fall as someone slips away.
      voice(ctx, { type: "sine", from: 460, to: 290, at: t, dur: 0.2, peak: 0.03, lp: 2600 });
      break;
    case "whoosh":
      // Smooth moving air for big transitions — no hiss.
      breath(ctx, { at: t, dur: 0.36, peak: 0.05, fromHz: 380, toHz: 1900, q: 0.5 });
      voice(ctx, { type: "sine", from: 300, to: 620, at: t, dur: 0.3, peak: 0.016, lp: 1800 });
      break;
    case "send":
      // A light upward swish as a message leaves.
      voice(ctx, { type: "sine", from: 640, to: 1120, at: t, dur: 0.12, peak: 0.036, lp: 4000 });
      breath(ctx, { at: t, dur: 0.12, peak: 0.02, fromHz: 1200, toHz: 2600, q: 0.6 });
      break;
    case "ding":
      // A clean, soft bell with a whisper of octave shimmer.
      voice(ctx, { type: "sine", from: 1046, at: t, dur: 0.22, peak: 0.03, lp: 5600 });
      voice(ctx, { type: "sine", from: 2092, at: t + 0.005, dur: 0.12, peak: 0.01, lp: 6200 });
      break;
    case "ghost":
      // A hollow, breathy exhale as the Meshi fades.
      breath(ctx, { at: t, dur: 0.42, peak: 0.035, fromHz: 1200, toHz: 300, q: 0.5 });
      voice(ctx, { type: "sine", from: 420, to: 210, at: t, dur: 0.34, peak: 0.02, lp: 1600 });
      break;
  }
}

// C-major pentatonic across ~1.5 octaves — ANY sequence of these sounds
// musical, so sweeping across several mesh strands plays a pleasant
// glissando no matter which filaments you brush (no wrong notes possible).
const PENTATONIC_HZ = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25] as const;

/**
 * A soft plucked-string tone for the mesh's strand strum. `degree` picks a
 * step of the pentatonic scale (0 = lowest). Same master bus, same gating,
 * same warmth as every other platform sound; allocates nothing while sounds
 * are off.
 */
export function playStrum(degree: number): void {
  if (!isSoundEnabled()) return;
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    if (!unlocked) return;
    ctx.resume().catch(() => {});
  }
  const t = ctx.currentTime + 0.005;
  const f = PENTATONIC_HZ[Math.max(0, Math.min(PENTATONIC_HZ.length - 1, Math.round(degree)))];
  // A rounded string body with a whisper of octave shimmer — harp, not beep.
  voice(ctx, { type: "triangle", from: f, at: t, dur: 0.34, peak: 0.034, lp: 3000, detune: -4 });
  voice(ctx, { type: "sine", from: f * 2, at: t + 0.004, dur: 0.16, peak: 0.011, lp: 4200 });
}
