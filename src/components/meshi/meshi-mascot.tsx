"use client";

import { motion, useSpring, useMotionValue } from "framer-motion";
import { useRef, useState, useCallback, useEffect, useId } from "react";

// Pre-compute trig values to avoid SSR/client hydration mismatches
const FLOWER_POSITIONS = [0, 60, 120, 180, 240, 300].map((deg) => ({
  deg,
  cx: Math.round(Math.cos((deg * Math.PI) / 180) * 4 * 1000) / 1000,
  cy: Math.round(Math.sin((deg * Math.PI) / 180) * 4 * 1000) / 1000,
}));


// Meshi face styles — eyes only, reacts to interaction
const FACES: Record<string, { eyes: string; svg?: boolean }> = {
  happy: { eyes: "", svg: true },
  excited: { eyes: "★  ★" },
  thinking: { eyes: "◑  ◐" },
  sleepy: { eyes: "◡  ◡" },
  surprised: { eyes: "◎  ◎" },
  love: { eyes: "♥  ♥" },
  cool: { eyes: "■  ■" },
  wink: { eyes: "", svg: true },
  petted: { eyes: "◠  ◠" },
  giggle: { eyes: "≧  ≦" },
  shy: { eyes: "·  ·" },
  synergy1017: { eyes: "", svg: true },
  searching: { eyes: "", svg: true },
  learning: { eyes: "", svg: true },
  celebrating: { eyes: "", svg: true },
  blinking: { eyes: "", svg: true },
};

// SVG faces for clean, scalable eye rendering
const SVG_FACES: Record<string, (color: string) => React.ReactNode> = {
  happy: (color: string) => (
    <g>
      <ellipse cx="-5" cy="0" rx="2.5" ry="3" fill={color} />
      <ellipse cx="5" cy="0" rx="2.5" ry="3" fill={color} />
    </g>
  ),
  wink: (color: string) => (
    <g>
      <ellipse cx="-5" cy="0" rx="2.5" ry="3" fill={color} />
      <path d="M 2.5 0.5 Q 5 -2.5 7.5 0.5" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </g>
  ),
  synergy1017: (color: string) => (
    <g>
      <ellipse cx="-4" cy="0" rx="1.8" ry="3.8" fill={color} />
      <path d="M 2 1.5 Q 4.5 -2.5 7 1.5" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </g>
  ),
  searching: (color: string) => (
    <g>
      <ellipse cx="-5" cy="0" rx="2.5" ry="3" fill={color} />
      <ellipse cx="5" cy="0" rx="2.5" ry="3" fill={color} />
    </g>
  ),
  learning: (color: string) => (
    <g>
      <ellipse cx="-5" cy="-0.5" rx="3" ry="3.5" fill={color} />
      <ellipse cx="5" cy="-0.5" rx="3" ry="3.5" fill={color} />
      <circle cx="-4" cy="-1.5" r="1" fill="white" opacity="0.8" />
      <circle cx="6" cy="-1.5" r="1" fill="white" opacity="0.8" />
    </g>
  ),
  celebrating: (color: string) => (
    <g>
      <path d="M -7.5 0 Q -5 -3 -2.5 0" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <path d="M 2.5 0 Q 5 -3 7.5 0" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </g>
  ),
  blinking: (color: string) => (
    <g>
      <path d="M -7.5 0 Q -5 0.5 -2.5 0" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <path d="M 2.5 0 Q 5 0.5 7.5 0" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
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
    <g transform="translate(17, 8) scale(0.52) rotate(-10)">
      <circle cx="0" cy="0" r="6" fill="none" stroke={color} strokeWidth="2.5" />
      <line x1="4" y1="4" x2="10" y2="10" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </g>
  ),
  clipboard: (color: string) => (
    <g transform="translate(16, 8) scale(0.48) rotate(4)">
      <rect x="-5" y="-2" width="10" height="14" rx="1.5" fill="none" stroke={color} strokeWidth="2" />
      <rect x="-2" y="-4" width="4" height="3" rx="1" fill={color} />
      <line x1="-3" y1="3" x2="3" y2="3" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="-3" y1="6" x2="3" y2="6" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="-3" y1="9" x2="1" y2="9" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </g>
  ),
  paintbrush: (color: string) => (
    <g transform="translate(17, 9) scale(0.52) rotate(-35)">
      <rect x="-1.5" y="-2" width="3" height="12" rx="1" fill={color} />
      <path d="M -2.5 10 Q 0 14 2.5 10" fill={color} opacity="0.7" />
    </g>
  ),
  megaphone: (color: string) => (
    <g transform="translate(16, 8) scale(0.5) rotate(-8)">
      <path d="M -2 -4 L 8 -8 L 8 4 L -2 0 Z" fill={color} opacity="0.8" />
      <rect x="-4" y="-4" width="3" height="4" rx="1" fill={color} />
    </g>
  ),
  shield: (color: string) => (
    <g transform="translate(16, 8) scale(0.48)">
      <path d="M 0 -7 L 7 -3 L 6 5 L 0 8 L -6 5 L -7 -3 Z" fill="none" stroke={color} strokeWidth="2" />
      <path d="M 0 -2 L 3 1 L 0 4 L -3 1 Z" fill={color} opacity="0.5" />
    </g>
  ),
  compass: (color: string) => (
    <g transform="translate(16, 8) scale(0.48)">
      <circle cx="0" cy="0" r="7" fill="none" stroke={color} strokeWidth="2" />
      <polygon points="0,-5 2,0 0,5 -2,0" fill={color} opacity="0.7" />
      <circle cx="0" cy="0" r="1.5" fill={color} />
    </g>
  ),
  bell: (color: string) => (
    <g transform="translate(16, 8) scale(0.5)">
      <path d="M -5 2 Q -5 -6 0 -7 Q 5 -6 5 2 L -5 2 Z" fill={color} opacity="0.8" />
      <rect x="-6" y="2" width="12" height="2" rx="1" fill={color} />
      <circle cx="0" cy="5" r="1.5" fill={color} />
    </g>
  ),
  heart: (color: string) => (
    <g transform="translate(0, 15) scale(0.58)">
      <path d="M 0 3 C -8 -2 -8 -8 -4 -8 C -1 -8 0 -5 0 -5 C 0 -5 1 -8 4 -8 C 8 -8 8 -2 0 3 Z" fill={color} opacity="0.8" />
    </g>
  ),
  wrench: (color: string) => (
    <g transform="translate(17, 8) scale(0.52) rotate(-48)">
      <rect x="-1.5" y="-2" width="3" height="14" rx="1" fill={color} />
      <circle cx="0" cy="-2" r="3" fill="none" stroke={color} strokeWidth="2" />
    </g>
  ),
  notebook: (color: string) => (
    <g transform="translate(0, 15) scale(0.46) rotate(2)">
      <rect x="-6" y="-2" width="12" height="14" rx="1.5" fill="none" stroke={color} strokeWidth="2" />
      <line x1="-2" y1="-2" x2="-2" y2="12" stroke={color} strokeWidth="1.4" opacity="0.7" />
      <line x1="0" y1="3" x2="4" y2="-1" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <line x1="0.5" y1="3.5" x2="3" y2="6" stroke={color} strokeWidth="1.4" strokeLinecap="round" opacity="0.75" />
    </g>
  ),
  paper: (color: string) => (
    <g transform="translate(0, 15) scale(0.48) rotate(4)">
      <path d="M -6 -7 H 3 L 7 -3 V 9 H -6 Z" fill="rgba(255,255,255,0.72)" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M 3 -7 V -3 H 7" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
      <line x1="-3" y1="-1" x2="3" y2="-1" stroke={color} strokeWidth="1.2" strokeLinecap="round" opacity="0.65" />
      <line x1="-3" y1="3" x2="4" y2="3" stroke={color} strokeWidth="1.2" strokeLinecap="round" opacity="0.65" />
    </g>
  ),
  envelope: (color: string) => (
    <g transform="translate(0, 15) scale(0.5) rotate(-2)">
      <rect x="-7" y="-4.5" width="14" height="10" rx="1.6" fill="rgba(255,255,255,0.7)" stroke={color} strokeWidth="1.8" />
      <path d="M -6 -3.5 L 0 1 L 6 -3.5" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
      <path d="M -6 5 L -1 1.2 M 6 5 L 1 1.2" fill="none" stroke={color} strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
    </g>
  ),
  keyboard: (color: string) => (
    <g transform="translate(0, 16) scale(0.5)">
      <rect x="-9" y="-5" width="18" height="12" rx="2.2" fill="rgba(255,255,255,0.58)" stroke={color} strokeWidth="1.9" />
      {[-5, 0, 5].map((x) => (
        <line key={`keyboard-key-${x}`} x1={x} y1="-1.8" x2={x} y2="2.5" stroke={color} strokeWidth="1" opacity="0.65" />
      ))}
      <line x1="-6" y1="2.8" x2="6" y2="2.8" stroke={color} strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
    </g>
  ),
  rock: (color: string) => (
    <g transform="translate(17, 8) scale(0.52)">
      <path d="M -5 1 C -7 -3 -4 -7 0 -7 C 5 -7 8 -3 6 2 C 5 6 1 8 -3 6 C -5 5 -6 3 -5 1 Z" fill={color} opacity="0.72" />
      <path d="M -3 -2 C 0 -4 3 -3 4 0" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1.1" strokeLinecap="round" />
    </g>
  ),
  scissors: (color: string) => (
    <g transform="translate(17, 8) scale(0.5) rotate(-18)">
      <circle cx="-4.5" cy="5" r="2.2" fill="none" stroke={color} strokeWidth="1.7" />
      <circle cx="2.5" cy="5" r="2.2" fill="none" stroke={color} strokeWidth="1.7" />
      <path d="M -2.5 3 L 7 -7 M 0.5 3 L -7 -7" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
    </g>
  ),
  ball: (color: string) => (
    <g transform="translate(17, 8) scale(0.52)">
      <circle cx="0" cy="0" r="6" fill="rgba(255,255,255,0.58)" stroke={color} strokeWidth="1.9" />
      <path d="M -5 -1 Q 0 -4 5 -1 M -5 2 Q 0 5 5 2" fill="none" stroke={color} strokeWidth="1.1" strokeLinecap="round" opacity="0.65" />
    </g>
  ),
  grab: (color: string) => (
    <g transform="translate(17, 8) scale(0.52)">
      <circle cx="0" cy="0" r="5.5" fill="none" stroke={color} strokeWidth="1.8" strokeDasharray="2.2 2" />
      <circle cx="0" cy="0" r="2" fill={color} opacity="0.6" />
    </g>
  ),
};

const TWO_HAND_PROPS: Set<MeshiProp> = new Set(["keyboard", "notebook", "paper", "envelope", "heart"]);

const HOLDING_POSES = {
  single: {
    right: { side: "right", shoulderX: 11.8, shoulderY: 5, elbowX: 15.4, elbowY: 7.8, handX: 17, handY: 10 },
  },
  two: {
    left: { side: "left", shoulderX: -8.8, shoulderY: 8, elbowX: -11.6, elbowY: 11.6, handX: -10.6, handY: 15 },
    right: { side: "right", shoulderX: 8.8, shoulderY: 8, elbowX: 11.6, elbowY: 11.6, handX: 10.6, handY: 15 },
  },
} as const;


// Meshi hat styles (rendered as SVG elements)
const HATS: Record<string, React.ReactNode> = {
  none: null,
  tophat: (
    <g transform="translate(0, -18)">
      <rect x="-12" y="-8" width="24" height="12" rx="2" fill="currentColor" opacity="0.9" />
      <rect x="-16" y="2" width="32" height="4" rx="2" fill="currentColor" opacity="0.9" />
    </g>
  ),
  crown: (
    <g transform="translate(0, -16)">
      <polygon points="-12,4 -12,-4 -8,-1 -4,-8 0,-1 4,-8 8,-1 12,-4 12,4" fill="#fbbf24" />
      <circle cx="-4" cy="-5" r="1.5" fill="#ef4444" />
      <circle cx="4" cy="-5" r="1.5" fill="#3b82f6" />
      <circle cx="0" cy="-2" r="1.5" fill="#22c55e" />
    </g>
  ),
  beanie: (
    <g transform="translate(0, -14)">
      <ellipse cx="0" cy="0" rx="14" ry="8" fill="currentColor" opacity="0.9" />
      <circle cx="0" cy="-6" r="3" fill="currentColor" opacity="0.7" />
    </g>
  ),
  cap: (
    <g transform="translate(0, -12)">
      <path d="M-14,2 Q-14,-8 0,-10 Q14,-8 14,2 Z" fill="currentColor" opacity="0.9" />
      <path d="M10,0 Q18,0 20,4 L14,4 Q12,2 10,2 Z" fill="currentColor" opacity="0.7" />
    </g>
  ),
  hardhat: (
    <g transform="translate(0, -13)">
      <path d="M-14,3 Q-14,-8 0,-10 Q14,-8 14,3 Z" fill="#f59e0b" />
      <path d="M-3,-7 L3,-7 L3,1 L-3,1 Z" fill="#fbbf24" opacity="0.85" />
      <rect x="-16" y="2" width="32" height="3.5" rx="1.7" fill="#d97706" />
      <path d="M-9,0 Q0,-2 9,0" fill="none" stroke="#fcd34d" strokeWidth="1.2" opacity="0.7" />
    </g>
  ),
  party: (
    <g transform="translate(0, -16)">
      <polygon points="0,-14 -8,2 8,2" fill="#ec4899" />
      <circle cx="0" cy="-14" r="2" fill="#fbbf24" />
      <circle cx="-3" cy="-6" r="1" fill="#3b82f6" />
      <circle cx="3" cy="-4" r="1" fill="#22c55e" />
      <circle cx="1" cy="-10" r="1" fill="#f97316" />
    </g>
  ),
  flower: (
    <g transform="translate(6, -14)">
      <circle cx="0" cy="0" r="3" fill="#fbbf24" />
      {FLOWER_POSITIONS.map((pos) => (
        <circle
          key={pos.deg}
          cx={pos.cx}
          cy={pos.cy}
          r="2.5"
          fill="#ec4899"
          opacity="0.8"
        />
      ))}
    </g>
  ),
  // MeshPro exclusive hats
  headphones: (
    <g transform="translate(0, -12)">
      <path d="M-12,4 Q-12,-10 0,-12 Q12,-10 12,4" fill="none" stroke="#6b7280" strokeWidth="3" strokeLinecap="round" />
      <rect x="-15" y="0" width="6" height="8" rx="2" fill="#374151" />
      <rect x="9" y="0" width="6" height="8" rx="2" fill="#374151" />
    </g>
  ),
  halo: (
    <g transform="translate(0, -20)">
      <ellipse cx="0" cy="0" rx="14" ry="4" fill="none" stroke="#fbbf24" strokeWidth="2.5" opacity="0.9" />
      <ellipse cx="0" cy="0" rx="14" ry="4" fill="none" stroke="#fde68a" strokeWidth="1" opacity="0.4" />
    </g>
  ),
  wizard: (
    <g transform="translate(0, -16)">
      <polygon points="0,-18 -10,2 10,2" fill="#6366f1" />
      <rect x="-14" y="0" width="28" height="4" rx="2" fill="#6366f1" opacity="0.8" />
      <circle cx="0" cy="-14" r="2" fill="#fbbf24" />
      <circle cx="-4" cy="-6" r="1.2" fill="#fbbf24" opacity="0.6" />
      <circle cx="3" cy="-9" r="1" fill="#fbbf24" opacity="0.5" />
    </g>
  ),
  astronaut: (
    <g transform="translate(0, -14)">
      <ellipse cx="0" cy="0" rx="16" ry="12" fill="none" stroke="#e2e8f0" strokeWidth="2.5" />
      <ellipse cx="0" cy="0" rx="16" ry="12" fill="rgba(148, 163, 184, 0.15)" />
      <ellipse cx="-4" cy="-2" rx="3" ry="2" fill="rgba(255,255,255,0.2)" />
    </g>
  ),
  pirate: (
    <g transform="translate(0, -14)">
      <path d="M-14,2 Q-14,-6 0,-8 Q14,-6 14,2 Z" fill="#1e1e2e" />
      <rect x="-16" y="0" width="32" height="3" rx="1" fill="#1e1e2e" />
      <path d="M-4,-4 L0,-6 L4,-4 L2,-2 L-2,-2 Z" fill="#e2e8f0" opacity="0.8" />
    </g>
  ),
  chef: (
    <g transform="translate(0, -16)">
      <ellipse cx="0" cy="0" rx="12" ry="10" fill="#f8fafc" />
      <circle cx="-6" cy="-4" r="5" fill="#f8fafc" />
      <circle cx="6" cy="-4" r="5" fill="#f8fafc" />
      <circle cx="0" cy="-8" r="5" fill="#f8fafc" />
      <rect x="-12" y="0" width="24" height="3" rx="1" fill="#e2e8f0" />
    </g>
  ),
};

const HAIRS: Record<string, React.ReactNode> = {
  none: null,
  fluffy: (
    <g transform="translate(0, -13)">
      <path d="M-12,3 Q-10,-8 -4,-7 Q-1,-12 3,-8 Q8,-10 12,2" fill="currentColor" opacity="0.8" />
    </g>
  ),
  bangs: (
    <g transform="translate(0, -12)">
      <path d="M-13,3 Q-9,-8 0,-8 Q9,-8 13,3 L9,3 Q7,-2 4,1 Q1,-2 -2,1 Q-5,-2 -8,3 Z" fill="currentColor" opacity="0.85" />
    </g>
  ),
  spikes: (
    <g transform="translate(0, -13)">
      <polygon points="-12,3 -10,-7 -6,2 -2,-8 2,2 6,-7 10,2 12,3" fill="currentColor" opacity="0.85" />
    </g>
  ),
  curls: (
    <g transform="translate(0, -12)">
      <circle cx="-8" cy="0" r="4" fill="currentColor" opacity="0.8" />
      <circle cx="-2" cy="-2" r="4.5" fill="currentColor" opacity="0.82" />
      <circle cx="5" cy="-1" r="4.2" fill="currentColor" opacity="0.8" />
      <circle cx="10" cy="1" r="3.5" fill="currentColor" opacity="0.78" />
    </g>
  ),
};

const ACCESSORIES: Record<string, React.ReactNode> = {
  none: null,
  glasses: (
    <g transform="translate(0, 0)">
      <rect x="-10" y="-4" width="7" height="5.5" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="3" y="-4" width="7" height="5.5" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <line x1="-3" y1="-1.25" x2="3" y2="-1.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </g>
  ),
  sunglasses: (
    <g transform="translate(0, 0)">
      <rect x="-10" y="-4" width="7.5" height="5.5" rx="1.8" fill="currentColor" opacity="0.85" />
      <rect x="2.5" y="-4" width="7.5" height="5.5" rx="1.8" fill="currentColor" opacity="0.85" />
      <line x1="-2.5" y1="-1.2" x2="2.5" y2="-1.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
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
      <circle cx="5.5" cy="-1.2" r="3.3" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <line x1="8.6" y1="2" x2="10" y2="5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </g>
  ),
};

const BADGES: Record<string, React.ReactNode> = {
  none: null,
  spark: (
    <g transform="translate(9, 8)">
      <circle cx="0" cy="0" r="4.2" fill="rgba(255,255,255,0.78)" stroke="currentColor" strokeWidth="1.3" />
      <path d="M0 -2.4 L0.8 -0.7 L2.5 0 L0.8 0.7 L0 2.4 L-0.8 0.7 L-2.5 0 L-0.8 -0.7 Z" fill="currentColor" />
    </g>
  ),
  heart: (
    <g transform="translate(9, 8)">
      <circle cx="0" cy="0" r="4.3" fill="rgba(255,255,255,0.78)" stroke="currentColor" strokeWidth="1.3" />
      <path d="M0 2.2 C-4 -0.5 -3.4 -3.1 -1.5 -3.1 C-0.5 -3.1 0 -2.2 0 -2.2 C0 -2.2 0.5 -3.1 1.5 -3.1 C3.4 -3.1 4 -0.5 0 2.2 Z" fill="currentColor" />
    </g>
  ),
  shield: (
    <g transform="translate(9, 8)">
      <circle cx="0" cy="0" r="4.3" fill="rgba(255,255,255,0.78)" stroke="currentColor" strokeWidth="1.3" />
      <path d="M0 -3.1 L2.5 -1.8 L2 1.4 L0 3 L-2 1.4 L-2.5 -1.8 Z" fill="currentColor" opacity="0.9" />
    </g>
  ),
  verified: (
    <g transform="translate(9, 8)">
      <circle cx="0" cy="0" r="4.4" fill="#2563eb" stroke="rgba(255,255,255,0.85)" strokeWidth="1.2" />
      <path d="M-2 -0.1 L-0.5 1.5 L2.4 -1.8" fill="none" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  ),
  creator: (
    <g transform="translate(9, 8)">
      <circle cx="0" cy="0" r="4.4" fill="#f59e0b" stroke="rgba(255,255,255,0.85)" strokeWidth="1.2" />
      <path d="M0 -2.7 L0.8 -0.8 L2.8 -0.8 L1.2 0.5 L1.8 2.5 L0 1.4 L-1.8 2.5 L-1.2 0.5 L-2.8 -0.8 L-0.8 -0.8 Z" fill="white" />
    </g>
  ),
  founder: (
    <g transform="translate(9, 8)">
      <circle cx="0" cy="0" r="4.4" fill="#7c3aed" stroke="rgba(255,255,255,0.85)" strokeWidth="1.2" />
      <path d="M-2.6 1.9 L-1.8 -1.8 L0 -0.4 L1.8 -1.8 L2.6 1.9 Z" fill="white" />
    </g>
  ),
};

const OUTFITS: Record<string, React.ReactNode> = {
  none: null,
  scarf: (
    <g transform="translate(0, 7)">
      <path d="M-12 -1 Q0 3 12 -1 L12 3 Q0 7 -12 3 Z" fill="currentColor" opacity="0.85" />
      <rect x="5" y="1" width="4" height="9" rx="1.4" fill="currentColor" opacity="0.72" />
    </g>
  ),
  hoodie: (
    <g transform="translate(0, 8)">
      <path d="M-13 -1 Q-9 -7 0 -7 Q9 -7 13 -1 L12 12 H-12 Z" fill="currentColor" opacity="0.28" />
      <path d="M-6 -5 Q0 -1 6 -5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.75" />
      <line x1="-3" y1="-2" x2="-3" y2="4" stroke="currentColor" strokeWidth="1" opacity="0.6" />
      <line x1="3" y1="-2" x2="3" y2="4" stroke="currentColor" strokeWidth="1" opacity="0.6" />
    </g>
  ),
  jacket: (
    <g transform="translate(0, 8)">
      <path d="M-14 0 Q-8 -5 0 -5 Q8 -5 14 0 L12 12 H-12 Z" fill="currentColor" opacity="0.24" />
      <path d="M0 -5 L0 12" stroke="currentColor" strokeWidth="1.5" opacity="0.7" />
      <circle cx="-4" cy="1" r="1" fill="currentColor" opacity="0.75" />
      <circle cx="4" cy="1" r="1" fill="currentColor" opacity="0.75" />
    </g>
  ),
  overalls: (
    <g transform="translate(0, 8)">
      <path d="M-10 -3 H10 L12 12 H-12 Z" fill="currentColor" opacity="0.3" />
      <path d="M-6 -5 V4 M6 -5 V4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.8" />
      <rect x="-4" y="1" width="8" height="5" rx="1" fill="rgba(255,255,255,0.28)" stroke="currentColor" strokeWidth="0.8" />
    </g>
  ),
  cape: (
    <g transform="translate(0, 7)">
      <path d="M-13 -4 Q0 2 13 -4 L11 15 Q0 10 -11 15 Z" fill="#7c3aed" opacity="0.34" />
      <circle cx="-5" cy="-2.5" r="1.2" fill="currentColor" />
      <circle cx="5" cy="-2.5" r="1.2" fill="currentColor" />
    </g>
  ),
  spacesuit: (
    <g transform="translate(0, 8)">
      <path d="M-13 0 Q-7 -6 0 -6 Q7 -6 13 0 L12 12 H-12 Z" fill="rgba(226,232,240,0.48)" stroke="currentColor" strokeWidth="1" />
      <rect x="-4.5" y="-1.5" width="9" height="5" rx="1.5" fill="rgba(15,23,42,0.22)" stroke="currentColor" strokeWidth="0.8" />
      <circle cx="0" cy="1" r="1" fill="currentColor" />
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

// Which hats are MeshPro exclusive
export const MESHPRO_HATS: Set<string> = new Set(["headphones", "halo", "wizard", "astronaut", "pirate", "chef"]);
export const MESHPRO_COLORS: Set<string> = new Set(["crimson", "midnight", "rose", "emerald", "arctic", "obsidian"]);
export const MESHPRO_HAIRS: Set<string> = new Set(["spikes", "curls"]);
export const MESHPRO_ACCESSORIES: Set<string> = new Set(["sunglasses", "monocle"]);
export const MESHPRO_BADGES: Set<string> = new Set(["verified", "creator", "founder"]);
export const MESHPRO_OUTFITS: Set<string> = new Set(["cape", "spacesuit"]);

// Achievement titles — earned through milestones
export const ACHIEVEMENT_TITLES: Record<string, { title: string; description: string; requirement: string }> = {
  explorer: { title: "Explorer", description: "Connected 3+ platforms", requirement: "3_platforms" },
  socialite: { title: "Socialite", description: "100+ followers across platforms", requirement: "100_followers" },
  creator: { title: "Creator", description: "50+ posts on the mesh", requirement: "50_posts" },
  connector: { title: "Connector", description: "Joined 5+ communities", requirement: "5_communities" },
  pioneer: { title: "Pioneer", description: "Early mesh.me adopter", requirement: "early_adopter" },
  influencer: { title: "Influencer", description: "1000+ total engagement", requirement: "1000_engagement" },
  meshmaster: { title: "Mesh Master", description: "Fully customized Meshi", requirement: "full_customization" },
  guardian: { title: "Guardian", description: "Verified email and phone", requirement: "verified" },
};

export type MeshiMood = keyof typeof FACES;
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
  showGlow = true,
  speaking = false,
  interactive = false,
  onMoodChange,
  prop = "none",
  bouncy = false,
}: MeshiMascotProps) {
  const theme = COLOR_THEMES[color] || COLOR_THEMES.blue;
  const face = FACES[mood] || FACES.happy;
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

  // Global mouse tracking for eye follow (smooth, Codex-like)
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

  // Determine prop SVG. Hands follow visible held objects only.
  const propSvg = prop && prop !== "none" && PROP_SVGS[prop] ? PROP_SVGS[prop](theme.primary) : null;
  const showHands = Boolean(propSvg);
  const propUsesBothHands = showHands && TWO_HAND_PROPS.has(prop);
  const holdingHands = propUsesBothHands
    ? [HOLDING_POSES.two.left, HOLDING_POSES.two.right]
    : [HOLDING_POSES.single.right];

  // Determine current face (with blinking override)
  const getCurrentFace = () => {
    if (isBlinking && !speaking) return { face: FACES.blinking, mood: "blinking" as MeshiMood };
    const currentMood = interactive ? (localMood || mood) : mood;
    const currentFace = interactive ? (FACES[localMood || mood] || FACES.happy) : face;
    return { face: currentFace, mood: currentMood };
  };

  const { face: renderedFace, mood: renderedMood } = getCurrentFace();

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
          {/* Breathing glow filter */}
          <filter id={`${uniqueId}-glow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Breathing ambient glow */}
        {showGlow && (
          <motion.circle cx="0" cy="0" r="20" fill="none" stroke={theme.primary} strokeWidth="1.5" opacity="0.2"
            animate={animate ? {
              scale: [1, 1.08, 1.03, 1.1, 1],
              opacity: [0.2, 0.35, 0.25, 0.3, 0.2],
              strokeWidth: [1.5, 2, 1.5, 1.8, 1.5],
            } : undefined}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />
        )}

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

        {/* Clipped content — everything inside the circle */}
        <g clipPath={`url(#${uniqueId}-clip)`}>
          {/* Body — clean circle with smooth breathing animation */}
          <motion.circle cx="0" cy="0" r="16" fill={theme.bg} stroke={theme.primary} strokeWidth="2"
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

          {/* Simple outfits stay inside the bubble so Meshi remains minimal. */}
          <g style={{ color: theme.primary }}>{outfitElement}</g>

          {/* Hair and hat */}
          <g style={{ color: theme.primary }}>{hairElement}</g>
          <g style={{ color: theme.primary }}>{hatElement}</g>

          {/* Face — eyes with smooth tracking and blinking */}
          <motion.g
            transform={`scale(${Math.min(scale, 1.2)})`}
            style={{ x: smoothEyeX, y: smoothEyeY }}
          >
            {(() => {
              if (renderedFace.svg && SVG_FACES[renderedMood]) {
                return SVG_FACES[renderedMood](theme.primary);
              }
              return (
                <text x="0" y="1" textAnchor="middle" dominantBaseline="central" fontSize="9"
                  fill={theme.primary} fontFamily="system-ui" style={{ userSelect: "none" }}>
                  {renderedFace.eyes}
                </text>
              );
            })()}
          </motion.g>

          {eyeStyleElement && <g style={{ color: theme.primary }}>{eyeStyleElement}</g>}
          {accessoryElement && <g style={{ color: theme.primary }}>{accessoryElement}</g>}
          {badgeElement && <g style={{ color: theme.primary }}>{badgeElement}</g>}
        </g>

        {/* Prop — rendered outside the clip for visibility */}
        {showHands && (
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            {holdingHands.map((hand) => (
              <motion.path
                key={`${hand.side}-holding-arm`}
                d={`M ${hand.shoulderX} ${hand.shoulderY} Q ${hand.elbowX} ${hand.elbowY} ${hand.handX} ${hand.handY}`}
                fill="none"
                stroke={theme.primary}
                strokeWidth="1.7"
                strokeLinecap="round"
                animate={animate ? { y: [0, -0.5, 0.3, 0] } : undefined}
                transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
              />
            ))}
          </motion.g>
        )}

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

        {/* Bubble hands — only shown when Meshi is actively holding a prop */}
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
                  r="2.9"
                  fill={theme.bg}
                  stroke={theme.primary}
                  strokeWidth="1.45"
                />
                <path
                  d={`M ${hand.handX - 1.25} ${hand.handY - 0.1} Q ${hand.handX} ${hand.handY - 1.35} ${hand.handX + 1.25} ${hand.handY - 0.1}`}
                  fill="none"
                  stroke={theme.primary}
                  strokeWidth="0.9"
                  strokeLinecap="round"
                  opacity="0.82"
                />
              </motion.g>
            ))}
          </motion.g>
        )}
      </svg>
    </motion.div>
  );
}

// Mini version for use as app icon / logo
export function MeshiLogo({ size = 32, color = "blue", mood = "happy", className = "" }: {
  size?: number; color?: MeshiColor; mood?: MeshiMood; className?: string;
}) {
  const theme = COLOR_THEMES[color] || COLOR_THEMES.blue;
  const face = FACES[mood] || FACES.happy;
  return (
    <div className={`inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="-20 -20 40 40">
        <circle cx="0" cy="0" r="16" fill={theme.bg} stroke={theme.primary} strokeWidth="2" />
        {face.svg && SVG_FACES[mood] ? (
          <g transform="scale(0.85)">{SVG_FACES[mood](theme.primary)}</g>
        ) : (
          <text x="0" y="1" textAnchor="middle" dominantBaseline="central" fontSize="8" fill={theme.primary} fontFamily="system-ui" style={{ userSelect: "none" }}>{face.eyes}</text>
        )}
      </svg>
    </div>
  );
}

// Determine Meshi's mood based on user activity
export function getMeshiMoodFromActivity(stats: {
  daysActive?: number;
  postsThisWeek?: number;
  lastLogin?: Date;
}): MeshiMood {
  const now = new Date();
  const daysSinceLogin = stats.lastLogin
    ? Math.floor((now.getTime() - new Date(stats.lastLogin).getTime()) / (1000 * 60 * 60 * 24))
    : 999;
  if (daysSinceLogin > 7) return "sleepy";
  if (daysSinceLogin > 3) return "thinking";
  if ((stats.postsThisWeek || 0) > 5) return "excited";
  if ((stats.postsThisWeek || 0) > 2) return "love";
  return "happy";
}

// Small social Meshi for displaying on other users' mesh nodes
export function MeshiMini({ size = 20, color = "blue", hat = "none", mood = "happy", hair = "none", accessory = "none", eyeStyle = "regular", badge = "none", outfit = "none" }: {
  size?: number; color?: MeshiColor; hat?: MeshiHat; mood?: MeshiMood; hair?: MeshiHair; accessory?: MeshiAccessory; eyeStyle?: MeshiEyeStyle; badge?: MeshiBadge; outfit?: MeshiOutfit;
}) {
  const theme = COLOR_THEMES[color] || COLOR_THEMES.blue;
  const face = FACES[mood] || FACES.happy;
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
      <g style={{ color: theme.primary }}>{outfitElement}</g>
      <g style={{ color: theme.primary }}>{hairElement}</g>
      <g style={{ color: theme.primary }}>{hatElement}</g>
      <g transform="scale(0.8)">
        {face.svg && SVG_FACES[mood] ? (
          SVG_FACES[mood](theme.primary)
        ) : (
          <text x="0" y="1" textAnchor="middle" dominantBaseline="central" fontSize="9"
            fill={theme.primary} fontFamily="system-ui" style={{ userSelect: "none" }}>
            {face.eyes}
          </text>
        )}
      </g>
      {eyeStyleElement && <g style={{ color: theme.primary }}>{eyeStyleElement}</g>}
      {accessoryElement && <g style={{ color: theme.primary }}>{accessoryElement}</g>}
      {badgeElement && <g style={{ color: theme.primary }}>{badgeElement}</g>}
    </svg>
  );
}

export { ACCESSORIES, BADGES, COLOR_THEMES, EYE_STYLES, FACES, HAIRS, HATS, OUTFITS, PROP_SVGS };
