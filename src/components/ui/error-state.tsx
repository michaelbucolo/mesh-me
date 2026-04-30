import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

interface ErrorStateProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  href?: string;
  className?: string;
  compact?: boolean;
}

export function ErrorState({
  title = "Something went wrong",
  description = "The page is still safe. Try again or go back to a known place.",
  actionLabel = "Try again",
  onAction,
  href,
  className,
  compact = false,
}: ErrorStateProps) {
  const action =
    href ? (
      <Button asChild variant="secondary">
        <a href={href}>{actionLabel}</a>
      </Button>
    ) : onAction ? (
      <Button type="button" variant="secondary" onClick={onAction}>
        {actionLabel}
      </Button>
    ) : null;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "py-8" : "py-14",
        className
      )}
      role="alert"
    >
      <div className="mb-4 rounded-[var(--ds-radius-md)] border border-[var(--ds-danger-border)] bg-[var(--ds-danger-bg)] p-3 text-[var(--ds-danger)]">
        <AlertTriangle className="h-6 w-6" aria-hidden="true" />
      </div>
      <h2 className="text-lg font-semibold leading-tight text-[var(--text-primary)] ds-text-balance">{title}</h2>
      {description && <p className="mt-2 max-w-md text-sm leading-6 text-[var(--text-secondary)]">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
