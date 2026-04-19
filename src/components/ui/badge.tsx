import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "secondary" | "outline" | "success" | "danger" | "warning";
  className?: string;
}

const variantStyles = {
  default: "bg-[var(--accent-muted)] text-[var(--accent)] border-transparent",
  secondary:
    "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border-transparent",
  outline:
    "bg-transparent text-[var(--text-tertiary)] border-[var(--border-primary)]",
  success: "bg-emerald-500/15 text-emerald-400 border-transparent",
  danger: "bg-red-500/15 text-red-400 border-transparent",
  warning: "bg-amber-500/15 text-amber-400 border-transparent",
};

export function Badge({
  children,
  variant = "default",
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none",
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
