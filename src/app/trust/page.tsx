import type { Metadata } from "next";
import Link from "next/link";
import { Shield, Lock, Eye, FileCheck2, ExternalLink } from "lucide-react";

export const metadata: Metadata = {
  title: "Trust Center — mesh.me",
  description: "Security, privacy, transparency, and responsible platform use on mesh.me.",
};

const trustPillars = [
  {
    icon: Shield,
    title: "Security by default",
    description: "HTTPS enforcement, strict transport security, secure headers, and hardened browser policies are enabled platform-wide.",
  },
  {
    icon: Lock,
    title: "Privacy-first data handling",
    description: "We minimize collected data, give user-facing privacy controls, and keep settings transparent and inspectable.",
  },
  {
    icon: Eye,
    title: "Transparency",
    description: "Users can inspect account-level transparency and privacy settings from the app’s privacy and settings surfaces.",
  },
  {
    icon: FileCheck2,
    title: "Terms & API compliance",
    description: "Platform usage is expected to follow Terms of Service, Privacy Policy, and approved API/provider policies.",
  },
];

export default function TrustCenterPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:py-10">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">mesh.me Trust Center</p>
        <h1 className="mt-2 text-3xl md:text-4xl font-bold text-[var(--text-primary)]">Security, Privacy, & Transparency</h1>
        <p className="mt-3 text-sm md:text-base text-[var(--text-secondary)] max-w-2xl">
          This page summarizes how mesh.me approaches secure transport, privacy controls, transparent data handling,
          and responsible platform/API use.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {trustPillars.map((pillar) => (
          <div key={pillar.title} className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4">
            <div className="mb-2 flex items-center gap-2">
              <pillar.icon className="h-4 w-4 text-[var(--accent)]" />
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">{pillar.title}</h2>
            </div>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">{pillar.description}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4">
        <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Policy & compliance references</h2>
        <div className="flex flex-wrap gap-2">
          <Link href="/privacy" className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-primary)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            Privacy Policy <ExternalLink className="h-3 w-3" />
          </Link>
          <Link href="/terms" className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-primary)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            Terms of Service <ExternalLink className="h-3 w-3" />
          </Link>
          <Link href="/settings?tab=privacy" className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-primary)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            Privacy Controls <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}

