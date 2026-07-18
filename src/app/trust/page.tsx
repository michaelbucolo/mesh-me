import type { Metadata } from "next";
import Link from "next/link";
import {
  ExternalLink,
  Eye,
  FileCheck2,
  KeyRound,
  Lock,
  ServerCog,
  Shield,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { PublicSiteShell } from "@/components/layout/public-site-shell";
import { SiteRouteMap } from "@/components/marketing/site-route-map";
import { meshBrand } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Trust Center",
  description: `Security, privacy, transparency, and launch trust principles for ${meshBrand.name}.`,
};

const trustPillars = [
  {
    icon: Shield,
    title: "Security by default",
    description: "Launch readiness means hardened defaults, protective headers, minimal exposure, and safer account handling across the stack.",
  },
  {
    icon: Lock,
    title: "Privacy visible in product",
    description: "Users should not have to trust hidden promises. Mesh.me exposes privacy, permissions, exports, and deletion controls directly in the interface.",
  },
  {
    icon: KeyRound,
    title: "Scoped platform access",
    description: "Connected account access is meant to be limited to user-authorized actions instead of broad invisible grabs for data.",
  },
  {
    icon: Eye,
    title: "Transparent ownership",
    description: "Mesh.me is designed as a user-authorized distribution and management layer, not a system that steals credit or hides what it stores.",
  },
];

const controlRows = [
  {
    icon: ServerCog,
    title: "Connected account permissions",
    copy: "Users should always understand which platforms are linked, what is imported, and what can be disconnected immediately.",
  },
  {
    icon: Trash2,
    title: "Deletion and export",
    copy: "Analytics and privacy tooling should let people inspect, export, and remove data without guesswork.",
  },
  {
    icon: ShieldCheck,
    title: "Meshi boundary",
    copy: "Meshi is the only deeply integrated companion layer so the rest of the product stays clean, predictable, and less invasive.",
  },
];

export default function TrustCenterPage() {
  return (
    <PublicSiteShell maxWidth="max-w-5xl">
      <section className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
        <div>
          <p className="mesh-kicker mb-4">mesh.me Trust Center</p>
          <h1 className="mesh-title text-4xl leading-tight md:text-6xl">
            Trust has to be part of the interface, not buried in the fine print.
          </h1>
        </div>
        <p className="mesh-copy text-base md:text-lg">
          Mesh.me is built around user ownership, source credit, secure connected accounts, clear permission states,
          and a business model that does not depend on selling the user out.
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

      <section className="mt-12 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <article className="rounded-3xl border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-6">
          <div className="mb-4 flex items-center gap-2">
            <FileCheck2 className="h-5 w-5 text-[var(--accent)]" />
            <h2 className="text-lg font-bold text-[var(--text-primary)]">How the trust model shows up in product</h2>
          </div>
          <div className="space-y-3">
            {controlRows.map((row) => (
              <div key={row.title} className="rounded-2xl border border-[var(--border-primary)] p-4">
                <div className="mb-2 flex items-center gap-2">
                  <row.icon className="h-4 w-4 text-[var(--accent)]" />
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">{row.title}</h3>
                </div>
                <p className="text-sm leading-6 text-[var(--text-secondary)]">{row.copy}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-3xl border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Source-respecting platform model
          </p>
          <p className="text-sm leading-6 text-[var(--text-secondary)]">
            Mesh.me is intended to feel like a user-authorized control layer for your digital world. Source-platform
            actions stay off unless the official API, approved scopes, user consent, and provider terms allow the action.
          </p>
          <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-200">
            Compliance rule: official APIs only, no scraping, no credential collection, no unsupported write-back.
          </div>
        </article>
      </section>

      <section className="mt-12 rounded-2xl border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-5">
        <div className="mb-4 flex items-center gap-2">
          <FileCheck2 className="h-5 w-5 text-[var(--accent)]" />
          <h2 className="text-base font-bold text-[var(--text-primary)]">Policy and launch references</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            ["/privacy", "Privacy Policy"],
            ["/terms", "Terms of Service"],
            ["/settings?tab=privacy", "Privacy Controls"],
            ["/api/trust/status", "Trust Status API"],
            ["/api/platform-capabilities", "Platform Capability API"],
            ["/.well-known/security.txt", "security.txt"],
            ["https://developers.google.com/youtube/terms/developer-policies", "YouTube API Policies"],
            ["https://developer.x.com/en/developer-terms/agreement-and-policy", "X Developer Terms"],
            ["https://developers.tiktok.com/doc/our-guidelines-developer-guidelines", "TikTok Developer Guidelines"],
            ["https://support-dev.discord.com/hc/en-us/articles/8562894815383-Discord-Developer-Terms-of-Service", "Discord Developer Terms"],
          ].map(([href, label]) => (
            <Link
              key={href}
              href={href}
              target={href.startsWith("http") ? "_blank" : undefined}
              rel={href.startsWith("http") ? "noreferrer" : undefined}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-primary)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              {label}
              <ExternalLink className="h-3 w-3" />
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <SiteRouteMap
          title="Keep exploring how Mesh protects you"
          description="From here you can move straight into Privacy, Terms, and the rest of the product to see the promise in practice."
        />
      </section>
    </PublicSiteShell>
  );
}
