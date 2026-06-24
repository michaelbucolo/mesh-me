import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock, ShieldCheck } from "lucide-react";
import { PublicSiteShell } from "@/components/layout/public-site-shell";
import { MeshiLogo } from "@/components/meshi/meshi-mascot";
import { SupportTicketForm } from "@/components/support/support-ticket-form";
import { meshBrand } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Support",
  description: `Submit a support ticket for ${meshBrand.name} with category, priority, message, screenshot, browser info, and account email.`,
};

export default function SupportPage() {
  return (
    <PublicSiteShell maxWidth="max-w-6xl">
      <section className="grid min-h-full gap-5 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div className="rounded-3xl border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-5 shadow-[var(--shadow-sm)]">
          <div className="flex items-center gap-3">
            <MeshiLogo size={56} color="blue" mood="thinking" />
            <div>
              <p className="mesh-kicker">Support</p>
              <h1 className="mt-1 text-3xl font-bold leading-tight text-[var(--text-primary)] md:text-5xl">
                Tell us what broke.
              </h1>
            </div>
          </div>

          <p className="mt-4 text-sm leading-6 text-[var(--text-secondary)] md:text-base">
            Use this form for account access, billing, Meshi, connected platforms, safety, data, password problems, and site errors.
          </p>

          <div className="mt-5 grid gap-3">
            <div className="flex gap-3 rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-primary)]/60 p-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent)]" aria-hidden="true" />
              <div>
                <p className="text-sm font-bold text-[var(--text-primary)]">Do not send secrets.</p>
                <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
                  Never include passwords, payment numbers, private tokens, or identity documents.
                </p>
              </div>
            </div>
            <div className="flex gap-3 rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-primary)]/60 p-3">
              <Clock className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent)]" aria-hidden="true" />
              <div>
                <p className="text-sm font-bold text-[var(--text-primary)]">Send enough context.</p>
                <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
                  Include the page, what you clicked, what you expected, and any error text.
                </p>
              </div>
            </div>
          </div>

          <Link href="/help" className="mesh-action mesh-action-secondary mt-5 justify-center px-4 text-sm">
            Search Help Center first
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <SupportTicketForm />
      </section>
    </PublicSiteShell>
  );
}
