"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface WelcomeBannerProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  dismissKey?: string;
  children?: React.ReactNode;
  className?: string;
}

export function WelcomeBanner({
  title,
  description,
  icon,
  dismissKey,
  children,
  className,
}: WelcomeBannerProps) {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    if (!dismissKey) return false;
    return localStorage.getItem(`banner-${dismissKey}`) === "true";
  });

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    if (dismissKey) localStorage.setItem(`banner-${dismissKey}`, "true");
  };

  return (
    <div
      className={cn(
        "relative rounded-2xl border border-[var(--accent-muted)] bg-gradient-to-r from-[var(--accent-subtle)] to-transparent p-5 animate-fade-in",
        className
      )}
    >
      {dismissKey && (
        <button
          onClick={handleDismiss}
          className="absolute right-3 top-3 rounded-lg p-1 text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
        >
          <X className="h-4 w-4" />
        </button>
      )}
      <div className="flex items-start gap-3">
        {icon && (
          <div className="rounded-xl bg-[var(--accent-muted)] p-2.5 flex-shrink-0">
            {icon}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-0.5">
            {title}
          </h3>
          {description && (
            <p className="text-xs text-[var(--text-tertiary)] leading-relaxed">
              {description}
            </p>
          )}
          {children && <div className="mt-3">{children}</div>}
        </div>
      </div>
    </div>
  );
}
