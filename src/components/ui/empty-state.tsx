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
        "flex flex-col items-center justify-center text-center",
        compact ? "py-8" : "py-14",
        className
      )}
    >
      <div className="mb-4 rounded-[var(--ds-radius-md)] border border-[var(--ds-border)] bg-[var(--ds-surface-muted)] p-3">
        <Icon className={cn("text-[var(--text-muted)]", compact ? "h-5 w-5" : "h-7 w-7")} />
      </div>
      <h3 className="mb-1 text-base font-semibold text-[var(--text-primary)] ds-text-balance">{title}</h3>
      {description && <p className="max-w-sm text-sm leading-6 text-[var(--text-secondary)]">{description}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
