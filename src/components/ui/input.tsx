import * as React from "react";
import { cn } from "@/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leftAddon?: React.ReactNode;
  rightAddon?: React.ReactNode;
}

const inputClassName =
  "ds-focus-ring flex h-[var(--ds-control-height-lg)] w-full rounded-[var(--ds-radius-md)] border border-[var(--ds-border)] bg-[var(--bg-input)] px-3.5 py-2 text-sm text-[var(--text-primary)] shadow-none transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-[var(--text-muted)] disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-[var(--ds-danger-border)] aria-[invalid=true]:bg-[var(--ds-danger-bg)]";

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, leftAddon, rightAddon, ...props }, ref) => {
    if (leftAddon || rightAddon) {
      return (
        <div className="relative flex items-center">
          {leftAddon && <div className="pointer-events-none absolute left-3 text-[var(--text-muted)]">{leftAddon}</div>}
          <input
            type={type}
            className={cn(inputClassName, leftAddon && "pl-10", rightAddon && "pr-10", className)}
            ref={ref}
            suppressHydrationWarning
            {...props}
          />
          {rightAddon && <div className="absolute right-3 text-[var(--text-muted)]">{rightAddon}</div>}
        </div>
      );
    }

    return <input type={type} className={cn(inputClassName, className)} ref={ref} suppressHydrationWarning {...props} />;
  }
);
Input.displayName = "Input";



export { Input };
