import Link from "next/link";
import { ArrowRight, Bell, BarChart3, MessageCircle, Network, Sparkles } from "lucide-react";
import { MeshiBrandLockup } from "@/components/meshi/meshi-identity";
import { MeshiMascot } from "@/components/meshi/meshi-mascot";

const coreRoutes = [
  { href: "/mesh", label: "Mesh", body: "Your online world.", icon: Network, tone: "from-cyan-300/24 to-blue-500/10" },
  { href: "/feed", label: "Feed", body: "Scroll everything.", icon: Sparkles, tone: "from-pink-300/22 to-fuchsia-500/10" },
  { href: "/messages", label: "MeChat", body: "One inbox.", icon: MessageCircle, tone: "from-emerald-300/22 to-cyan-500/10" },
  { href: "/analytics", label: "Analytics", body: "Know and control.", icon: BarChart3, tone: "from-amber-200/22 to-orange-500/10" },
  { href: "/connected-accounts", label: "Connect", body: "Only with permission.", icon: Sparkles, tone: "from-violet-300/22 to-indigo-500/10" },
  { href: "/super-app", label: "Apps", body: "Replace the clutter.", icon: Bell, tone: "from-lime-200/18 to-emerald-500/10" },
];

const publicRoutes = [
  { href: "/features", label: "Features" },
  { href: "/vision", label: "Vision" },
  { href: "/trust", label: "Trust" },
  { href: "/privacy", label: "Privacy" },
];

const orbitNodes = [
  { label: "YouTube", className: "left-[12%] top-[20%]" },
  { label: "Instagram", className: "right-[10%] top-[18%]" },
  { label: "MeChat", className: "left-[6%] bottom-[26%]" },
  { label: "Analytics", className: "right-[12%] bottom-[22%]" },
  { label: "Privacy", className: "left-[30%] bottom-[5%]" },
  { label: "Security", className: "right-[28%] bottom-[6%]" },
];

const replacementCategories = [
  { label: "Social feeds", examples: "Instagram, Facebook, X, Threads, Bluesky" },
  { label: "Video and creators", examples: "YouTube, TikTok, Twitch, Reels, Shorts" },
  { label: "Messaging and calls", examples: "Discord, Messenger, WhatsApp, Telegram, Signal" },
  { label: "Communities", examples: "Discord servers, Facebook Groups, Reddit, fan spaces" },
  { label: "Creator dashboards", examples: "YouTube Studio, TikTok analytics, insights tools" },
  { label: "Notifications", examples: "Likes, comments, messages, follows, security alerts" },
];

export function MeshOS() {
  return (
    <main className="mesh-aurora public-mesh-os min-h-dvh overflow-x-hidden text-[var(--text-primary)]">
      <div className="pointer-events-none fixed inset-0 mesh-soft-grid" aria-hidden="true" />

      <div className="spatial-public-container relative mx-auto flex min-h-dvh max-w-[86rem] flex-col px-4 py-5 md:px-6 xl:px-8">
        <header className="mesh-pop-in flex items-center justify-between gap-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)]/72 px-3 py-3 backdrop-blur md:gap-4 md:px-4">
          <MeshiBrandLockup href="/" size={32} label="Mesh.me" subtitle="Your World, Your Way" className="font-semibold" />
          <nav className="hidden items-center gap-2 text-sm text-[var(--text-secondary)] sm:flex">
            {publicRoutes.map((route) => (
              <Link key={route.href} href={route.href} className="mesh-pressable rounded-md px-3 py-2 hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]">
                {route.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="mesh-action mesh-action-secondary px-3 text-sm">
              Log in
            </Link>
            <Link href="/signup" className="hidden mesh-action mesh-action-primary px-3 text-sm sm:inline-flex">
              Create account
            </Link>
          </div>
        </header>

        <section className="grid flex-1 content-center gap-6 py-6 sm:gap-8 sm:py-8 md:grid-cols-[minmax(0,1fr)_22rem] md:items-center lg:grid-cols-[minmax(0,1fr)_31rem] lg:py-12 xl:grid-cols-[minmax(0,1fr)_34rem]">
          <div className="mesh-pop-in mesh-delay-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-primary)] bg-[var(--bg-primary)]/70 px-3 py-2 text-sm text-[var(--text-secondary)]">
              <span className="mesh-live-dot" aria-hidden="true" />
              Account required. No ads.
            </div>
            <h1 className="mt-4 max-w-4xl text-4xl font-bold leading-[1.02] tracking-[0] sm:mt-5 sm:text-5xl lg:text-6xl xl:text-7xl">
              The internet, rebuilt around <span className="mesh-gradient-text">you.</span>
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-[var(--text-secondary)] sm:mt-5 md:text-lg">
              One account for your feed, messages, identity, analytics, privacy controls, and Meshi.
            </p>
            <div className="mt-6 grid gap-2 sm:mt-8 sm:flex sm:flex-wrap sm:gap-3">
              <Link href="/signup" className="mesh-action mesh-action-primary w-full px-5 text-sm sm:w-auto">
                Create account
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <Link href="/login" className="mesh-action mesh-action-secondary w-full px-5 text-sm sm:w-auto">
                Log in
              </Link>
            </div>
            <div className="mt-4 flex max-w-xl flex-wrap gap-2 text-xs font-bold text-[var(--text-secondary)] sm:mt-5">
              {["Private by default", "No data selling", "Clear permissions"].map((item) => (
                <span key={item} className="mesh-step rounded-md px-3 py-2">{item}</span>
              ))}
            </div>
          </div>

          <div className="spatial-orbit-card mesh-pop-in mesh-delay-2 relative min-h-[18rem] overflow-hidden sm:min-h-[22rem] md:min-h-[24rem] lg:min-h-[28rem] xl:min-h-[31rem]">
            <div className="absolute inset-0 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)]/48" />
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 500 500" role="img" aria-label="Animated Mesh.me identity map">
              <path className="mesh-trace" d="M250 250 C130 130 110 250 80 370" fill="none" stroke="rgba(155,232,255,0.7)" strokeWidth="2" />
              <path className="mesh-trace" d="M250 250 C360 90 430 145 430 250" fill="none" stroke="rgba(255,154,192,0.62)" strokeWidth="2" />
              <path className="mesh-trace" d="M250 250 C350 360 260 420 190 455" fill="none" stroke="rgba(184,247,212,0.62)" strokeWidth="2" />
              <path className="mesh-trace" d="M250 250 C150 320 260 390 430 385" fill="none" stroke="rgba(255,225,140,0.5)" strokeWidth="2" />
            </svg>
            <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center">
              <span className="lg:hidden">
                <MeshiMascot size={92} color="blue" mood="happy" showGlow interactive bouncy />
              </span>
              <span className="hidden lg:inline-flex">
                <MeshiMascot size={116} color="blue" mood="happy" showGlow interactive bouncy />
              </span>
              <span className="mt-4 rounded-full border border-[var(--border-primary)] bg-[var(--bg-primary)] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]">
                Meshi represents you
              </span>
            </div>
            {orbitNodes.map((node, index) => (
              <div
                key={node.label}
                className={`mesh-pressable absolute ${node.className} ${index > 3 ? "hidden sm:block" : ""} rounded-md border border-[var(--border-primary)] bg-[var(--bg-secondary)]/88 px-2 py-1.5 text-[11px] shadow-lg backdrop-blur sm:px-3 sm:py-2 sm:text-sm`}
                style={{ animation: `meshFloat ${5 + index * 0.5}s ease-in-out infinite`, animationDelay: `${index * 0.28}s` }}
              >
                {node.label}
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-3 pb-10 sm:grid-cols-2 md:grid-cols-3">
          {coreRoutes.map((route, index) => {
            const Icon = route.icon;

            return (
              <Link
                key={route.href}
                href={route.href}
                className={`mesh-surface mesh-glow-border mesh-pressable mesh-pop-in mesh-delay-${Math.min(index + 1, 4)} rounded-lg p-4`}
              >
                <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-md bg-gradient-to-br ${route.tone}`}>
                  <Icon size={20} aria-hidden="true" />
                </div>
                <h2 className="text-base font-bold">{route.label}</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{route.body}</p>
              </Link>
            );
          })}
        </section>

        <section className="grid gap-5 pb-10 md:grid-cols-[0.9fr_1.1fr] md:items-start">
          <div className="mesh-pop-in">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">Replacement goal</p>
            <h2 className="mt-3 text-3xl font-bold leading-tight md:text-5xl">
              Built to reduce the daily need for the top social and communication apps.
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-6 text-[var(--text-secondary)] md:text-base">
              Mesh.me does not need to clone every app. It needs to combine the behaviors people actually repeat every day:
              scrolling, posting, messaging, sharing, saving, analyzing, and controlling their identity.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/super-app" className="mesh-action mesh-action-primary px-5 text-sm">
                Open replacement planner
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <Link href="/features" className="mesh-action mesh-action-secondary px-5 text-sm">
                See features
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {replacementCategories.map((category) => (
              <article key={category.label} className="mesh-surface mesh-pressable rounded-lg p-4">
                <h3 className="text-base font-bold">{category.label}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{category.examples}</p>
              </article>
            ))}
          </div>
        </section>

        <footer className="border-t border-[var(--border-primary)] py-5 text-sm text-[var(--text-muted)]">
          Privacy and security first. No ads. No secret selling. Account required before entering Mesh.me.
        </footer>
      </div>
    </main>
  );
}
