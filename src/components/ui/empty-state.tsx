import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
  compact?: boolean;
}

export function EmptyState({ icon: Icon, title, description, children, className, compact = false }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "mesh-cascade relative flex flex-col items-center justify-center text-center",
        compact ? "py-8" : "py-14",
        className
      )}
    >
      {/* A still aurora glow behind the icon keeps a blank screen lit and
          inviting. Deliberately NOT animated: this surface is where the eye
          rests, and the old breathing/bobbing pair nagged at it forever. */}
      <span className="mesh-soft-glow" aria-hidden="true" style={{ top: compact ? "2.5rem" : "3.75rem" }} />
      <div
        className="mesh-float relative mb-4 rounded-[var(--ds-radius-md)] border border-[var(--ds-border)] bg-[var(--ds-surface-muted)] p-3"
        style={{ ["--i" as string]: 0 }}
      >
        <Icon className={cn("text-[var(--text-muted)]", compact ? "h-5 w-5" : "h-7 w-7")} />
      </div>
      <h3 className="relative mb-1 text-base font-semibold text-[var(--text-primary)] ds-text-balance" style={{ ["--i" as string]: 1 }}>{title}</h3>
      {description && <p className="relative max-w-sm text-sm leading-6 text-[var(--text-secondary)]" style={{ ["--i" as string]: 2 }}>{description}</p>}
      {children && <div className="relative mt-4" style={{ ["--i" as string]: 3 }}>{children}</div>}
    </div>
  );
}
