import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BellRing,
  Brain,
  Compass,
  Crown,
  Lock,
  MessageCircle,
  Palette,
  RadioTower,
  Shield,
  Users,
  Waypoints,
} from "lucide-react";
import { PublicSiteShell } from "@/components/layout/public-site-shell";
import { SiteRouteMap } from "@/components/marketing/site-route-map";
import { meshBrand } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Features",
  description: `Explore ${meshBrand.name} product areas, launch philosophy, interface modes, and Mesh Pro.`,
};

const productAreas = [
  {
    icon: Waypoints,
    title: "The Mesh",
    description: "A live explorable internet map that turns posts, people, communities, and relationships into a navigable world.",
  },
  {
    icon: RadioTower,
    title: "The Feed",
    description: "A familiar scroll-based layer for people who want instant usability without losing the unified model underneath.",
  },
  {
    icon: MessageCircle,
    title: "MeChat",
    description: "One communication home for threads, shares, platform context, and future shared browsing sessions.",
  },
  {
    icon: BarChart3,
    title: "Analytics",
    description: "Creator-grade insights plus exports, privacy, permissions, and transparent data controls.",
  },
];

const capabilityRows = [
  {
    icon: Lock,
    title: "Private by default",
    copy: "Mesh.me should feel safer than legacy platforms because user control is a product requirement, not a legal afterthought.",
  },
  {
    icon: BellRing,
    title: "Notification cleanup",
    copy: "Connected platforms funnel into one calmer notification center so your digital life stops feeling noisy and fragmented.",
  },
  {
    icon: Brain,
    title: "Meshi is the only deep companion layer",
    copy: "Intelligence stays centered in Meshi so the product avoids generic clutter while still giving users a smart private companion.",
  },
  {
    icon: Shield,
    title: "Consumer-first business model",
    copy: "The platform is designed around optional Mesh Pro value instead of ads, surveillance, or degrading the free experience.",
  },
];

const interfaceModes = [
  {
    title: "Mesh-native",
    audience: "Power users and explorers",
    copy: "Live inside the visual web and manage your digital identity spatially.",
  },
  {
    title: "Creator mode",
    audience: "Growth-minded users",
    copy: "Lead with analytics, control center workflows, and source-aware distribution.",
  },
  {
    title: "Familiar feed mode",
    audience: "Everyday consumers",
    copy: "Scroll in a recognizable layout while still benefiting from the same unified backend.",
  },
  {
    title: "Comfort-first mode",
    audience: "Less technical users",
    copy: "Present the internet in a calmer, more familiar style without losing access to connected content.",
  },
];

const meshProItems = [
  "Deeper creator analytics and professional controls",
  "More Meshi accessories, colors, and identity customization",
  "Expanded app theming and visual personalization",
  "Advanced Mesh styling without locking away the core product",
];

export default function FeaturesPage() {
  return (
    <PublicSiteShell>
      <section className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-end">
        <div>
          <p className="mesh-kicker mb-4">Product vision</p>
          <h1 className="mesh-title text-4xl leading-tight md:text-6xl">
            The internet should feel like one world, not ten disconnected apps.
          </h1>
        </div>
        <p className="mesh-copy text-base md:text-lg">
          Mesh.me combines a standalone social network with a user-authorized control center for the rest of your digital life. One product model powers the Mesh, the Feed, MeChat, Analytics, connected accounts, and Meshi.
        </p>
      </section>

      <section className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {productAreas.map((area) => (
          <article key={area.title} className="mesh-section p-5">
            <area.icon className="mb-4 h-5 w-5 text-[var(--accent)]" />
            <h2 className="text-base font-bold text-[var(--text-primary)]">{area.title}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{area.description}</p>
          </article>
        ))}
      </section>

      <section className="mt-12 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
            What makes Mesh.me different
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {capabilityRows.map((capability) => (
              <article key={capability.title} className="rounded-2xl border border-[var(--border-primary)] p-4">
                <capability.icon className="mb-3 h-5 w-5 text-[var(--accent)]" />
                <h3 className="text-sm font-bold text-[var(--text-primary)]">{capability.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{capability.copy}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-6">
          <div className="mb-5 flex items-center gap-2">
            <Palette className="h-5 w-5 text-[var(--accent)]" />
            <h2 className="text-lg font-bold text-[var(--text-primary)]">Interface adaptability</h2>
          </div>
          <div className="space-y-3">
            {interfaceModes.map((mode) => (
              <div key={mode.title} className="rounded-2xl border border-[var(--border-primary)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-[var(--text-primary)]">{mode.title}</h3>
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                      {mode.audience}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{mode.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-12 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <article className="mesh-section p-6">
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-[var(--accent)]" />
            <h2 className="text-lg font-bold text-[var(--text-primary)]">Built for different kinds of people</h2>
          </div>
          <p className="text-sm leading-6 text-[var(--text-secondary)]">
            Mesh.me is meant to work for creators, casual users, and people who need a calmer, more familiar layout. The product adapts to the person instead of forcing every user into one rigid social pattern.
          </p>
        </article>

        <article className="mesh-section p-6">
          <div className="mb-4 flex items-center gap-2">
            <Compass className="h-5 w-5 text-[var(--accent)]" />
            <h2 className="text-lg font-bold text-[var(--text-primary)]">Cross-platform philosophy</h2>
          </div>
          <p className="text-sm leading-6 text-[var(--text-secondary)]">
            When supported by provider APIs and permissions, Mesh.me is designed to route interactions back to the original source so creators keep credit and the connected web stays fair.
          </p>
        </article>
      </section>

      <section className="mt-12 rounded-3xl border border-[var(--accent)]/20 bg-[var(--accent)]/5 p-6">
        <div className="mb-4 flex items-center gap-2">
          <Crown className="h-5 w-5 text-[var(--accent)]" />
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Mesh Pro</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {meshProItems.map((item) => (
            <div
              key={item}
              className="rounded-2xl border border-[var(--accent)]/15 bg-[var(--bg-secondary)] px-4 py-3 text-sm text-[var(--text-secondary)]"
            >
              {item}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12 grid gap-4 lg:grid-cols-3">
        {[
          {
            title: "Launch path",
            copy: "Feed, Mesh, MeChat, Analytics, and the public trust pages now cross-link more directly so users can orient themselves without guessing where to go next.",
          },
          {
            title: "Interface strategy",
            copy: "The UX pass prioritizes quick comprehension on public pages, then progressively hands off to richer product surfaces after signup and onboarding.",
          },
          {
            title: "What stays fixed",
            copy: "Meshi remains visually stable so the mascot still feels like the constant identity anchor through the rest of the product.",
          },
        ].map((item) => (
          <article key={item.title} className="rounded-2xl border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-5">
            <h3 className="text-base font-bold text-[var(--text-primary)]">{item.title}</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{item.copy}</p>
          </article>
        ))}
      </section>

      <section className="mt-12">
        <SiteRouteMap
          title="See how the pieces fit together"
          description="Compare Mesh, Feed, MeChat, and Analytics, then dig into the trust and policy routes to see how they work."
        />
      </section>

      <section className="mt-12 mesh-section grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <p className="mesh-kicker mb-2">Launch direction</p>
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">
            Mesh.me is trying to become the cleanest, safest place to manage your whole online identity.
          </h2>
        </div>
        <Link href="/signup" className="brand-button inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white">
          Start with Meshi <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </PublicSiteShell>
  );
}
