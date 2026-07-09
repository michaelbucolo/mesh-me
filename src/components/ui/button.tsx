import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "ds-interactive ds-focus-ring inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-[var(--ds-radius-pill)] border text-sm font-semibold tracking-[0] disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        default: "border-[var(--ds-accent-border)] bg-[var(--accent)] text-[var(--accent-contrast,#ffffff)] hover:bg-[var(--accent-hover)]",
        secondary: "border-[var(--ds-border)] bg-[var(--ds-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]",
        ghost: "border-transparent bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]",
        outline: "border-[var(--ds-border)] bg-transparent text-[var(--text-primary)] hover:bg-[var(--bg-hover)]",
        glass: "border-[var(--ds-border)] bg-[var(--ds-surface-glass)] text-[var(--text-primary)] backdrop-blur-md hover:bg-[var(--bg-hover)]",
        danger: "border-[var(--ds-danger-border)] bg-[var(--ds-danger)] text-white hover:bg-red-500",
        destructive: "border-[var(--ds-danger-border)] bg-[var(--ds-danger)] text-white hover:bg-red-500",
        success: "border-[var(--ds-success-border)] bg-[var(--ds-success)] text-white hover:bg-emerald-500",
        warning: "border-[var(--ds-warning-border)] bg-[var(--ds-warning-bg)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]",
        link: "h-auto border-transparent bg-transparent p-0 text-[var(--accent)] underline-offset-4 hover:underline",
        gradient: "btn-gradient border-transparent text-white",
      },
      size: {
        default: "h-[var(--ds-control-height)] px-4 py-2",
        sm: "h-[var(--ds-control-height-sm)] px-3 text-xs",
        lg: "h-[var(--ds-control-height-lg)] px-5 text-base",
        xl: "h-14 px-7 text-base",
        icon: "h-[var(--ds-control-height)] w-[var(--ds-control-height)] p-0",
        "icon-sm": "h-[var(--ds-control-height-sm)] w-[var(--ds-control-height-sm)] p-0",
        "icon-lg": "h-[var(--ds-control-height-lg)] w-[var(--ds-control-height-lg)] p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      loadingLabel = "Loading",
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";
    if (asChild) {
      return (
        <Slot
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          aria-busy={loading || undefined}
          {...props}
        >
          {children}
        </Slot>
      );
    }

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        aria-busy={loading || undefined}
        disabled={!asChild ? disabled || loading : disabled}
        {...props}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : leftIcon}
        {loading && <span className="sr-only">{loadingLabel}</span>}
        {children}
        {!loading && rightIcon}
      </Comp>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
