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
  { href: "/developers", label: "Developers" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/data-deletion", label: "Data deletion" },
];

export function PublicSiteShell({
  children,
  maxWidth = "max-w-5xl",
  sectionLabel = "Explore Mesh.me",
}: {
  children: React.ReactNode;
  maxWidth?: string;
  sectionLabel?: string;
}) {
  return (
    <div className="public-site-shell public-studio relative isolate flex h-dvh max-h-dvh min-h-0 flex-col overflow-hidden text-[var(--text-primary)]">
      <a href="#public-content" className="public-skip-link">Skip to content</a>
      <header className="public-studio-header relative z-40 shrink-0">
        <div className="public-site-nav">
          <MeshiBrandLockup href="/" size={32} label={meshBrand.name} subtitle={meshBrand.motto} className="text-lg" />
          <nav aria-label="Discover Mesh.me" className="public-primary-nav">
            {navLinks.map((item) => (
              <Link key={item.href} href={item.href} data-feedback="navigate">{item.label}</Link>
            ))}
          </nav>
          <div className="public-account-nav">
            <Link href="/login" className="public-login-link">Log in</Link>
            <Link href="/signup" className="public-join-link">
              <span>Create account</span><ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>
      <main id="public-content" tabIndex={-1} className="public-site-main min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <div className={`public-document mx-auto w-full ${maxWidth}`}>
          <div className="public-location"><span aria-hidden="true" />{sectionLabel}</div>
          {children}
        </div>
        <footer className="public-studio-footer">
          <div className="public-footer-intro">
            <MeshiBrandLockup href="/" size={30} label={meshBrand.name} className="text-lg" />
            <p>{meshBrand.motto}.</p>
            <span><ShieldCheck size={14} aria-hidden="true" />{meshBrand.trustLine}</span>
          </div>
          <nav aria-label="About Mesh.me" className="public-footer-links">
            {footerLinks.map((item) => <Link key={item.href} href={item.href}>{item.label}</Link>)}
          </nav>
        </footer>
      </main>
    </div>
  );
}
