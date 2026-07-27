import type { Metadata } from "next";
import { CheckCircle2, Lock, ShieldCheck, Sparkles } from "lucide-react";
import { PublicSiteShell } from "@/components/layout/public-site-shell";
import { MeshiLogo } from "@/components/meshi/meshi-mascot";
import { SiteRouteMap } from "@/components/marketing/site-route-map";
import { meshBrand } from "@/lib/brand";

export const metadata: Metadata = {
  title: "About",
  description: `${meshBrand.name} is a privacy-first social platform and digital identity hub built around user ownership.`,
};

const principles = [
  "Users own their identity, content, permissions, and connected platform choices.",
  "Useful social features should not require ads, hidden profiling, or data selling.",
  "The product should adapt to the user instead of forcing one rigid interface.",
  "Meshi is the single integrated companion layer, not a generic assistant scattered everywhere.",
  "Every imported action should preserve source credit and route engagement back when APIs allow it.",
];

export default function AboutPage() {
  return (
    <PublicSiteShell maxWidth="max-w-5xl">
      <section className="grid gap-10 lg:grid-cols-[1fr_0.8fr] lg:items-center">
        <div>
          <p className="mesh-kicker mb-4">Why Mesh.me exists</p>
          <h1 className="mesh-title text-4xl leading-tight md:text-6xl">The internet should feel like one world you control.</h1>
          <p className="mesh-copy mt-6 text-base md:text-lg">
            Modern social life is fragmented across feeds, inboxes, creator dashboards, analytics tabs, notification systems, and privacy settings. Mesh.me brings those pieces into one consumer-first environment.
          </p>
        </div>

        <div className="mesh-section p-6">
          <div className="mb-6 flex items-center gap-3">
            <MeshiLogo size={54} color="blue" mood="happy" />
            <div>
              <h2 className="text-xl font-semibold text-[var(--text-primary)]">{meshBrand.meshi.name} stays {meshBrand.meshi.name}</h2>
              <p className="text-sm text-[var(--text-secondary)]">{meshBrand.meshi.visualRule}</p>
            </div>
          </div>
          <p className="text-sm leading-6 text-[var(--text-secondary)]">
            Meshi represents presence inside the Mesh and acts as the private companion for asking questions about your own data. The product avoids generic feature sprawl so Meshi remains recognizable and trustworthy.
          </p>
        </div>
      </section>

      <section className="mt-12 grid gap-4 md:grid-cols-3">
        {[
          { icon: Lock, title: "Private", copy: "Sensitive controls are visible and user-managed." },
          { icon: ShieldCheck, title: "Secure", copy: "Security choices are part of the product architecture, not decoration." },
          { icon: Sparkles, title: "Useful", copy: "Power comes from simplifying the user experience, not increasing noise." },
        ].map((item) => (
          <article key={item.title} className="rounded-2xl border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-5">
            <item.icon className="mb-4 h-5 w-5 text-[var(--accent-text)]" />
            <h2 className="text-base font-semibold text-[var(--text-primary)]">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{item.copy}</p>
          </article>
        ))}
      </section>

      <section className="mt-12 mesh-section p-6">
        <p className="mesh-kicker mb-4">Operating principles</p>
        <div className="grid gap-3">
          {principles.map((principle) => (
            <div key={principle} className="flex items-start gap-3 rounded-xl border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-4">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              <p className="text-sm leading-6 text-[var(--text-secondary)]">{principle}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <SiteRouteMap
          title="Explore the rest of Mesh"
          description="Start with the promise, see how the principles hold up here, then jump straight to whatever answers your next question."
        />
      </section>
    </PublicSiteShell>
  );
}
