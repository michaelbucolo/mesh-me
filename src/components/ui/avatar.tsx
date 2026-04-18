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

export function Avatar({ src, alt = "", size = "md", className }: AvatarProps) {
  if (src) {
    return (
      <div className={cn("relative overflow-hidden rounded-full ring-2 ring-[var(--border-primary)] flex-shrink-0", sizeMap[size], className)}>
        <Image
          src={src}
          alt={alt}
          fill
          sizes="80px"
          className="object-cover"
        />
      </div>
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
