import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const panelVariants = cva("border text-[var(--text-primary)]", {
  variants: {
    variant: {
      surface: "ds-surface",
      glass: "ds-glass-panel",
      muted: "border-[var(--ds-border)] bg-[var(--ds-surface-muted)]",
      transparent: "border-transparent bg-transparent shadow-none",
    },
    padding: {
      none: "p-0",
      sm: "p-3",
      default: "p-4",
      lg: "p-5",
      xl: "p-6",
    },
  },
  defaultVariants: {
    variant: "surface",
    padding: "default",
  },
});

export interface PanelProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof panelVariants> {
  interactive?: boolean;
}

export const Panel = React.forwardRef<HTMLDivElement, PanelProps>(
  ({ className, variant, padding, interactive = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        panelVariants({ variant, padding }),
        interactive && "ds-interactive hover:bg-[var(--bg-hover)]",
        className
      )}
      {...props}
    />
  )
);
Panel.displayName = "Panel";

export function PageShell({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <main className={cn("ds-page-shell", className)} {...props} />;
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">{eyebrow}</p>}
        <h2 className="text-xl font-semibold leading-tight text-[var(--text-primary)] ds-text-balance">{title}</h2>
        {description && <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

export { panelVariants };
