"use client";

import { motion } from "framer-motion";

// Meshi face styles
const FACES: Record<string, { eyes: string }> = {
  happy: { eyes: "◕ ◕" },
  excited: { eyes: "★ ★" },
  thinking: { eyes: "◑ ◐" },
  sleepy: { eyes: "◡ ◡" },
  surprised: { eyes: "◎ ◎" },
  love: { eyes: "♥ ♥" },
  cool: { eyes: "■ ■" },
  wink: { eyes: "◕ ◡" },
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
      {[0, 60, 120, 180, 240, 300].map((deg) => (
        <circle
          key={deg}
          cx={Math.cos((deg * Math.PI) / 180) * 4}
          cy={Math.sin((deg * Math.PI) / 180) * 4}
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
}: MeshiMascotProps) {
  const theme = COLOR_THEMES[color] || COLOR_THEMES.blue;
  const face = FACES[mood] || FACES.happy;
  const hatElement = HATS[hat] || null;
  const scale = size / 48;

  return (
    <motion.div
      className={`inline-flex items-center justify-center cursor-pointer select-none ${className}`}
      style={{ width: size, height: size }}
      onClick={onClick}
      whileHover={animate ? { scale: 1.1 } : undefined}
      whileTap={animate ? { scale: 0.95 } : undefined}
    >
      <svg
        width={size}
        height={size}
        viewBox="-24 -24 48 48"
        style={{ overflow: "visible" }}
      >
        {/* Glow */}
        {showGlow && (
          <motion.circle
            cx="0"
            cy="0"
            r="20"
            fill="none"
            stroke={theme.primary}
            strokeWidth="1"
            opacity="0.3"
            animate={animate ? {
              scale: [1, 1.15, 1],
              opacity: [0.3, 0.15, 0.3],
            } : undefined}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
        )}

        {/* Speaking pulse rings */}
        {speaking && (
          <>
            <motion.circle
              cx="0" cy="0" r="18" fill="none"
              stroke={theme.primary} strokeWidth="1.5"
              initial={{ r: 18, opacity: 0.6 }}
              animate={{ r: 28, opacity: 0 }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }}
            />
            <motion.circle
              cx="0" cy="0" r="18" fill="none"
              stroke={theme.primary} strokeWidth="1"
              initial={{ r: 18, opacity: 0.4 }}
              animate={{ r: 32, opacity: 0 }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut", delay: 0.4 }}
            />
          </>
        )}

        {/* Body */}
        <motion.circle
          cx="0"
          cy="0"
          r="16"
          fill={theme.bg}
          stroke={theme.primary}
          strokeWidth="2"
          animate={animate ? {
            y: [0, -1.5, 0],
          } : undefined}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Inner gradient circle */}
        <circle cx="0" cy="0" r="14" fill={theme.primary} opacity="0.15" />

        {/* Hat */}
        <g style={{ color: theme.primary }}>
          {hatElement}
        </g>

        {/* Face — eyes only, no mouth */}
        <g transform={`scale(${Math.min(scale, 1.2)})`}>
          <text
            x="0"
            y="1"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="9"
            fill={theme.primary}
            fontFamily="system-ui"
            style={{ userSelect: "none" }}
          >
            {face.eyes}
          </text>
        </g>

        {/* Mesh connection dots */}
        {[0, 72, 144, 216, 288].map((deg, i) => (
          <motion.circle
            key={deg}
            cx={Math.cos((deg * Math.PI) / 180) * 18}
            cy={Math.sin((deg * Math.PI) / 180) * 18}
            r="1.5"
            fill={theme.primary}
            opacity="0.5"
            animate={animate ? {
              opacity: [0.3, 0.7, 0.3],
              scale: [1, 1.3, 1],
            } : undefined}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: i * 0.3,
              ease: "easeInOut",
            }}
          />
        ))}
      </svg>
    </motion.div>
  );
}

// Mini version for use as app icon / logo
export function MeshiLogo({
  size = 32,
  color = "blue",
  mood = "happy",
  className = "",
}: {
  size?: number;
  color?: MeshiColor;
  mood?: MeshiMood;
  className?: string;
}) {
  const theme = COLOR_THEMES[color] || COLOR_THEMES.blue;
  const face = FACES[mood] || FACES.happy;

  return (
    <div
      className={`inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox="-20 -20 40 40">
        <circle cx="0" cy="0" r="16" fill={theme.primary} opacity="0.15" />
        <circle cx="0" cy="0" r="16" fill="none" stroke={theme.primary} strokeWidth="2" />
        <text x="0" y="1" textAnchor="middle" dominantBaseline="central" fontSize="8" fill={theme.primary} fontFamily="system-ui" style={{ userSelect: "none" }}>{face.eyes}</text>
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

export { COLOR_THEMES, FACES, HATS };
