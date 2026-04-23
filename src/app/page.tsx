import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  BellRing,
  Lock,
  MessageCircle,
  Network,
  RadioTower,
  ShieldCheck,
  Sparkles,
  Waypoints,
} from "lucide-react";
import { MeshBackground } from "@/components/mesh-background";
import { MeshEntry } from "@/components/mesh-entry";
import { MeshiLogo } from "@/components/meshi/meshi-mascot";

const pillars = [
  {
    icon: Waypoints,
    title: "The Mesh",
    copy: "A living map of your posts, relationships, platforms, comments, and identity.",
  },
  {
    icon: RadioTower,
    title: "The Feed",
    copy: "A familiar scroll experience powered by the same unified data model underneath the Mesh.",
  },
  {
    icon: MessageCircle,
    title: "MeChat",
    copy: "One inbox for conversation, sharing, and the next generation of group browsing together.",
  },
  {
    icon: BarChart3,
    title: "Analytics",
    copy: "Performance, permissions, exports, and privacy controls in one trustworthy control center.",
  },
];

const reasons = [
  "Replace app-switching with one consumer-first home base",
  "Respect source credit and route supported interactions back to origin platforms",
  "Keep privacy, security, and transparency visible in the product itself",
  "Let users shape the interface around how they naturally consume the internet",
];

const launchSignals = [
  { label: "Unified surfaces", value: "4" },
  { label: "Connected worlds", value: "1 app" },
  { label: "Ad-driven compromise", value: "0" },
];

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user?.onboarded) redirect("/mesh");

  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--bg-primary)]">
      <MeshBackground density={92} />
      <div className="pointer-events-none absolute inset-0 mesh-grid-bg opacity-[0.18]" />

      <section className="relative z-10 mx-auto grid min-h-screen max-w-7xl gap-12 px-4 py-6 md:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
        <div className="flex flex-col justify-center">
          <div className="mb-6 flex items-center gap-3">
            <MeshiLogo size={42} color="blue" mood="happy" />
            <div>
              <p className="brand-wordmark text-2xl text-[var(--text-primary)]">
                Mesh<span className="brand-wordmark-accent">.me</span>
              </p>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                Your World, Your Way
              </p>
            </div>
          </div>

          <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-[var(--accent-muted)] bg-[var(--accent-subtle)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
            <Sparkles className="h-3.5 w-3.5" />
            Consumer-first social operating system
          </div>

          <h1 className="max-w-4xl text-5xl font-black leading-[1.02] text-[var(--text-primary)] md:text-7xl">
            One place to own, shape, and navigate your entire online world.
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-7 text-[var(--text-secondary)] md:text-lg">
            Mesh.me is the digital identity hub that unifies posts, likes, comments, followers, messages,
            analytics, permissions, and notifications into one privacy-first experience. It is both a new
            social platform and the control layer for everything you already do online.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="/signup"
              className="brand-button inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white"
            >
              Start your Mesh
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="/features"
              className="inline-flex items-center rounded-xl border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] px-5 py-3 text-sm font-semibold text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
            >
              Explore the product
            </a>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {launchSignals.map((signal) => (
              <div
                key={signal.label}
                className="rounded-2xl border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-4"
              >
                <p className="text-2xl font-black text-[var(--text-primary)]">{signal.value}</p>
                <p className="mt-1 text-xs font-semibold text-[var(--text-muted)]">{signal.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-2">
            {reasons.map((reason) => (
              <div
                key={reason}
                className="rounded-2xl border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] px-4 py-3 text-sm text-[var(--text-secondary)]"
              >
                {reason}
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap gap-4 text-xs text-[var(--text-secondary)]">
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              No ad-driven business model
            </span>
            <span className="inline-flex items-center gap-2">
              <Lock className="h-4 w-4 text-[var(--accent)]" />
              Clear permissions and data controls
            </span>
            <span className="inline-flex items-center gap-2">
              <Network className="h-4 w-4 text-violet-300" />
              Source-aware syncing philosophy
            </span>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-2xl">
          <div className="grid gap-3 md:grid-cols-2">
            {pillars.map((pillar) => (
              <article
                key={pillar.title}
                className="rounded-3xl border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-5 shadow-[var(--shadow-md)]"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-subtle)]">
                  <pillar.icon className="h-5 w-5 text-[var(--accent)]" />
                </div>
                <h2 className="text-base font-bold text-[var(--text-primary)]">{pillar.title}</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{pillar.copy}</p>
              </article>
            ))}
          </div>

          <div className="mt-4 rounded-[1.75rem] border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-4 shadow-[var(--shadow-lg)]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Live product preview
                </p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  The Mesh is the signature experience. The Feed, MeChat, and Analytics make it instantly usable.
                </p>
              </div>
              <div className="rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-300">
                Launch path
              </div>
            </div>
            <div className="mesh-section p-3 md:p-4">
              <MeshEntry />
            </div>
          </div>

          <div className="mt-4 rounded-3xl border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-5">
            <div className="mb-3 flex items-center gap-2">
              <BellRing className="h-4 w-4 text-[var(--accent)]" />
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                Notification unification
              </p>
            </div>
            <p className="text-sm leading-6 text-[var(--text-secondary)]">
              Mesh.me is designed to absorb the noise of fragmented platforms into one clean notification home so
              users can stop being blasted by duplicate alerts across ten apps.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
