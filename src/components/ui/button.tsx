import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { PaperWait } from "@/components/loading/paper-wait";
import { cn } from "@/lib/utils";

// THE BUTTON IS THE KEY. `.key` supplies the moulded silhouette — the --edge
// ring that carries the boundary, the side wall, and the press that conserves
// total height. Variants supply only the material.
//
// `ghost` and `link` are deliberately NOT keys: a ghost button has no face, so
// giving it a side wall would draw a wall around nothing. They keep the flat
// treatment and the plain focus ring.
// NOT `ds-interactive`. That class is the OLD paper depth model — it lifts the
// element 2px on hover and swaps in a wide blurred shadow. A `.key` presses INTO
// a plinth. An element carrying both has two depth models fighting, and because
// `.ds-interactive:hover` sits later in globals.css it wins on source order: the
// side wall never collapses, the bottom edge moves, and height conservation —
// the entire point of the press — silently stops happening. Caught by measuring
// the bottom edge in a real browser, not by reading the CSS.
const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap text-sm font-semibold tracking-[0] disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        default: "key key-lit [--mould:var(--mould-cobalt)] [--mould-ink:var(--mould-cobalt-ink)] [--mould-plinth:var(--mould-cobalt-plinth)]",
        secondary: "key",
        ghost: "ds-focus-ring rounded-[var(--radius-md)] border border-transparent bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]",
        outline: "key bg-transparent text-[var(--text-primary)]",
        // `glass` keeps its name for the ~30 call sites, but there is no glass in
        // this system — backdrop-filter is banned everywhere but the modal scrim.
        // It is a plain secondary key.
        glass: "key",
        // DESTRUCTIVE IS RED TEXT, NOT A RED FILL.
        //
        // This was `key-lit` crimson — a filled plastic, the same weight the
        // affirmative primary gets. Photographed on /settings: "Delete account"
        // rendered as a full-width crimson slab beside a plain "Sign out",
        // making the most dangerous action the loudest thing on the page. Apple
        // is explicit that fill marks the ONE action you want pressed, and that
        // destructive actions are red LABELS in a row; iOS has never drawn Delete
        // as a filled button in a settings list.
        //
        // The ink is --danger, not --mould-crimson. --mould-crimson is a FILL:
        // it is measured against its own pinned ink, never against paper.
        // --danger is one of the five pigments contrast-check measures on all
        // four papers, which is exactly what a label needs.
        danger: "key text-[var(--danger)]",
        // One definition, not two. These were byte-identical strings under two
        // names — the same fact stated twice, which is how they would have
        // drifted the moment one was edited.
        get destructive() {
          return this.danger;
        },
        success: "key key-lit [--mould:var(--mould-jade)] [--mould-ink:var(--mould-jade-ink)] [--mould-plinth:var(--mould-jade-plinth)]",
        warning: "key key-lit [--mould:var(--mould-amber)] [--mould-ink:var(--mould-amber-ink)] [--mould-plinth:var(--mould-amber-plinth)]",
        link: "ds-focus-ring h-auto rounded-[var(--radius-xs)] border-transparent bg-transparent p-0 text-[var(--accent-text)] underline-offset-4 hover:underline",
        // No gradients in a moulded system — a plastic is one colour through.
        // The brand plastic is tomato.
        gradient: "key key-lit [--mould:var(--mould-tomato)] [--mould-ink:var(--mould-tomato-ink)] [--mould-plinth:var(--mould-tomato-plinth)]",
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

interface ButtonProps
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
        {loading ? <PaperWait size="sm" /> : leftIcon}
        {loading && <span className="sr-only">{loadingLabel}</span>}
        {children}
        {!loading && rightIcon}
      </Comp>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
