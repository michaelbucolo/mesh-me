"use client";

import { motion, useSpring } from "framer-motion";
import { useRef, useState, useCallback, useEffect } from "react";

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
};

// SVG faces for clean, scalable eye rendering
const SVG_FACES: Record<string, (color: string) => React.ReactNode> = {
  happy: (color: string) => (
    <g>
      {/* Wide, friendly oval eyes */}
      <ellipse cx="-5" cy="0" rx="2.5" ry="3" fill={color} />
      <ellipse cx="5" cy="0" rx="2.5" ry="3" fill={color} />
    </g>
  ),
  wink: (color: string) => (
    <g>
      {/* Left eye — wide oval */}
      <ellipse cx="-5" cy="0" rx="2.5" ry="3" fill={color} />
      {/* Right eye — happy closed arc */}
      <path d="M 2.5 0.5 Q 5 -2.5 7.5 0.5" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </g>
  ),
  synergy1017: (color: string) => (
    <g>
      {/* Left eye — tall oval */}
      <ellipse cx="-4" cy="0" rx="1.8" ry="3.8" fill={color} />
      {/* Right eye — thick upward-facing wink arc */}
      <path d="M 2 1.5 Q 4.5 -2.5 7 1.5" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </g>
  ),
  searching: (color: string) => (
    <g>
      {/* Squinting eyes — focused look */}
      <ellipse cx="-5" cy="0" rx="3" ry="1.5" fill={color} />
      <ellipse cx="5" cy="0" rx="3" ry="1.5" fill={color} />
      <circle cx="-4" cy="0" r="0.8" fill="white" />
      <circle cx="6" cy="0" r="0.8" fill="white" />
    </g>
  ),
  learning: (color: string) => (
    <g>
      {/* Wide curious eyes — big and bright */}
      <ellipse cx="-5" cy="-0.5" rx="3" ry="3.5" fill={color} />
      <ellipse cx="5" cy="-0.5" rx="3" ry="3.5" fill={color} />
      <circle cx="-4" cy="-1.5" r="1" fill="white" opacity="0.8" />
      <circle cx="6" cy="-1.5" r="1" fill="white" opacity="0.8" />
    </g>
  ),
  celebrating: (color: string) => (
    <g>
      {/* Happy closed eyes — arcs */}
      <path d="M -7.5 0 Q -5 -3 -2.5 0" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <path d="M 2.5 0 Q 5 -3 7.5 0" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </g>
  ),
};

// Meshi prop types — contextual items Meshi holds
export type MeshiProp = "none" | "magnifying-glass" | "clipboard" | "paintbrush" | "megaphone" | "shield" | "compass" | "bell" | "heart" | "wrench";

// SVG props rendered near Meshi
const PROP_SVGS: Record<string, (color: string) => React.ReactNode> = {
  "magnifying-glass": (color: string) => (
    <g transform="translate(12, -8) scale(0.6)">
      <circle cx="0" cy="0" r="6" fill="none" stroke={color} strokeWidth="2.5" />
      <line x1="4" y1="4" x2="10" y2="10" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </g>
  ),
  clipboard: (color: string) => (
    <g transform="translate(12, -6) scale(0.55)">
      <rect x="-5" y="-2" width="10" height="14" rx="1.5" fill="none" stroke={color} strokeWidth="2" />
      <rect x="-2" y="-4" width="4" height="3" rx="1" fill={color} />
      <line x1="-3" y1="3" x2="3" y2="3" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="-3" y1="6" x2="3" y2="6" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="-3" y1="9" x2="1" y2="9" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </g>
  ),
  paintbrush: (color: string) => (
    <g transform="translate(13, -7) scale(0.55) rotate(-30)">
      <rect x="-1.5" y="-2" width="3" height="12" rx="1" fill={color} />
      <path d="M -2.5 10 Q 0 14 2.5 10" fill={color} opacity="0.7" />
    </g>
  ),
  megaphone: (color: string) => (
    <g transform="translate(12, -4) scale(0.55)">
      <path d="M -2 -4 L 8 -8 L 8 4 L -2 0 Z" fill={color} opacity="0.8" />
      <rect x="-4" y="-4" width="3" height="4" rx="1" fill={color} />
    </g>
  ),
  shield: (color: string) => (
    <g transform="translate(12, -6) scale(0.55)">
      <path d="M 0 -7 L 7 -3 L 6 5 L 0 8 L -6 5 L -7 -3 Z" fill="none" stroke={color} strokeWidth="2" />
      <path d="M 0 -2 L 3 1 L 0 4 L -3 1 Z" fill={color} opacity="0.5" />
    </g>
  ),
  compass: (color: string) => (
    <g transform="translate(12, -6) scale(0.55)">
      <circle cx="0" cy="0" r="7" fill="none" stroke={color} strokeWidth="2" />
      <polygon points="0,-5 2,0 0,5 -2,0" fill={color} opacity="0.7" />
      <circle cx="0" cy="0" r="1.5" fill={color} />
    </g>
  ),
  bell: (color: string) => (
    <g transform="translate(12, -6) scale(0.55)">
      <path d="M -5 2 Q -5 -6 0 -7 Q 5 -6 5 2 L -5 2 Z" fill={color} opacity="0.8" />
      <rect x="-6" y="2" width="12" height="2" rx="1" fill={color} />
      <circle cx="0" cy="5" r="1.5" fill={color} />
    </g>
  ),
  heart: (color: string) => (
    <g transform="translate(12, -6) scale(0.55)">
      <path d="M 0 3 C -8 -2 -8 -8 -4 -8 C -1 -8 0 -5 0 -5 C 0 -5 1 -8 4 -8 C 8 -8 8 -2 0 3 Z" fill={color} opacity="0.8" />
    </g>
  ),
  wrench: (color: string) => (
    <g transform="translate(13, -7) scale(0.55) rotate(-45)">
      <rect x="-1.5" y="-2" width="3" height="14" rx="1" fill={color} />
      <circle cx="0" cy="-2" r="3" fill="none" stroke={color} strokeWidth="2" />
    </g>
  ),
};


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
};

export type MeshiMood = keyof typeof FACES;
export type MeshiHat = keyof typeof HATS;
export type MeshiColor = keyof typeof COLOR_THEMES;

// Page-to-prop mapping: which prop Meshi holds on each page
export const PAGE_PROPS: Record<string, MeshiProp> = {
  "/mesh": "compass",
  "/feed": "clipboard",
  "/messages": "heart",
  "/communities": "megaphone",
  "/notifications": "bell",
  "/settings": "wrench",
  "/explore": "compass",
  "/search": "magnifying-glass",
  "/profile": "paintbrush",
  "/meshpro": "shield",
};

interface MeshiMascotProps {
  size?: number;
  mood?: MeshiMood;
  hat?: MeshiHat;
  color?: MeshiColor;
  animate?: boolean;
  onClick?: () => void;
  className?: string;
  showGlow?: boolean;
  speaking?: boolean;
  /** Enable physics jiggle and petting reactions */
  interactive?: boolean;
  /** Callback when mood changes from petting */
  onMoodChange?: (mood: MeshiMood) => void;
  /** Prop to display (contextual item Meshi holds) */
  prop?: MeshiProp;
  /** Enable enhanced bouncing idle animation */
  bouncy?: boolean;
}

export function MeshiMascot({
  size = 48,
  mood = "happy",
  hat = "none",
  color = "blue",
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
  const containerRef = useRef<HTMLDivElement>(null);

  // Physics-based jiggle springs
  const squishX = useSpring(1, { stiffness: 600, damping: 12, mass: 0.3 });
  const squishY = useSpring(1, { stiffness: 600, damping: 12, mass: 0.3 });
  const wobbleRotate = useSpring(0, { stiffness: 300, damping: 8, mass: 0.5 });

  // Track mouse velocity for petting
  const lastMouseX = useRef(0);
  const lastMouseTime = useRef(0);
  const petCount = useRef(0);
  const petTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [localMood, setLocalMood] = useState<MeshiMood | null>(null);

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

  // Determine prop SVG
  const propSvg = prop && prop !== "none" && PROP_SVGS[prop] ? PROP_SVGS[prop](theme.primary) : null;

  return (
    <motion.div
      ref={containerRef}
      className={`inline-flex items-center justify-center cursor-pointer select-none ${className}`}
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
        {/* Clip to perfect circle */}
        <defs>
          <clipPath id="meshi-circle-clip">
            <circle cx="0" cy="0" r="22" />
          </clipPath>
        </defs>

        {/* Glow ring — outside clip, perfectly circular */}
        {showGlow && (
          <motion.circle cx="0" cy="0" r="20" fill="none" stroke={theme.primary} strokeWidth="1" opacity="0.3"
            animate={animate ? { scale: [1, 1.1, 1], opacity: [0.3, 0.15, 0.3] } : undefined}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
        )}

        {/* Speaking pulse rings */}
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
          </>
        )}

        {/* Clipped content — everything inside the circle */}
        <g clipPath="url(#meshi-circle-clip)">
          {/* Body — clean circle with enhanced bounce */}
          <motion.circle cx="0" cy="0" r="16" fill={theme.bg} stroke={theme.primary} strokeWidth="2"
            animate={animate ? (bouncy
              ? { y: [0, -2.5, 0, -1, 0], scaleX: [1, 0.97, 1.02, 0.99, 1], scaleY: [1, 1.04, 0.97, 1.01, 1] }
              : { y: [0, -1, 0] }
            ) : undefined}
            transition={bouncy
              ? { duration: 2, repeat: Infinity, ease: "easeInOut" }
              : { duration: 2.5, repeat: Infinity, ease: "easeInOut" }
            }
          />

          {/* Hat */}
          <g style={{ color: theme.primary }}>{hatElement}</g>

          {/* Face — eyes only, reactive to petting */}
          <g transform={`scale(${Math.min(scale, 1.2)})`}>
            {(() => {
              const currentFace = interactive ? (FACES[localMood || mood] || FACES.happy) : face;
              const currentMood = interactive ? (localMood || mood) : mood;
              if (currentFace.svg && SVG_FACES[currentMood]) {
                return SVG_FACES[currentMood](theme.primary);
              }
              return (
                <text x="0" y="1" textAnchor="middle" dominantBaseline="central" fontSize="9"
                  fill={theme.primary} fontFamily="system-ui" style={{ userSelect: "none" }}>
                  {currentFace.eyes}
                </text>
              );
            })()}
          </g>
        </g>

        {/* Prop — rendered outside the clip for visibility */}
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
export function MeshiMini({ size = 20, color = "blue", hat = "none", mood = "happy" }: {
  size?: number; color?: MeshiColor; hat?: MeshiHat; mood?: MeshiMood;
}) {
  const theme = COLOR_THEMES[color] || COLOR_THEMES.blue;
  const face = FACES[mood] || FACES.happy;
  const hatElement = HATS[hat] || null;
  return (
    <svg width={size} height={size} viewBox="-24 -24 48 48">
      <circle cx="0" cy="0" r="16" fill={theme.bg} stroke={theme.primary} strokeWidth="2.5" />
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
    </svg>
  );
}

export { COLOR_THEMES, FACES, HATS, PROP_SVGS };
