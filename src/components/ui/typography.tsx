import * as React from "react";
import { cn } from "@/lib/utils";

export function H1({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h1
      className={cn("text-3xl font-semibold leading-tight text-[var(--text-primary)] ds-text-balance sm:text-4xl", className)}
      {...props}
    />
  );
}

export function H2({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn("text-2xl font-semibold leading-tight text-[var(--text-primary)] ds-text-balance", className)}
      {...props}
    />
  );
}

export function H3({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-lg font-semibold leading-tight text-[var(--text-primary)] ds-text-balance", className)}
      {...props}
    />
  );
}

export function Text({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm leading-6 text-[var(--text-secondary)]", className)} {...props} />;
}

export function Muted({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-xs leading-5 text-[var(--text-muted)]", className)} {...props} />;
}

export function Kbd({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        "rounded-[var(--ds-radius-sm)] border border-[var(--ds-border)] bg-[var(--ds-surface-muted)] px-1.5 py-0.5 font-mono text-[0.72rem] text-[var(--text-secondary)]",
        className
      )}
      {...props}
    />
  );
}
