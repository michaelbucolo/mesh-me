import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 text-center",
        className
      )}
    >
      <div className="rounded-2xl bg-[var(--bg-tertiary)] p-4 mb-4">
        <Icon className="h-8 w-8 text-[var(--text-muted)]" />
      </div>
      <h3 className="text-base font-semibold text-[var(--text-secondary)] mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-[var(--text-muted)] max-w-xs">
          {description}
        </p>
      )}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
