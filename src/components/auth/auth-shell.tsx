import Link from "next/link";
import type { ReactNode } from "react";
import { Lock, ShieldCheck, Waypoints } from "lucide-react";
import { MeshBackground } from "@/components/mesh-background";
import { MeshiLogo } from "@/components/meshi/meshi-mascot";

export function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--bg-primary)]">
      <MeshBackground density={58} className="opacity-30" />
      <div className="pointer-events-none absolute inset-0 mesh-grid-bg opacity-[0.14]" />

      <div className="relative z-10 grid min-h-screen gap-10 px-4 py-6 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:px-8">
        <section className="flex min-h-[16rem] flex-col justify-between rounded-[2rem] border border-[var(--glass-card-border)] bg-[linear-gradient(180deg,rgba(0,210,255,0.08),transparent_35%),var(--glass-card-bg)] p-6 md:p-8">
          <div>
            <Link href="/" className="inline-flex items-center gap-3">
              <MeshiLogo size={38} color="blue" mood="happy" />
              <div>
                <p className="brand-wordmark text-xl text-[var(--text-primary)]">
                  Mesh<span className="brand-wordmark-accent">.me</span>
                </p>
                <p className="text-xs font-semibold text-[var(--text-muted)]">Your World, Your Way</p>
              </div>
            </Link>
          </div>

          <div className="max-w-xl py-8">
            <p className="mesh-kicker mb-4">Account access</p>
            <h1 className="text-4xl font-bold text-[var(--text-primary)] md:text-5xl">{title}</h1>
            <p className="mt-4 text-sm leading-7 text-[var(--text-secondary)] md:text-base">{description}</p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {[
              { icon: Lock, title: "Private login", copy: "Account recovery, verification, and platform tokens stay under user control." },
              { icon: ShieldCheck, title: "Trust first", copy: "The same privacy model follows the user from signup into settings and analytics." },
              { icon: Waypoints, title: "Fast entry", copy: "Join quickly, then grow the Mesh after account creation instead of front-loading complexity." },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-4">
                <item.icon className="mb-3 h-4 w-4 text-[var(--accent)]" />
                <h2 className="text-sm font-bold text-[var(--text-primary)]">{item.title}</h2>
                <p className="mt-2 text-xs leading-6 text-[var(--text-secondary)]">{item.copy}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="relative">{children}</section>
      </div>
    </main>
  );
}
