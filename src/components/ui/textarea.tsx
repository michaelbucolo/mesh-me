import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-xl border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50 resize-none",
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
