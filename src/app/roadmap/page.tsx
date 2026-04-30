import type { Metadata } from "next";
import Link from "next/link";
import {
  Archive,
  ArrowRight,
  BarChart3,
  Bell,
  CheckCircle2,
  Glasses,
  LockKeyhole,
  MessageCircle,
  Mic,
  Network,
  Rss,
  ShieldCheck,
  Sparkles,
  Store,
  UsersRound,
  Waypoints,
} from "lucide-react";
import { PublicSiteShell } from "@/components/layout/public-site-shell";
import { meshBrand } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Roadmap",
  description:
    `${meshBrand.name} launch-ready product definition and expansion roadmap for Mesh, Feed, MeChat, Analytics, Meshi, Vault, Spaces, Marketplace, and visionOS.`,
};

const launchFeatures = [
  { icon: ShieldCheck, title: "Secure accounts", copy: "Account creation, login, account-only app access, session protection, and privacy-first defaults." },
  { icon: Network, title: "The Mesh", copy: "A protected visual dashboard for the user's digital footprint, relationships, posts, and connected sources." },
  { icon: Rss, title: "The Feed", copy: "A familiar scroll surface backed by the same unified content and source-aware data model." },
  { icon: MessageCircle, title: "MeChat", copy: "Unified messages, shared post context, and the foundation for group browsing sessions." },
  { icon: BarChart3, title: "Analytics", copy: "Creator insights, activity summaries, exports, permissions, privacy controls, and security posture." },
  { icon: Sparkles, title: "Meshi", copy: "The mascot, user representative, customizable identity layer, and only deeply integrated AI companion." },
  { icon: Bell, title: "Notifications", copy: "A central notification hub designed to reduce noise and eventually replace native app alerts." },
  { icon: LockKeyhole, title: "Data controls", copy: "Clear connected-account permissions, export, deletion, visibility, and no ad-based data exploitation." },
];

const expansionFeatures = [
  { icon: Archive, title: "Mesh Vault", copy: "A private archive for saved posts, messages, milestones, creator references, and memories." },
  { icon: UsersRound, title: "Collaborative Spaces", copy: "Shared Mesh areas for families, friend groups, teams, communities, and events." },
  { icon: Mic, title: "Meshi Voice", copy: "Hands-free interaction with Meshi for search, navigation, analytics, messaging, and privacy checks." },
  { icon: Store, title: "Mesh Marketplace", copy: "Creator packs, Meshi accessories, themes, templates, memberships, and digital goods without ads." },
  { icon: Glasses, title: "visionOS Mesh", copy: "A spatial version of the Mesh where Meshi and the user's digital universe become immersive." },
  { icon: Waypoints, title: "Deeper sync", copy: "More providers, richer interaction syncing, cross-platform posting, and source-respecting automation." },
];

const userTypes = [
  "Casual users who want one clean feed and inbox.",
  "Creators who need unified analytics and content control.",
  "Families and older users who need familiar, calm layouts.",
  "Friend groups that want MeChat, shared scrolling, and spaces.",
  "Power users who want the full Mesh, customization, and privacy controls.",
];

export default function RoadmapPage() {
  return (
    <PublicSiteShell maxWidth="max-w-6xl">
      <section className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-end">
        <div>
          <p className="mesh-kicker mb-4">Launch roadmap</p>
          <h1 className="mesh-title text-4xl leading-tight md:text-6xl">
            Mesh.me launches as an account-only social hub, then expands into the full digital world.
          </h1>
        </div>
        <div className="mesh-section p-6">
          <p className="text-sm leading-6 text-[var(--text-secondary)] md:text-base">
            The product promise is broad, but the launch path stays practical: secure account access, Meshi identity, Mesh, Feed, MeChat, Analytics, notifications, connected accounts, and privacy controls first. Expansion features add more power without weakening the no-ads, no-data-selling model.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/signup" className="brand-button inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white">
              Create account <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/trust" className="rounded-xl border border-[var(--border-primary)] px-5 py-3 text-sm font-semibold text-[var(--text-primary)]">
              Review trust model
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-12">
        <div className="mb-5 max-w-3xl">
          <p className="mesh-kicker mb-3">Core launch features</p>
          <h2 className="text-2xl font-bold text-[var(--text-primary)] md:text-3xl">What must feel real first</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {launchFeatures.map((feature) => (
            <article key={feature.title} className="mesh-section p-5">
              <feature.icon className="mb-4 h-5 w-5 text-[var(--accent)]" />
              <h3 className="text-base font-bold text-[var(--text-primary)]">{feature.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{feature.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <div className="mb-5 max-w-3xl">
          <p className="mesh-kicker mb-3">Expansion features</p>
          <h2 className="text-2xl font-bold text-[var(--text-primary)] md:text-3xl">What the platform grows into</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {expansionFeatures.map((feature) => (
            <article key={feature.title} className="rounded-2xl border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-5">
              <feature.icon className="mb-4 h-5 w-5 text-[var(--accent)]" />
              <h3 className="text-base font-bold text-[var(--text-primary)]">{feature.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{feature.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-12 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <article className="mesh-section p-6">
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">Who Mesh.me is for</h2>
          <div className="mt-5 grid gap-3">
            {userTypes.map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                <p className="text-sm leading-6 text-[var(--text-secondary)]">{item}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="mesh-section p-6">
          <p className="mesh-kicker mb-3">Non-negotiables</p>
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">What Mesh.me should never become</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {["No ads", "No data selling", "No hidden AI sprawl", "No creator-credit theft", "No cluttered settings maze", "No one-size-fits-all interface"].map((item) => (
              <div key={item} className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm font-semibold text-emerald-100">
                {item}
              </div>
            ))}
          </div>
        </article>
      </section>
    </PublicSiteShell>
  );
}
