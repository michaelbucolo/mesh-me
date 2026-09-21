import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
  compact?: boolean;
}

export function EmptyState({ icon: Icon, title, description, children, className, compact = false }: EmptyStateProps) {
  return (
    <div className={cn("mesh-empty-state relative flex flex-col items-center justify-center text-center", className)} data-compact={compact}>
      <div className="mesh-empty-symbol" aria-hidden="true">
        <span className="mesh-empty-symbol-well"><Icon className={compact ? "h-5 w-5" : "h-6 w-6"} strokeWidth={1.5} /></span>
        <span className="mesh-empty-satellite" />
      </div>
      <h3 className="mesh-empty-title">{title}</h3>
      {description && <p className="mesh-empty-description">{description}</p>}
      {children && <div className="mesh-empty-actions">{children}</div>}
    </div>
  );
}
