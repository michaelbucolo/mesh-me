import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Lock,
  MessageCircle,
  Network,
  RadioTower,
  ShieldCheck,
  Sparkles,
  Waypoints,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { PublicSiteShell } from "@/components/layout/public-site-shell";
import { MeshiLogo } from "@/components/meshi/meshi-mascot";

export const metadata: Metadata = {
  title: "Mesh.me | Your World, Your Way",
  description:
    "Mesh.me is a privacy-first digital identity hub that unifies the Mesh, Feed, MeChat, and Analytics in one consumer-first platform.",
};

const pillars = [
  {
    icon: Lock,
    title: "Private by design",
    description:
      "Mesh.me is built to give users clear control over connected accounts, permissions, and what data is visible.",
  },
  {
    icon: ShieldCheck,
    title: "Secure by default",
    description:
      "Security is integrated into architecture decisions and account workflows, not layered on as marketing copy.",
  },
  {
    icon: Sparkles,
    title: "Simple to start",
    description:
      "Onboarding focuses on quick wins: connect accounts, import activity, and immediately experience one unified timeline.",
  },
];

const productAreas = [
  {
    icon: Waypoints,
    title: "The Mesh",
    description:
      "A live interactive map of your digital life where posts, relationships, communities, and interactions are explorable.",
  },
  {
    icon: RadioTower,
    title: "The Feed",
    description:
      "A familiar scroll layer powered by the same unified data model so users can start in a comfortable interface.",
  },
  {
    icon: MessageCircle,
    title: "MeChat",
    description:
      "A unified communication center that preserves source context while reducing cross-platform inbox fragmentation.",
  },
  {
    icon: BarChart3,
    title: "Analytics + Controls",
    description:
      "Creator-grade insights and privacy controls in one place, including visibility, permissions, and sync transparency.",
  },
];

const capabilities = [
  "Connect multiple platforms and manage them from one surface",
  "Post to Mesh.me and distribute across supported destinations",
  "Route engagement back to original platforms when APIs allow",
  "Centralize notifications into one calmer inbox",
  "Use Meshi as your private in-product guide and AI companion",
  "Customize your identity with Meshi accessories and themes",
];

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user?.onboarded) redirect("/mesh");
  if (user && !user.onboarded) redirect("/onboarding");

  return (
    <PublicSiteShell>
      <section className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
        <div>
          <p className="mesh-kicker mb-4">Your World, Your Way</p>
          <h1 className="mesh-title text-4xl leading-tight md:text-6xl">
            One platform for your entire digital life.
          </h1>
          <p className="mesh-copy mt-6 max-w-2xl text-base md:text-lg">
            Mesh.me unifies your posts, messages, interactions, and identity across platforms into one consumer-first
            experience designed to feel safer, cleaner, and more useful than fragmented social apps.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/signup" className="brand-button inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white">
              Create your Mesh
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/features"
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-5 py-3 text-sm font-semibold text-[var(--text-primary)] transition hover:border-[var(--border-hover)]"
            >
              Explore the platform
            </Link>
          </div>
        </div>

        <div className="mesh-section p-6 md:p-7">
          <div className="mb-6 flex items-center gap-4">
            <MeshiLogo size={58} color="blue" mood="happy" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Meshi</p>
              <h2 className="text-xl font-bold text-[var(--text-primary)]">The face of Mesh.me</h2>
            </div>
          </div>
          <p className="text-sm leading-6 text-[var(--text-secondary)]">
            Meshi stays simple and recognizable: bubbly, two eyes, no mouth. Meshi represents your presence in the
            Mesh and serves as your only deeply integrated AI companion.
          </p>
          <div className="mt-5 rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4 text-sm text-[var(--text-secondary)]">
            <p className="font-semibold text-[var(--text-primary)]">No ad-driven model</p>
            <p className="mt-2">Mesh.me is monetized through optional Mesh Pro enhancements, not surveillance advertising.</p>
          </div>
        </div>
      </section>

      <section className="mt-12 grid gap-4 md:grid-cols-3">
        {pillars.map((pillar) => (
          <article key={pillar.title} className="rounded-2xl border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-5">
            <pillar.icon className="mb-3 h-5 w-5 text-[var(--accent)]" />
            <h2 className="text-base font-bold text-[var(--text-primary)]">{pillar.title}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{pillar.description}</p>
          </article>
        ))}
      </section>

      <section className="mt-12">
        <div className="mb-5 flex items-center gap-2">
          <Network className="h-5 w-5 text-[var(--accent)]" />
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Core platform sections</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {productAreas.map((area) => (
            <article key={area.title} className="mesh-section p-5">
              <area.icon className="mb-4 h-5 w-5 text-[var(--accent)]" />
              <h3 className="text-base font-bold text-[var(--text-primary)]">{area.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{area.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-12 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <article className="mesh-section p-6">
          <p className="mesh-kicker mb-3">What you can do</p>
          <div className="grid gap-2">
            {capabilities.map((capability) => (
              <div key={capability} className="flex items-start gap-2 rounded-xl border border-[var(--border-primary)] px-3 py-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <p className="text-sm text-[var(--text-secondary)]">{capability}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="mesh-section p-6">
          <p className="mesh-kicker mb-3">Launch principle</p>
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">The product should adapt to people, not force people to adapt to the product.</h2>
          <p className="mt-4 text-sm leading-6 text-[var(--text-secondary)]">
            Mesh.me supports multiple experience styles so creators, everyday consumers, and less technical users can use
            the same unified ecosystem in the way that feels best for them.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/about" className="rounded-xl border border-[var(--border-primary)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] transition hover:border-[var(--border-hover)]">
              Why Mesh.me
            </Link>
            <Link href="/trust" className="rounded-xl border border-[var(--border-primary)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] transition hover:border-[var(--border-hover)]">
              Security & trust
            </Link>
          </div>
        </article>
      </section>

      <section className="mt-12 rounded-3xl border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-6 md:p-8">
        <p className="mesh-kicker mb-2">Ready to start</p>
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">Build your unified digital identity with Mesh.me.</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
          Connect what you use, control what you share, and navigate your online world from one place.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/signup" className="brand-button inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white">
            Sign up free
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/login" className="rounded-xl border border-[var(--border-primary)] px-5 py-3 text-sm font-semibold text-[var(--text-primary)] transition hover:border-[var(--border-hover)]">
            Log in
          </Link>
        </div>
      </section>
    </PublicSiteShell>
  );
}
