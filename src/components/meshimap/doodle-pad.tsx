"use client";

// THE PAD YOU DRAW ON.
//
// ── THE CONFLICT, AND HOW IT IS RESOLVED ───────────────────────────────────
//
// Dragging already pans the map. A drawing tool that also wants drag has to
// resolve that, and the two obvious answers are both bad: a mode toggle means
// half your strokes pan the map because you forgot which mode you were in, and
// a long-press-to-draw means every doodle starts with a wait.
//
// So the pad is a SEPARATE SURFACE. It slides up over the map, it owns its own
// pointer events entirely, and while it is open the map is not being dragged
// because your finger is not on the map. That is also what PictoChat actually
// was — a separate screen you drew on, with the room above it — so the
// borrowed interaction is the borrowed one, not an invention.
//
// ── WHY THE STRIP HAS A FIXED ASPECT RATIO ─────────────────────────────────
//
// Strokes are stored as integers on a 128×64 grid. If the pad's on-screen box
// is not 2:1, what you drew and what everyone else sees are different pictures
// — a circle drawn on a squashed pad arrives as an ellipse. The box is
// aspect-locked so the grid and the pixels agree.

import { useCallback, useRef, useState } from "react";
import { encodeInk, INK_COLOURS, INK_HEIGHT, INK_WIDTH, MAX_POINTS, MAX_STROKES } from "@/lib/meshimap/ink";

type Point = { x: number; y: number };
type PadStroke = { colour: number; points: Point[] };

/** The four inks, as actual colours. Index IS the wire value. */
const INK_HEX = ["#e8edf8", "#60a5fa", "#f0a3a3", "#8fd8a8"] as const;

export function DoodlePad({
  onSent,
  onClose,
}: {
  onSent: () => void;
  onClose: () => void;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [strokes, setStrokes] = useState<PadStroke[]>([]);
  const [colour, setColour] = useState(0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const drawing = useRef<number | null>(null);

  const totalPoints = strokes.reduce((sum, s) => sum + s.points.length, 0);
  const full = strokes.length >= MAX_STROKES || totalPoints >= MAX_POINTS;

  /** Screen point → grid point. Rounded and clamped HERE, at the input edge,
   * where clamping is correct: a finger that strays a pixel outside the pad
   * meant the edge. The decoder refuses out-of-range values precisely because
   * by then it is too late to know what was intended. */
  const toGrid = useCallback((clientX: number, clientY: number): Point | null => {
    const box = boxRef.current?.getBoundingClientRect();
    if (!box || box.width === 0 || box.height === 0) return null;
    const x = Math.round(((clientX - box.left) / box.width) * (INK_WIDTH - 1));
    const y = Math.round(((clientY - box.top) / box.height) * (INK_HEIGHT - 1));
    return {
      x: Math.min(INK_WIDTH - 1, Math.max(0, x)),
      y: Math.min(INK_HEIGHT - 1, Math.max(0, y)),
    };
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (full) return;
    const p = toGrid(e.clientX, e.clientY);
    if (!p) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = e.pointerId;
    setStrokes((prev) => [...prev, { colour, points: [p] }]);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drawing.current !== e.pointerId) return;
    const p = toGrid(e.clientX, e.clientY);
    if (!p) return;
    setStrokes((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      const tip = last.points[last.points.length - 1];
      // Drop repeats: a finger resting still would otherwise burn the point
      // budget without adding a single visible pixel.
      if (tip && tip.x === p.x && tip.y === p.y) return prev;
      if (prev.reduce((sum, s) => sum + s.points.length, 0) >= MAX_POINTS) return prev;
      const next = prev.slice(0, -1);
      next.push({ colour: last.colour, points: [...last.points, p] });
      return next;
    });
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drawing.current !== e.pointerId) return;
    drawing.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  async function send() {
    if (strokes.length === 0 || sending) return;
    setSending(true);
    setError(null);
    try {
      const response = await fetch("/api/meshimap/doodle", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ink: encodeInk({ strokes }) }),
      });
      if (!response.ok) {
        // The server's reason, not a generic one: "put yourself on the map
        // first" and "slow down a moment" are different problems and a user
        // can act on the first.
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "That didn't send.");
        return;
      }
      setStrokes([]);
      onSent();
      onClose();
    } catch {
      setError("That didn't send.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      data-testid="doodle-pad"
      className="absolute inset-x-0 bottom-0 z-20 p-3"
      style={{ background: "#0b1526f2", borderTop: "1px solid #ffffff1f" }}
    >
      <div className="mb-2 flex items-center justify-between">
        <span style={{ color: "#93a0bb", fontSize: 11.5 }}>
          Draw something for the people around you
        </span>
        <button type="button" onClick={onClose} aria-label="Close the pad" style={{ color: "#93a0bb", fontSize: 12.5 }}>
          Close
        </button>
      </div>

      {/* THE PAD. `touch-none` so a drag here scrolls nothing and pans nothing —
          the pointer belongs to the drawing while this is open. The aspect
          ratio is locked to the grid so what you draw is what arrives. */}
      <div
        ref={boxRef}
        data-testid="doodle-surface"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="relative w-full touch-none overflow-hidden rounded-xl"
        style={{ aspectRatio: `${INK_WIDTH} / ${INK_HEIGHT}`, background: "#111d33", border: "1px solid #ffffff14" }}
      >
        <InkPreview strokes={strokes} />
      </div>

      <div className="mt-2 flex items-center gap-2">
        {Array.from({ length: INK_COLOURS }, (_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Ink ${i + 1}`}
            data-testid={`doodle-ink-${i}`}
            onClick={() => setColour(i)}
            className="h-7 w-7 rounded-full"
            style={{ background: INK_HEX[i], border: colour === i ? "2px solid #ffffff" : "2px solid #ffffff22" }}
          />
        ))}
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setStrokes([])}
          disabled={strokes.length === 0}
          className="rounded-full px-3 py-1.5"
          style={{ background: "#182642", color: "#dce4f5", fontSize: 12.5, opacity: strokes.length === 0 ? 0.5 : 1 }}
        >
          Clear
        </button>
        <button
          type="button"
          data-testid="doodle-send"
          onClick={() => void send()}
          disabled={strokes.length === 0 || sending}
          className="rounded-full px-4 py-1.5"
          style={{
            background: "#60a5fa",
            color: "#04060c",
            fontSize: 13,
            fontWeight: 600,
            opacity: strokes.length === 0 || sending ? 0.5 : 1,
          }}
        >
          {sending ? "Sending…" : "Send"}
        </button>
      </div>

      {full && (
        <p className="mt-1.5" style={{ color: "#93a0bb", fontSize: 11 }}>
          That&apos;s a full drawing — send it or clear and start again.
        </p>
      )}
      {error && (
        <p className="mt-1.5" style={{ color: "#f0a3a3", fontSize: 11.5 }}>
          {error}
        </p>
      )}
    </div>
  );
}

/** Render strokes in grid space. One shared renderer for the pad and the map,
 * so what you drew and what everyone else sees cannot diverge. */
export function InkPreview({ strokes, opacity = 1 }: { strokes: Array<{ colour: number; points: Point[] }>; opacity?: number }) {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox={`0 0 ${INK_WIDTH} ${INK_HEIGHT}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{ opacity }}
    >
      {strokes.map((s, i) => (
        <polyline
          key={i}
          points={s.points.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke={INK_HEX[s.colour] ?? INK_HEX[0]}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          // A single-point stroke is a dot, and a polyline of one point draws
          // nothing without this.
          strokeDasharray={s.points.length === 1 ? "0.1 4" : undefined}
        />
      ))}
    </svg>
  );
}
