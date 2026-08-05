// ONE requestAnimationFrame loop for the whole mesh — the fixed phase
// pipeline every frame system rides instead of racing its own rAF:
//
//   sim(dt)      → physics + camera motion (world state settles)
//   paint(dt)    → hitmap rebuild + canvas draw (pixels from settled state)
//   domSync(dt)  → Meshi/heart DOM layer (screen positions from the SAME frame)
//
// One clock, one dt clamp, one frame cap. The old scene ran two uncoordinated
// loops — the canvas render loop and a second Meshi/hearts DOM loop — with
// separate dt clocks, duplicated frame caps, and the DOM loop consuming the
// paint loop's hitbox side-effects with no ordering guarantee. Phases on a
// single loop make that ordering structural. The scheduler also carries the
// rolling frame-time telemetry that baselines the PR3 frame-budget SLO
// (physics + paint ≤ 6ms on a 2019 mid-tier phone at tier 0).

type FramePhase = "sim" | "paint" | "domSync";

interface FrameTiming {
  /** The rAF timestamp of this frame (performance.now() timebase). */
  time: number;
  /** Ms since the previous EXECUTED frame — THE one dt clamp, so a
   * tab-refocus gap (dt of many seconds) can't blow up physics, easing, or
   * the perf watchdog's average in any phase. */
  dt: number;
}

/** The one dt clamp (ms). The old loops disagreed (64 in render, 50 in the
 * DOM step); a real slow frame is still well within this bound, and physics
 * additionally clamps its own integration step internally. */
const MAX_DT = 64;
/** First-frame dt, when there is no previous frame to measure from. */
const FIRST_DT = 16;
/** Rolling telemetry window (~2s of frames at 60fps). */
const STATS_WINDOW = 120;

/** Rolling frame-time stats — dev telemetry only, no UI. The PR3 quality
 * governor's SLO (physics + paint ≤ 6ms) will gate on `simPlusPaint`. */
export interface MeshFrameStats {
  /** Samples currently in the rolling window. */
  sampleCount: number;
  /** True rAF-to-rAF interval of executed frames (unclamped). */
  frame: { avgMs: number; p95Ms: number; maxMs: number };
  simAvgMs: number;
  paintAvgMs: number;
  domSyncAvgMs: number;
  /** Physics + paint together — the pair the frame-budget SLO measures. */
  simPlusPaint: { avgMs: number; p95Ms: number };
}

export interface MeshSchedulerOptions {
  /** Minimum ms between executed frames, read per frame (0 = every rAF).
   * The perf governor hands its deepest-tier ~30fps cap in through this, so
   * frame skipping happens ONCE for the whole pipeline. */
  frameCapMs?: () => number;
}

export interface MeshScheduler {
  /** Register (or clear, with null) a phase. The loop runs while any phase
   * is registered and stops itself once the last one clears. */
  setPhase(phase: FramePhase, fn: ((frame: FrameTiming) => void) | null): void;
  /** Rolling frame-time stats; null until a frame has executed. */
  getStats(): MeshFrameStats | null;
  /** True while the internal rAF loop is scheduled. */
  isRunning(): boolean;
}

// Dev-mode invariant: exactly ONE mesh rAF loop may run at a time. Counted
// across every scheduler instance, so a second scheduler (or a re-introduced
// side loop wired through one) fails loudly in development.
let liveLoops = 0;

export function createMeshScheduler(options: MeshSchedulerOptions = {}): MeshScheduler {
  const phases: Record<FramePhase, ((frame: FrameTiming) => void) | null> = {
    sim: null,
    paint: null,
    domSync: null,
  };
  let raf = 0;
  let running = false;
  let last = 0;
  let lastRun = 0;

  // Telemetry ring buffers — flat typed arrays so recording a frame
  // allocates nothing on the hot path.
  const frameMs = new Float32Array(STATS_WINDOW);
  const simMs = new Float32Array(STATS_WINDOW);
  const paintMs = new Float32Array(STATS_WINDOW);
  const domMs = new Float32Array(STATS_WINDOW);
  let sampleCount = 0;
  let sampleIdx = 0;

  const tick = (time: number) => {
    raf = requestAnimationFrame(tick);
    // Frame-rate cap only when the perf governor asks for it (deepest tier):
    // a steady 30fps reads far smoother than a stuttering rate on a device
    // that can't sustain more.
    const cap = options.frameCapMs?.() ?? 0;
    if (cap > 0 && time - lastRun < cap) return;
    lastRun = time;
    const rawDt = last ? time - last : FIRST_DT;
    last = time;
    const frame: FrameTiming = { time, dt: Math.min(rawDt, MAX_DT) };
    const t0 = performance.now();
    phases.sim?.(frame);
    const t1 = performance.now();
    phases.paint?.(frame);
    const t2 = performance.now();
    phases.domSync?.(frame);
    const t3 = performance.now();
    frameMs[sampleIdx] = rawDt;
    simMs[sampleIdx] = t1 - t0;
    paintMs[sampleIdx] = t2 - t1;
    domMs[sampleIdx] = t3 - t2;
    sampleIdx = (sampleIdx + 1) % STATS_WINDOW;
    if (sampleCount < STATS_WINDOW) sampleCount += 1;
  };

  const start = () => {
    if (running) return;
    running = true;
    liveLoops += 1;
    if (process.env.NODE_ENV !== "production" && liveLoops > 1) {
      throw new Error(
        `Mesh scheduler invariant violated: ${liveLoops} rAF loops running — ` +
          "the mesh drives everything from ONE loop; register a phase instead.",
      );
    }
    last = 0;
    lastRun = 0;
    raf = requestAnimationFrame(tick);
  };

  const stop = () => {
    if (!running) return;
    running = false;
    liveLoops -= 1;
    cancelAnimationFrame(raf);
  };

  const scheduler: MeshScheduler = {
    setPhase(phase, fn) {
      phases[phase] = fn;
      if (phases.sim || phases.paint || phases.domSync) start();
      else stop();
    },
    getStats() {
      if (sampleCount === 0) return null;
      const take = (src: Float32Array) => Array.from(src.subarray(0, sampleCount));
      const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
      const p95 = (xs: number[]) => {
        const sorted = [...xs].sort((a, b) => a - b);
        return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
      };
      const frames = take(frameMs);
      const sim = take(simMs);
      const paint = take(paintMs);
      const dom = take(domMs);
      const simPaint = sim.map((v, i) => v + paint[i]);
      return {
        sampleCount,
        frame: { avgMs: avg(frames), p95Ms: p95(frames), maxMs: Math.max(...frames) },
        simAvgMs: avg(sim),
        paintAvgMs: avg(paint),
        domSyncAvgMs: avg(dom),
        simPlusPaint: { avgMs: avg(simPaint), p95Ms: p95(simPaint) },
      };
    },
    isRunning: () => running,
  };

  if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
    // Dev-only console hook (`__meshFrameStats()`), never a UI: the baseline
    // the PR3 frame-budget SLO will be measured against.
    (window as unknown as { __meshFrameStats?: () => MeshFrameStats | null }).__meshFrameStats =
      () => scheduler.getStats();
  }

  return scheduler;
}
