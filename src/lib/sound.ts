// Platform sound design — every sound is synthesized on-device with the Web
// Audio API (no assets, CSP-safe, zero network). The palette is deliberately
// soft and short: little glass pops and warm chimes that CONFIRM an action,
// never announce the app. All sounds respect the user's "Sounds" setting and
// the browser's autoplay rules (the context unlocks on the first gesture).

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

export function setSoundEnabled(on: boolean): void {
  try {
    localStorage.setItem(SOUND_KEY, on ? "1" : "0");
  } catch {
    // Storage may be unavailable; the session keeps the current behavior.
  }
}

let audioCtx: AudioContext | null = null;
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

/** One enveloped oscillator voice. */
function voice(
  ctx: AudioContext,
  opts: {
    type: OscillatorType;
    from: number;
    to?: number;
    at: number;
    dur: number;
    peak: number;
    curve?: "exp" | "lin";
  },
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = opts.type;
  osc.frequency.setValueAtTime(opts.from, opts.at);
  if (opts.to && opts.to !== opts.from) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.to), opts.at + opts.dur);
  }
  gain.gain.setValueAtTime(0.0001, opts.at);
  gain.gain.exponentialRampToValueAtTime(opts.peak, opts.at + Math.min(0.018, opts.dur * 0.3));
  gain.gain.exponentialRampToValueAtTime(0.0001, opts.at + opts.dur);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(opts.at);
  osc.stop(opts.at + opts.dur + 0.02);
}

/** A short breath of filtered noise (for whooshes and swishes). */
function breath(
  ctx: AudioContext,
  opts: { at: number; dur: number; peak: number; fromHz: number; toHz: number },
): void {
  const len = Math.ceil(ctx.sampleRate * opts.dur);
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = 1.1;
  filter.frequency.setValueAtTime(opts.fromHz, opts.at);
  filter.frequency.exponentialRampToValueAtTime(opts.toHz, opts.at + opts.dur);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, opts.at);
  gain.gain.exponentialRampToValueAtTime(opts.peak, opts.at + opts.dur * 0.25);
  gain.gain.exponentialRampToValueAtTime(0.0001, opts.at + opts.dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  src.start(opts.at);
  src.stop(opts.at + opts.dur + 0.02);
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
      voice(ctx, { type: "sine", from: 520, to: 780, at: t, dur: 0.09, peak: 0.055 });
      break;
    case "heart":
      breath(ctx, { at: t, dur: 0.16, peak: 0.05, fromHz: 900, toHz: 2600 });
      voice(ctx, { type: "sine", from: 660, to: 1180, at: t, dur: 0.14, peak: 0.035 });
      break;
    case "land":
      voice(ctx, { type: "triangle", from: 1320, at: t, dur: 0.07, peak: 0.05 });
      voice(ctx, { type: "sine", from: 1980, at: t + 0.03, dur: 0.06, peak: 0.03 });
      break;
    case "chime":
      voice(ctx, { type: "sine", from: 880, at: t, dur: 0.22, peak: 0.045 });
      voice(ctx, { type: "sine", from: 1320, at: t + 0.07, dur: 0.24, peak: 0.035 });
      break;
    case "leave":
      voice(ctx, { type: "sine", from: 520, to: 300, at: t, dur: 0.18, peak: 0.04 });
      break;
    case "whoosh":
      breath(ctx, { at: t, dur: 0.34, peak: 0.06, fromHz: 500, toHz: 2200 });
      break;
    case "send":
      voice(ctx, { type: "sine", from: 700, to: 1250, at: t, dur: 0.12, peak: 0.05 });
      breath(ctx, { at: t, dur: 0.12, peak: 0.028, fromHz: 1300, toHz: 3000 });
      break;
    case "ding":
      voice(ctx, { type: "sine", from: 1046, at: t, dur: 0.18, peak: 0.04 });
      break;
    case "ghost":
      breath(ctx, { at: t, dur: 0.4, peak: 0.045, fromHz: 1400, toHz: 320 });
      voice(ctx, { type: "sine", from: 440, to: 220, at: t, dur: 0.32, peak: 0.025 });
      break;
  }
}
