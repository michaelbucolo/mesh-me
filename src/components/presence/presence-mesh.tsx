"use client";

// YOUR PRESENCE, MESHED — THE SURFACE.
//
// ── WHAT THE PREVIOUS ATTEMPT GOT WRONG, IN ITS OWN TERMS ─────────────────
//
// The ring field was verified by ~300 assertions and never once looked at in a
// browser. Every assertion passed and the screen was still wrong, because none
// of them could see: a giant flat disc with a bare number at the centre (the
// exact "0 new for you" pattern the redesign existed to kill, drawn larger),
// identical generated glyphs for every human being, names truncated to four
// characters, and ninety percent black.
//
// So the rules this file is built on are the ones a gate cannot check:
//
//   1. SHOW REAL THINGS. Faces and thumbnails first; the generated mark is a
//      fallback, never the default. If you cannot recognise anyone, it is a
//      chart of dots and there is no reason to open it.
//   2. THE CENTRE IS YOU, NOT A COUNT. A number in a circle is a notification
//      badge. Your identity plus one honest sentence is a home.
//   3. STRUCTURE YOU ALREADY KNOW. One arm per platform, and you recognise
//      your own logos instantly. The old surface needed a coach-mark reading
//      "drag to look around, scroll to zoom", which is proof it was not
//      natural. This needs no instructions.
//   4. FILL THE SCREEN. Few items means bigger items, not more emptiness.
//
// Layout is deterministic (arm order and index only — no randomness, no
// measurement feedback), so the server and client renders agree and there is
// no hydration flicker.

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { MeshiMascot } from "@/components/meshi/meshi-mascot";
import { PlatformLogo } from "@/components/platform/platform-logo";
import { useMeshiPreferences } from "@/hooks/use-meshi-preferences";
import type { ArmItem, MyPresence, PresenceArm } from "@/lib/mesh/read-my-presence";

/** Brand-family blues. The previous surface shipped salmon, teal, purple and
 * orange on flat black; the sign-in page — the design north-star — is deep
 * blue on near-black. These are that, not a fifth opinion. */
const INK = "#f2f4f8";
const INK_DIM = "#8b93a7";
const BRAND = "#3b82f6";
const OWED = "#60a5fa";

/** Per-platform accent, used ONLY as a thin rim so arms stay distinguishable
 * without the screen becoming a paint chart. */
const ACCENT: Record<string, string> = {
  mesh: "#3b82f6",
  instagram: "#e4405f",
  youtube: "#ff0000",
  tiktok: "#25f4ee",
  twitter: "#1d9bf0",
  twitch: "#9146ff",
  reddit: "#ff4500",
  spotify: "#1db954",
  facebook: "#1877f2",
  linkedin: "#0a66c2",
  threads: "#ffffff",
  bluesky: "#0085ff",
};

function accentOf(platform: string): string {
  return ACCENT[platform] ?? BRAND;
}

export function PresenceMesh({ presence }: { presence: MyPresence }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const prefs = useMeshiPreferences();

  useEffect(() => {
    const node = hostRef.current;
    if (!node) return;
    const ro = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (box) setSize({ w: Math.round(box.width), h: Math.round(box.height) });
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  const layout = useMemo(() => layOutArms(presence.arms, size), [presence.arms, size]);
  const ready = size.w > 0 && size.h > 0;

  return (
    <div
      ref={hostRef}
      data-testid="presence-mesh"
      className="relative h-full w-full overflow-hidden"
      style={{
        // Deep blue-black rather than flat black, matching sign-in. Flat black
        // is what made the old surface read as "off" rather than "night".
        background:
          "radial-gradient(120% 90% at 50% 42%, #0d1526 0%, #070b14 55%, #04060c 100%)",
      }}
    >
      {ready && (
        <svg
          width={size.w}
          height={size.h}
          className="absolute inset-0"
          role="img"
          aria-label={headlineText(presence)}
        >
          <defs>
            <radialGradient id="pm-core-glow">
              <stop offset="0%" stopColor={BRAND} stopOpacity={0.35} />
              <stop offset="100%" stopColor={BRAND} stopOpacity={0} />
            </radialGradient>
            {layout.arms.map((a) => (
              <linearGradient
                key={`g-${a.arm.platform}`}
                id={`pm-arm-${a.arm.platform}`}
                x1={layout.cx}
                y1={layout.cy}
                x2={a.headX}
                y2={a.headY}
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0%" stopColor={accentOf(a.arm.platform)} stopOpacity={0.5} />
                <stop offset="100%" stopColor={accentOf(a.arm.platform)} stopOpacity={0.12} />
              </linearGradient>
            ))}
          </defs>

          {/* The core's aura. Drawn first so nothing else sits under it. */}
          <circle cx={layout.cx} cy={layout.cy} r={layout.coreR * 3.4} fill="url(#pm-core-glow)" />

          {/* Arms: a line from you to each platform head. This IS the mesh. */}
          {layout.arms.map((a) => (
            <line
              key={`l-${a.arm.platform}`}
              x1={layout.cx}
              y1={layout.cy}
              x2={a.headX}
              y2={a.headY}
              stroke={`url(#pm-arm-${a.arm.platform})`}
              strokeWidth={a.arm.state === "offer" ? 1 : 2}
              strokeDasharray={a.arm.state === "offer" ? "3 6" : undefined}
              strokeLinecap="round"
            />
          ))}
        </svg>
      )}

      {/* ── BEADS: the real things, as HTML so they can hold real images ──── */}
      {ready &&
        layout.arms.map((a) =>
          a.beads.map((b) => (
            <Bead key={b.item.id} bead={b} accent={accentOf(a.arm.platform)} />
          )),
        )}

      {/* ── ARM HEADS: the platform itself, and its state ─────────────────── */}
      {ready && layout.arms.map((a) => <ArmHead key={`h-${a.arm.platform}`} placed={a} />)}

      {/* ── THE CORE: you ────────────────────────────────────────────────── */}
      {ready && (
        <div
          data-testid="presence-core"
          className="pointer-events-none absolute flex flex-col items-center text-center"
          style={{
            left: layout.cx - layout.coreR * 3,
            top: layout.cy - layout.coreR,
            width: layout.coreR * 6,
          }}
        >
          <div
            className="pointer-events-auto relative flex items-center justify-center rounded-full"
            style={{
              width: layout.coreR * 2,
              height: layout.coreR * 2,
              background: "radial-gradient(circle at 35% 30%, #16233d 0%, #0b1220 70%)",
              border: `1px solid ${BRAND}55`,
              boxShadow: `0 0 ${layout.coreR}px ${layout.coreR / 2.5}px ${BRAND}22`,
            }}
          >
            {/* Meshi is who you are here — the one element worth carrying over. */}
            <MeshiMascot
              size={Math.round(layout.coreR * 1.5)}
              colorTheme={prefs?.colorTheme}
              hatStyle={prefs?.hatStyle}
              faceStyle={prefs?.faceStyle}
              hairStyle={prefs?.hairStyle}
              accessoryStyle={prefs?.accessoryStyle}
              eyeStyle={prefs?.eyeStyle}
            />
          </div>

          <p className="mt-3 font-semibold" style={{ color: INK, fontSize: 16, lineHeight: 1.3 }}>
            {presence.you.displayName || presence.you.username}
          </p>
          <p className="mt-1" style={{ color: INK_DIM, fontSize: 13 }}>
            {headlineText(presence)}
          </p>
        </div>
      )}

      {/* The same presence as an ordered list. The radial view is a way of
          seeing it, not the only way — and a screen reader gets the real thing
          rather than a description of a picture. */}
      <ul data-testid="presence-list" className="sr-only">
        {presence.arms.map((arm) => (
          <li key={arm.platform}>
            {arm.platform} {arm.handle ?? ""} — {arm.state}
            {arm.detail ? `: ${arm.detail}` : ""}
            <ul>
              {arm.items.map((i) => (
                <li key={i.id}>
                  <a href={i.href}>
                    {i.awaitingViewer ? "Waiting on you: " : ""}
                    {i.title}
                  </a>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One thing, drawn as a real object: a face or a thumbnail when there is one. */
function Bead({ bead, accent }: { bead: PlacedBead; accent: string }) {
  const { item, x, y, r } = bead;
  const owed = !!item.awaitingViewer;
  return (
    <a
      href={item.href}
      data-testid="presence-item"
      data-owed={owed ? "1" : "0"}
      aria-label={`${owed ? "Waiting on you: " : ""}${item.title}`}
      className="group absolute block"
      style={{ left: x - r, top: y - r, width: r * 2, height: r * 2 }}
    >
      <span
        className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full transition-transform duration-200 group-hover:scale-110"
        style={{
          background: "#0e1626",
          border: `2px solid ${owed ? OWED : `${accent}66`}`,
          boxShadow: owed ? `0 0 ${r}px ${r / 2}px ${OWED}33` : "none",
        }}
      >
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt=""
            width={Math.round(r * 2)}
            height={Math.round(r * 2)}
            className="h-full w-full object-cover"
            unoptimized
          />
        ) : (
          <span style={{ color: INK, fontSize: Math.max(11, r * 0.7), fontWeight: 600 }}>
            {initialsOf(item.title)}
          </span>
        )}
      </span>

      {/* The label lives under the bead and is only rendered when there is room
          for it — a name cut to four characters is worse than no name. */}
      {bead.showLabel && (
        <span
          className="pointer-events-none absolute left-1/2 top-full mt-1 block -translate-x-1/2 whitespace-nowrap text-center"
          style={{ color: owed ? INK : INK_DIM, fontSize: 11, maxWidth: 140 }}
        >
          <span className="block truncate">{item.title}</span>
        </span>
      )}
    </a>
  );
}

/** The platform, its handle, and whether it needs you. */
function ArmHead({ placed }: { placed: PlacedArm }) {
  const { arm, headX, headY, headR } = placed;
  const accent = accentOf(arm.platform);
  const offer = arm.state === "offer";

  return (
    <a
      href={offer ? "/connected-accounts" : `/connected-accounts#${arm.platform}`}
      data-testid="presence-arm"
      data-platform={arm.platform}
      data-state={arm.state}
      aria-label={`${arm.platform}${arm.handle ? ` ${arm.handle}` : ""} — ${arm.detail ?? arm.state}`}
      className="group absolute flex flex-col items-center"
      style={{ left: headX - headR * 2.2, top: headY - headR, width: headR * 4.4 }}
    >
      <span
        className="relative flex items-center justify-center rounded-full transition-transform duration-200 group-hover:scale-105"
        style={{
          width: headR * 2,
          height: headR * 2,
          background: offer ? "transparent" : "#0d1728",
          border: offer ? `1px dashed ${INK_DIM}77` : `2px solid ${accent}`,
          boxShadow: offer ? "none" : `0 0 ${headR * 0.9}px ${headR / 3}px ${accent}22`,
          opacity: offer ? 0.65 : 1,
        }}
      >
        <PlatformLogo platform={arm.platform} size={Math.round(headR * 1.1)} />

        {/* Owed count rides the head, so you can see WHERE the pressure is
            without reading anything. */}
        {arm.wantsYou > 0 && (
          <span
            className="absolute -right-1 -top-1 flex items-center justify-center rounded-full font-semibold"
            style={{
              minWidth: 18,
              height: 18,
              padding: "0 5px",
              background: OWED,
              color: "#04060c",
              fontSize: 11,
            }}
          >
            {arm.wantsYou}
          </span>
        )}
      </span>

      <span className="mt-1.5 block text-center" style={{ maxWidth: headR * 4.2 }}>
        <span className="block truncate font-medium" style={{ color: INK, fontSize: 12 }}>
          {arm.handle ?? labelOf(arm.platform)}
        </span>
        {arm.state !== "live" && arm.detail && (
          <span
            className="block truncate"
            style={{ color: arm.state === "error" ? "#f87171" : INK_DIM, fontSize: 10.5 }}
          >
            {arm.detail}
          </span>
        )}
      </span>
    </a>
  );
}

// ---------------------------------------------------------------------------
// Layout — pure, deterministic, and sized to the viewport it is given.
// ---------------------------------------------------------------------------

type PlacedBead = { item: ArmItem; x: number; y: number; r: number; showLabel: boolean };
type PlacedArm = {
  arm: PresenceArm;
  angle: number;
  headX: number;
  headY: number;
  headR: number;
  beads: PlacedBead[];
};

function layOutArms(arms: PresenceArm[], size: { w: number; h: number }) {
  const cx = size.w / 2;
  const cy = size.h / 2;
  const short = Math.min(size.w, size.h);

  // Scale with the viewport rather than fixed pixels, so a phone gets a mesh
  // that fills the phone and a desktop gets one that fills the desktop.
  const coreR = Math.max(34, Math.min(58, short * 0.075));
  const headR = Math.max(20, Math.min(30, short * 0.04));
  // Leave room for the head plus its two label lines inside the viewport.
  const reach = Math.min(size.w, size.h) / 2 - headR - 46;

  const n = Math.max(arms.length, 1);
  // Start at the top and go clockwise. Deterministic, and the first arm (yours,
  // "mesh") always sits at 12 o'clock so the surface is stable between loads.
  const placed: PlacedArm[] = arms.map((arm, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const headX = cx + Math.cos(angle) * reach;
    const headY = cy + Math.sin(angle) * reach;

    // Beads sit along the arm between the core and the head. Owed items are
    // first in `items` (the read sorted them), so index 0 lands nearest you —
    // urgency becomes distance without being the only axis.
    const first = coreR + Math.max(30, reach * 0.22);
    const last = reach - headR - 16;
    const span = Math.max(0, last - first);
    const count = arm.items.length;

    const beads: PlacedBead[] = arm.items.map((item, j) => {
      const t = count === 1 ? 0.42 : j / (count - 1);
      const d = first + span * t;
      // Fewer things means bigger things. An arm with one item should look
      // deliberate, not sparse.
      const r = Math.max(16, Math.min(30, short * 0.032) * (count <= 2 ? 1.15 : 1));
      return {
        item,
        x: cx + Math.cos(angle) * d,
        y: cy + Math.sin(angle) * d,
        r,
        // Only label what will not collide: the nearest bead on each arm, and
        // only when the arm is not crowded.
        showLabel: count <= 3 && j === 0,
      };
    });

    return { arm, angle, headX, headY, headR, beads };
  });

  return { cx, cy, coreR, arms: placed };
}

/** One honest sentence. Never a bare count, and never zero on its own. */
function headlineText(p: MyPresence): string {
  const platforms = p.connectedCount === 1 ? "1 platform" : `${p.connectedCount} platforms`;
  if (p.totalWantsYou === 0) return `Nothing needs you · ${platforms} in your mesh`;
  const thing = p.totalWantsYou === 1 ? "thing wants you" : "things want you";
  return `${p.totalWantsYou} ${thing} · across ${platforms}`;
}

function labelOf(platform: string): string {
  if (platform === "mesh") return "mesh.me";
  if (platform === "twitter") return "X";
  return platform.charAt(0).toUpperCase() + platform.slice(1);
}

/** A readable stand-in when there is no image — initials of a real name beat
 * an abstract glyph, because at least you can tell two of them apart. */
function initialsOf(title: string): string {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "·";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
