"use client";

import { motion, useSpring, useMotionValue, useTransform } from "framer-motion";
import { useRef, useState, useCallback, useEffect, useId } from "react";

// Pre-compute trig values to avoid SSR/client hydration mismatches
const FLOWER_POSITIONS = [0, 60, 120, 180, 240, 300].map((deg) => ({
  deg,
  cx: Math.round(Math.cos((deg * Math.PI) / 180) * 4 * 1000) / 1000,
  cy: Math.round(Math.sin((deg * Math.PI) / 180) * 4 * 1000) / 1000,
}));


// Crisp vector eyes for each mood. Tall, slightly elliptical solid eyes stay
// consistent at any size (no unicode-glyph eyes).
const SVG_FACES: Record<string, (color: string) => React.ReactNode> = {
  happy: (color: string) => (
    <g>
      <ellipse cx="-5" cy="0" rx="2.4" ry="3.7" fill={color} />
      <ellipse cx="5" cy="0" rx="2.4" ry="3.7" fill={color} />
    </g>
  ),
  excited: (color: string) => (
    <g>
      <ellipse cx="-5" cy="-0.3" rx="2.9" ry="4" fill={color} />
      <ellipse cx="5" cy="-0.3" rx="2.9" ry="4" fill={color} />
    </g>
  ),
  thinking: (color: string) => (
    <g>
      <ellipse cx="-5" cy="-1" rx="2.2" ry="3.4" fill={color} />
      <ellipse cx="5" cy="-1" rx="2.2" ry="3.4" fill={color} />
    </g>
  ),
  sleepy: (color: string) => (
    <g>
      <path d="M -7.6 -0.6 Q -5 2.2 -2.4 -0.6" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M 2.4 -0.6 Q 5 2.2 7.6 -0.6" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    </g>
  ),
  surprised: (color: string) => (
    <g>
      <circle cx="-5" cy="0" r="3.3" fill="none" stroke={color} strokeWidth="1.8" />
      <circle cx="5" cy="0" r="3.3" fill="none" stroke={color} strokeWidth="1.8" />
      <circle cx="-5" cy="0" r="1.3" fill={color} />
      <circle cx="5" cy="0" r="1.3" fill={color} />
    </g>
  ),
  love: (color: string) => (
    <g>
      <path d="M -5 2.4 C -8.2 -0.4 -7.6 -3.6 -5.7 -2.4 C -5 -1.9 -5 -1.5 -5 -1.5 C -5 -1.5 -5 -1.9 -4.3 -2.4 C -2.4 -3.6 -1.8 -0.4 -5 2.4 Z" fill={color} />
      <path d="M 5 2.4 C 1.8 -0.4 2.4 -3.6 4.3 -2.4 C 5 -1.9 5 -1.5 5 -1.5 C 5 -1.5 5 -1.9 5.7 -2.4 C 7.6 -3.6 8.2 -0.4 5 2.4 Z" fill={color} />
    </g>
  ),
  cool: (color: string) => (
    <g>
      <rect x="-7.6" y="-1.5" width="5.2" height="3" rx="1.5" fill={color} />
      <rect x="2.4" y="-1.5" width="5.2" height="3" rx="1.5" fill={color} />
    </g>
  ),
  wink: (color: string) => (
    <g>
      <ellipse cx="-5" cy="0" rx="2.4" ry="3.7" fill={color} />
      <path d="M 2.5 0.5 Q 5 -2.6 7.5 0.5" fill="none" stroke={color} strokeWidth="1.9" strokeLinecap="round" />
    </g>
  ),
  petted: (color: string) => (
    <g>
      <path d="M -7.6 0.6 Q -5 -2.4 -2.4 0.6" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M 2.4 0.6 Q 5 -2.4 7.6 0.6" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    </g>
  ),
  giggle: (color: string) => (
    <g>
      <path d="M -7.6 -0.4 Q -5 -3.3 -2.4 -0.4" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M 2.4 -0.4 Q 5 -3.3 7.6 -0.4" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    </g>
  ),
  shy: (color: string) => (
    <g>
      <circle cx="-9.2" cy="3.4" r="2" fill="#f9a8d4" opacity="0.5" />
      <circle cx="9.2" cy="3.4" r="2" fill="#f9a8d4" opacity="0.5" />
      <ellipse cx="-5" cy="0.4" rx="1.9" ry="2.9" fill={color} />
      <ellipse cx="5" cy="0.4" rx="1.9" ry="2.9" fill={color} />
    </g>
  ),
  synergy1017: (color: string) => (
    <g>
      <ellipse cx="-4.5" cy="0" rx="2" ry="3.8" fill={color} />
      <path d="M 2.2 1 Q 4.7 -2.6 7.2 1" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </g>
  ),
  searching: (color: string) => (
    <g>
      <ellipse cx="-5" cy="0.4" rx="2.2" ry="3.2" fill={color} />
      <ellipse cx="5" cy="0.4" rx="2.2" ry="3.2" fill={color} />
    </g>
  ),
  learning: (color: string) => (
    <g>
      <ellipse cx="-5" cy="-0.5" rx="3" ry="3.6" fill={color} />
      <ellipse cx="5" cy="-0.5" rx="3" ry="3.6" fill={color} />
    </g>
  ),
  celebrating: (color: string) => (
    <g>
      <path d="M -7.6 0 Q -5 -3.1 -2.4 0" fill="none" stroke={color} strokeWidth="2.1" strokeLinecap="round" />
      <path d="M 2.4 0 Q 5 -3.1 7.6 0" fill="none" stroke={color} strokeWidth="2.1" strokeLinecap="round" />
    </g>
  ),
  blinking: (color: string) => (
    <g>
      <path d="M -7.6 0 Q -5 0.6 -2.4 0" fill="none" stroke={color} strokeWidth="2.1" strokeLinecap="round" />
      <path d="M 2.4 0 Q 5 0.6 7.6 0" fill="none" stroke={color} strokeWidth="2.1" strokeLinecap="round" />
    </g>
  ),
};

// Meshi prop types — contextual items Meshi can physically hold.
// Hands are only rendered when one of these visible props is active.
export type MeshiProp =
  | "none"
  | "magnifying-glass"
  | "clipboard"
  | "paintbrush"
  | "megaphone"
  | "shield"
  | "compass"
  | "bell"
  | "heart"
  | "wrench"
  | "notebook"
  | "paper"
  | "envelope"
  | "keyboard"
  | "rock"
  | "scissors"
  | "ball"
  | "grab";

// SVG props are anchored where Meshi's hand grips them, never over the face.
const PROP_SVGS: Record<string, (color: string) => React.ReactNode> = {
  "magnifying-glass": (color: string) => (
    <g transform="translate(18, 7) scale(0.66) rotate(-10)">
      <circle cx="0" cy="0" r="6" fill="none" stroke={color} strokeWidth="2.5" />
      <line x1="4" y1="4" x2="10" y2="10" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </g>
  ),
  clipboard: (color: string) => (
    <g transform="translate(18, 7) scale(0.6) rotate(4)">
      <rect x="-5" y="-2" width="10" height="14" rx="1.5" fill="none" stroke={color} strokeWidth="2" />
      <rect x="-2" y="-4" width="4" height="3" rx="1" fill={color} />
      <line x1="-3" y1="3" x2="3" y2="3" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="-3" y1="6" x2="3" y2="6" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="-3" y1="9" x2="1" y2="9" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </g>
  ),
  paintbrush: (color: string) => (
    <g transform="translate(18, 8) scale(0.66) rotate(-35)">
      <rect x="-1.5" y="-2" width="3" height="12" rx="1" fill={color} />
      <path d="M -2.5 10 Q 0 14 2.5 10" fill={color} opacity="0.7" />
    </g>
  ),
  megaphone: (color: string) => (
    <g transform="translate(18, 7) scale(0.64) rotate(-8)">
      <path d="M -2 -4 L 8 -8 L 8 4 L -2 0 Z" fill={color} opacity="0.8" />
      <rect x="-4" y="-4" width="3" height="4" rx="1" fill={color} />
    </g>
  ),
  shield: (color: string) => (
    <g transform="translate(18, 7) scale(0.62)">
      <path d="M 0 -7 L 7 -3 L 6 5 L 0 8 L -6 5 L -7 -3 Z" fill="none" stroke={color} strokeWidth="2" />
      <path d="M 0 -2 L 3 1 L 0 4 L -3 1 Z" fill={color} opacity="0.5" />
    </g>
  ),
  compass: (color: string) => (
    <g transform="translate(18, 7) scale(0.62)">
      <circle cx="0" cy="0" r="7" fill="none" stroke={color} strokeWidth="2" />
      <polygon points="0,-5 2,0 0,5 -2,0" fill={color} opacity="0.7" />
      <circle cx="0" cy="0" r="1.5" fill={color} />
    </g>
  ),
  bell: (color: string) => (
    <g transform="translate(18, 7) scale(0.64)">
      <path d="M -5 2 Q -5 -6 0 -7 Q 5 -6 5 2 L -5 2 Z" fill={color} opacity="0.8" />
      <rect x="-6" y="2" width="12" height="2" rx="1" fill={color} />
      <circle cx="0" cy="5" r="1.5" fill={color} />
    </g>
  ),
  heart: (color: string) => (
    <g transform="translate(0, 16) scale(0.7)">
      <path d="M 0 3 C -8 -2 -8 -8 -4 -8 C -1 -8 0 -5 0 -5 C 0 -5 1 -8 4 -8 C 8 -8 8 -2 0 3 Z" fill={color} opacity="0.8" />
    </g>
  ),
  wrench: (color: string) => (
    <g transform="translate(18, 7) scale(0.66) rotate(-48)">
      <rect x="-1.5" y="-2" width="3" height="14" rx="1" fill={color} />
      <circle cx="0" cy="-2" r="3" fill="none" stroke={color} strokeWidth="2" />
    </g>
  ),
  notebook: (color: string) => (
    <g transform="translate(0, 16) scale(0.58) rotate(2)">
      <rect x="-6" y="-2" width="12" height="14" rx="1.5" fill="none" stroke={color} strokeWidth="2" />
      <line x1="-2" y1="-2" x2="-2" y2="12" stroke={color} strokeWidth="1.4" opacity="0.7" />
      <line x1="0" y1="3" x2="4" y2="-1" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <line x1="0.5" y1="3.5" x2="3" y2="6" stroke={color} strokeWidth="1.4" strokeLinecap="round" opacity="0.75" />
    </g>
  ),
  paper: (color: string) => (
    <g transform="translate(0, 16) scale(0.6) rotate(4)">
      <path d="M -6 -7 H 3 L 7 -3 V 9 H -6 Z" fill="rgba(255,255,255,0.72)" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M 3 -7 V -3 H 7" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
      <line x1="-3" y1="-1" x2="3" y2="-1" stroke={color} strokeWidth="1.2" strokeLinecap="round" opacity="0.65" />
      <line x1="-3" y1="3" x2="4" y2="3" stroke={color} strokeWidth="1.2" strokeLinecap="round" opacity="0.65" />
    </g>
  ),
  envelope: (color: string) => (
    <g transform="translate(0, 16) scale(0.62) rotate(-2)">
      <rect x="-7" y="-4.5" width="14" height="10" rx="1.6" fill="rgba(255,255,255,0.7)" stroke={color} strokeWidth="1.8" />
      <path d="M -6 -3.5 L 0 1 L 6 -3.5" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
      <path d="M -6 5 L -1 1.2 M 6 5 L 1 1.2" fill="none" stroke={color} strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
    </g>
  ),
  keyboard: (color: string) => (
    <g transform="translate(0, 17) scale(0.62)">
      <rect x="-9" y="-5" width="18" height="12" rx="2.2" fill="rgba(255,255,255,0.58)" stroke={color} strokeWidth="1.9" />
      {[-5, 0, 5].map((x) => (
        <line key={`keyboard-key-${x}`} x1={x} y1="-1.8" x2={x} y2="2.5" stroke={color} strokeWidth="1" opacity="0.65" />
      ))}
      <line x1="-6" y1="2.8" x2="6" y2="2.8" stroke={color} strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
    </g>
  ),
  rock: (color: string) => (
    <g transform="translate(18, 7) scale(0.64)">
      <path d="M -5 1 C -7 -3 -4 -7 0 -7 C 5 -7 8 -3 6 2 C 5 6 1 8 -3 6 C -5 5 -6 3 -5 1 Z" fill={color} opacity="0.72" />
      <path d="M -3 -2 C 0 -4 3 -3 4 0" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1.1" strokeLinecap="round" />
    </g>
  ),
  scissors: (color: string) => (
    <g transform="translate(18, 7) scale(0.62) rotate(-18)">
      <circle cx="-4.5" cy="5" r="2.2" fill="none" stroke={color} strokeWidth="1.7" />
      <circle cx="2.5" cy="5" r="2.2" fill="none" stroke={color} strokeWidth="1.7" />
      <path d="M -2.5 3 L 7 -7 M 0.5 3 L -7 -7" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
    </g>
  ),
  ball: (color: string) => (
    <g transform="translate(18, 7) scale(0.64)">
      <circle cx="0" cy="0" r="6" fill="rgba(255,255,255,0.58)" stroke={color} strokeWidth="1.9" />
      <path d="M -5 -1 Q 0 -4 5 -1 M -5 2 Q 0 5 5 2" fill="none" stroke={color} strokeWidth="1.1" strokeLinecap="round" opacity="0.65" />
    </g>
  ),
  grab: (color: string) => (
    <g transform="translate(18, 7) scale(0.64)">
      <circle cx="0" cy="0" r="5.5" fill="none" stroke={color} strokeWidth="1.8" strokeDasharray="2.2 2" />
      <circle cx="0" cy="0" r="2" fill={color} opacity="0.6" />
    </g>
  ),
};

const TWO_HAND_PROPS: Set<MeshiProp> = new Set(["keyboard", "notebook", "paper", "envelope", "heart"]);

// Accessories that hang and should swing like pendulums when Meshi moves.
const DANGLING_ACCESSORIES = new Set(["earrings", "necklace"]);

// Hats that leave the crown open — hair renders at full size under these.
// Every other hat compresses the hair so strands tuck under the brim instead
// of poking through the shell.
const OPEN_HATS = new Set(["none", "halo", "headband", "bow", "flower"]);
const HAIR_TUCK_TRANSFORM = "translate(0, 2.4) scale(0.88)";

const HOLDING_POSES = {
  single: {
    right: { side: "right", shoulderX: 11.8, shoulderY: 5, elbowX: 15.4, elbowY: 7.8, handX: 17, handY: 10 },
  },
  two: {
    left: { side: "left", shoulderX: -8.8, shoulderY: 8, elbowX: -11.6, elbowY: 11.6, handX: -10.6, handY: 15 },
    right: { side: "right", shoulderX: 8.8, shoulderY: 8, elbowX: 11.6, elbowY: 11.6, handX: 10.6, handY: 15 },
  },
} as const;


// Meshi hats — rendered on top of (outside) the body clip so nothing is cut
// off. Each sits on the crown (head top ≈ y -16) and stays within the viewBox.
const HATS: Record<string, React.ReactNode> = {
  none: null,
  tophat: (
    <g transform="translate(0, -13)">
      <ellipse cx="0" cy="2.4" rx="13" ry="2.5" fill="currentColor" opacity="0.92" />
      <rect x="-8.5" y="-10" width="17" height="12.4" rx="1.4" fill="currentColor" />
      <path d="M-8.5 -10 L-8.5 2.4 L-3 2.4 L-3 -10 Z" fill="rgba(0,0,0,0.16)" />
      <ellipse cx="0" cy="-10" rx="8.5" ry="1.7" fill="currentColor" />
      <ellipse cx="0" cy="-10" rx="8.5" ry="1.7" fill="rgba(255,255,255,0.12)" />
      <rect x="-8.5" y="-2.4" width="17" height="3" fill="#fbbf24" opacity="0.95" />
      <path d="M6 -8.6 L6 -3" stroke="rgba(255,255,255,0.3)" strokeWidth="1.3" strokeLinecap="round" />
    </g>
  ),
  crown: (
    <g transform="translate(0, -14)">
      <polygon points="-11,3 -11,-3 -7,-0.5 -3.5,-7 0,-0.5 3.5,-7 7,-0.5 11,-3 11,3" fill="#fbbf24" stroke="#d97706" strokeWidth="0.7" strokeLinejoin="round" />
      <polygon points="-11,3 -11,-3 -7,-0.5 -3.5,-7 -1.8,-3.6 -1.8,3" fill="rgba(255,255,255,0.16)" />
      <rect x="-11" y="1.2" width="22" height="2.4" rx="1" fill="#f59e0b" />
      <path d="M-9 2.4 H9" stroke="rgba(255,255,255,0.28)" strokeWidth="0.6" strokeLinecap="round" />
      <circle cx="-3.5" cy="-3.8" r="1.3" fill="#ef4444" stroke="rgba(255,255,255,0.4)" strokeWidth="0.4" />
      <circle cx="3.5" cy="-3.8" r="1.3" fill="#3b82f6" stroke="rgba(255,255,255,0.4)" strokeWidth="0.4" />
      <circle cx="0" cy="-1.4" r="1.3" fill="#22c55e" stroke="rgba(255,255,255,0.4)" strokeWidth="0.4" />
      <circle cx="-3.9" cy="-4.2" r="0.4" fill="rgba(255,255,255,0.75)" />
      <circle cx="3.1" cy="-4.2" r="0.4" fill="rgba(255,255,255,0.75)" />
    </g>
  ),
  beanie: (
    <g transform="translate(0, -12)">
      <path d="M-11 1 Q-11 -10 0 -10 Q11 -10 11 1 Z" fill="currentColor" opacity="0.96" />
      <path d="M-8 -8 Q-9.5 -3 -9.5 1 M-4 -9.4 Q-5 -3.5 -5 1 M0 -10 L0 1 M4 -9.4 Q5 -3.5 5 1 M8 -8 Q9.5 -3 9.5 1" fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth="0.8" />
      <rect x="-11.5" y="0.2" width="23" height="3.8" rx="1.9" fill="currentColor" />
      <path d="M-9 0.8 L-9 3.4 M-5.5 0.8 L-5.5 3.4 M-2 0.8 L-2 3.4 M1.5 0.8 L1.5 3.4 M5 0.8 L5 3.4 M8.5 0.8 L8.5 3.4" stroke="rgba(0,0,0,0.28)" strokeWidth="0.9" strokeLinecap="round" />
      <circle cx="0" cy="-10.6" r="2.3" fill="currentColor" />
      <circle cx="-0.7" cy="-11.2" r="0.8" fill="rgba(255,255,255,0.5)" />
    </g>
  ),
  cap: (
    <g transform="translate(0, -12)">
      <path d="M-11 1 Q-11 -9.5 0 -9.5 Q11 -9.5 11 1 Z" fill="currentColor" opacity="0.96" />
      <path d="M-11 1 Q-11 -9.5 0 -9.5 L0 1 Z" fill="rgba(0,0,0,0.18)" />
      <path d="M0 -9.5 L0 1 M-6.5 -8 Q-7.5 -3 -7.5 1 M6.5 -8 Q7.5 -3 7.5 1" fill="none" stroke="rgba(0,0,0,0.22)" strokeWidth="0.8" />
      <path d="M7 0 Q16 0.4 18.2 3.4 Q12.4 4.8 8 2.9 Q7.2 1.4 7 0 Z" fill="currentColor" opacity="0.85" />
      <circle cx="0" cy="-9.6" r="1.3" fill="currentColor" />
      <path d="M-8 -5.5 Q0 -9 8 -5.5" stroke="rgba(255,255,255,0.32)" strokeWidth="0.9" fill="none" strokeLinecap="round" />
    </g>
  ),
  hardhat: (
    <g transform="translate(0, -11)">
      <path d="M-12,2 Q-12,-9 0,-9 Q12,-9 12,2 Z" fill="#f59e0b" />
      <path d="M-12,2 Q-12,-9 0,-9 L0,2 Z" fill="rgba(0,0,0,0.14)" />
      <rect x="-2.4" y="-8.6" width="4.8" height="10" rx="1.6" fill="#fbbf24" />
      <path d="M-8,-4.5 Q-9.4,-1 -9.4,2 M8,-4.5 Q9.4,-1 9.4,2" fill="none" stroke="rgba(0,0,0,0.18)" strokeWidth="0.9" />
      <rect x="-14" y="1.4" width="28" height="3.2" rx="1.6" fill="#d97706" />
      <path d="M-12.5 3 H12.5" stroke="rgba(255,255,255,0.2)" strokeWidth="0.7" strokeLinecap="round" />
      <path d="M-7 -6.5 Q-3.5 -8.6 0 -8.7" stroke="rgba(255,255,255,0.35)" strokeWidth="1" fill="none" strokeLinecap="round" />
    </g>
  ),
  party: (
    <g transform="translate(0, -11)">
      <polygon points="0,-10 -7,3 7,3" fill="#ec4899" stroke="#db2777" strokeWidth="0.5" strokeLinejoin="round" />
      <path d="M0,-10 L-7,3 L-3.2,3 Z" fill="rgba(255,255,255,0.16)" />
      <path d="M-4.9,-1 Q0,1.4 4.9,-1 M-2.8,-4.8 Q0,-3.4 2.8,-4.8" fill="none" stroke="#fbbf24" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M-7,3 Q0,4.6 7,3" fill="none" stroke="#db2777" strokeWidth="1.1" strokeLinecap="round" />
      <circle cx="0" cy="-10.6" r="1.8" fill="#fbbf24" />
      <circle cx="-0.6" cy="-11.2" r="0.6" fill="rgba(255,255,255,0.7)" />
    </g>
  ),
  flower: (
    <g transform="translate(7, -13)">
      {FLOWER_POSITIONS.map((pos) => (
        <ellipse
          key={pos.deg}
          cx={pos.cx}
          cy={pos.cy}
          rx="2.5"
          ry="2"
          transform={`rotate(${pos.deg} ${pos.cx} ${pos.cy})`}
          fill="#ec4899"
          stroke="#db2777"
          strokeWidth="0.4"
          opacity="0.95"
        />
      ))}
      <path d="M-4.5 3.5 Q-8 4.5 -9.5 8 Q-5.5 7.5 -4 4.8 Z" fill="#22c55e" opacity="0.9" />
      <circle cx="0" cy="0" r="2.7" fill="#fbbf24" stroke="#f59e0b" strokeWidth="0.5" />
      <circle cx="-0.7" cy="-0.7" r="0.8" fill="rgba(255,255,255,0.55)" />
    </g>
  ),
  beret: (
    <g transform="translate(0, -12)">
      <path d="M-11 1 Q-12 -6 -3 -7.4 Q6 -8.4 11 -1 Q11.6 1.4 6 2.6 Q-4 4 -9.5 2.6 Q-11 2 -11 1 Z" fill="currentColor" opacity="0.94" />
      <path d="M-11 1 Q-12 -6 -3 -7.4 L-2 2.8 Q-7 3.4 -9.5 2.6 Q-11 2 -11 1 Z" fill="rgba(0,0,0,0.14)" />
      <path d="M-8 -4.5 Q-2 -7.6 5 -5.5" stroke="rgba(255,255,255,0.28)" strokeWidth="1" fill="none" strokeLinecap="round" />
      <path d="M-7 1.8 Q0 3.2 8 1.6" fill="none" stroke="rgba(0,0,0,0.22)" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M2.4 -7.2 Q3 -9 4.2 -9.4" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </g>
  ),
  headband: (
    <g transform="translate(0, -9)">
      <path d="M-12 -1 Q0 -7.4 12 -1 L12 2 Q0 -4.4 -12 2 Z" fill="currentColor" opacity="0.94" />
      <path d="M-12 -1 Q0 -7.4 12 -1 L12 0 Q0 -6.2 -12 0 Z" fill="rgba(255,255,255,0.2)" />
      <path d="M-8 -2.6 L-7.4 -0.2 M-4 -4 L-3.6 -1.6 M0 -4.6 L0 -2.2 M4 -4 L3.6 -1.6 M8 -2.6 L7.4 -0.2" stroke="rgba(0,0,0,0.2)" strokeWidth="0.8" strokeLinecap="round" />
      <circle cx="-9.5" cy="-2" r="1.8" fill="currentColor" />
      <path d="M-11 -0.6 L-12.4 1.8 M-8.4 -0.5 L-7.6 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </g>
  ),
  bow: (
    <g transform="translate(0, -14)">
      <path d="M-0.8 0 Q-4.5 -4.6 -7.4 -3.4 Q-9 -2.6 -8.2 0.2 Q-7.4 3 -5.4 3.4 Q-3 3.8 -0.8 0 Z" fill="currentColor" opacity="0.95" />
      <path d="M0.8 0 Q4.5 -4.6 7.4 -3.4 Q9 -2.6 8.2 0.2 Q7.4 3 5.4 3.4 Q3 3.8 0.8 0 Z" fill="currentColor" opacity="0.95" />
      <path d="M-0.8 0 Q-4 -3.6 -6.6 -2.8" fill="none" stroke="rgba(0,0,0,0.22)" strokeWidth="0.8" strokeLinecap="round" />
      <path d="M0.8 0 Q4 -3.6 6.6 -2.8" fill="none" stroke="rgba(0,0,0,0.22)" strokeWidth="0.8" strokeLinecap="round" />
      <rect x="-1.9" y="-1.9" width="3.8" height="3.8" rx="1.2" fill="currentColor" />
      <path d="M-1.2 -1.2 L0.6 -0.4" stroke="rgba(255,255,255,0.4)" strokeWidth="0.7" strokeLinecap="round" />
    </g>
  ),
  cowboy: (
    <g transform="translate(0, -12)">
      <path d="M-8 0 Q-8.6 -8.6 -4 -8.2 Q-2 -5.8 0 -5.8 Q2 -5.8 4 -8.2 Q8.6 -8.6 8 0 Z" fill="currentColor" opacity="0.95" />
      <path d="M-8 0 Q-8.6 -8.6 -4 -8.2 Q-2.4 -6.2 -1.4 -6 L-1.4 0 Z" fill="rgba(0,0,0,0.14)" />
      <path d="M0 -5.8 L0 -1" stroke="rgba(0,0,0,0.2)" strokeWidth="1" strokeLinecap="round" />
      <path d="M-14 0.6 Q-13 3.4 -9 4 Q0 5.2 9 4 Q13 3.4 14 0.6 Q10.4 -1 8 0 L-8 0 Q-10.4 -1 -14 0.6 Z" fill="currentColor" opacity="0.88" />
      <path d="M-13 1.6 Q-6 3.6 0 3.6 Q6 3.6 13 1.6" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8" strokeLinecap="round" />
      <path d="M-8 -0.8 Q0 1 8 -0.8" fill="none" stroke="#92400e" strokeWidth="1.8" strokeLinecap="round" />
      <rect x="-1.2" y="-0.9" width="2.4" height="1.9" rx="0.5" fill="#fbbf24" />
    </g>
  ),
  graduation: (
    <g transform="translate(0, -13)">
      <path d="M-6 0.5 Q-6 -1.5 0 -1.5 Q6 -1.5 6 0.5 L6 2.8 Q6 4.8 0 4.8 Q-6 4.8 -6 2.8 Z" fill="currentColor" opacity="0.8" />
      <polygon points="0,-7 14,-1.5 0,4 -14,-1.5" fill="currentColor" opacity="0.96" />
      <polygon points="0,-7 -14,-1.5 0,4" fill="rgba(0,0,0,0.14)" />
      <polygon points="0,-7 14,-1.5 0,4" fill="rgba(255,255,255,0.08)" />
      <circle cx="0" cy="-1.5" r="1.1" fill="#fbbf24" />
      <path d="M0 -1.5 Q6 -1.4 10 0" fill="none" stroke="#fbbf24" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="10" y1="0" x2="10" y2="6.6" stroke="#fbbf24" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M8.8 6.6 H11.2 L10.9 9.4 Q10 10 9.1 9.4 Z" fill="#fbbf24" />
    </g>
  ),
  // MeshPro exclusive hats
  headphones: (
    <g transform="translate(0, -10)">
      <path d="M-12,4 Q-12,-9 0,-9 Q12,-9 12,4" fill="none" stroke="#4b5563" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M-8,-6.4 Q0,-10.4 8,-6.4" fill="none" stroke="#6b7280" strokeWidth="1.6" strokeLinecap="round" />
      <rect x="-15.4" y="-0.6" width="6.6" height="10" rx="3" fill="#374151" stroke="#1f2937" strokeWidth="0.7" />
      <rect x="8.8" y="-0.6" width="6.6" height="10" rx="3" fill="#374151" stroke="#1f2937" strokeWidth="0.7" />
      <rect x="-14.2" y="0.6" width="2" height="7.6" rx="1" fill="rgba(255,255,255,0.14)" />
      <rect x="10" y="0.6" width="2" height="7.6" rx="1" fill="rgba(255,255,255,0.14)" />
      <circle cx="-12.1" cy="4.4" r="1.4" fill="#111827" />
      <circle cx="12.1" cy="4.4" r="1.4" fill="#111827" />
    </g>
  ),
  halo: (
    <g transform="translate(0, -18.5)">
      <ellipse cx="0" cy="0" rx="11" ry="3.4" fill="none" stroke="#fde68a" strokeWidth="2.6" opacity="0.95" />
      <ellipse cx="0" cy="0" rx="11" ry="3.4" fill="none" stroke="#fbbf24" strokeWidth="1" opacity="0.6" />
      <path d="M-8 -2.2 Q-4 -3.6 0 -3.4" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="0.9" strokeLinecap="round" />
      <circle cx="11.6" cy="0.6" r="0.7" fill="#fef3c7" opacity="0.9" />
      <circle cx="-11.6" cy="0.6" r="0.7" fill="#fef3c7" opacity="0.9" />
    </g>
  ),
  wizard: (
    <g transform="translate(0, -11)">
      <path d="M0 -12 Q-1.6 -8 -4.6 -4.4 L-9 3 L9 3 L3.4 -6.4 Q1.4 -9.6 0 -12 Z" fill="#6366f1" stroke="#4f46e5" strokeWidth="0.6" strokeLinejoin="round" />
      <path d="M0 -12 Q-1.6 -8 -4.6 -4.4 L-9 3 L-2.6 3 Z" fill="rgba(0,0,0,0.16)" />
      <path d="M-10,3 Q0,0.8 10,3 L10,5.2 Q0,3.2 -10,5.2 Z" fill="#4f46e5" />
      <path d="M-9 3.6 Q0 1.8 9 3.6" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="0.7" />
      <circle cx="0" cy="-12" r="1.5" fill="#fbbf24" />
      <path d="M-3.4 -2.4 L-2.9 -1.2 L-1.7 -1 L-2.6 -0.2 L-2.4 1 L-3.4 0.4 L-4.4 1 L-4.2 -0.2 L-5.1 -1 L-3.9 -1.2 Z" fill="#fbbf24" opacity="0.9" />
      <path d="M3.6 -5.2 Q2.6 -4 3.2 -2.6 Q1.8 -3.4 1.9 -4.9 Q2.6 -5.6 3.6 -5.2 Z" fill="#fbbf24" opacity="0.75" />
    </g>
  ),
  astronaut: (
    <g transform="translate(0, -6)">
      <path d="M-15,4 Q-15,-12 0,-12 Q15,-12 15,4 Z" fill="rgba(148,163,184,0.16)" stroke="#e2e8f0" strokeWidth="2" />
      <path d="M-13,3 Q-13,-10 0,-10" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.1" strokeLinecap="round" />
      <ellipse cx="-6" cy="-6" rx="3.2" ry="1.8" fill="rgba(255,255,255,0.3)" transform="rotate(-20 -6 -6)" />
      <rect x="-16.6" y="1" width="3.2" height="4.6" rx="1.4" fill="#cbd5e1" />
      <rect x="13.4" y="1" width="3.2" height="4.6" rx="1.4" fill="#cbd5e1" />
      <line x1="0" y1="-12" x2="0" y2="-14.6" stroke="#cbd5e1" strokeWidth="1.1" strokeLinecap="round" />
      <circle cx="0" cy="-15.4" r="1" fill="#ef4444" />
    </g>
  ),
  pirate: (
    <g transform="translate(0, -12)">
      <path d="M-13,2 Q-13,-6 0,-7 Q13,-6 13,2 Z" fill="#1f2937" />
      <path d="M-13,2 Q-13,-6 0,-7 L0,2 Z" fill="rgba(255,255,255,0.05)" />
      <path d="M-14,0.8 Q-15,3.2 -12,3.8 Q0,5.4 12,3.8 Q15,3.2 14,0.8 Q10,-0.6 8,0.6 Q0,2 -8,0.6 Q-10,-0.6 -14,0.8 Z" fill="#111827" stroke="#fbbf24" strokeWidth="0.7" />
      <circle cx="0" cy="-2.9" r="2.4" fill="#e5e7eb" />
      <ellipse cx="-0.85" cy="-3.3" rx="0.6" ry="0.75" fill="#1f2937" />
      <ellipse cx="0.85" cy="-3.3" rx="0.6" ry="0.75" fill="#1f2937" />
      <path d="M-2.5 0 L2.5 -1.4 M-2.5 -1.4 L2.5 0" stroke="#e5e7eb" strokeWidth="1" strokeLinecap="round" />
    </g>
  ),
  chef: (
    <g transform="translate(0, -12)">
      <circle cx="-6.2" cy="-4.2" r="4.6" fill="#f8fafc" />
      <circle cx="6.2" cy="-4.2" r="4.6" fill="#f8fafc" />
      <circle cx="0" cy="-6.4" r="5.2" fill="#f8fafc" />
      <rect x="-9.2" y="-3.4" width="18.4" height="6.2" rx="1.4" fill="#f8fafc" />
      <path d="M-4.6 -8.4 Q-4.2 -5 -4.6 -2 M0 -11 Q0.4 -6 0 -2 M4.6 -8.4 Q4.2 -5 4.6 -2" stroke="rgba(15,23,42,0.12)" strokeWidth="0.9" fill="none" strokeLinecap="round" />
      <rect x="-9.2" y="1.6" width="18.4" height="2.8" rx="1.2" fill="#e2e8f0" />
      <path d="M-8 3 H8" stroke="rgba(15,23,42,0.1)" strokeWidth="0.7" strokeLinecap="round" />
    </g>
  ),
};

const HAIRS: Record<string, React.ReactNode> = {
  none: null,
  fluffy: (
    <g transform="translate(0, -13)">
      <path d="M-12,3 Q-12.6,-4 -7.6,-6 Q-6,-9.4 -2.4,-8.6 Q0,-11.6 3.4,-9.2 Q7.6,-10 9.2,-6.2 Q12.6,-4.4 12,2 Q8,-2 5.4,-5 Q3,-2.6 0.4,-6 Q-2.6,-2.8 -5.6,-5.4 Q-8.6,-2 -12,3 Z" fill="currentColor" opacity="0.9" />
      <path d="M-7 -5.8 Q-4 -8.2 -1 -7.4" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.9" strokeLinecap="round" />
      <path d="M1.6 -8 Q4.4 -8.8 6.6 -6.8" fill="none" stroke="rgba(255,255,255,0.24)" strokeWidth="0.9" strokeLinecap="round" />
    </g>
  ),
  bangs: (
    <g transform="translate(0, -12)">
      <path d="M-13,3 Q-13,-9 0,-9 Q13,-9 13,3 L9.4,3 Q8.4,-2.6 5.4,0.6 Q3.4,-3.2 0.4,0.2 Q-2.4,-3.4 -5,0.4 Q-7.6,-2.8 -9.2,3 Z" fill="currentColor" opacity="0.92" />
      <path d="M-9 -6.4 Q-4 -8.8 0 -8.6" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="0.9" strokeLinecap="round" />
      <path d="M-5 0.4 Q-4.4 -1.8 -3.6 -2.8 M0.4 0.2 Q1 -2 1.8 -3 M5.4 0.6 Q6 -1.4 6.8 -2.4" stroke="rgba(0,0,0,0.16)" strokeWidth="0.8" fill="none" strokeLinecap="round" />
    </g>
  ),
  spikes: (
    <g transform="translate(0, -13)">
      <path d="M-12,3 L-10.4,-6.6 Q-9.6,-7.6 -9,-6.4 L-6.4,1.4 L-3,-8.4 Q-2.2,-9.6 -1.6,-8.2 L1.6,1.6 L5.4,-7 Q6.2,-8.2 6.8,-6.8 L9.6,1.4 L12,3 Z" fill="currentColor" opacity="0.92" />
      <path d="M-10.4,-6.6 L-9.4,-2 M-3,-8.4 L-1.9,-4 M5.4,-7 L6.4,-2.6" stroke="rgba(255,255,255,0.26)" strokeWidth="0.8" strokeLinecap="round" />
    </g>
  ),
  curls: (
    <g transform="translate(0, -12)">
      <circle cx="-8.4" cy="0.4" r="4" fill="currentColor" opacity="0.86" />
      <circle cx="-2.4" cy="-2" r="4.6" fill="currentColor" opacity="0.9" />
      <circle cx="4.4" cy="-1.4" r="4.3" fill="currentColor" opacity="0.88" />
      <circle cx="9.8" cy="0.8" r="3.5" fill="currentColor" opacity="0.84" />
      <path d="M-9.6 -0.4 Q-8.2 -2.4 -6.4 -1 Q-6.8 0.8 -8.6 0.6" fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth="0.8" strokeLinecap="round" />
      <path d="M-3.6 -3.4 Q-1.6 -4.8 -0.2 -2.9 Q-1 -1 -3 -1.6" fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth="0.8" strokeLinecap="round" />
      <path d="M3.2 -3 Q5.2 -4 6.2 -2.2 Q5.2 -0.6 3.6 -1.4" fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth="0.8" strokeLinecap="round" />
      <path d="M-4 -4.6 Q-2 -6 0 -5" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="0.9" strokeLinecap="round" />
    </g>
  ),
};

const ACCESSORIES: Record<string, React.ReactNode> = {
  none: null,
  glasses: (
    <g transform="translate(0, 0)">
      <rect x="-10.5" y="-4.2" width="8" height="6.6" rx="3" fill="rgba(255,255,255,0.09)" stroke="currentColor" strokeWidth="1.6" />
      <rect x="2.5" y="-4.2" width="8" height="6.6" rx="3" fill="rgba(255,255,255,0.09)" stroke="currentColor" strokeWidth="1.6" />
      <path d="M-2.5 -1.2 Q0 -2.8 2.5 -1.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <line x1="-10.5" y1="-1.6" x2="-13.6" y2="-2.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="10.5" y1="-1.6" x2="13.6" y2="-2.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M-9 -3 L-7.4 -1.4" stroke="rgba(255,255,255,0.4)" strokeWidth="0.9" strokeLinecap="round" />
      <path d="M4 -3 L5.6 -1.4" stroke="rgba(255,255,255,0.4)" strokeWidth="0.9" strokeLinecap="round" />
    </g>
  ),
  sunglasses: (
    <g transform="translate(0, 0)">
      <path d="M-10.8 -4.2 H-2.6 V-1.6 Q-2.6 2.4 -6.7 2.4 Q-10.8 2.4 -10.8 -1.6 Z" fill="#0f172a" stroke="currentColor" strokeWidth="1.3" />
      <path d="M2.6 -4.2 H10.8 V-1.6 Q10.8 2.4 6.7 2.4 Q2.6 2.4 2.6 -1.6 Z" fill="#0f172a" stroke="currentColor" strokeWidth="1.3" />
      <line x1="-2.6" y1="-3.2" x2="2.6" y2="-3.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="-10.8" y1="-2.6" x2="-13.6" y2="-3.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <line x1="10.8" y1="-2.6" x2="13.6" y2="-3.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M-9.2 -3 L-6.8 -0.4" stroke="rgba(255,255,255,0.35)" strokeWidth="1" strokeLinecap="round" />
      <path d="M4.2 -3 L6.6 -0.4" stroke="rgba(255,255,255,0.35)" strokeWidth="1" strokeLinecap="round" />
    </g>
  ),
  lashes: (
    <g transform="translate(0, 0)">
      <path d="M-8,-3 L-9.5,-5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M-6,-3 L-6,-5.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M-4,-3 L-2.8,-5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M4,-3 L2.8,-5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M6,-3 L6,-5.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M8,-3 L9.5,-5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </g>
  ),
  monocle: (
    <g transform="translate(0, 0)">
      <circle cx="5.5" cy="-1.2" r="3.4" fill="rgba(255,255,255,0.1)" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="5.5" cy="-1.2" r="2.2" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="0.6" />
      <path d="M4.4 -2.6 L5.8 -1.2" stroke="rgba(255,255,255,0.45)" strokeWidth="0.8" strokeLinecap="round" />
      <path d="M8.4 1.4 Q9.6 3.4 9.4 5.6 Q9.2 7 10.4 7.6" fill="none" stroke="#fbbf24" strokeWidth="1" strokeLinecap="round" />
    </g>
  ),
  earrings: (
    <g>
      <path d="M-15 3.6 Q-15.8 4.6 -15 5.4 M15 3.6 Q15.8 4.6 15 5.4" stroke="currentColor" strokeWidth="1" fill="none" strokeLinecap="round" />
      <circle cx="-15" cy="6" r="1.4" fill="currentColor" />
      <circle cx="15" cy="6" r="1.4" fill="currentColor" />
      <path d="M-15 7.4 L-15 8 M15 7.4 L15 8" stroke="#fbbf24" strokeWidth="0.8" strokeLinecap="round" />
      <circle cx="-15" cy="9.2" r="1.2" fill="#fbbf24" stroke="#f59e0b" strokeWidth="0.4" />
      <circle cx="15" cy="9.2" r="1.2" fill="#fbbf24" stroke="#f59e0b" strokeWidth="0.4" />
      <circle cx="-15.4" cy="8.8" r="0.35" fill="rgba(255,255,255,0.8)" />
      <circle cx="14.6" cy="8.8" r="0.35" fill="rgba(255,255,255,0.8)" />
    </g>
  ),
  bowtie: (
    <g transform="translate(0, 14.5)">
      <path d="M-1 0 Q-4 -3.4 -6.4 -3 Q-7.4 -2.6 -7.2 -0.6 L-7.2 0.6 Q-7.4 2.6 -6.4 3 Q-4 3.4 -1 0 Z" fill="currentColor" opacity="0.95" />
      <path d="M1 0 Q4 -3.4 6.4 -3 Q7.4 -2.6 7.2 -0.6 L7.2 0.6 Q7.4 2.6 6.4 3 Q4 3.4 1 0 Z" fill="currentColor" opacity="0.95" />
      <path d="M-1 0 Q-3.6 -2.4 -5.6 -2.4 M1 0 Q3.6 -2.4 5.6 -2.4" stroke="rgba(0,0,0,0.22)" strokeWidth="0.7" fill="none" strokeLinecap="round" />
      <rect x="-1.7" y="-2" width="3.4" height="4" rx="1" fill="currentColor" />
      <path d="M-0.9 -1.1 L0.7 -0.3" stroke="rgba(255,255,255,0.4)" strokeWidth="0.7" strokeLinecap="round" />
    </g>
  ),
  freckles: (
    <g fill="currentColor" opacity="0.55">
      <circle cx="-10" cy="3" r="0.75" />
      <circle cx="-8" cy="4.3" r="0.6" />
      <circle cx="-11.6" cy="4.7" r="0.65" />
      <circle cx="-9.4" cy="5.8" r="0.5" />
      <circle cx="10" cy="3" r="0.75" />
      <circle cx="8" cy="4.3" r="0.6" />
      <circle cx="11.6" cy="4.7" r="0.65" />
      <circle cx="9.4" cy="5.8" r="0.5" />
    </g>
  ),
  blush: (
    <g>
      <ellipse cx="-9" cy="3.6" rx="2.9" ry="1.7" fill="#f9a8d4" opacity="0.35" />
      <ellipse cx="-9" cy="3.6" rx="1.9" ry="1.1" fill="#f9a8d4" opacity="0.45" />
      <ellipse cx="9" cy="3.6" rx="2.9" ry="1.7" fill="#f9a8d4" opacity="0.35" />
      <ellipse cx="9" cy="3.6" rx="1.9" ry="1.1" fill="#f9a8d4" opacity="0.45" />
    </g>
  ),
  eyepatch: (
    <g>
      <path d="M-13.5 -5.5 Q-4 -4.2 1.6 -3.6 M8.4 -3.2 Q11.4 -3 13.5 -2.6" stroke="#1f2937" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <ellipse cx="5" cy="0" rx="4.2" ry="4.7" fill="#1f2937" stroke="#111827" strokeWidth="0.8" />
      <path d="M2.4 -2.4 Q5 -4 7.6 -2.4" fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="0.8" strokeLinecap="round" />
    </g>
  ),
  star: (
    <g transform="translate(9, 4.5) scale(0.9)">
      <path d="M0 -3 L0.9 -0.9 L3 -0.9 L1.3 0.6 L1.9 2.8 L0 1.5 L-1.9 2.8 L-1.3 0.6 L-3 -0.9 L-0.9 -0.9 Z" fill="#fbbf24" stroke="#f59e0b" strokeWidth="0.4" strokeLinejoin="round" />
      <circle cx="-0.6" cy="-1.2" r="0.35" fill="rgba(255,255,255,0.85)" />
    </g>
  ),
  mustache: (
    <g transform="translate(0, 6)">
      <path d="M0 0 Q-2 -2.4 -4.6 -1.6 Q-7.4 -0.7 -8.2 1.4 Q-5.6 1.8 -3.4 0.9 Q-1.4 0.2 0 1 Q1.4 0.2 3.4 0.9 Q5.6 1.8 8.2 1.4 Q7.4 -0.7 4.6 -1.6 Q2 -2.4 0 0 Z" fill="currentColor" opacity="0.95" />
      <path d="M-5.6 -0.9 Q-4 -1.4 -2.6 -0.7 M2.6 -0.7 Q4 -1.4 5.6 -0.9" stroke="rgba(255,255,255,0.22)" strokeWidth="0.6" fill="none" strokeLinecap="round" />
    </g>
  ),
  necklace: (
    <g transform="translate(0, 12)">
      <path d="M-9 -2 Q0 4.5 9 -2" fill="none" stroke="#fbbf24" strokeWidth="1.3" strokeDasharray="1.6 1" />
      <path d="M-9 -2 Q0 4.5 9 -2" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.5" />
      <path d="M0 1.3 L1.5 3 L0 5.2 L-1.5 3 Z" fill="#fbbf24" stroke="#f59e0b" strokeWidth="0.4" strokeLinejoin="round" />
      <path d="M-0.5 2.4 L0.4 3" stroke="rgba(255,255,255,0.8)" strokeWidth="0.5" strokeLinecap="round" />
    </g>
  ),
};

const BADGES: Record<string, React.ReactNode> = {
  none: null,
  spark: (
    <g transform="translate(11, 11)">
      <circle cx="0" cy="0" r="4.2" fill="rgba(255,255,255,0.78)" stroke="currentColor" strokeWidth="1.3" />
      <path d="M0 -2.4 L0.8 -0.7 L2.5 0 L0.8 0.7 L0 2.4 L-0.8 0.7 L-2.5 0 L-0.8 -0.7 Z" fill="currentColor" />
    </g>
  ),
  heart: (
    <g transform="translate(11, 11)">
      <circle cx="0" cy="0" r="4.3" fill="rgba(255,255,255,0.78)" stroke="currentColor" strokeWidth="1.3" />
      <path d="M0 2.2 C-4 -0.5 -3.4 -3.1 -1.5 -3.1 C-0.5 -3.1 0 -2.2 0 -2.2 C0 -2.2 0.5 -3.1 1.5 -3.1 C3.4 -3.1 4 -0.5 0 2.2 Z" fill="currentColor" />
    </g>
  ),
  shield: (
    <g transform="translate(11, 11)">
      <circle cx="0" cy="0" r="4.3" fill="rgba(255,255,255,0.78)" stroke="currentColor" strokeWidth="1.3" />
      <path d="M0 -3.1 L2.5 -1.8 L2 1.4 L0 3 L-2 1.4 L-2.5 -1.8 Z" fill="currentColor" opacity="0.9" />
    </g>
  ),
  verified: (
    <g transform="translate(11, 11)">
      <circle cx="0" cy="0" r="4.4" fill="#2563eb" stroke="rgba(255,255,255,0.85)" strokeWidth="1.2" />
      <path d="M-2 -0.1 L-0.5 1.5 L2.4 -1.8" fill="none" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  ),
  creator: (
    <g transform="translate(11, 11)">
      <circle cx="0" cy="0" r="4.4" fill="#f59e0b" stroke="rgba(255,255,255,0.85)" strokeWidth="1.2" />
      <path d="M0 -2.7 L0.8 -0.8 L2.8 -0.8 L1.2 0.5 L1.8 2.5 L0 1.4 L-1.8 2.5 L-1.2 0.5 L-2.8 -0.8 L-0.8 -0.8 Z" fill="white" />
    </g>
  ),
  founder: (
    <g transform="translate(11, 11)">
      <circle cx="0" cy="0" r="4.4" fill="#7c3aed" stroke="rgba(255,255,255,0.85)" strokeWidth="1.2" />
      <path d="M-2.6 1.9 L-1.8 -1.8 L0 -0.4 L1.8 -1.8 L2.6 1.9 Z" fill="white" />
    </g>
  ),
};

const OUTFITS: Record<string, React.ReactNode> = {
  none: null,
  scarf: (
    <g transform="translate(0, 7)">
      <path d="M-12 -1.5 Q0 3 12 -1.5 L12 2.5 Q0 7 -12 2.5 Z" fill="currentColor" opacity="0.96" />
      <path d="M-12 0.5 Q0 5 12 0.5 L12 2.5 Q0 7 -12 2.5 Z" fill="rgba(0,0,0,0.2)" />
      <rect x="4.6" y="1.4" width="4.4" height="9.2" rx="1.4" fill="currentColor" opacity="0.92" />
      <path d="M5.5 10.8 L5.5 12.8 M7 10.8 L7 12.8 M8.5 10.8 L8.5 12.8" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.85" />
    </g>
  ),
  hoodie: (
    <g transform="translate(0, 8)">
      <path d="M-13 -1 Q-9 -7.5 0 -7.5 Q9 -7.5 13 -1 L12 12 H-12 Z" fill="currentColor" opacity="0.34" />
      <path d="M-6.5 -5.5 Q0 -1.5 6.5 -5.5 Q4 -2.4 0 -2.4 Q-4 -2.4 -6.5 -5.5 Z" fill="currentColor" opacity="0.6" />
      <line x1="-2.8" y1="-2.2" x2="-3.3" y2="4.6" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.9" />
      <line x1="2.8" y1="-2.2" x2="3.3" y2="4.6" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.9" />
      <circle cx="-3.3" cy="5.4" r="0.9" fill="currentColor" />
      <circle cx="3.3" cy="5.4" r="0.9" fill="currentColor" />
      <path d="M-7.5 7.5 Q0 9.5 7.5 7.5" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1" strokeLinecap="round" />
    </g>
  ),
  jacket: (
    <g transform="translate(0, 8)">
      <path d="M-14 0 Q-8 -5 0 -5 Q8 -5 14 0 L12 12 H-12 Z" fill="currentColor" opacity="0.3" />
      <path d="M-14 0 Q-8 -5 0 -5 L0 12 H-12 Z" fill="rgba(0,0,0,0.1)" />
      <path d="M0 -5 L-4.6 0.4 L-1.4 1.6 L0 -3 Z M0 -5 L4.6 0.4 L1.4 1.6 L0 -3 Z" fill="currentColor" opacity="0.55" />
      <path d="M0 -3 L0 12" stroke="currentColor" strokeWidth="1.4" opacity="0.8" />
      <path d="M-0.7 0 H0.7 M-0.7 3 H0.7 M-0.7 6 H0.7 M-0.7 9 H0.7" stroke="rgba(255,255,255,0.3)" strokeWidth="0.6" />
      <path d="M-8.6 6 L-5.6 6.6 M8.6 6 L5.6 6.6" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.7" />
    </g>
  ),
  overalls: (
    <g transform="translate(0, 8)">
      <path d="M-10 -3 H10 L12 12 H-12 Z" fill="currentColor" opacity="0.34" />
      <path d="M-6.4 -5.5 L-6 4 M6.4 -5.5 L6 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity="0.85" />
      <rect x="-6.9" y="-2.6" width="1.9" height="1.9" rx="0.4" fill="#fbbf24" />
      <rect x="5" y="-2.6" width="1.9" height="1.9" rx="0.4" fill="#fbbf24" />
      <rect x="-4.4" y="0.6" width="8.8" height="5.6" rx="1.1" fill="rgba(255,255,255,0.24)" stroke="currentColor" strokeWidth="0.9" />
      <path d="M-3.4 1.7 H3.4" stroke="currentColor" strokeWidth="0.7" opacity="0.6" strokeDasharray="1 0.8" />
      <path d="M-9.4 10.4 Q0 12 9.4 10.4" fill="none" stroke="rgba(0,0,0,0.18)" strokeWidth="0.9" strokeLinecap="round" />
    </g>
  ),
  turtleneck: (
    <g transform="translate(0, 9)">
      <path d="M-11 -2 Q0 2 11 -2 L11 12 H-11 Z" fill="currentColor" opacity="0.36" />
      <path d="M-6.4 -3.4 Q0 0.6 6.4 -3.4 L6.4 0.6 Q0 4.6 -6.4 0.6 Z" fill="currentColor" opacity="0.6" />
      <path d="M-5 -1.6 L-5 1.4 M-2.5 -0.7 L-2.5 2.3 M0 -0.4 L0 2.6 M2.5 -0.7 L2.5 2.3 M5 -1.6 L5 1.4" stroke="rgba(0,0,0,0.22)" strokeWidth="0.8" strokeLinecap="round" />
      <path d="M-7 5 Q0 7 7 5 M-7.6 8.4 Q0 10.4 7.6 8.4" stroke="rgba(0,0,0,0.14)" strokeWidth="0.8" fill="none" strokeLinecap="round" />
    </g>
  ),
  varsity: (
    <g transform="translate(0, 8)">
      <path d="M-13 0 Q-7 -5 0 -5 Q7 -5 13 0 L12 12 H-12 Z" fill="currentColor" opacity="0.3" />
      <path d="M-13 0 Q-10 -2.6 -6.6 -3.9 L-6 12 H-12 Z M13 0 Q10 -2.6 6.6 -3.9 L6 12 H12 Z" fill="#f8fafc" opacity="0.18" />
      <path d="M0 -5 L0 12" stroke="#f8fafc" strokeWidth="1.4" opacity="0.6" />
      <circle cx="-1.6" cy="0" r="0.55" fill="#f8fafc" opacity="0.75" />
      <circle cx="-1.6" cy="3.4" r="0.55" fill="#f8fafc" opacity="0.75" />
      <circle cx="-1.6" cy="6.8" r="0.55" fill="#f8fafc" opacity="0.75" />
      <path d="M-11.8 10 Q0 12.4 11.8 10 M-11.9 11.4 Q0 13.8 11.9 11.4" stroke="#f8fafc" strokeWidth="0.8" fill="none" opacity="0.5" />
      <path d="M2.6 2.2 L3.2 3.6 L4.7 3.7 L3.6 4.7 L3.9 6.2 L2.6 5.4 L1.3 6.2 L1.6 4.7 L0.5 3.7 L2 3.6 Z" fill="#f8fafc" opacity="0.55" />
    </g>
  ),
  tux: (
    <g transform="translate(0, 9)">
      <path d="M-12 -1 Q-6 -6 0 -6 Q6 -6 12 -1 L11 11 H-11 Z" fill="#111827" opacity="0.88" />
      <path d="M0 -6 L-4 -1 L0 8 L4 -1 Z" fill="#f8fafc" opacity="0.92" />
      <path d="M0 -6 L-4 -1 L-2.2 -0.4 L0 -3.6 Z M0 -6 L4 -1 L2.2 -0.4 L0 -3.6 Z" fill="#1f2937" />
      <path d="M-4 -1 L-6.8 5.4 L-4.4 4 Z M4 -1 L6.8 5.4 L4.4 4 Z" fill="#0b1120" opacity="0.9" />
      <path d="M0 -3.4 L-2.4 -4.8 L2.4 -4.8 Z" fill="#111827" />
      <circle cx="0" cy="0.5" r="0.65" fill="#111827" />
      <circle cx="0" cy="3.2" r="0.65" fill="#111827" />
      <circle cx="0" cy="5.9" r="0.65" fill="#111827" />
      <path d="M-8.4 2.6 L-5.8 2.2 L-6.2 3.8 Z" fill="#f8fafc" opacity="0.85" />
    </g>
  ),
  cape: (
    <g transform="translate(0, 7)">
      <path d="M-13 -4 Q0 2 13 -4 L11 15 Q0 10 -11 15 Z" fill="#7c3aed" opacity="0.4" />
      <path d="M-13 -4 Q-6.5 -1 0 -1 L-1 12.4 Q-6 11 -11 15 Z" fill="rgba(0,0,0,0.14)" />
      <path d="M-8.6 -1.4 L-7.4 12 M8.6 -1.4 L7.4 12 M0 -1 L0 11.2" stroke="rgba(255,255,255,0.14)" strokeWidth="0.9" strokeLinecap="round" />
      <path d="M11 15 Q0 10 -11 15" fill="none" stroke="#a78bfa" strokeWidth="1" opacity="0.55" />
      <circle cx="-5" cy="-2.5" r="1.3" fill="#fbbf24" stroke="#f59e0b" strokeWidth="0.4" />
      <circle cx="5" cy="-2.5" r="1.3" fill="#fbbf24" stroke="#f59e0b" strokeWidth="0.4" />
      <path d="M-3.8 -2.5 H3.8" stroke="#fbbf24" strokeWidth="0.8" />
    </g>
  ),
  spacesuit: (
    <g transform="translate(0, 8)">
      <path d="M-13 0 Q-7 -6 0 -6 Q7 -6 13 0 L12 12 H-12 Z" fill="rgba(226,232,240,0.5)" stroke="currentColor" strokeWidth="1" />
      <path d="M-9.6 -2.6 Q-9 4 -9.6 10.4 M9.6 -2.6 Q9 4 9.6 10.4" stroke="rgba(15,23,42,0.2)" strokeWidth="0.8" fill="none" />
      <rect x="-4.8" y="-1.8" width="9.6" height="6" rx="1.6" fill="rgba(15,23,42,0.26)" stroke="currentColor" strokeWidth="0.9" />
      <circle cx="-2.4" cy="0.4" r="0.8" fill="#22c55e" />
      <circle cx="0" cy="0.4" r="0.8" fill="#fbbf24" />
      <circle cx="2.4" cy="0.4" r="0.8" fill="#ef4444" />
      <rect x="-3.6" y="2.2" width="7.2" height="1.1" rx="0.55" fill="rgba(255,255,255,0.45)" />
      <path d="M-4.8 1 Q-8 1.6 -8.6 4.6 M4.8 1 Q8 1.6 8.6 4.6" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.7" />
    </g>
  ),
};

const EYE_STYLES: Record<string, React.ReactNode> = {
  regular: null,
  lashes: (
    <g transform="translate(0, 0)">
      <path d="M-8,-3 L-9.5,-5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M-6,-3 L-6,-5.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M-4,-3 L-2.8,-5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M4,-3 L2.8,-5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M6,-3 L6,-5.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M8,-3 L9.5,-5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </g>
  ),
};

// Meshi color themes
const COLOR_THEMES: Record<string, { primary: string; glow: string; bg: string }> = {
  blue: { primary: "#3b82f6", glow: "rgba(59, 130, 246, 0.4)", bg: "rgba(59, 130, 246, 0.1)" },
  purple: { primary: "#8b5cf6", glow: "rgba(139, 92, 246, 0.4)", bg: "rgba(139, 92, 246, 0.1)" },
  pink: { primary: "#ec4899", glow: "rgba(236, 72, 153, 0.4)", bg: "rgba(236, 72, 153, 0.1)" },
  green: { primary: "#22c55e", glow: "rgba(34, 197, 94, 0.4)", bg: "rgba(34, 197, 94, 0.1)" },
  orange: { primary: "#f97316", glow: "rgba(249, 115, 22, 0.4)", bg: "rgba(249, 115, 22, 0.1)" },
  cyan: { primary: "#06b6d4", glow: "rgba(6, 182, 212, 0.4)", bg: "rgba(6, 182, 212, 0.1)" },
  gold: { primary: "#eab308", glow: "rgba(234, 179, 8, 0.4)", bg: "rgba(234, 179, 8, 0.1)" },
  rainbow: { primary: "#ec4899", glow: "rgba(236, 72, 153, 0.4)", bg: "rgba(139, 92, 246, 0.1)" },
  // MeshPro exclusive colors
  crimson: { primary: "#dc2626", glow: "rgba(220, 38, 38, 0.4)", bg: "rgba(220, 38, 38, 0.1)" },
  midnight: { primary: "#312e81", glow: "rgba(49, 46, 129, 0.4)", bg: "rgba(49, 46, 129, 0.15)" },
  rose: { primary: "#f43f5e", glow: "rgba(244, 63, 94, 0.4)", bg: "rgba(244, 63, 94, 0.1)" },
  emerald: { primary: "#059669", glow: "rgba(5, 150, 105, 0.4)", bg: "rgba(5, 150, 105, 0.1)" },
  arctic: { primary: "#7dd3fc", glow: "rgba(125, 211, 252, 0.4)", bg: "rgba(125, 211, 252, 0.1)" },
  obsidian: { primary: "#475569", glow: "rgba(71, 85, 105, 0.4)", bg: "rgba(71, 85, 105, 0.15)" },
};

// Wearables (hats, hair, outfits, accessories) render in a LIGHTER tint of
// the Meshi's color. In the theme color itself they blended into the body and
// the dark backdrop — picking a hat looked like nothing happened.
function lightenHex(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

// Which hats are MeshPro exclusive

// Achievement titles — earned through milestones

export type MeshiMood =
  | "happy"
  | "excited"
  | "thinking"
  | "sleepy"
  | "surprised"
  | "love"
  | "cool"
  | "wink"
  | "petted"
  | "giggle"
  | "shy"
  | "synergy1017"
  | "searching"
  | "learning"
  | "celebrating"
  | "blinking";
export type MeshiHat = keyof typeof HATS;
export type MeshiHair = keyof typeof HAIRS;
export type MeshiAccessory = keyof typeof ACCESSORIES;
export type MeshiEyeStyle = keyof typeof EYE_STYLES;
export type MeshiColor = keyof typeof COLOR_THEMES;
export type MeshiBadge = keyof typeof BADGES;
export type MeshiOutfit = keyof typeof OUTFITS;

// Page-to-prop mapping: which prop Meshi holds on each page
export const PAGE_PROPS: Record<string, MeshiProp> = {
  "/meshpro": "shield",
  "/mesh": "compass",
  "/feed": "clipboard",
  "/messages": "heart",
  "/communities": "megaphone",
  "/notifications": "bell",
  "/settings": "wrench",
  "/explore": "compass",
  "/search": "magnifying-glass",
  "/profile": "paintbrush",
};

interface MeshiMascotProps {
  size?: number;
  mood?: MeshiMood;
  hat?: MeshiHat;
  color?: MeshiColor;
  hair?: MeshiHair;
  accessory?: MeshiAccessory;
  eyeStyle?: MeshiEyeStyle;
  badge?: MeshiBadge;
  outfit?: MeshiOutfit;
  animate?: boolean;
  onClick?: () => void;
  className?: string;
  showGlow?: boolean;
  speaking?: boolean;
  interactive?: boolean;
  onMoodChange?: (mood: MeshiMood) => void;
  prop?: MeshiProp;
  bouncy?: boolean;
}

export function MeshiMascot({
  size = 48,
  mood = "happy",
  hat = "none",
  color = "blue",
  hair = "none",
  accessory = "none",
  eyeStyle = "regular",
  badge = "none",
  outfit = "none",
  animate = true,
  onClick,
  className = "",
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  showGlow,
  speaking = false,
  interactive = false,
  onMoodChange,
  prop = "none",
  bouncy = false,
}: MeshiMascotProps) {
  const theme = COLOR_THEMES[color] || COLOR_THEMES.blue;
  const wearable = lightenHex(theme.primary, 0.42);
  const hatElement = HATS[hat] || null;
  const scale = size / 48;
  const hairElement = HAIRS[hair] || null;
  const effectiveEyeStyle = accessory === "lashes" ? "lashes" : eyeStyle;
  const effectiveAccessory = accessory === "lashes" ? "none" : accessory;
  const eyeStyleElement = EYE_STYLES[effectiveEyeStyle] || null;
  const accessoryElement = ACCESSORIES[effectiveAccessory] || null;
  const badgeElement = BADGES[badge] || null;
  const outfitElement = OUTFITS[outfit] || null;
  const containerRef = useRef<HTMLDivElement>(null);
  const uniqueId = useId();

  // Physics-based jiggle springs
  const squishX = useSpring(1, { stiffness: 600, damping: 12, mass: 0.3 });
  const squishY = useSpring(1, { stiffness: 600, damping: 12, mass: 0.3 });
  const wobbleRotate = useSpring(0, { stiffness: 300, damping: 8, mass: 0.5 });

  // ── Wearable physics ──────────────────────────────────────
  // Wearables react to real movement: as Meshi travels the mesh (or gets
  // carried anywhere), hats and hair lag with inertia and dangling pieces
  // (earrings, necklace) swing like pendulums. Velocity is sensed from the
  // element's actual on-screen motion, so no caller wiring is needed.
  const hatSway = useSpring(0, { stiffness: 170, damping: 14, mass: 0.6 });
  const hatLift = useSpring(0, { stiffness: 210, damping: 16, mass: 0.5 });
  const hairSway = useSpring(0, { stiffness: 120, damping: 11, mass: 0.85 });
  const hairLift = useTransform(hatLift, (v) => v * 0.6);
  const dangleSway = useSpring(0, { stiffness: 100, damping: 6.5, mass: 1 });
  const outfitSway = useSpring(0, { stiffness: 150, damping: 13, mass: 0.7 });
  const travelSquash = useSpring(0, { stiffness: 240, damping: 18, mass: 0.5 });
  const travelScaleX = useTransform(travelSquash, (v) => 1 + v);
  const travelScaleY = useTransform(travelSquash, (v) => 1 - v * 0.8);

  useEffect(() => {
    if (!animate) return;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const clamp = (v: number, limit: number) => Math.max(-limit, Math.min(limit, v));
    let raf = 0;
    let lastX = 0;
    let lastY = 0;
    let lastT = 0;
    let vx = 0;
    let vy = 0;
    const step = (t: number) => {
      raf = requestAnimationFrame(step);
      const el = containerRef.current;
      if (!el || document.hidden) return;
      // getBoundingClientRect forces a layout read; doing that every frame in
      // every mounted mascot janks the whole page. ~22Hz is plenty for
      // sensing travel velocity — the springs smooth in between.
      if (t - lastT < 45) return;
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      if (lastT) {
        const dt = Math.min((t - lastT) / 1000, 0.05);
        if (dt > 0) {
          const nvx = (x - lastX) / dt;
          const nvy = (y - lastY) / dt;
          vx += (nvx - vx) * 0.35;
          vy += (nvy - vy) * 0.35;
          hatSway.set(clamp(-vx * 0.022, 13));
          hatLift.set(clamp(-vy * 0.012, 2.6));
          hairSway.set(clamp(-vx * 0.016, 9));
          dangleSway.set(clamp(-vx * 0.06, 32));
          outfitSway.set(clamp(vx * 0.02, 9));
          travelSquash.set(Math.min(Math.sqrt(vx * vx + vy * vy) * 0.00009, 0.05));
        }
      }
      lastX = x;
      lastY = y;
      lastT = t;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [animate, hatSway, hatLift, hairSway, dangleSway, outfitSway, travelSquash]);

  // Smooth eye tracking via spring-based motion values
  const eyeOffsetX = useMotionValue(0);
  const eyeOffsetY = useMotionValue(0);
  const smoothEyeX = useSpring(eyeOffsetX, { stiffness: 150, damping: 20, mass: 0.5 });
  const smoothEyeY = useSpring(eyeOffsetY, { stiffness: 150, damping: 20, mass: 0.5 });

  // Track mouse velocity for petting
  const lastMouseX = useRef(0);
  const lastMouseTime = useRef(0);
  const petCount = useRef(0);
  const petTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [localMood, setLocalMood] = useState<MeshiMood | null>(null);

  // Blinking state for smooth, lifelike animation
  const [isBlinking, setIsBlinking] = useState(false);
  const blinkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleGestureActive = useRef(false);

  // Smooth blinking at random intervals (2-6 seconds)
  useEffect(() => {
    if (!animate) return;
    let cancelled = false;
    const scheduleBlink = () => {
      const delay = 2000 + Math.random() * 4000;
      blinkTimerRef.current = setTimeout(() => {
        if (cancelled) return;
        setIsBlinking(true);
        setTimeout(() => {
          if (cancelled) return;
          setIsBlinking(false);
          scheduleBlink();
        }, 120);
      }, delay);
    };
    scheduleBlink();
    return () => { cancelled = true; if (blinkTimerRef.current) clearTimeout(blinkTimerRef.current); };
  }, [animate]);

  // Global mouse tracking for smooth eye follow
  useEffect(() => {
    if (!interactive && !animate) return;
    const handleGlobalMouse = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = e.clientX - centerX;
      const dy = e.clientY - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxOffset = 2.5;
      const factor = Math.min(dist / 300, 1);
      eyeOffsetX.set((dx / (dist || 1)) * maxOffset * factor);
      eyeOffsetY.set((dy / (dist || 1)) * maxOffset * factor);
    };
    window.addEventListener("mousemove", handleGlobalMouse, { passive: true });
    return () => window.removeEventListener("mousemove", handleGlobalMouse);
  }, [interactive, animate, eyeOffsetX, eyeOffsetY]);

  // Mouse enter — initial shy reaction + gentle jiggle
  const handleMouseEnter = useCallback(() => {
    if (!interactive) return;
    squishX.set(1.12);
    squishY.set(0.9);
    wobbleRotate.set(3);
    setTimeout(() => { squishX.set(0.95); squishY.set(1.08); wobbleRotate.set(-2); }, 80);
    setTimeout(() => { squishX.set(1); squishY.set(1); wobbleRotate.set(0); }, 200);
    setLocalMood("shy");
    onMoodChange?.("shy");
    if (petTimer.current) clearTimeout(petTimer.current);
    petTimer.current = setTimeout(() => { setLocalMood(null); petCount.current = 0; }, 2000);
  }, [interactive, squishX, squishY, wobbleRotate, onMoodChange]);

  // Mouse move over Meshi — "petting" effect
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!interactive) return;
    const now = Date.now();
    const dx = e.clientX - lastMouseX.current;
    const dt = now - lastMouseTime.current;
    lastMouseX.current = e.clientX;
    lastMouseTime.current = now;
    if (dt > 0 && dt < 100) {
      const velocity = Math.abs(dx) / dt;
      if (velocity > 0.3) {
        const jiggleIntensity = Math.min(velocity * 0.15, 0.2);
        squishX.set(1 + jiggleIntensity);
        squishY.set(1 - jiggleIntensity * 0.7);
        wobbleRotate.set(dx > 0 ? jiggleIntensity * 15 : -jiggleIntensity * 15);
        petCount.current += 1;
        if (petCount.current > 8) { setLocalMood("giggle"); onMoodChange?.("giggle"); }
        else if (petCount.current > 3) { setLocalMood("petted"); onMoodChange?.("petted"); }
        else { setLocalMood("happy"); onMoodChange?.("happy"); }
        if (petTimer.current) clearTimeout(petTimer.current);
        petTimer.current = setTimeout(() => { setLocalMood(null); petCount.current = 0; }, 2000);
      }
    }
  }, [interactive, squishX, squishY, wobbleRotate, onMoodChange]);

  // Mouse leave — bounce back
  const handleMouseLeave = useCallback(() => {
    if (!interactive) return;
    squishX.set(0.92); squishY.set(1.1); wobbleRotate.set(0);
    setTimeout(() => { squishX.set(1); squishY.set(1); }, 150);
    if (petTimer.current) clearTimeout(petTimer.current);
    petTimer.current = setTimeout(() => { setLocalMood(null); petCount.current = 0; }, 1200);
  }, [interactive, squishX, squishY, wobbleRotate]);

  useEffect(() => { return () => { if (petTimer.current) clearTimeout(petTimer.current); }; }, []);

  // Spontaneous idle gestures — every so often Meshi glances around and shimmies
  // on his own, so he feels like a living being rather than a looping animation.
  // Purely physical (springs + a brief glance), never touching the mood system,
  // so it never fights petting or speaking states.
  useEffect(() => {
    if (!interactive || !animate || speaking) return;
    let cancelled = false;
    const settleTimers: ReturnType<typeof setTimeout>[] = [];
    const schedule = () => {
      const delay = 8000 + Math.random() * 7000;
      idleTimerRef.current = setTimeout(() => {
        if (cancelled) return;
        // Skip if the user is actively interacting or the tab is hidden.
        if (petCount.current > 0 || (typeof document !== "undefined" && document.hidden)) {
          schedule();
          return;
        }
        const side = Math.random() < 0.5 ? -1 : 1;
        idleGestureActive.current = true;
        eyeOffsetX.set(side * 1.8);
        eyeOffsetY.set(-0.6);
        squishX.set(1.05); squishY.set(0.95); wobbleRotate.set(side * 2.5);
        settleTimers.push(setTimeout(() => {
          if (cancelled) return;
          // If the user started interacting mid-gesture, hand control to the
          // pointer handlers instead of fighting them.
          if (petCount.current > 0) { idleGestureActive.current = false; return; }
          squishX.set(0.97); squishY.set(1.03); wobbleRotate.set(-side * 1.5);
        }, 220));
        settleTimers.push(setTimeout(() => {
          if (cancelled) return;
          idleGestureActive.current = false;
          if (petCount.current > 0) { schedule(); return; }
          squishX.set(1); squishY.set(1); wobbleRotate.set(0);
          eyeOffsetX.set(0); eyeOffsetY.set(0);
          schedule();
        }, 520));
      }, delay);
    };
    schedule();
    return () => {
      cancelled = true;
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      settleTimers.forEach(clearTimeout);
      // Only reset when a gesture was genuinely mid-flight (e.g. interrupted by
      // speaking), so we never clobber the eyes' cursor tracking when nothing
      // was animating.
      if (idleGestureActive.current) {
        squishX.set(1); squishY.set(1); wobbleRotate.set(0);
        eyeOffsetX.set(0); eyeOffsetY.set(0);
        idleGestureActive.current = false;
      }
    };
  }, [interactive, animate, speaking, eyeOffsetX, eyeOffsetY, squishX, squishY, wobbleRotate]);

  // Determine prop SVG. Hands follow visible held objects only.
  const propSvg = prop && prop !== "none" && PROP_SVGS[prop] ? PROP_SVGS[prop](theme.primary) : null;
  const showHands = Boolean(propSvg);
  const propUsesBothHands = showHands && TWO_HAND_PROPS.has(prop);
  const holdingHands = propUsesBothHands
    ? [HOLDING_POSES.two.left, HOLDING_POSES.two.right]
    : [HOLDING_POSES.single.right];

  // Determine current mood (with blinking override)
  const getCurrentMood = (): MeshiMood => {
    if (isBlinking && !speaking) return "blinking";
    return interactive ? (localMood || mood) : mood;
  };

  const renderedMood = getCurrentMood();

  return (
    <motion.div
      ref={containerRef}
      className={`inline-flex items-center justify-center cursor-pointer select-none ${className}`}
      data-meshi-mascot="true"
      style={{
        width: size, height: size,
        scaleX: interactive ? squishX : undefined,
        scaleY: interactive ? squishY : undefined,
        rotate: interactive ? wobbleRotate : undefined,
      }}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      whileHover={!interactive && animate ? { scale: 1.1 } : undefined}
      whileTap={animate ? { scale: 0.9 } : undefined}
    >
      <svg width={size} height={size} viewBox="-24 -24 48 48">
        {/* Clip to perfect circle — unique ID per instance */}
        <defs>
          <clipPath id={`${uniqueId}-clip`}>
            <circle cx="0" cy="0" r="22" />
          </clipPath>
          {/* Glossy body fill — light gathers top-left, deepens toward the rim
              so Meshi reads as a living, dimensional bubble rather than a flat disc. */}
          <radialGradient id={`${uniqueId}-body`} cx="36%" cy="30%" r="80%">
            <stop offset="0%" stopColor={theme.primary} stopOpacity="0.34" />
            <stop offset="52%" stopColor={theme.primary} stopOpacity="0.15" />
            <stop offset="100%" stopColor={theme.primary} stopOpacity="0.28" />
          </radialGradient>
        </defs>



        {/* Speaking pulse rings — triple layered for rich effect */}
        {speaking && (
          <>
            <motion.circle cx="0" cy="0" r="18" fill="none" stroke={theme.primary} strokeWidth="1.5"
              initial={{ scale: 1, opacity: 0.6 }} animate={{ scale: 1.4, opacity: 0 }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }}
            />
            <motion.circle cx="0" cy="0" r="18" fill="none" stroke={theme.primary} strokeWidth="1"
              initial={{ scale: 1, opacity: 0.4 }} animate={{ scale: 1.6, opacity: 0 }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut", delay: 0.4 }}
            />
            <motion.circle cx="0" cy="0" r="18" fill="none" stroke={theme.primary} strokeWidth="0.5"
              initial={{ scale: 1, opacity: 0.3 }} animate={{ scale: 1.8, opacity: 0 }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut", delay: 0.8 }}
            />
          </>
        )}

        {/* Travel squash — the whole body stretches slightly along the
            direction of motion and settles when Meshi comes to rest. */}
        <motion.g style={{ scaleX: travelScaleX, scaleY: travelScaleY, transformBox: "fill-box", transformOrigin: "50% 50%" }}>
        {/* Clipped content — everything inside the circle */}
        <g clipPath={`url(#${uniqueId}-clip)`}>
          {/* Body — glossy circle with smooth breathing animation */}
          <motion.circle cx="0" cy="0" r="16" fill={`url(#${uniqueId}-body)`} stroke={theme.primary} strokeWidth="2"
            animate={animate ? (bouncy
              ? { y: [0, -2.5, 0, -1, 0], scaleX: [1, 0.97, 1.02, 0.99, 1], scaleY: [1, 1.04, 0.97, 1.01, 1] }
              : {
                  scaleX: [1, 1.015, 1, 0.985, 1],
                  scaleY: [1, 0.985, 1, 1.015, 1],
                  y: [0, -0.5, 0, 0.3, 0],
                }
            ) : undefined}
            transition={bouncy
              ? { duration: 2, repeat: Infinity, ease: "easeInOut" }
              : { duration: 3.5, repeat: Infinity, ease: "easeInOut" }
            }
          />
          {/* Simple outfits stay inside the bubble so Meshi remains minimal.
              Draped ones trail slightly against the direction of travel. */}
          <motion.g
            style={{ color: wearable, rotate: outfitSway, transformBox: "fill-box", transformOrigin: "50% 0%" }}
          >
            {outfitElement}
          </motion.g>
        </g>

        {/* Headwear, face and accessories render OUTSIDE the body clip so tall
            hats are never chopped off by the bubble's circular mask. Hair tucks
            under closed hats so strands never poke through the shell. */}
        <motion.g style={{ color: wearable, rotate: hairSway, y: hairLift, transformBox: "fill-box", transformOrigin: "50% 100%" }}>
          {hairElement && hat && !OPEN_HATS.has(hat) ? <g transform={HAIR_TUCK_TRANSFORM}>{hairElement}</g> : hairElement}
        </motion.g>

        {/* Face — eyes with smooth tracking and blinking */}
        <motion.g
          transform={`scale(${Math.min(scale, 1.2)})`}
          style={{ x: smoothEyeX, y: smoothEyeY }}
        >
          {(SVG_FACES[renderedMood] || SVG_FACES.happy)(theme.primary)}
        </motion.g>

        {eyeStyleElement && <g style={{ color: theme.primary }}>{eyeStyleElement}</g>}
        {accessoryElement &&
          (DANGLING_ACCESSORIES.has(effectiveAccessory) ? (
            <motion.g
              style={{ color: wearable, rotate: dangleSway, transformBox: "fill-box", transformOrigin: "50% 0%" }}
            >
              {accessoryElement}
            </motion.g>
          ) : (
            <g style={{ color: wearable }}>{accessoryElement}</g>
          ))}
        {badgeElement && <g style={{ color: theme.primary }}>{badgeElement}</g>}

        {/* Hat sits on top of everything so it always reads clearly, tips with
            inertia as Meshi travels, and lags vertically on hops and drops. */}
        <motion.g style={{ color: wearable, rotate: hatSway, y: hatLift, transformBox: "fill-box", transformOrigin: "50% 100%" }}>
          {hatElement}
        </motion.g>

        {/* Bubble hands — only shown when Meshi is actively holding a prop.
            Drawn before the prop so the held object reads clearly on top,
            and Meshi reads as gripping it rather than hiding it. */}
        {showHands && (
          <motion.g
            initial={{ opacity: 0, y: 3, scale: 0.84 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            {holdingHands.map((hand, index) => (
              <motion.g
                key={`${hand.side}-holding-hand`}
                animate={animate ? {
                  x: hand.side === "right" ? [0, 0.7, 0.2, 0] : [0, -0.7, -0.2, 0],
                  y: [0, -1.1, -0.2, 0],
                  scale: [1, 1.09, 1.01, 1],
                } : undefined}
                transition={{
                  duration: speaking ? 0.85 : 1.2,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: index * 0.08,
                }}
              >
                <circle
                  cx={hand.handX}
                  cy={hand.handY}
                  r="2.6"
                  fill={theme.bg}
                  stroke={theme.primary}
                  strokeWidth="1.35"
                />
                <path
                  d={`M ${hand.handX - 1.1} ${hand.handY - 0.1} Q ${hand.handX} ${hand.handY - 1.2} ${hand.handX + 1.1} ${hand.handY - 0.1}`}
                  fill="none"
                  stroke={theme.primary}
                  strokeWidth="0.85"
                  strokeLinecap="round"
                  opacity="0.75"
                />
              </motion.g>
            ))}
          </motion.g>
        )}

        {/* Prop — rendered on top of the hands and outside the clip so it's
            clearly visible. Meshi has NO arms: the hands float freely near the
            bubble, never connected by a limb. */}
        {propSvg && (
          <motion.g
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
          >
            {propSvg}
          </motion.g>
        )}
        </motion.g>
      </svg>
    </motion.div>
  );
}

// Mini version for use as app icon / logo
export function MeshiLogo({ size = 32, color = "blue", mood = "happy", className = "" }: {
  size?: number; color?: MeshiColor; mood?: MeshiMood; className?: string;
}) {
  const theme = COLOR_THEMES[color] || COLOR_THEMES.blue;
  return (
    <div className={`inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="-20 -20 40 40">
        <circle cx="0" cy="0" r="16" fill={theme.bg} stroke={theme.primary} strokeWidth="2" />
        <g transform="scale(0.85)">{(SVG_FACES[mood] || SVG_FACES.happy)(theme.primary)}</g>
      </svg>
    </div>
  );
}

// Determine Meshi's mood based on user activity

// Small social Meshi for displaying on other users' mesh nodes
export function MeshiMini({ size = 20, color = "blue", hat = "none", mood = "happy", hair = "none", accessory = "none", eyeStyle = "regular", badge = "none", outfit = "none" }: {
  size?: number; color?: MeshiColor; hat?: MeshiHat; mood?: MeshiMood; hair?: MeshiHair; accessory?: MeshiAccessory; eyeStyle?: MeshiEyeStyle; badge?: MeshiBadge; outfit?: MeshiOutfit;
}) {
  const theme = COLOR_THEMES[color] || COLOR_THEMES.blue;
  const wearable = lightenHex(theme.primary, 0.42);
  const hatElement = HATS[hat] || null;
  const hairElement = HAIRS[hair] || null;
  const effectiveEyeStyle = accessory === "lashes" ? "lashes" : eyeStyle;
  const effectiveAccessory = accessory === "lashes" ? "none" : accessory;
  const eyeStyleElement = EYE_STYLES[effectiveEyeStyle] || null;
  const accessoryElement = ACCESSORIES[effectiveAccessory] || null;
  const badgeElement = BADGES[badge] || null;
  const outfitElement = OUTFITS[outfit] || null;
  return (
    <svg width={size} height={size} viewBox="-24 -24 48 48">
      <circle cx="0" cy="0" r="16" fill={theme.bg} stroke={theme.primary} strokeWidth="2.5" />
      <g style={{ color: wearable }}>{outfitElement}</g>
      <g style={{ color: wearable }}>
        {hairElement && hat && !OPEN_HATS.has(hat) ? <g transform={HAIR_TUCK_TRANSFORM}>{hairElement}</g> : hairElement}
      </g>
      <g transform="scale(0.8)">
        {(SVG_FACES[mood] || SVG_FACES.happy)(theme.primary)}
      </g>
      {eyeStyleElement && <g style={{ color: theme.primary }}>{eyeStyleElement}</g>}
      {accessoryElement && <g style={{ color: wearable }}>{accessoryElement}</g>}
      {badgeElement && <g style={{ color: theme.primary }}>{badgeElement}</g>}
      <g style={{ color: wearable }}>{hatElement}</g>
    </svg>
  );
}
