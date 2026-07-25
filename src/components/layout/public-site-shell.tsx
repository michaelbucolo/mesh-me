import Link from "next/link";
import type React from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
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
      <div className="pointer-events-none fixed inset-0 mesh-soft-grid mesh-soft-grid-elegant" aria-hidden="true" />
      <div className="pointer-events-none fixed inset-0 mesh-shell-vignette" aria-hidden="true" />
      <header className="relative z-40 shrink-0 border-b border-[var(--border-primary)] bg-[var(--bg-primary)]/86 backdrop-blur-xl">
        <div className="public-site-nav mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <MeshiBrandLockup href="/" size={32} label={meshBrand.name} subtitle={meshBrand.motto} className="text-lg" />
          {/* Five pressables in the public header, none of which had material.
              `.mesh-choice` and `.mesh-action*` are SHARED classes with 30+ call
              sites across the product, and they are pinned by `!important`
              blocks at globals.css:4142-4160 and 4114-4139 that `.key` cannot
              outrank — so, exactly as feed-timeline-client.tsx:647,656 did for
              the feed's own two, these five call sites emit `.key` and rebuild
              their geometry from utilities instead. The shared rules are left
              untouched for everyone else.

              What that removes here is not neutral: `.mesh-choice:hover` and
              `.mesh-action:hover` both lift under a wide blurred shadow
              (:2293, :2350, :4155) — the control rising toward the finger —
              and `.mesh-action-primary` was a three-stop hardcoded gradient
              (#a5c8ff → #ffffff → #c7b8ff, :2311) lit by an emitting
              `0 14px 36px rgba(91,141,239,0.18)` and wiped by a sweeping
              ::after highlight (:2316-2330). A plastic is one colour through:
              the primary CTA is moulded from --mould-tomato, the brand plastic
              (tokens.css:451), with its pinned ink and plinth. */}
          <nav className="flex max-w-full gap-3 overflow-x-auto text-sm text-[var(--text-secondary)]">
            {navLinks.map((item) => (
              <Link key={item.href} href={item.href} className="key inline-flex shrink-0 items-center px-3 py-2 text-[var(--text-primary)]">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="key inline-flex min-h-11 items-center gap-2 px-3 text-sm font-semibold text-[var(--text-primary)]">
              Log in
            </Link>
            <Link
              href="/signup"
              className="key key-lit [--mould:var(--mould-tomato)] [--mould-ink:var(--mould-tomato-ink)] [--mould-plinth:var(--mould-tomato-plinth)] inline-flex min-h-11 items-center gap-2 px-3 text-sm font-semibold"
            >
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
