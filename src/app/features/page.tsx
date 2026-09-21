import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BellRing,
  Brain,
  Crown,
  Lock,
  MessageCircle,
  Palette,
  RadioTower,
  Shield,
  Waypoints,
} from "lucide-react";
import { PublicSiteShell } from "@/components/layout/public-site-shell";
import { SiteRouteMap } from "@/components/marketing/site-route-map";
import { meshBrand } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Features",
  description: `Explore ${meshBrand.name} product areas, launch philosophy, interface modes, and MeshPro.`,
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
    copy: "The platform is designed around optional MeshPro value instead of ads, surveillance, or degrading the free experience.",
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
    <PublicSiteShell sectionLabel="A world of possibilities" maxWidth="max-w-6xl">
      <section className="public-editorial-hero public-feature-hero">
        <div>
          <p className="mesh-kicker mb-4">Your people. Your interests. Your Mesh.</p>
          <h1 className="mesh-title">All your worlds.<br />A little closer.</h1>
        </div>
        <div className="public-feature-intro">
          <p className="mesh-copy">A social home of your own, with a familiar feed, real conversations, and a whole new way to explore the connections between them.</p>
          <Link href="/explore" className="public-join-link">Take a look around <ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
      </section>

      <section className="public-feature-grid" aria-label="Explore the product">
        {productAreas.map((area, index) => (
          <Link key={area.title} href={["/mesh", "/feed", "/messages", "/analytics"][index]} className="public-feature-tile">
            <div className="public-feature-tile-top"><span>{String(index + 1).padStart(2, "0")}</span><area.icon size={22} strokeWidth={1.4} aria-hidden="true" /></div>
            <div><h2>{area.title}</h2><p>{area.description}</p></div>
            <span className="public-feature-tile-link">Explore {area.title}<ArrowRight size={16} aria-hidden="true" /></span>
          </Link>
        ))}
      </section>

      <section className="public-feature-principles">
        <div className="public-feature-section-heading"><p className="public-kicker">Built around you</p><h2>Less noise.<br />More of what matters.</h2></div>
        <div className="public-feature-principle-list">
          {capabilityRows.map((capability) => (
            <article key={capability.title}><capability.icon size={20} strokeWidth={1.4} aria-hidden="true" /><div><h3>{capability.title}</h3><p>{capability.copy}</p></div></article>
          ))}
        </div>
      </section>

      <section className="public-panel public-feature-layouts">
        <div className="public-feature-section-heading"><Palette size={22} aria-hidden="true" /><h2>Find your rhythm.</h2><p>Start with a view that feels familiar. Explore the rest when you feel like it.</p></div>
        <div className="public-feature-mode-list">{interfaceModes.map((mode) => <article key={mode.title}><h3>{mode.title}</h3><p>{mode.copy}</p></article>)}</div>
      </section>

      <section className="public-feature-pro public-panel">
        <div><p className="public-kicker"><Crown size={16} aria-hidden="true" /> MeshPro</p><h2>A little more you.</h2><p>Optional tools and personal touches. Your core social experience stays open.</p><Link href="/pricing" className="public-login-link">Explore MeshPro <ArrowRight size={15} aria-hidden="true" /></Link></div>
        <ul>{meshProItems.map((item) => <li key={item}><span aria-hidden="true" />{item}</li>)}</ul>
      </section>

      <section className="public-feature-source-note"><Shield size={18} aria-hidden="true" /><p>Connected platform features depend on each provider’s APIs and your permissions. Source credit stays visible, and supported interactions link back to the original platform.</p></section>
      <section><SiteRouteMap title="Make yourself at home" description="Get to know Mesh.me, see your privacy choices, and find answers along the way." /></section>
    </PublicSiteShell>
  );
}

// Prerendered HTML freezes build-time markup while the proxy stamps a fresh CSP
// nonce per request — every script on the cached page was refused (~25 console
// errors, zero hydration; journey audit). Per-request rendering lets Next stamp
// the live nonce onto its scripts, the same way every dynamic page already works.
export const dynamic = "force-dynamic";
