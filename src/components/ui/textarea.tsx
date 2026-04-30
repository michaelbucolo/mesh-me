import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "ds-focus-ring flex min-h-[6rem] w-full rounded-[var(--ds-radius-md)] border border-[var(--ds-border)] bg-[var(--bg-input)] px-3.5 py-3 text-sm leading-6 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-[border-color,box-shadow,background-color] duration-150 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-[var(--ds-danger-border)] aria-[invalid=true]:bg-[var(--ds-danger-bg)] resize-none",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
