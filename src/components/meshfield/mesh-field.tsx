"use client";

// THE SURFACE ITSELF. EVERYTHING ABOVE THIS FILE IS ARITHMETIC.
//
// Six pure modules decide where things go, what colour they are, what they may
// say and who gets to say it. None of them can draw. This draws, and it is
// deliberately thin: if a rule appears here that also exists in a model, the
// two will drift and the gates will only be watching one of them.
//
// So this file contains no thresholds, no ranking, no decisions about urgency,
// and no opinion about what fits. It asks and it renders.
//
// ── WHY SVG AND NOT A CANVAS ────────────────────────────────────────────────
//
// The old surface was a canvas, and a canvas has no accessibility tree: every
// node on it was invisible to a screen reader and unreachable by a keyboard.
// A social surface whose entire content is undiscoverable without a mouse is
// not finished. Here every node is a real <a> — focusable, announced, and
// followable with the keyboard alone.
//
// ── MEASUREMENT IS THE ONE THING ONLY THE BROWSER KNOWS ────────────────────
//
// `legible.ts` refuses to guess how wide a string is, and takes a measurer
// instead. This is where the real one comes from: a canvas 2D context with the
// actual font applied. Everything else is decided before a pixel exists.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MeshiMascot } from "@/components/meshi/meshi-mascot";
import { useMeshiPreferences } from "@/hooks/use-meshi-preferences";
import { useFieldPresence } from "./use-field-presence";
import { setCanvasMeshi } from "@/components/mesh/live/meshi-presence";
import { impressionIdFor } from "./seen-bridge";
import { layOut } from "./model/geometry";
import { identityMark } from "./model/identity-mark";
import { planLabels } from "./model/labels";
import type { Measure } from "./model/legible";
import { contrastOnBackdrop, MESH_BACKDROP, materialFor, type MeshTheme } from "./model/material";
import { placeField, RINGS, type FieldItem } from "./model/rings";

/** The font the labels are actually drawn in, for the measurer and the SVG. */
const FONT_STACK = "system-ui, -apple-system, 'Segoe UI', sans-serif";

/**
 * A measurer backed by the real font.
 *
 * Falls back to a proportional estimate when there is no canvas — during SSR,
 * and in the rare browser that refuses a 2D context. The fallback is
 * deliberately a little WIDE: over-estimating means a label is refused or
 * truncated early, and under-estimating means it overflows its node, which is
 * the failure this whole layer exists to prevent.
 */
function useMeasure(): Measure {
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  return useMemo(() => {
    return (text: string, size: number) => {
      if (typeof document === "undefined") return text.length * size * 0.58;
      if (!ctxRef.current) {
        ctxRef.current = document.createElement("canvas").getContext("2d");
      }
      const ctx = ctxRef.current;
      if (!ctx) return text.length * size * 0.58;
      ctx.font = `${size}px ${FONT_STACK}`;
      return ctx.measureText(text).width;
    };
  }, []);
}

/** The viewport the field is laid out into, tracked as the element resizes. */
function useViewport(ref: React.RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (box) setSize({ width: Math.round(box.width), height: Math.round(box.height) });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}

/**
 * Which palette to draw in.
 *
 * Read from the document rather than from a media query, because the app has a
 * theme toggle and the toggle is the authority — a user who chose light does
 * not want the mesh deciding otherwise because their OS disagrees.
 */
function useMeshTheme(): MeshTheme {
  const [theme, setTheme] = useState<MeshTheme>("dark");

  useEffect(() => {
    const read = () => setTheme(document.documentElement.classList.contains("light") ? "light" : "dark");
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return theme;
}

/** A person's generated mark, drawn at a given size. Pure presentation. */
function IdentityMark({ id, size, ink }: { id: string; size: number; ink: string }) {
  const mark = useMemo(() => identityMark(id), [id]);
  return (
    <g opacity={0.92}>
      {mark.edges.map(([a, b], i) => (
        <line
          key={`e${i}`}
          x1={mark.nodes[a].x * size}
          y1={mark.nodes[a].y * size}
          x2={mark.nodes[b].x * size}
          y2={mark.nodes[b].y * size}
          stroke={ink}
          strokeOpacity={0.55}
          strokeWidth={Math.max(1, size * 0.035)}
          strokeLinecap="round"
        />
      ))}
      {mark.nodes.map((n, i) => (
        <circle key={`n${i}`} cx={n.x * size} cy={n.y * size} r={n.r * size} fill={ink} />
      ))}
    </g>
  );
}

export function MeshField({
  items,
  nowMs,
  roomUserId = null,
  viewerId = null,
  centre,
  canRecordImpressions = false,
}: {
  items: FieldItem[];
  nowMs: number;
  /** Whose mesh this is — the presence room. Null renders the field alone. */
  roomUserId?: string | null;
  /** The signed-in viewer, excluded from the roaming roster so they are not
   * drawn twice (see the self-Meshi duplication this replaced). */
  viewerId?: string | null;
  /**
   * What the centre says, when the caller knows better than the field does.
   *
   * The computed headline answers "what wants YOU", which is the right
   * question on your own mesh and the wrong one on somebody else's — and the
   * unread count in the disc is meaningless there too. So a caller rendering
   * a mesh that is not the viewer's own supplies its own centre. The rule that
   * a headline is never a bare count still lives in `rings.ts`; this does not
   * relitigate it, it just lets a different surface say a different true thing.
   */
  centre?: { badge: string; text: string; action?: { label: string; href: string } };
  /**
   * Whether this viewer's impressions may be recorded, feeding the Flow
   * seen-set so the mesh and the Flow stop showing you the same post twice.
   * False for Global and for guests — see `seen-bridge`, which owns that rule.
   */
  canRecordImpressions?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const prefs = useMeshiPreferences();
  const presence = useFieldPresence({
    roomUserId,
    viewerId,
    prefs,
    containerRef: hostRef,
    enabled: !!roomUserId,
  });
  const viewport = useViewport(hostRef);
  const theme = useMeshTheme();
  const measure = useMeasure();

  const field = useMemo(() => placeField(items, nowMs), [items, nowMs]);
  const ready = viewport.width > 0 && viewport.height > 0;

  const geometry = useMemo(
    () => (ready ? layOut(field, viewport) : null),
    [field, viewport, ready],
  );

  const byId = useMemo(() => new Map(field.items.map((i) => [i.id, i])), [field]);

  const plan = useMemo(() => {
    if (!geometry) return null;
    const texts: Record<string, string> = {};
    for (const p of geometry.placements) {
      const item = byId.get(p.id);
      if (item) texts[p.id] = item.title;
    }
    return planLabels(geometry, viewport, texts, measure);
  }, [geometry, viewport, byId, measure]);

  // This surface shows Meshis of its own (the presence layer above), so the
  // floating Meshi must stand down while it is mounted — otherwise you get two
  // of them on one screen. The canvas used to make this claim; the field makes
  // it now, which is why the flag outlived the canvas.
  useEffect(() => {
    setCanvasMeshi(true);
    return () => setCanvasMeshi(false);
  }, []);

  // Opening a native post here tells the Flow you have seen it, so the two
  // surfaces stop offering you the same thing twice. `keepalive` because the
  // click is a navigation: without it the request dies with the page.
  const beaconSeen = useCallback(
    (item: FieldItem) => {
      const id = impressionIdFor(item, { canRecordImpressions });
      if (!id) return;
      void fetch("/api/flow/impression", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ postId: id }),
        keepalive: true,
      }).catch(() => {
        // A missed impression costs a repeat, never the navigation.
      });
    },
    [canRecordImpressions],
  );

  // Resolved once: the centre's action, whether supplied or computed.
  const centreAction = centre ? centre.action : field.headline.action;

  const backdrop = MESH_BACKDROP[theme];
  const coreMaterial = materialFor("needsYou", null, theme);
  const dim = theme === "dark" ? "#8a8a99" : "#5a5a6a";

  return (
    <div
      ref={hostRef}
      className="relative h-full w-full overflow-hidden"
      style={{ background: backdrop, fontFamily: FONT_STACK }}
    >
      {geometry && plan ? (
        <svg
          width={viewport.width}
          height={viewport.height}
          viewBox={`0 0 ${viewport.width} ${viewport.height}`}
          role="group"
          aria-label={centre ? centre.text : "Your mesh, arranged by what wants you"}
        >
          <defs>
            {RINGS.map((ring) => {
              const m = materialFor(ring, null, theme);
              return (
                <radialGradient key={ring} id={`glow-${ring}`}>
                  <stop offset="0%" stopColor={m.fill} stopOpacity={0.55 * m.glow} />
                  <stop offset="100%" stopColor={m.fill} stopOpacity={0} />
                </radialGradient>
              );
            })}
          </defs>

          {/* The bands themselves, so the ring structure is visible rather than
              inferred from where things happen to sit. */}
          {RINGS.map((ring) => {
            const inBand = geometry.placements.filter((p) => p.ring === ring);
            if (inBand.length === 0) return null;
            const distance =
              inBand.reduce((sum, p) => sum + Math.hypot(p.x - geometry.core.x, p.y - geometry.core.y), 0) / inBand.length;
            const m = materialFor(ring, null, theme);
            return (
              <circle
                key={`band-${ring}`}
                cx={geometry.core.x}
                cy={geometry.core.y}
                r={distance}
                fill="none"
                stroke={m.fill}
                strokeOpacity={0.16}
                strokeWidth={1}
              />
            );
          })}

          {/* Leaders, drawn under everything: a caption that sits out past the
              bands has to be visibly attached to the thing it describes. */}
          {plan.granted.map((g) => {
            const p = geometry.placements.find((q) => q.id === g.id);
            if (!p) return null;
            const m = materialFor(p.ring, byId.get(p.id)?.platform ?? null, theme);
            return (
              <line
                key={`lead-${g.id}`}
                x1={p.x}
                y1={p.y}
                x2={g.box.x + g.box.width / 2}
                y2={g.box.y}
                stroke={m.fill}
                strokeOpacity={0.32}
                strokeWidth={1}
              />
            );
          })}

          {geometry.placements.map((p) => {
            const item = byId.get(p.id);
            if (!item) return null;
            const m = materialFor(p.ring, item.platform, theme);
            const markSize = p.radius * 1.15;

            return (
              <a
                key={p.id}
                href={item.href}
                aria-label={`${item.verb}: ${item.title}. ${item.reason}`}
                onClick={() => beaconSeen(item)}
              >
                {m.glow > 0 && (
                  <circle cx={p.x} cy={p.y} r={p.radius * 2.4} fill={`url(#glow-${p.ring})`} />
                )}
                <circle cx={p.x} cy={p.y} r={p.radius} fill={m.fill} stroke={m.rim} strokeWidth={2} />
                <g transform={`translate(${p.x - markSize / 2}, ${p.y - markSize / 2})`}>
                  <IdentityMark id={p.id} size={markSize} ink={m.ink} />
                </g>
              </a>
            );
          })}

          {/* Captions. Only the ones the budget granted, at the size it chose. */}
          {plan.granted.map((g) => {
            const p = geometry.placements.find((q) => q.id === g.id);
            const item = byId.get(g.id);
            if (!p || !item) return null;
            const m = materialFor(p.ring, item.platform, theme);
            return (
              <text
                key={`label-${g.id}`}
                x={g.box.x + g.box.width / 2}
                y={g.box.y + g.label.size}
                textAnchor="middle"
                fontSize={g.label.size}
                fontWeight={600}
                fill={theme === "dark" ? "#f2f2f7" : "#1c1c1e"}
              >
                {g.label.lines.map((line, i) => (
                  <tspan key={i} x={g.box.x + g.box.width / 2} dy={i === 0 ? 0 : g.label.size * 1.28}>
                    {line}
                  </tspan>
                ))}
                <tspan
                  x={g.box.x + g.box.width / 2}
                  dy={g.label.size * 1.34}
                  fontSize={Math.max(10, g.label.size * 0.72)}
                  fill={m.fill}
                  letterSpacing="0.06em"
                >
                  {item.verb.toUpperCase()}
                </tspan>
              </text>
            );
          })}
        </svg>
      ) : null}

      {/* THE CORE. Meshi is the one element carried over from the old surface,
          and it is the only thing at the centre — it reads the field and names
          the single most worthwhile thing to do. The headline is never a bare
          count, which is what "0 new for you" was. */}
      {geometry && (
        <div
          className="pointer-events-none absolute flex flex-col items-center text-center"
          style={{
            left: geometry.core.x - geometry.core.radius * 2.6,
            top: geometry.core.y - geometry.core.radius,
            width: geometry.core.radius * 5.2,
          }}
        >
          <div
            className="pointer-events-auto flex items-center justify-center rounded-full"
            style={{
              width: geometry.core.radius * 2,
              height: geometry.core.radius * 2,
              background: coreMaterial.fill,
              boxShadow: `0 0 ${geometry.core.radius}px ${geometry.core.radius / 3}px ${coreMaterial.fill}44`,
            }}
          >
            <span
              className="font-semibold"
              style={{ color: coreMaterial.ink, fontSize: Math.max(13, geometry.core.radius * 0.42) }}
            >
              {centre ? centre.badge : field.calm ? "calm" : field.byRing.needsYou.length}
            </span>
          </div>

          <p
            className="mt-3 font-semibold"
            style={{ color: theme === "dark" ? "#f2f2f7" : "#1c1c1e", fontSize: 15, lineHeight: 1.35 }}
          >
            {centre ? centre.text : field.headline.text}
          </p>

          {centreAction && (
            <a
              className="pointer-events-auto mt-2 rounded-full px-3 py-1 text-xs font-semibold"
              href={centreAction.href}
              style={{ background: coreMaterial.fill, color: coreMaterial.ink }}
            >
              {centreAction.label}
            </a>
          )}

          {geometry.dropped.length > 0 && (
            // Reported, never silent. A surface that quietly hides part of your
            // world has lied about being your world.
            <p className="mt-2 text-xs" style={{ color: dim }}>
              {geometry.dropped.length} more off-screen
            </p>
          )}
        </div>
      )}

      {/* Live presence — the people who are here with you.
          Absolutely positioned and transform-driven: the glide loop in
          `use-field-presence` writes each element's transform directly, so a
          busy room costs zero React renders per frame. React only re-renders
          when the ROSTER changes, and the roster hands back stable object
          identities while an appearance is unchanged. */}
      {presence.people.map((p) => (
        <div
          key={p.userId}
          ref={presence.registerNode(p.userId)}
          className={`pointer-events-none absolute left-0 top-0 z-20 flex flex-col items-center will-change-transform${
            // MeshPro's gold rim. Read off the presence entry, never inferred
            // locally, so the mark is server-authoritative: a client cannot
            // award itself one, and it does not blink out depending on who is
            // looking.
            p.isPro ? " meshi-pro-rim" : ""
          }`}
          // Parked off-screen until the first frame places it, so nobody
          // flashes at the origin before the glide loop has run.
          style={{ transform: "translate3d(-9999px, -9999px, 0)" }}
        >
          <MeshiMascot
            // The wire carries plain strings; the mascot wants unions. The
            // values are server-validated on the way in, so this asserts what
            // the payload already guarantees rather than re-checking it.
            {...({
              size: 40,
              mood: p.meshiMood,
              color: p.meshiColor,
              hat: p.meshiHat,
              hair: p.meshiHair,
              accessory: p.meshiAccessory,
              eyeStyle: p.meshiEyeStyle,
              badge: p.meshiBadge,
              animate: true,
            } as React.ComponentProps<typeof MeshiMascot>)}
          />
          <span
            className="mt-0.5 max-w-[7rem] truncate rounded-full px-1.5 py-0.5 text-xs font-medium"
            style={{ background: theme === "dark" ? "#1b1b24cc" : "#ffffffcc", color: dim }}
          >
            {p.displayName || p.username}
          </span>
        </div>
      ))}

      {/* The same field as a list. Not a fallback — a radial surface is hard to
          scan, and some people simply want the queue. Both are the same data in
          the same order, which is why it is generated from `field.items`. */}
      <ul className="sr-only">
        {field.items.map((item) => (
          <li key={item.id}>
            <a href={item.href}>
              {item.verb}: {item.title} — {item.reason}
            </a>
          </li>
        ))}
      </ul>

      {!ready && (
        <div className="flex h-full w-full items-center justify-center" style={{ color: dim }}>
          <span className="text-sm">Reading your mesh…</span>
        </div>
      )}

      {/* Contrast of the innermost band against this backdrop, kept as a live
          value so a future palette change that breaks it shows up in the DOM
          rather than only in a gate. */}
      <span className="sr-only" data-mesh-core-contrast={contrastOnBackdrop(coreMaterial, theme).toFixed(2)} />
    </div>
  );
}
