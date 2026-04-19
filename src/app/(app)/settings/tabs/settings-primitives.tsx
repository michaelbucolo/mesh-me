import { cn } from "@/lib/utils";

interface SettingsCardProps {
  children: React.ReactNode;
  className?: string;
}

export function SettingsCard({ children, className }: SettingsCardProps) {
  return <section className={cn("glass-card rounded-2xl p-5", className)}>{children}</section>;
}

interface SettingsCardHeaderProps {
  title: string;
  className?: string;
  description?: string;
  icon?: React.ReactNode;
}

export function SettingsCardHeader({ title, className, description, icon }: SettingsCardHeaderProps) {
  return (
    <header className={cn("mb-4", className)}>
      <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
        {icon}
        {title}
      </h3>
      {description && <p className="mt-2 text-xs text-[var(--text-muted)]">{description}</p>}
    </header>
  );
}
