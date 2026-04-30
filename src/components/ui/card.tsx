import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const cardVariants = cva(
  "border text-[var(--text-primary)]",
  {
    variants: {
      variant: {
        default: "ds-surface",
        elevated: "border-[var(--ds-border)] bg-[var(--ds-surface-raised)] shadow-[var(--ds-shadow-floating)]",
        glass: "ds-glass-panel",
        flat: "border-[var(--ds-border)] bg-transparent shadow-none",
        muted: "border-[var(--ds-border)] bg-[var(--ds-surface-muted)] shadow-none",
      },
      padding: {
        none: "p-0",
        sm: "p-3",
        default: "p-4",
        lg: "p-5",
      },
      radius: {
        sm: "rounded-[var(--ds-radius-sm)]",
        default: "rounded-[var(--ds-radius-md)]",
        lg: "rounded-[var(--ds-radius-lg)]",
      },
    },
    defaultVariants: {
      variant: "default",
      padding: "none",
      radius: "default",
    },
  }
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  hover?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ children, className, hover = false, variant, padding, radius, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        cardVariants({ variant, padding, radius }),
        hover && "ds-interactive hover:bg-[var(--bg-hover)]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
);
Card.displayName = "Card";

export function CardHeader({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex flex-col gap-1 px-4 pb-2 pt-4", className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-base font-semibold leading-tight text-[var(--text-primary)] ds-text-balance", className)}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-sm leading-6 text-[var(--text-secondary)]", className)} {...props}>
      {children}
    </p>
  );
}

export function CardContent({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("px-4 pb-4", className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-center gap-2 border-t border-[var(--ds-border)] px-4 pb-4 pt-3", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export { cardVariants };
