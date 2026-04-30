import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface NavItem {
  href: string;
  label: string;
  icon?: LucideIcon;
  active?: boolean;
  badge?: React.ReactNode;
}

export function NavList({
  items,
  className,
  compact = false,
}: {
  items: NavItem[];
  className?: string;
  compact?: boolean;
}) {
  return (
    <nav className={cn("grid gap-1", className)} aria-label="Primary">
      {items.map((item) => (
        <NavLink key={item.href} item={item} compact={compact} />
      ))}
    </nav>
  );
}

export function NavLink({ item, compact = false }: { item: NavItem; compact?: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={item.active ? "page" : undefined}
      className={cn(
        "ds-focus-ring ds-interactive flex min-h-[var(--ds-control-height)] items-center gap-3 rounded-[var(--ds-radius-pill)] px-3 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]",
        item.active && "bg-[var(--bg-hover)] text-[var(--text-primary)]",
        compact && "justify-center px-2"
      )}
      title={compact ? item.label : undefined}
    >
      {Icon && <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />}
      {!compact && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
      {!compact && item.badge && <span className="shrink-0">{item.badge}</span>}
    </Link>
  );
}

export function SegmentedControl({
  options,
  value,
  onChange,
  className,
}: {
  options: { label: string; value: string; icon?: LucideIcon }[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div
      className={cn("inline-flex rounded-[var(--ds-radius-pill)] border border-[var(--ds-border)] bg-[var(--ds-surface-muted)] p-1", className)}
      role="tablist"
    >
      {options.map((option) => {
        const Icon = option.icon;
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "ds-focus-ring ds-interactive inline-flex h-8 items-center justify-center gap-1.5 rounded-[var(--ds-radius-pill)] px-3 text-sm font-semibold text-[var(--text-secondary)]",
              active && "bg-[var(--ds-surface)] text-[var(--text-primary)] shadow-[var(--ds-shadow-card)]"
            )}
          >
            {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
