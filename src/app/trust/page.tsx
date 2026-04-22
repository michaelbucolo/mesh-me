import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, Eye, FileCheck2, KeyRound, Lock, Shield } from "lucide-react";
import { PublicSiteShell } from "@/components/layout/public-site-shell";

export const metadata: Metadata = {
  title: "Trust Center | mesh.me",
  description: "Security, privacy, transparency, and responsible platform use on Mesh.me.",
};

const trustPillars = [
  {
    icon: Shield,
    title: "Security by default",
    description: "Secure headers, strict transport security, hardened browser policies, and production readiness checks are part of the launch path.",
  },
  {
    icon: Lock,
    title: "Privacy-first data handling",
    description: "Users can inspect privacy settings, connected accounts, permission states, and stored-data controls in the product.",
  },
  {
    icon: KeyRound,
    title: "Token protection",
    description: "Connected platform tokens are designed to be encrypted and scoped to user-authorized actions.",
  },
  {
    icon: Eye,
    title: "Transparent controls",
    description: "Analytics doubles as a data control center so privacy is an interface, not a hidden policy paragraph.",
  },
];

export default function TrustCenterPage() {
  return (
    <PublicSiteShell maxWidth="max-w-5xl">
      <section className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
        <div>
          <p className="mesh-kicker mb-4">mesh.me Trust Center</p>
          <h1 className="mesh-title text-4xl leading-tight md:text-6xl">Security, privacy, and transparency built into the product.</h1>
        </div>
        <p className="mesh-copy text-base md:text-lg">
          Mesh.me is designed around user ownership, source credit, no ad-driven exploitation, and clear controls for data access, storage, sync, and deletion.
        </p>
      </section>

      <section className="mt-12 grid gap-4 md:grid-cols-2">
        {trustPillars.map((pillar) => (
          <article key={pillar.title} className="mesh-section p-5">
            <div className="mb-3 flex items-center gap-2">
              <pillar.icon className="h-5 w-5 text-[var(--accent)]" />
              <h2 className="text-base font-bold text-[var(--text-primary)]">{pillar.title}</h2>
            </div>
            <p className="text-sm leading-6 text-[var(--text-secondary)]">{pillar.description}</p>
          </article>
        ))}
      </section>

      <section className="mt-12 rounded-2xl border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-5">
        <div className="mb-4 flex items-center gap-2">
          <FileCheck2 className="h-5 w-5 text-[var(--accent)]" />
          <h2 className="text-base font-bold text-[var(--text-primary)]">Policy and compliance references</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            ["/privacy", "Privacy Policy"],
            ["/terms", "Terms of Service"],
            ["/settings?tab=privacy", "Privacy Controls"],
            ["/api/trust/status", "Trust Status API"],
            ["/.well-known/security.txt", "security.txt"],
          ].map(([href, label]) => (
            <Link key={href} href={href} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-primary)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
              {label} <ExternalLink className="h-3 w-3" />
            </Link>
          ))}
        </div>
      </section>
    </PublicSiteShell>
  );
}
