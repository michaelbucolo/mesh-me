import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "secondary" | "outline" | "success" | "danger" | "warning" | "accent";
  className?: string;
  /** Spring-pop the badge into place (for counts / "new" moments). */
  pop?: boolean;
}

const variantStyles = {
  default: "bg-[var(--ds-surface-muted)] text-[var(--text-secondary)] border-[var(--ds-border)]",
  secondary: "bg-[var(--ds-surface)] text-[var(--text-secondary)] border-[var(--ds-border)]",
  outline: "bg-transparent text-[var(--text-tertiary)] border-[var(--ds-border)]",
  success: "bg-[var(--ds-success-bg)] text-[var(--ds-success)] border-[var(--ds-success-border)]",
  danger: "bg-[var(--ds-danger-bg)] text-[var(--ds-danger)] border-[var(--ds-danger-border)]",
  warning: "bg-[var(--ds-warning-bg)] text-[var(--ds-warning)] border-[var(--ds-warning-border)]",
  // Opaque, like its three siblings. --accent-subtle is translucent, so the
  // colour under this label depended on whatever was behind the badge: measured
  // in a browser, 49 of these fell below AA at 12px. See --ds-accent-bg.
  accent: "bg-[var(--ds-accent-bg)] text-[var(--accent-text)] border-[var(--ds-accent-border)]",
};

export function Badge({ children, variant = "default", className, pop = false }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center gap-1 rounded-[var(--ds-radius-pill)] border px-2 py-0.5 text-xs font-semibold leading-none transition-colors",
        variantStyles[variant],
        pop && "animate-mesh-pop",
        className
      )}
    >
      {children}
    </span>
  );
}
