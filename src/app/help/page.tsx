import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, LifeBuoy, Search } from "lucide-react";
import { HelpCenterSearch } from "@/components/help/help-center-search";
import { PublicSiteShell } from "@/components/layout/public-site-shell";
import { MeshiLogo } from "@/components/meshi/meshi-mascot";
import { helpArticles, helpCategories, helpCategoryMeta } from "@/lib/help-center";
import { meshBrand } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Help Center",
  description: `Search help articles for ${meshBrand.name} accounts, Meshi, safety, billing, connected platforms, data, password problems, and common errors.`,
};

export default function HelpCenterPage() {
  return (
    <PublicSiteShell maxWidth="max-w-6xl">
      <section className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr] lg:items-end">
        <div>
          <p className="mesh-kicker mb-3">Help Center</p>
          <h1 className="mesh-title text-4xl leading-tight md:text-6xl">Find a clear answer fast.</h1>
          <p className="mesh-copy mt-4 text-base md:text-lg">
            Search practical help for accounts, Meshi, safety, billing, connected platforms, data controls, password problems, and common errors.
          </p>
        </div>

        <div className="rounded-3xl border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-5">
          <div className="flex items-center gap-3">
            <MeshiLogo size={52} color="blue" mood="thinking" />
            <div>
              <h2 className="text-lg font-black text-[var(--text-primary)]">Meshi can help you get unstuck.</h2>
              <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
                Start with search, then jump to the right product surface if you need to act.
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Link href="/status" className="mesh-choice inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black text-[var(--text-secondary)]">
              <Search className="h-4 w-4" aria-hidden="true" />
              System status
            </Link>
            <Link href="/support" className="mesh-action mesh-action-primary justify-center px-4 text-sm">
              <LifeBuoy className="h-4 w-4" aria-hidden="true" />
              Contact support
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="Help topics">
        {helpCategories.map((category) => {
          const meta = helpCategoryMeta[category];
          const Icon = meta.icon;
          const count = helpArticles.filter((article) => article.category === category).length;

          return (
            <div key={category} className="rounded-2xl border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-4 shadow-[var(--shadow-sm)]">
              <div className="mb-3 flex items-center justify-between gap-3">
                <Icon className="h-5 w-5 text-[var(--accent)]" aria-hidden="true" />
                <span className="rounded-full border border-[var(--border-primary)] px-2 py-0.5 text-xs font-black text-[var(--text-muted)]">
                  {count}
                </span>
              </div>
              <h2 className="text-sm font-black text-[var(--text-primary)]">{meta.label}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{meta.description}</p>
            </div>
          );
        })}
      </section>

      <section className="mt-5">
        <HelpCenterSearch articles={helpArticles} />
      </section>

      <section className="mt-5 rounded-3xl border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-5 md:flex md:items-center md:justify-between md:gap-4">
        <div>
          <p className="text-sm font-black text-[var(--text-primary)]">Still need help?</p>
          <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
            Send support the page URL, what you tried, and any error text you saw.
          </p>
        </div>
        <Link href="/support" className="mesh-action mesh-action-secondary mt-4 justify-center px-4 text-sm md:mt-0">
          Contact support
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </section>
    </PublicSiteShell>
  );
}
