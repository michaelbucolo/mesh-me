import type { Metadata } from "next";
import Link from "next/link";
import {
  CheckCircle2,
  CircleAlert,
  Clock3,
  CreditCard,
  Database,
  MessageCircle,
  RadioTower,
  Server,
  UploadCloud,
  Waypoints,
} from "lucide-react";
import { PublicSiteShell } from "@/components/layout/public-site-shell";
import { meshBrand } from "@/lib/brand";
import { getPublicSystemStatus, type SystemServiceStatus, type SystemStatusCheck } from "@/lib/system-status";

export const metadata: Metadata = {
  title: "System Status",
  description: `Live public status for ${meshBrand.name} website, database, messaging, integrations, uploads, and payments.`,
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

const serviceIcons = {
  website: Server,
  database: Database,
  messaging: MessageCircle,
  integrations: Waypoints,
  uploads: UploadCloud,
  payments: CreditCard,
} satisfies Record<SystemStatusCheck["id"], typeof Server>;

const statusStyles = {
  operational: {
    label: "Operational",
    icon: CheckCircle2,
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    dotClassName: "bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.55)]",
  },
  degraded: {
    label: "Degraded",
    icon: CircleAlert,
    className: "border-rose-500/30 bg-rose-500/10 text-rose-300",
    dotClassName: "bg-rose-400 shadow-[0_0_14px_rgba(251,113,133,0.55)]",
  },
  setup_needed: {
    label: "Setup needed",
    icon: CircleAlert,
    className: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    dotClassName: "bg-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.55)]",
  },
} satisfies Record<SystemServiceStatus, { label: string; icon: typeof CheckCircle2; className: string; dotClassName: string }>;

function formatCheckedAt(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

function StatusBadge({ status }: { status: SystemServiceStatus }) {
  const style = statusStyles[status];
  const Icon = style.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${style.className}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {style.label}
    </span>
  );
}

function ServiceCard({ check }: { check: SystemStatusCheck }) {
  const Icon = serviceIcons[check.id];
  const style = statusStyles[check.status];

  return (
    <article className="rounded-2xl border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-4 shadow-[var(--shadow-sm)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)]">
            <Icon className="h-5 w-5 text-[var(--accent)]" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-[var(--text-primary)]">{check.label}</h2>
            <p className="mt-1 text-xs font-semibold mesh-eyebrow text-[var(--text-muted)]">{check.latencyMs} ms check</p>
          </div>
        </div>
        <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${style.dotClassName}`} aria-hidden="true" />
      </div>

      <div className="mt-4">
        <StatusBadge status={check.status} />
        <p className="mt-3 text-sm font-semibold text-[var(--text-primary)]">{check.summary}</p>
        <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{check.detail}</p>
      </div>
    </article>
  );
}

export default async function StatusPage() {
  const status = await getPublicSystemStatus();
  const overallStyle = statusStyles[status.overallStatus];

  return (
    <PublicSiteShell maxWidth="max-w-6xl">
      <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
        <div>
          <p className="mesh-kicker mb-3">System status</p>
          <h1 className="mesh-title text-4xl leading-tight md:text-6xl">Mesh.me status is public by default.</h1>
        </div>
        <div className="rounded-3xl border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className={`h-3 w-3 rounded-full ${overallStyle.dotClassName}`} aria-hidden="true" />
            <StatusBadge status={status.overallStatus} />
          </div>
          <p className="mt-4 text-lg font-semibold text-[var(--text-primary)]">{status.summary}</p>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            Last checked {formatCheckedAt(status.generatedAt)} UTC. This page checks public app health without exposing account data or secrets.
          </p>
        </div>
      </section>

      <section className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {status.checks.map((check) => (
          <ServiceCard key={check.id} check={check} />
        ))}
      </section>

      <section className="mt-5 grid gap-3 rounded-3xl border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-5 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
            <Clock3 className="h-4 w-4 text-[var(--accent)]" aria-hidden="true" />
            Public monitoring endpoint
          </div>
          <p className="text-sm leading-6 text-[var(--text-secondary)]">
            The same checks are available as JSON for uptime monitors and launch-readiness tooling.
          </p>
        </div>
        <Link href="/api/system-status" className="mesh-action mesh-action-secondary justify-center px-4 text-sm">
          View JSON
          <RadioTower className="h-4 w-4" aria-hidden="true" />
        </Link>
      </section>
    </PublicSiteShell>
  );
}
