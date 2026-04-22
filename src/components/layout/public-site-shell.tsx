import Link from "next/link";
import type React from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { MeshiLogo } from "@/components/meshi/meshi-mascot";
import { MeshBackground } from "@/components/mesh-background";

export function PublicSiteShell({
  children,
  maxWidth = "max-w-6xl",
}: {
  children: React.ReactNode;
  maxWidth?: string;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--bg-primary)]">
      <MeshBackground density={42} className="opacity-25" />
      <div className="pointer-events-none absolute inset-0 mesh-grid-bg opacity-[0.14]" />

      <header className="glass sticky top-0 z-30 border-b border-[var(--glass-border)]">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6">
          <Link href="/" className="flex items-center gap-2">
            <MeshiLogo size={32} color="blue" mood="happy" />
            <span className="brand-wordmark text-lg text-[var(--text-primary)]">
              Mesh<span className="brand-wordmark-accent">.me</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            <Link href="/features" className="mesh-command px-3">Features</Link>
            <Link href="/about" className="mesh-command px-3">About</Link>
            <Link href="/trust" className="mesh-command px-3">Trust</Link>
            <Link href="/privacy" className="mesh-command px-3">Privacy</Link>
          </nav>

          <Link href="/" className="brand-button inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white">
            Enter <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <main className={`relative z-10 mx-auto ${maxWidth} px-4 py-12 md:px-6 md:py-16`}>
        {children}
      </main>

      <footer className="relative z-10 border-t border-[var(--glass-border)] py-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 text-xs text-[var(--text-muted)] sm:flex-row sm:items-center sm:justify-between md:px-6">
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            Copyright 2026 Mesh.me. No ads. No data selling.
          </span>
          <div className="flex flex-wrap gap-4">
            <Link href="/privacy" className="hover:text-[var(--text-secondary)]">Privacy</Link>
            <Link href="/terms" className="hover:text-[var(--text-secondary)]">Terms</Link>
            <Link href="/features" className="hover:text-[var(--text-secondary)]">Features</Link>
            <Link href="/about" className="hover:text-[var(--text-secondary)]">About</Link>
            <Link href="/trust" className="hover:text-[var(--text-secondary)]">Trust</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
