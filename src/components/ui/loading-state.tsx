import { getLoadingPersonality, type LoadingPersonalityKey } from "@/lib/loading-personality";
import { cn } from "@/lib/utils";
import { Skeleton } from "./skeleton";

interface LoadingStateProps {
  title?: string;
  description?: string;
  className?: string;
  compact?: boolean;
  personality?: LoadingPersonalityKey;
}

export function LoadingState({
  title,
  description,
  className,
  compact = false,
  personality = "app",
}: LoadingStateProps) {
  const loading = getLoadingPersonality(personality);

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center text-[var(--text-secondary)]",
        compact ? "py-6" : "py-14",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <span className="relative mb-3 flex h-8 w-8 items-center justify-center rounded-full" aria-hidden="true">
        <span className="absolute inset-0 rounded-full border border-[var(--accent)]/35 motion-safe:animate-ping" />
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent)] shadow-[0_0_18px_var(--accent-muted)]" />
      </span>
      <p className="text-sm font-semibold text-[var(--text-primary)]">{title ?? loading.title}</p>
      <p className="mt-1 max-w-sm text-sm leading-6 text-[var(--text-secondary)]">
        {description ?? loading.subtitle}
      </p>
    </div>
  );
}

export function LoadingList({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("grid gap-3", className)} aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="rounded-[var(--ds-radius-md)] border border-[var(--ds-border)] bg-[var(--ds-surface)] p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="grid flex-1 gap-2">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-3 w-4/5" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
