import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { BarChart3, BellRing, Lock, MessageCircle, RadioTower, Rss, ShieldCheck, Sparkles, Waypoints } from "lucide-react";
import { MeshBackground } from "@/components/mesh-background";
import { MeshEntry } from "@/components/mesh-entry";
import { MeshiLogo } from "@/components/meshi/meshi-mascot";

const pillars = [
  { icon: Waypoints, label: "The Mesh", copy: "A living map of posts, people, platforms, and relationships." },
  { icon: Rss, label: "Feed", copy: "The same unified world in a familiar scroll format." },
  { icon: MessageCircle, label: "MeChat", copy: "Messages, shares, and group browsing in one inbox." },
  { icon: BarChart3, label: "Analytics", copy: "Performance, permissions, exports, and privacy controls." },
];

const signals = [
  { label: "Connected sources", value: "8", tone: "text-cyan-300" },
  { label: "Synced interactions", value: "14.2k", tone: "text-violet-300" },
  { label: "Private controls", value: "100%", tone: "text-emerald-300" },
];

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user?.onboarded) redirect("/mesh");

  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--bg-primary)]">
      <MeshBackground density={92} />
      <div className="pointer-events-none absolute inset-0 mesh-grid-bg opacity-[0.2]" />

      <section className="relative z-10 grid min-h-screen gap-8 px-4 py-5 md:px-8 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:gap-10">
        <div className="flex min-h-[calc(100vh-2.5rem)] flex-col justify-between">
          <header className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <MeshiLogo size={42} color="blue" mood="happy" />
              <div>
                <p className="brand-wordmark text-2xl text-[var(--text-primary)]">
                  Mesh<span className="brand-wordmark-accent">.me</span>
                </p>
                <p className="text-xs font-semibold text-[var(--text-muted)]">Your World, Your Way</p>
              </div>
            </div>
            <div className="hidden items-center gap-2 md:flex">
              <a href="/features" className="mesh-command px-3">Features</a>
              <a href="/trust" className="mesh-command px-3">Trust</a>
            </div>
          </header>

          <div className="max-w-3xl py-10">
            <p className="mesh-kicker mb-4">Privacy-first social operating system</p>
            <h1 className="mesh-title text-5xl leading-[1.02] md:text-7xl">
              One app for your whole digital world.
            </h1>
            <p className="mesh-copy mt-6 max-w-2xl text-base md:text-lg">
              Mesh.me unifies posts, messages, followers, comments, analytics, notifications, permissions, and identity into one consumer-first experience.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {signals.map((signal) => (
                <div key={signal.label} className="rounded-2xl border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-4">
                  <p className={`text-2xl font-black ${signal.tone}`}>{signal.value}</p>
                  <p className="mt-1 text-xs font-semibold text-[var(--text-muted)]">{signal.label}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {pillars.map((pillar) => (
                <div key={pillar.label} className="mesh-section p-4">
                  <pillar.icon className="mb-3 h-5 w-5 text-[var(--accent)]" />
                  <h2 className="text-sm font-bold text-[var(--text-primary)]">{pillar.label}</h2>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{pillar.copy}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 pb-3 text-xs text-[var(--text-secondary)] sm:grid-cols-3">
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              No ad-driven model
            </span>
            <span className="inline-flex items-center gap-2">
              <Lock className="h-4 w-4 text-[var(--accent)]" />
              Transparent controls
            </span>
            <span className="inline-flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-300" />
              Meshi is the AI layer
            </span>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-xl">
          <div className="mb-4 grid grid-cols-3 gap-2">
            {[
              ["Mesh", Waypoints],
              ["Sync", RadioTower],
              ["Alerts", BellRing],
            ].map(([label, Icon]) => {
              const IconComponent = Icon as typeof Waypoints;
              return (
                <div key={label as string} className="rounded-2xl border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-3 text-center">
                  <IconComponent className="mx-auto mb-1 h-4 w-4 text-[var(--accent)]" />
                  <p className="text-[11px] font-bold text-[var(--text-secondary)]">{label as string}</p>
                </div>
              );
            })}
          </div>

          <div className="mesh-section p-3 md:p-4">
            <MeshEntry />
          </div>

          <div className="mt-4 rounded-2xl border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Source credit preserved</p>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              Connected content stays labeled by origin, and supported actions are designed to route engagement back through the user-authorized source.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
