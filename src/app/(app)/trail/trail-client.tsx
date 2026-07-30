"use client";

// Your monthly Trail — the mesh's answer to a wrapped recap. Not a table of
// statistics: the month rendered as the literal path you traveled through
// your world, drawn as a glowing thread through every moment, in order.
// Built only from your own activity; only you can ever see it.

import { motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, Footprints, Lock, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RouteWait } from "@/components/loading/route-wait";
import { inkForFill } from "@/lib/palette";

type TrailStep = {
  id: string;
  type: "post" | "like" | "comment" | "follow" | "sync" | "message";
  at: string;
  title: string;
  subtitle: string | null;
  color: string;
  href: string | null;
};

type TrailData = {
  range?: "month" | "year";
  month: string;
  label: string;
  isCurrentMonth: boolean;
  prevMonth: string;
  nextMonth: string | null;
  steps: TrailStep[];
  summary: {
    totalMoments: number;
    posts: number;
    hearts: number;
    comments: number;
    newPeople: number;
    published: number;
    messages: number;
    activeDays: number;
    busiestDay: string | null;
    busiestCount: number;
    topPeople: { name: string; count: number }[];
  };
};

const TYPE_LABELS: Record<TrailStep["type"], string> = {
  post: "Posted",
  like: "Heart",
  comment: "Comment",
  follow: "New person",
  sync: "Published",
  message: "Messages",
};

// Stable gradient id per node color, safe for SVG url() references.
const haloId = (color: string) => `trailHalo-${color.replace(/[^a-zA-Z0-9]/g, "")}`;

// Serpentine layout: the trail winds down the page like a footpath, each
// moment a node along the thread, labels alternating sides.
function layoutTrail(steps: TrailStep[], width: number) {
  const usable = Math.max(320, width);
  const margin = 56;
  const amplitude = (usable - margin * 2) / 2;
  const cx = usable / 2;
  const gapY = 92;
  const points = steps.map((_, i) => ({
    x: cx + Math.sin(i * 0.9 + 0.6) * amplitude * (0.55 + 0.45 * Math.sin(i * 0.37)),
    y: 70 + i * gapY,
  }));
  const height = 70 + Math.max(steps.length - 1, 0) * gapY + 90;
  // Smooth path through the points (Catmull-Rom → cubic Bézier).
  let d = "";
  if (points.length === 1) {
    d = `M ${points[0].x} ${points[0].y}`;
  } else if (points.length > 1) {
    d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i += 1) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(points.length - 1, i + 2)];
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
    }
  }
  return { points, d, height, width: usable };
}

function TrailInner({ isPro }: { isPro: boolean }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const searchParams = useSearchParams();
  const month = searchParams.get("month");
  // "Your Year" — the same thread across twelve months (MeshPro).
  const yearMode = searchParams.get("range") === "year" && isPro;
  const yearParam = searchParams.get("year");
  const [data, setData] = useState<TrailData | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  // The labels are HTML at fixed font size while the SVG scales with the
  // container — so the layout must be computed from the REAL width. Laid out
  // at a hardcoded 720 and squeezed onto a 390px phone, the 92px node gap
  // renders at ~50px, shorter than one ~70px label: every label overlapped
  // its neighbour. null = not measured yet; the trail waits for the first
  // observation instead of flashing a mislaid frame.
  const [trailWidth, setTrailWidth] = useState<number | null>(null);
  const trailObserverRef = useRef<ResizeObserver | null>(null);
  const measureTrail = useCallback((el: HTMLDivElement | null) => {
    trailObserverRef.current?.disconnect();
    trailObserverRef.current = null;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setTrailWidth(Math.min(720, Math.max(320, Math.round(width))));
    });
    observer.observe(el);
    trailObserverRef.current = observer;
  }, []);

  const loadTrail = useCallback(async (signal: AbortSignal) => {
    setStatus("loading");
    try {
      const query = yearMode
        ? `?range=year${yearParam ? `&year=${encodeURIComponent(yearParam)}` : ""}`
        : month
          ? `?month=${encodeURIComponent(month)}`
          : "";
      const res = await fetch(`/api/trail${query}`, {
        cache: "no-store",
        signal,
      });
      if (!res.ok) throw new Error(String(res.status));
      const payload: TrailData = await res.json();
      if (signal.aborted) return;
      setData(payload);
      setStatus("ready");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setStatus("error");
    }
  }, [month, yearMode, yearParam]);

  useEffect(() => {
    const controller = new AbortController();
    void loadTrail(controller.signal);
    return () => controller.abort();
  }, [loadTrail]);

  const trail = useMemo(
    () => (data && trailWidth ? layoutTrail(data.steps, trailWidth) : null),
    [data, trailWidth],
  );

  if (status === "loading") {
    return (
      <div className="min-h-[70vh]">
        <RouteWait shape="page" label="Retracing your month" />
      </div>
    );
  }
  if (status === "error" || !data) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm text-[var(--text-secondary)]">Your trail couldn&apos;t be traced right now.</p>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="rounded-full border border-[var(--border-primary)] bg-[var(--bg-card)] px-4 py-1.5 text-xs text-[var(--text-primary)]"
        >
          Try again
        </button>
      </div>
    );
  }

  const { summary } = data;
  const stats: { value: number | string; label: string }[] = [
    { value: summary.totalMoments, label: "moments" },
    { value: summary.hearts, label: "hearts thrown" },
    { value: summary.comments, label: "comments" },
    { value: summary.posts, label: "posts made" },
    ...(summary.published > 0 ? [{ value: summary.published, label: "published elsewhere" }] : []),
    { value: summary.newPeople, label: "new people" },
    { value: summary.activeDays, label: "days on the mesh" },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-6">
      {/* Header */}
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-400/10 text-[var(--success)]">
            <Footprints size={20} />
          </span>
          <div>
            <h1 className="text-xl font-semibold text-[var(--text-primary)]">Your Trail</h1>
            <p className="text-xs text-[var(--text-muted)]">{data.label}{data.isCurrentMonth ? " — so far" : ""}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Link
            href={yearMode ? `/trail?range=year&year=${data.prevMonth}` : `/trail?month=${data.prevMonth}`}
            aria-label={yearMode ? "Previous year" : "Previous month"}
            className="mesh-bubble-btn flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-primary)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <ChevronLeft size={15} />
          </Link>
          {data.nextMonth ? (
            <Link
              href={yearMode ? `/trail?range=year&year=${data.nextMonth}` : `/trail?month=${data.nextMonth}`}
              aria-label={yearMode ? "Next year" : "Next month"}
              className="mesh-bubble-btn flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-primary)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              <ChevronRight size={15} />
            </Link>
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-primary)] text-[var(--text-muted)]">
              <ChevronRight size={15} />
            </span>
          )}
        </div>
      </div>

      {/* Month / Year range. Your Year is the MeshPro long view. */}
      <div className="mb-3 flex items-center gap-1.5">
        <Link
          href="/trail"
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
            !yearMode ? "bg-[var(--accent)] text-[var(--accent-contrast)]" : "border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
        >
          Month
        </Link>
        {isPro ? (
          <Link
            href="/trail?range=year"
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              yearMode ? "bg-[var(--accent)] text-[var(--accent-contrast)]" : "border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            Your Year
          </Link>
        ) : (
          <Link
            href="/meshpro"
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
          >
            <Lock size={11} />
            Your Year · Pro
          </Link>
        )}
      </div>
      <p className="mb-5 flex items-center gap-1.5 text-micro text-[var(--text-muted)]">
        <Lock size={11} />
        Built only from your own activity on mesh.me. Only you can see your Trail.
      </p>

      {data.steps.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-[var(--border-primary)] bg-[var(--bg-card)] px-6 py-16 text-center">
          <Footprints size={28} className="text-[var(--text-muted)]" />
          <p className="text-sm font-semibold text-[var(--text-primary)]">A quiet {yearMode ? "year" : "month"} on the mesh</p>
          <p className="max-w-xs text-xs leading-relaxed text-[var(--text-muted)]">
            Trails appear as you live here — every post, heart, comment, and new person becomes a step on your path.
          </p>
          <Link
            href="/flow"
            className="mesh-bubble-btn mt-2 rounded-full bg-[var(--accent)] px-5 py-2 text-xs font-semibold text-[var(--accent-contrast)]"
          >
            Go make some footprints
          </Link>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="mb-6 flex flex-wrap gap-2">
            {stats.map((s) => (
              <span
                key={s.label}
                className="rounded-full border border-[var(--border-primary)] bg-[var(--bg-card)] px-3 py-1.5 text-xs text-[var(--text-secondary)]"
              >
                <span className="font-semibold text-[var(--text-primary)]">{s.value}</span> {s.label}
              </span>
            ))}
            {summary.busiestDay && (
              <span className="rounded-full border border-[var(--border-primary)] bg-[var(--bg-card)] px-3 py-1.5 text-xs text-[var(--text-secondary)]">
                busiest:{" "}
                <span className="font-semibold text-[var(--text-primary)]">
                  {new Date(summary.busiestDay + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>{" "}
                ({summary.busiestCount} moments)
              </span>
            )}
          </div>
          {summary.topPeople.length > 0 && (
            <p className="mb-6 text-xs text-[var(--text-muted)]">
              You spent this {yearMode ? "year" : "month"} around{" "}
              <span className="font-semibold text-[var(--text-primary)]">
                {summary.topPeople.map((p) => p.name).join(", ")}
              </span>
              .
            </p>
          )}

          {/* The trail itself */}
          <div ref={measureTrail} className="relative overflow-hidden rounded-3xl border border-[var(--border-primary)] bg-[radial-gradient(ellipse_at_top,#0c1226,#070a16_60%,#030409)]">
            {trail && (
              <div className="relative mx-auto w-full" style={{ maxWidth: trail.width }}>
                <svg
                  viewBox={`0 0 ${trail.width} ${trail.height}`}
                  className="block h-auto w-full"
                  role="img"
                  aria-label={`Your trail through ${data.label}: ${summary.totalMoments} moments`}
                >
                  {/* The traveled thread, drawing itself in. */}
                  <path
                    d={trail.d}
                    fill="none"
                    stroke="url(#trailGrad)"
                    strokeWidth={2}
                    strokeLinecap="round"
                    pathLength={1}
                    style={{
                      strokeDasharray: 1,
                      strokeDashoffset: reduce ? 0 : 1,
                      animation: reduce ? undefined : "trailDraw 2.6s cubic-bezier(0.4,0,0.2,1) .2s forwards",
                    }}
                  />
                  <defs>
                    <linearGradient id="trailGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="#8aa1ff" stopOpacity="0.85" />
                      <stop offset="1" stopColor="#34d399" stopOpacity="0.6" />
                    </linearGradient>
                    {/* One soft orb halo per node color — the mesh's radial glow. */}
                    {Array.from(new Set(data.steps.map((s) => s.color))).map((color) => (
                      <radialGradient key={color} id={haloId(color)}>
                        <stop offset="0" stopColor={color} stopOpacity="0.35" />
                        <stop offset="0.55" stopColor={color} stopOpacity="0.16" />
                        <stop offset="1" stopColor={color} stopOpacity="0" />
                      </radialGradient>
                    ))}
                  </defs>
                  {trail.points.map((pt, i) => {
                    const step = data.steps[i];
                    const hovered = hoveredNode === step.id;
                    return (
                      <g
                        key={step.id}
                        onMouseEnter={() => setHoveredNode(step.id)}
                        onMouseLeave={() => setHoveredNode(null)}
                        style={{ animation: reduce ? undefined : `trailNodeIn .5s ease-out ${0.25 + (i / Math.max(trail.points.length, 1)) * 2.2}s backwards` }}
                      >
                        {/* Inner group carries the hover scale so it never fights the entrance animation. */}
                        <g
                          style={{
                            transform: hovered ? "scale(1.18)" : "scale(1)",
                            transformOrigin: `${pt.x}px ${pt.y}px`,
                            transition: "transform .25s ease",
                          }}
                        >
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r={16}
                            fill={`url(#${haloId(step.color)})`}
                            opacity={hovered ? 1 : 0.7}
                            style={{ transition: "opacity .25s ease" }}
                          />
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r={4.5}
                            fill={step.color}
                            stroke="#fff"
                            strokeOpacity={0.4}
                            strokeWidth={1}
                          />
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r={4.5}
                            fill="none"
                            stroke="#fff"
                            strokeOpacity={0.75}
                            strokeWidth={1}
                            opacity={hovered ? 1 : 0}
                            style={{ transition: "opacity .25s ease" }}
                          />
                        </g>
                      </g>
                    );
                  })}
                </svg>
                {/* Labels overlaid beside each node, alternating sides. */}
                {trail.points.map((pt, i) => {
                  const step = data.steps[i];
                  const left = pt.x < trail.width / 2;
                  return (
                    <div
                      key={`label-${step.id}`}
                      className="absolute w-[46%]"
                      style={{
                        top: `${(pt.y / trail.height) * 100}%`,
                        [left ? "left" : "right"]: `${((left ? pt.x + 22 : trail.width - pt.x + 22) / trail.width) * 100}%`,
                        transform: "translateY(-50%)",
                        textAlign: left ? "left" : "right",
                        animation: reduce ? undefined : `trailNodeIn .5s ease-out ${0.35 + (i / Math.max(trail.points.length, 1)) * 2.2}s backwards`,
                      }}
                    >
                      {step.href ? (
                        <Link href={step.href} className="group inline-block max-w-full">
                          <TrailLabel step={step} align={left ? "left" : "right"} />
                        </Link>
                      ) : (
                        <TrailLabel step={step} align={left ? "left" : "right"} />
                      )}
                    </div>
                  );
                })}
                {/* Finale — a little spark lands at the end of the trail once
                    the thread finishes drawing itself in. */}
                {trail.points.length > 0 &&
                  (() => {
                    const end = trail.points[trail.points.length - 1];
                    const delay = reduce ? 0 : 2.9;
                    return (
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute"
                        style={{
                          left: `${(end.x / trail.width) * 100}%`,
                          top: `${(end.y / trail.height) * 100}%`,
                          transform: "translate(-50%, -50%)",
                        }}
                      >
                        {!reduce && (
                          <motion.span
                            className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border"
                            style={{ borderColor: "var(--mesh-cyan)" }}
                            initial={{ scale: 0.4, opacity: 0.75 }}
                            animate={{ scale: 2.6, opacity: 0 }}
                            transition={{ delay, duration: 1, ease: "easeOut", repeat: Infinity, repeatDelay: 1.6 }}
                          />
                        )}
                        {/* Float lives on the wrapper so its transform never
                            fights the framer pop below. */}
                        <div className="mesh-float">
                          <motion.span
                            className="relative flex h-7 w-7 items-center justify-center rounded-full"
                            style={{
                              color: "var(--mesh-cyan)",
                              background:
                                "radial-gradient(circle, color-mix(in srgb, var(--accent) 55%, transparent), transparent 70%)",
                            }}
                            initial={reduce ? false : { scale: 0, opacity: 0, rotate: -30 }}
                            animate={{ scale: 1, opacity: 1, rotate: 0 }}
                            transition={{ delay, type: "spring", stiffness: 320, damping: 16 }}
                          >
                            <Sparkles size={16} />
                          </motion.span>
                        </div>
                      </div>
                    );
                  })()}
              </div>
            )}
          </div>
          {summary.totalMoments > data.steps.length && (
            <p className="mt-3 text-center text-micro text-[var(--media-ink-2)]">
              Showing {data.steps.length} of {summary.totalMoments} moments — the thread samples your whole {yearMode ? "year" : "month"}.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function TrailLabel({ step, align }: { step: TrailStep; align: "left" | "right" }) {
  return (
    <span className={`inline-block max-w-full ${align === "right" ? "text-right" : "text-left"}`}>
      {/* Was the node colour as INK on a 12% wash of itself. On the dark canvas that
          wash is dark and the ink reads; in the light theme the same wash lands on
          light paper and the saturated ink fell to 1.37:1. The colour is the FILL
          now, and the ink is the one PINNED to that fill by tokens.css — --chip-ink
          was tuned against the old pastel node colours and fails AA on four of the
          seven plastics (cobalt 3.28, teal 3.47, grape 3.19, crimson 2.90). The
          pinned inks clear 5.09-8.69 by construction, in both themes, because
          neither the fill nor the ink moves with one. */}
      <span className="mb-0.5 inline-flex items-center gap-1 rounded-full px-1.5 py-px text-micro font-semibold mesh-eyebrow " style={{ color: inkForFill(step.color), background: step.color }}>
        {TYPE_LABELS[step.type]}
      </span>
      <span className="block truncate text-micro font-medium leading-snug text-[var(--media-ink)] group-hover:text-[var(--media-ink)]">{step.title}</span>
      {step.subtitle && <span className="block truncate text-micro text-[var(--media-ink-2)]">{step.subtitle}</span>}
      <span className="block text-micro text-[var(--media-ink-2)]">
        {new Date(step.at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
      </span>
    </span>
  );
}

export function TrailClient({ isPro = false }: { isPro?: boolean }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-[70vh]">
          <RouteWait shape="page" label="Retracing your month" />
        </div>
      }
    >
      <TrailInner isPro={isPro} />
    </Suspense>
  );
}
