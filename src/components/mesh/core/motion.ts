// Motion & quality — the mesh's two-way quality-tier ladder.
//
// One rule from the blueprint governs everything here: IDENTICAL SEMANTICS AT
// EVERY TIER. Every feature works at T2 exactly as it does at T0 — nodes,
// strands, selection, arrival, presence — only fidelity (garnish) drops:
//
//   T0  full: shadows, full particles, live strand physics, DPR ≤ 2
//   T1  no shadows, particles halved, DPR ≤ 1.5
//   T2  static strands, fx off, static background, ~30fps cap, DPR ≤ 1.3
//
// Two mechanisms pick the tier:
//   1. `probeStartTier()` — a startup device probe (deviceMemory /
//      hardwareConcurrency / devicePixelRatio heuristic, absorbing the old
//      scene's cores<=2||mem<=2 seed) pins known-weak devices to T1/T2 so
//      they never pay the jank-discovery cost. The probed tier is the
//      PERMANENT FLOOR: the governor never promotes past it.
//   2. `createQualityGovernor()` — a frame-budget monitor wired to the
//      scheduler's telemetry (core/scheduler.ts `MeshFrameStats`). Sustained
//      frames over budget demote one tier; sustained headroom promotes back
//      (the ladder is two-way, unlike the old one-way watchdog whose
//      demotion thresholds are absorbed here verbatim: smoothed inter-frame
//      time > 22ms for 60 consecutive frames after a 30-frame warm-up).

import type { MeshFrameStats } from "./scheduler";

export type QualityTier = 0 | 1 | 2;

export interface TierParams {
  /** Device-pixel-ratio ceiling (min'd with the real DPR at resize). */
  dprCap: number;
  /** Scheduler frame cap in ms (0 = every rAF; ~31 = steady 30fps). */
  frameCapMs: number;
  /** Canvas shadows (shadowBlur — the most expensive 2D op) allowed? */
  shadows: boolean;
  /** 0..1 multiplier on decorative particle counts (birth ripples/sparks). */
  particleScale: number;
  /** Pulses/bursts fx layer enabled? (The interactions themselves always work.) */
  fx: boolean;
  /** Strands bend through live physics control points; false = rest pose. */
  liveStrands: boolean;
  /** How stale the cached background layer may grow while the camera is
   * still (twinkle/nebula refresh). Infinity = repaint on resize/theme only. */
  /** Time-based staleness bound for the cached sheet. Camera pan/zoom always
   *  repaints (the orbit contours are world-anchored); this clock only bounds
   *  drift when nothing else changed, so Infinity on the deepest tier means
   *  "input-driven repaints only", not a frozen background. */
  backgroundRefreshMs: number;
}

export const TIER_PARAMS: readonly TierParams[] = [
  { dprCap: 2, frameCapMs: 0, shadows: true, particleScale: 1, fx: true, liveStrands: true, backgroundRefreshMs: 150 },
  { dprCap: 1.5, frameCapMs: 0, shadows: false, particleScale: 0.5, fx: true, liveStrands: true, backgroundRefreshMs: 400 },
  { dprCap: 1.3, frameCapMs: 31, shadows: false, particleScale: 0, fx: false, liveStrands: false, backgroundRefreshMs: Infinity },
];

/**
 * Startup device probe: pick the tier a device STARTS at (and is floored to).
 * Known-weak hardware starts degraded instead of janking its way down.
 */
export function probeStartTier(): QualityTier {
  if (typeof navigator === "undefined") return 0;
  const cores = navigator.hardwareConcurrency || 8;
  const mem = (navigator as { deviceMemory?: number }).deviceMemory ?? 8;
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  // Absorbed from the old scene's seed: very few cores / very little memory
  // ⇒ straight to the deepest tier.
  if (cores <= 2 || mem <= 2) return 2;
  // Mid-weak: few cores or little memory, or a dense screen a weak GPU must
  // fill (high DPR + few cores is the classic budget-phone shape).
  if (cores <= 4 || mem <= 4 || (dpr >= 3 && cores <= 6)) return 1;
  return 0;
}

// --- Frame-budget monitor thresholds -------------------------------------
/** The PR3 SLO: physics + paint together on one frame, ms. */
const FRAME_BUDGET_MS = 6;
/** Ignore the first frames after mount / a tier change (startup jank). */
const WARMUP_FRAMES = 30;
/** A frame is "slow" when the smoothed inter-frame interval is below ~45fps
 * (absorbed from the legacy watchdog). */
const SLOW_FRAME_MS = 22;
/** Consecutive slow frames (~1s at 60fps) before demoting one tier. */
const DEMOTE_AFTER_SLOW_FRAMES = 60;
/** simPlusPaint p95 this far over budget also counts a demotion window even
 * if rAF cadence looks fine (e.g. 120Hz devices hiding cost in headroom). */
const DEMOTE_BUDGET_P95_MS = FRAME_BUDGET_MS * 2;
const DEMOTE_BUDGET_WINDOWS = 2;
/** Sustained headroom (ms) before promoting one tier back (~5s). */
const PROMOTE_HEADROOM_MS = 5000;
/** Uncapped tiers promote on WORK headroom relative to the display's observed
 * base rAF cadence, never on an absolute inter-frame time: a vsync'd 60Hz
 * display's dt is never below ~16.7ms no matter how idle the device is, so an
 * absolute wall-clock gate (the old `dt < 14`) silently made the ladder
 * one-way there. Work p95 must fit inside this fraction of the base cadence
 * (and always inside the SLO budget) to count as headroom. */
const PROMOTE_WORK_CADENCE_FRACTION = 0.5;
/** A frame "holds cadence" (isn't dropped) when its dt stays within this
 * factor of the observed base rAF interval; beyond it, headroom resets. */
const PROMOTE_CADENCE_SLACK = 1.4;
/** Smallest inter-frame interval trusted as a real vsync period when learning
 * the base cadence (240Hz ≈ 4.2ms; below that is timer noise). */
const MIN_CREDIBLE_FRAME_MS = 3;
/** After any demotion, promotion locks for this long (no flapping). */
const PROMOTE_LOCK_MS = 30000;
/** Consult the (rolling, allocation-y) scheduler stats every N frames only. */
const STATS_EVERY_FRAMES = 30;

export interface QualityGovernor {
  tier(): QualityTier;
  /** Params of the current tier — a stable constant object, safe per-frame. */
  params(): TierParams;
  /** Feed one frame's true inter-frame interval (the scheduler's raw dt). */
  onFrame(dt: number): void;
  /** Called with the new tier after every change (demote or promote). */
  onTierChange(cb: (tier: QualityTier) => void): () => void;
}

export interface QualityGovernorOptions {
  startTier: QualityTier;
  /** The tier the governor may never promote past. Defaults to `startTier`
   * (the probe's pin); pass 0 to allow full recovery regardless of probe. */
  minTier?: QualityTier;
  /** Scheduler telemetry hook — `scheduler.getStats` — for the budget SLO. */
  getStats?: () => MeshFrameStats | null;
}

export function createQualityGovernor(options: QualityGovernorOptions): QualityGovernor {
  const minTier = options.minTier ?? options.startTier;
  let tier: QualityTier = options.startTier;
  let frames = 0;
  let frameCost = 16; // smoothed inter-frame ms (legacy watchdog's estimator)
  let slow = 0; // consecutive slow frames
  let overBudgetWindows = 0;
  let headroomMs = 0;
  let promoteLockMs = 0;
  // The display's base rAF cadence (≈ vsync period: ~16.7ms at 60Hz, ~8.3ms
  // at 120Hz): the smallest credible inter-frame interval observed. A display
  // property, so it survives tier changes.
  let baseFrameMs = Infinity;
  let statsCountdown = STATS_EVERY_FRAMES;
  let statsHeadroomOk = false;
  const listeners = new Set<(tier: QualityTier) => void>();

  const changeTier = (next: QualityTier) => {
    tier = next;
    frames = 0;
    frameCost = 16;
    slow = 0;
    overBudgetWindows = 0;
    headroomMs = 0;
    statsHeadroomOk = false;
    listeners.forEach((cb) => cb(tier));
  };

  return {
    tier: () => tier,
    params: () => TIER_PARAMS[tier],
    onFrame(dt) {
      frames += 1;
      // Learn the base rAF cadence from the fastest credible frame seen. Only
      // uncapped tiers observe the true vsync interval — under T2's frame cap
      // dt is pinned at ~31ms and would poison the estimate on fast displays.
      if (TIER_PARAMS[tier].frameCapMs === 0 && dt >= MIN_CREDIBLE_FRAME_MS && dt < baseFrameMs) {
        baseFrameMs = dt;
      }
      if (promoteLockMs > 0) promoteLockMs = Math.max(0, promoteLockMs - dt);
      if (frames <= WARMUP_FRAMES) return;

      // Periodic budget check against the scheduler's rolling telemetry —
      // getStats() allocates, so it runs every STATS_EVERY_FRAMES, not per
      // frame. It serves both directions: over-budget p95 ⇒ demotion vote,
      // well-under-budget p95 ⇒ the work-time half of the promotion gate.
      statsCountdown -= 1;
      if (statsCountdown <= 0) {
        statsCountdown = STATS_EVERY_FRAMES;
        const stats = options.getStats?.() ?? null;
        if (stats && stats.sampleCount >= STATS_EVERY_FRAMES) {
          const p95 = stats.simPlusPaint.p95Ms;
          if (tier < 2 && p95 > DEMOTE_BUDGET_P95_MS) {
            overBudgetWindows += 1;
            if (overBudgetWindows >= DEMOTE_BUDGET_WINDOWS) {
              promoteLockMs = PROMOTE_LOCK_MS;
              changeTier((tier + 1) as QualityTier);
              return;
            }
          } else {
            overBudgetWindows = 0;
          }
          // Under a frame cap (T2) the rAF interval is pinned at ~31ms no
          // matter how fast the device is, so promotion out of T2 gates on
          // WORK time alone (and demands extra slack). Uncapped tiers gate
          // work p95 against the observed base rAF cadence — the display's
          // vsync interval is the real per-frame budget — but never looser
          // than the SLO budget itself.
          const capped = TIER_PARAMS[tier].frameCapMs > 0;
          statsHeadroomOk = capped
            ? p95 < FRAME_BUDGET_MS * 0.66
            : p95 < Math.min(FRAME_BUDGET_MS, baseFrameMs * PROMOTE_WORK_CADENCE_FRACTION);
        } else {
          statsHeadroomOk = false;
        }
      }

      // Demotion — the legacy watchdog's exact judgement, absorbed: smoothed
      // true inter-frame time, sustained CONSECUTIVE slow frames, single fast
      // frame resets (borderline devices never get nudged down by noise).
      if (tier < 2) {
        frameCost = frameCost * 0.9 + dt * 0.1;
        if (frameCost > SLOW_FRAME_MS) {
          if (++slow > DEMOTE_AFTER_SLOW_FRAMES) {
            promoteLockMs = PROMOTE_LOCK_MS;
            changeTier((tier + 1) as QualityTier);
            return;
          }
        } else {
          slow = 0;
        }
      }

      // Promotion — two-way ladder: sustained headroom recovers fidelity,
      // but never past the probe's floor, and never soon after a demotion.
      // Uncapped tiers ask "is the display holding its native cadence?"
      // (dropped frames show up as dt ≈ 2× the base interval), never
      // "is dt below an absolute wall-clock number" — a vsync'd 60Hz display
      // never beats ~16.7ms, so an absolute gate would freeze recovery there.
      if (tier > minTier && promoteLockMs <= 0) {
        const capped = TIER_PARAMS[tier].frameCapMs > 0;
        const frameOk = capped || dt < baseFrameMs * PROMOTE_CADENCE_SLACK;
        if (frameOk && statsHeadroomOk) {
          headroomMs += dt;
          if (headroomMs >= PROMOTE_HEADROOM_MS) {
            changeTier((tier - 1) as QualityTier);
          }
        } else {
          headroomMs = 0;
        }
      }
    },
    onTierChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}
