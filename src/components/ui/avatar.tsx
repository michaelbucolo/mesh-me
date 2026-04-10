import { cn, getInitials } from "@/lib/utils";
import Image from "next/image";

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

const pixelSizeMap = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 56,
  xl: 80,
};

export function Avatar({ src, alt = "", size = "md", className }: AvatarProps) {
  if (src) {
    return (
      <Image
        src={src}
        alt={alt}
        width={pixelSizeMap[size]}
        height={pixelSizeMap[size]}
        unoptimized
        className={cn(
          "rounded-full object-cover ring-2 ring-[var(--border-primary)] flex-shrink-0",
          sizeMap[size],
          className
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center font-semibold text-white ring-2 ring-[var(--border-primary)] flex-shrink-0",
        "bg-[var(--accent)]",
        sizeMap[size],
        className
      )}
    >
      {getInitials(alt || "?")}
    </div>
  );
}
