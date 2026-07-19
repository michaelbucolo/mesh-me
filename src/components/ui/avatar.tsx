import { memo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { MeshiLogo } from "@/components/meshi/meshi-mascot";
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
  /**
   * Opt-in interactivity: hover scale + ring-brighten, and a tiny happy bob for
   * the Meshi fallback. Omitted = static, identical to prior behavior.
   */
  interactive?: boolean;
}

const sizeMap = {
  xs: "h-6 w-6 text-[10px]",
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
  "transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] " +
  "hover:scale-[1.03] hover:ring-[var(--accent)] will-change-transform " +
  "motion-reduce:transition-none motion-reduce:hover:scale-100";

export const Avatar = memo(function Avatar({
  src,
  alt = "",
  size = "md",
  className,
  presence,
  interactive = false,
}: AvatarProps) {
  const meshiSize = size === "xs" ? 14 : size === "sm" ? 18 : size === "md" ? 20 : size === "lg" ? 28 : 36;

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
        "rounded-full flex items-center justify-center ring-1 ring-[var(--border-primary)] flex-shrink-0 bg-[var(--bg-secondary)]",
        sizeMap[size],
        interactive && interactiveClass,
        className
      )}
      role="img"
      aria-label={alt ? `${alt}'s Meshi avatar` : "Meshi avatar"}
      title={alt ? `${alt}'s Meshi` : "Meshi"}
    >
      {interactive ? (
        <motion.span
          className="inline-flex"
          whileHover={{ y: [0, -3, 0] }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        >
          <MeshiLogo size={meshiSize} color="blue" mood="happy" />
        </motion.span>
      ) : (
        <MeshiLogo size={meshiSize} color="blue" mood="happy" />
      )}
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
