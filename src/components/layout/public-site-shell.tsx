import Link from "next/link";
import type React from "react";
import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import { MeshiLogo } from "@/components/meshi/meshi-mascot";
import { MeshBackground } from "@/components/mesh-background";

const navItems = [
  { href: "/features", label: "Features" },
  { href: "/about", label: "About" },
  { href: "/trust", label: "Trust" },
  { href: "/privacy", label: "Privacy" },
];

export function PublicSiteShell({
  children,
  maxWidth = "max-w-6xl",
}: {
  children: React.ReactNode;
  maxWidth?: string;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--bg-primary)]">
      <MeshBackground density={46} className="opacity-25" />
      <div className="pointer-events-none absolute inset-0 mesh-grid-bg opacity-[0.14]" />

      <header className="glass sticky top-0 z-30 border-b border-[var(--glass-border)]">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 md:h-18 md:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <MeshiLogo size={34} color="blue" mood="happy" />
            <div className="min-w-0">
              <p className="brand-wordmark truncate text-lg text-[var(--text-primary)]">
                Mesh<span className="brand-wordmark-accent">.me</span>
              </p>
              <p className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)] md:block">
                Your World, Your Way
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-xl px-3 py-2 text-sm font-medium text-[var(--text-secondary)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/features"
              className="hidden rounded-xl border border-[var(--glass-card-border)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] transition hover:text-[var(--text-primary)] sm:inline-flex"
            >
              See the vision
            </Link>
            <Link
              href="/"
              className="brand-button inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white"
            >
              Enter
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className={`relative z-10 mx-auto ${maxWidth} px-4 py-12 md:px-6 md:py-16`}>
        {children}
      </main>

      <footer className="relative z-10 border-t border-[var(--glass-border)] py-8">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 md:grid-cols-[1.2fr_0.8fr] md:px-6">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              No ads. No data selling.
            </div>
            <p className="max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
              Mesh.me is built to unify the useful parts of modern internet life without the manipulative parts.
              Users connect what they want, control what is visible, and keep source credit intact.
            </p>
          </div>

          <div className="grid gap-2 text-sm text-[var(--text-muted)] sm:grid-cols-2">
            <Link href="/privacy" className="transition hover:text-[var(--text-primary)]">Privacy</Link>
            <Link href="/terms" className="transition hover:text-[var(--text-primary)]">Terms</Link>
            <Link href="/features" className="transition hover:text-[var(--text-primary)]">Features</Link>
            <Link href="/about" className="transition hover:text-[var(--text-primary)]">About</Link>
            <Link href="/trust" className="transition hover:text-[var(--text-primary)]">Trust</Link>
            <div className="inline-flex items-center gap-2 text-[var(--text-secondary)]">
              <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
              2026 launch surface
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
