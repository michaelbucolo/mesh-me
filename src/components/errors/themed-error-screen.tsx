"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Compass, Home, RefreshCw, ShieldCheck } from "lucide-react";
import { MeshBackground } from "@/components/mesh-background";
import { MeshiLogo } from "@/components/meshi/meshi-mascot";
import { cn } from "@/lib/utils";

type ErrorLink = {
  href: string;
  label: string;
};

type ErrorCard = {
  href: string;
  icon: ReactNode;
  title: string;
  description: string;
};

type ThemedErrorScreenProps = {
  code?: string;
  eyebrow?: string;
  title: string;
  description: string;
  mood?: "thinking" | "surprised" | "searching";
  resetLabel?: string;
  onReset?: () => void;
  primaryLink?: ErrorLink;
  secondaryLink?: ErrorLink;
  cards?: ErrorCard[];
  fullScreen?: boolean;
  compact?: boolean;
  className?: string;
};

const defaultCards: ErrorCard[] = [
  {
    href: "/features",
    icon: <Compass className="h-4 w-4 text-[var(--accent)]" aria-hidden="true" />,
    title: "Browse Mesh.me",
    description: "Find Feed, MeChat, Analytics, Mesh Pro, and the public product routes.",
  },
  {
    href: "/trust",
    icon: <ShieldCheck className="h-4 w-4 text-emerald-400" aria-hidden="true" />,
    title: "Trust center",
    description: "Review the privacy, security, and data-control promises behind the platform.",
  },
];

export function ThemedErrorScreen({
  code,
  eyebrow = "Mesh.me",
  title,
  description,
  mood = "thinking",
  resetLabel = "Try again",
  onReset,
  primaryLink,
  secondaryLink,
  cards = defaultCards,
  fullScreen,
  compact,
  className,
}: ThemedErrorScreenProps) {
  const primary = primaryLink ?? { href: "/mesh", label: "Back to the Mesh" };
  const secondary = secondaryLink ?? { href: "/", label: "Home" };

  return (
    <section
      className={cn(
        "themed-error-screen relative isolate flex min-h-[70vh] items-center justify-center overflow-hidden px-4 py-6 text-center animate-page-enter",
        fullScreen && "h-dvh min-h-0",
        !fullScreen && "rounded-xl",
        className,
      )}
      data-meshi-zone="error"
    >
      <MeshBackground density={fullScreen ? 34 : 24} mouseInfluence={0.35} fixed={fullScreen} className="opacity-20" />

      <div className={cn("relative z-10 mx-auto w-full max-w-3xl", compact && "max-w-xl")}>
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[var(--border-primary)] bg-[var(--bg-primary)]/82 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-[var(--text-muted)] shadow-[var(--shadow-sm)] backdrop-blur">
          <ShieldCheck className="h-3.5 w-3.5 text-[var(--accent)]" aria-hidden="true" />
          {eyebrow}
        </div>

        <div className="themed-error-card mesh-surface mx-auto mt-5 rounded-2xl p-5 sm:p-7">
          <div className="mx-auto inline-flex rounded-[1.4rem] border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-3 shadow-[var(--shadow-sm)]">
            <MeshiLogo size={compact ? 58 : 72} color="blue" mood={mood} />
          </div>

          {code && (
            <p className="mt-5 font-mono text-xs font-black uppercase tracking-[0.22em] text-[var(--accent)]">
              {code}
            </p>
          )}

          <h1 className={cn("mx-auto mt-3 max-w-2xl font-display text-3xl font-black leading-tight text-[var(--text-primary)]", !compact && "sm:text-5xl")}>
            {title}
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[var(--text-secondary)] sm:text-base">
            {description}
          </p>

          <div className="mt-6 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            {onReset ? (
              <button
                type="button"
                onClick={onReset}
                className="brand-button inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-black text-white shadow-lg"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                {resetLabel}
              </button>
            ) : (
              <Link
                href={primary.href}
                className="brand-button inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-black text-white shadow-lg"
              >
                {primary.label}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            )}

            {onReset && (
              <Link
                href={primary.href}
                className="mesh-choice inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-black text-[var(--text-secondary)]"
              >
                {primary.label}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            )}

            <Link
              href={secondary.href}
              className="mesh-choice inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-black text-[var(--text-secondary)]"
            >
              <Home className="h-4 w-4" aria-hidden="true" />
              {secondary.label}
            </Link>
          </div>
        </div>

        {!compact && cards.length > 0 && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {cards.map((card) => (
              <Link key={card.href} href={card.href} className="mesh-choice rounded-2xl p-4 text-left">
                {card.icon}
                <p className="mt-3 text-sm font-black text-[var(--text-primary)]">{card.title}</p>
                <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{card.description}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
