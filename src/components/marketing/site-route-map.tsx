"use client";

import Link from "next/link";
import { ArrowRight, BarChart3, Lock, MessageCircle, Rss, ShieldCheck, Sparkles, Waypoints } from "lucide-react";

const routes = [
  {
    href: "/",
    icon: Waypoints,
    title: "The Mesh",
    description: "Explore the living map of your posts, people, communities, and connected platforms.",
    accent: "text-cyan-300",
  },
  {
    href: "/features",
    icon: Rss,
    title: "Feed and controls",
    description: "See the familiar scroll view, cross-posting flow, and source-aware interaction model.",
    accent: "text-violet-300",
  },
  {
    href: "/trust",
    icon: ShieldCheck,
    title: "Trust center",
    description: "Review security posture, privacy choices, tokens, permissions, and compliance references.",
    accent: "text-emerald-300",
  },
  {
    href: "/about",
    icon: Sparkles,
    title: "Product vision",
    description: "Understand why Mesh.me exists, how Meshi fits, and how the product adapts to the user.",
    accent: "text-amber-300",
  },
  {
    href: "/privacy",
    icon: Lock,
    title: "Privacy policy",
    description: "Read the user-facing explanation of data collection, storage, export, deletion, and rights.",
    accent: "text-sky-300",
  },
  {
    href: "/terms",
    icon: BarChart3,
    title: "Terms and platform use",
    description: "Review user obligations, third-party platform boundaries, subscriptions, and legal terms.",
    accent: "text-fuchsia-300",
  },
];

export function SiteRouteMap({
  title = "Route map",
  description = "These are the public routes that define the launch surface.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <section className="grid gap-5">
      <div className="max-w-3xl">
        <p className="mesh-kicker mb-3">Route by route</p>
        <h2 className="text-2xl font-bold text-[var(--text-primary)] md:text-3xl">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)] md:text-base">{description}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {routes.map((route) => (
          <Link
            key={route.href}
            href={route.href}
            className="group rounded-2xl border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-5 transition hover:border-[var(--border-hover)] hover:bg-[var(--bg-hover)]"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--accent-muted)] bg-[var(--accent-subtle)]">
                <route.icon className={`h-5 w-5 ${route.accent}`} />
              </div>
              <ArrowRight className="h-4 w-4 text-[var(--text-muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--text-primary)]" />
            </div>
            <h3 className="text-base font-bold text-[var(--text-primary)]">{route.title}</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{route.description}</p>
          </Link>
        ))}
      </div>

      <div className="rounded-2xl border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-5">
        <div className="flex items-start gap-3">
          <MessageCircle className="mt-1 h-5 w-5 text-[var(--accent)]" />
          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Launch UX rule</h3>
            <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
              Every route should answer three questions quickly: where the user is, what they can do here, and what the next best path is.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
