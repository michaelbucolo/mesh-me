import { cn } from "@/lib/utils";
import { MeshiLogo } from "@/components/meshi/meshi-mascot";

interface AvatarProps {
  src?: string | null;
  alt?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeMap = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-base",
  xl: "h-20 w-20 text-xl",
};

export function Avatar({ src, alt = "", size = "md", className }: AvatarProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className={cn(
          "rounded-full object-cover ring-1 ring-[var(--border-primary)] flex-shrink-0",
          sizeMap[size],
          className
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center ring-1 ring-[var(--border-primary)] flex-shrink-0 bg-[var(--bg-secondary)]",
        sizeMap[size],
        className
      )}
    >
      <MeshiLogo size={size === "xs" ? 14 : size === "sm" ? 18 : size === "md" ? 20 : size === "lg" ? 28 : 36} color="blue" mood="happy" />
    </div>
  );
}
