import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, FileCheck2, ShieldCheck } from "lucide-react";
import { PublicSiteShell } from "@/components/layout/public-site-shell";

type LegalSection = {
  id: string;
  title: string;
  content: ReactNode;
};

export function LegalDocumentPage({
  eyebrow,
  title,
  summary,
  updatedLabel,
  sections,
}: {
  eyebrow: string;
  title: string;
  summary: string;
  updatedLabel: string;
  sections: LegalSection[];
}) {
  return (
    <PublicSiteShell maxWidth="max-w-6xl">
      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
        <div>
          <p className="mesh-kicker mb-4">{eyebrow}</p>
          <h1 className="mesh-title text-4xl leading-tight md:text-6xl">{title}</h1>
        </div>
        <div className="rounded-2xl border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-5">
          <p className="text-xs font-semibold mesh-eyebrow text-[var(--text-muted)]">{updatedLabel}</p>
          <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{summary}</p>
        </div>
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-[16rem_1fr]">
        <aside className="h-fit rounded-2xl border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-4 lg:sticky lg:top-24">
          <div className="mb-4 flex items-center gap-2">
            <FileCheck2 className="h-4 w-4 text-[var(--accent)]" />
            <p className="text-sm font-semibold text-[var(--text-primary)]">On this page</p>
          </div>
          <nav className="grid gap-1.5">
            {sections.map((section, index) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="rounded-lg px-3 py-2 text-sm text-[var(--text-secondary)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              >
                {index + 1}. {section.title}
              </a>
            ))}
          </nav>
        </aside>

        <div className="grid gap-4">
          {sections.map((section, index) => (
            <section
              key={section.id}
              id={section.id}
              className="rounded-2xl border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-5 md:p-6"
            >
              <p className="text-xs font-semibold mesh-eyebrow text-[var(--text-muted)]">Section {index + 1}</p>
              <h2 className="mt-2 text-xl font-semibold text-[var(--text-primary)]">{section.title}</h2>
              <div className="mt-4 space-y-4 text-sm leading-7 text-[var(--text-secondary)]">{section.content}</div>
            </section>
          ))}
        </div>
      </section>

      <section className="mt-10 grid gap-4 md:grid-cols-[1fr_auto] md:items-center rounded-2xl border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-1 h-5 w-5 text-emerald-400" />
          <div>
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Need the product controls too?</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
              The policy pages explain the rules. The Trust Center and in-app controls show how the product exposes them.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/trust" className="brand-button inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white">
            Trust Center <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/" className="mesh-command inline-flex rounded-xl px-4 py-2 text-sm">
            Home
          </Link>
        </div>
      </section>
    </PublicSiteShell>
  );
}
