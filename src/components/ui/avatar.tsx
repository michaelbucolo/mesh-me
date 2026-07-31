import { memo } from "react";
import { cn } from "@/lib/utils";
import Image from "next/image";

interface AvatarProps {
  src?: string | null;
  alt?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  /**
   * Opt-in presence flourish. "live" wraps the avatar in the shared aurora ring
   * (new/live), "online" adds a radar-ping presence dot. Omitted = no motion.
   */
  presence?: "online" | "live";
  /** Opt-in interactivity: hover ring-brighten. Omitted = static. */
  interactive?: boolean;
}

const sizeMap = {
  xs: "h-6 w-6 text-micro",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-base",
  xl: "h-20 w-20 text-xl",
};

const sizePixelMap = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 56,
  xl: 80,
};

const dotSizeMap = {
  xs: "h-1.5 w-1.5",
  sm: "h-2 w-2",
  md: "h-2.5 w-2.5",
  lg: "h-3 w-3",
  xl: "h-3.5 w-3.5",
};

const interactiveClass =
  "transition-shadow duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] " +
  "hover:ring-[var(--accent)] " +
  "motion-reduce:transition-none";

/**
 * Identity slots are never the mascot. The old fallback rendered the same
 * cartoon MeshiLogo face for EVERY user without a photo, on seven of eleven
 * screens — a feed where half the bylines share one smiley reads as a toy, and
 * names stop meaning anything. The fallback is now the adult convention:
 * the user's initial on a disc whose hue is a stable hash of their name, so
 * the same person is always the same color and two people rarely collide.
 * MeshiLogo remains reserved for Meshi's OWN system rows.
 */
const FALLBACK_HUES = [211, 156, 32, 262, 340, 190, 82, 16] as const;

function initialOf(alt: string): string {
  const trimmed = alt.trim();
  if (!trimmed) return "?";
  // First grapheme, uppercased — handles astral-plane characters.
  const first = [...trimmed][0] ?? "?";
  return first.toUpperCase();
}

function hueOf(alt: string): number {
  let hash = 5381;
  for (let i = 0; i < alt.length; i++) hash = ((hash << 5) + hash + alt.charCodeAt(i)) >>> 0;
  return FALLBACK_HUES[hash % FALLBACK_HUES.length];
}

export const Avatar = memo(function Avatar({
  src,
  alt = "",
  size = "md",
  className,
  presence,
  interactive = false,
}: AvatarProps) {
  const core = src ? (
    <Image
      src={src}
      alt={alt}
      width={sizePixelMap[size]}
      height={sizePixelMap[size]}
      unoptimized
      loading="lazy"
      className={cn(
        "rounded-full object-cover ring-1 ring-[var(--border-primary)] flex-shrink-0",
        sizeMap[size],
        interactive && interactiveClass,
        className
      )}
    />
  ) : (
    <div
      className={cn(
        "rounded-full flex items-center justify-center ring-1 ring-[var(--border-primary)] flex-shrink-0 select-none font-semibold",
        sizeMap[size],
        interactive && interactiveClass,
        className
      )}
      style={{
        // Desaturated, theme-stable: dark enough for light ink in dark mode,
        // read through color-mix so the light theme lifts it automatically.
        background: `color-mix(in srgb, hsl(${hueOf(alt)} 26% 40%) 42%, var(--bg-secondary))`,
        color: "var(--text-secondary)",
      }}
      role="img"
      aria-label={alt || "Avatar"}
      title={alt || undefined}
    >
      {initialOf(alt)}
    </div>
  );

  // Default path — no opt-in flourishes: return the bare element unchanged.
  if (!presence) return core;

  if (presence === "live") {
    return <span className="mesh-aurora-ring inline-flex flex-shrink-0 rounded-full">{core}</span>;
  }

  // presence === "online"
  return (
    <span className="relative inline-flex flex-shrink-0">
      {core}
      <span
        className={cn(
          "mesh-presence-ping absolute bottom-0 right-0 block rounded-full bg-[var(--mesh-cyan)] text-[var(--mesh-cyan)] ring-2 ring-[var(--bg-primary)]",
          dotSizeMap[size]
        )}
        aria-hidden="true"
      />
    </span>
  );
});
