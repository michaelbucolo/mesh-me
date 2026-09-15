"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

// Layouts persist during client navigation. Read the current route here so
// the active tab and sign-in return destination follow the page on screen.
export function GuestHeader() {
  const pathname = usePathname() || "/explore";
  const search = useSearchParams().toString();
  const nextPath = `${pathname}${search ? `?${search}` : ""}`;
  return (
    <header className="mesh-guest-header flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-[var(--border-primary)] bg-[var(--bg-primary)] px-4 pb-2 pt-[max(.75rem,env(safe-area-inset-top))] sm:flex-nowrap sm:px-6">
      <Link href="/" className="brand-wordmark text-lg text-[var(--text-primary)]">
        mesh<span className="brand-wordmark-accent">.me</span>
      </Link>
      <nav aria-label="Browse Mesh.me" className="order-last flex w-full items-center justify-center gap-5 sm:order-none sm:w-auto">
        {[{ href: "/explore", label: "Explore" }, { href: "/flow", label: "Flow" }].map((item) => (
          <Link key={item.href} href={item.href}
            aria-current={pathname === item.href ? "page" : undefined}
            className="inline-flex min-h-11 items-center border-b-2 border-transparent text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] aria-[current=page]:border-[var(--accent)] aria-[current=page]:text-[var(--text-primary)]">
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="flex items-center gap-2">
        <Link
          href={`/login?next=${encodeURIComponent(nextPath)}`}
          className="inline-flex min-h-11 items-center px-3.5 text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          Sign in
        </Link>
        <Link
          href="/signup"
          className="mesh-action mesh-action-primary px-4 text-sm"
        >
          Create account
        </Link>
      </div>
    </header>
  );
}
