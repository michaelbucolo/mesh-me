import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "secondary" | "outline" | "success" | "danger";
  className?: string;
}

const variantStyles = {
  default: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  secondary: "bg-zinc-700/50 text-zinc-300 border-zinc-600",
  outline: "bg-transparent text-zinc-400 border-zinc-600",
  success: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  danger: "bg-red-500/20 text-red-300 border-red-500/30",
};

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
