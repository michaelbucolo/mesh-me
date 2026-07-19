import Link from "next/link";
import type React from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { DeferredMeshBackground } from "@/components/deferred-mesh-background";
import { MeshiBrandLockup } from "@/components/meshi/meshi-identity";
import { meshBrand } from "@/lib/brand";

const navLinks = [
  { href: "/features", label: "Features" },
  { href: "/trust", label: "Trust" },
  { href: "/help", label: "Help" },
];

const footerLinks = [
  { href: "/about", label: "About" },
  { href: "/help", label: "Help" },
  { href: "/support", label: "Support" },
  { href: "/status", label: "Status" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/data-deletion", label: "Data Deletion" },
];

export function PublicSiteShell({
  children,
  maxWidth = "max-w-5xl",
}: {
  children: React.ReactNode;
  maxWidth?: string;
}) {
  return (
    <div className="mesh-aurora public-site-shell relative isolate flex h-dvh max-h-dvh min-h-0 flex-col overflow-hidden text-[var(--text-primary)]">
      <DeferredMeshBackground fixed interactive density={30} mouseInfluence={0.42} className="mesh-field-public" delayMs={520} />
      <div className="pointer-events-none fixed inset-0 mesh-soft-grid mesh-soft-grid-elegant" aria-hidden="true" />
      <div className="pointer-events-none fixed inset-0 mesh-shell-vignette" aria-hidden="true" />
      <header className="relative z-40 shrink-0 border-b border-[var(--border-primary)] bg-[var(--bg-primary)]/86 backdrop-blur-xl">
        <div className="public-site-nav mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <MeshiBrandLockup href="/" size={32} label={meshBrand.name} subtitle={meshBrand.motto} className="text-lg" />
          <nav className="flex max-w-full gap-3 overflow-x-auto text-sm text-[var(--text-secondary)]">
            {navLinks.map((item) => (
              <Link key={item.href} href={item.href} className="mesh-choice shrink-0 rounded-md px-3 py-2 hover:text-[var(--text-primary)]">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="mesh-action mesh-action-secondary px-3 text-sm">
              Log in
            </Link>
            <Link href="/signup" className="mesh-action mesh-action-primary px-3 text-sm">
              Create account
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      <main className={`public-site-main relative z-10 mx-auto min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden ${maxWidth} px-4 py-4 md:py-5`}>{children}</main>

      <footer className="relative z-10 shrink-0 border-t border-[var(--border-primary)] bg-[var(--bg-primary)]/58">
        <div className="mx-auto grid max-w-5xl gap-2 px-4 py-3 text-xs text-[var(--text-muted)] md:grid-cols-[1fr_auto] md:items-center md:text-sm">
          <div>
            <div className="flex items-center gap-2 font-semibold text-[var(--text-secondary)]">
              <ShieldCheck size={15} aria-hidden="true" />
              {meshBrand.trustLine}
            </div>
            <p className="mt-1">{meshBrand.motto}.</p>
          </div>
          <nav className="flex flex-wrap gap-2">
            {footerLinks.map((item) => (
              <Link key={item.href} href={item.href} className="rounded-md px-2 py-1 hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
