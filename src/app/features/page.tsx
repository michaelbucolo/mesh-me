import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, BellRing, Brain, Compass, Lock, MessageCircle, Palette, RadioTower, Rss, Shield, Waypoints } from "lucide-react";
import { PublicSiteShell } from "@/components/layout/public-site-shell";

export const metadata: Metadata = {
  title: "Features | mesh.me",
  description: "Explore Mesh.me features: The Mesh, Feed, MeChat, Analytics, Meshi, privacy controls, and Mesh Pro.",
};

const productAreas = [
  {
    icon: Waypoints,
    title: "The Mesh",
    description: "A live visual map of posts, people, platforms, messages, relationships, and content branches.",
  },
  {
    icon: Rss,
    title: "The Feed",
    description: "A familiar scroll experience that mirrors the Mesh for people who want the internet in a simpler format.",
  },
  {
    icon: MessageCircle,
    title: "MeChat",
    description: "A unified inbox for platform messages, shared posts, and group browsing sessions.",
  },
  {
    icon: BarChart3,
    title: "Analytics",
    description: "Creator-grade insights plus the data, privacy, permission, export, and deletion controls users expect.",
  },
];

const capabilities = [
  { icon: Lock, title: "Private by default", copy: "Encrypted token storage, visible permissions, and account-level privacy controls." },
  { icon: RadioTower, title: "Source-aware syncing", copy: "Interactions can route back to the original platform where provider APIs allow it." },
  { icon: Brain, title: "Meshi only", copy: "AI stays centered in Meshi instead of being scattered through generic product surfaces." },
  { icon: BellRing, title: "Notification hub", copy: "Connected activity is organized in one clean stream instead of ten noisy apps." },
  { icon: Palette, title: "Personal interface", copy: "Users can adapt the experience to Mesh, Feed, creator, or familiar social modes." },
  { icon: Shield, title: "No ad bargain", copy: "Mesh Pro funds optional enhancements without degrading the free product." },
];

export default function FeaturesPage() {
  return (
    <PublicSiteShell>
      <section className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
        <div>
          <p className="mesh-kicker mb-4">Your World, Your Way</p>
          <h1 className="mesh-title text-4xl leading-tight md:text-6xl">One platform for the whole digital footprint.</h1>
        </div>
        <p className="mesh-copy text-base md:text-lg">
          Mesh.me combines a standalone social network with a user-authorized control center for connected platforms. The same data model powers visual exploration, scrolling, messaging, analytics, privacy, and Meshi.
        </p>
      </section>

      <section className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {productAreas.map((area) => (
          <article key={area.title} className="mesh-section p-5">
            <area.icon className="mb-4 h-5 w-5 text-[var(--accent)]" />
            <h2 className="text-base font-bold text-[var(--text-primary)]">{area.title}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{area.description}</p>
          </article>
        ))}
      </section>

      <section className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {capabilities.map((capability) => (
          <article key={capability.title} className="rounded-2xl border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-5">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--accent-muted)] bg-[var(--accent-subtle)]">
              <capability.icon className="h-5 w-5 text-[var(--accent)]" />
            </div>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">{capability.title}</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{capability.copy}</p>
          </article>
        ))}
      </section>

      <section className="mt-12 mesh-section grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <p className="mesh-kicker mb-2">Built for everyone</p>
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">Creators, casual users, and people who need a familiar layout share the same underlying Mesh.</h2>
        </div>
        <Link href="/" className="brand-button inline-flex justify-center rounded-xl px-5 py-3 text-sm font-bold text-white">
          Start with Meshi
        </Link>
      </section>
    </PublicSiteShell>
  );
}
