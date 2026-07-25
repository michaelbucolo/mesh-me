import type { CSSProperties, ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { MeshiBrandLockup } from "@/components/meshi/meshi-identity";
import { meshBrand } from "@/lib/brand";

const trustChips = ["Account required", "No ads", "Private by default"];

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
    <main className="mesh-aurora auth-shell relative isolate h-dvh max-h-dvh min-h-0 overflow-hidden text-[var(--text-primary)]">
      <div className="pointer-events-none fixed inset-0 mesh-soft-grid mesh-soft-grid-elegant" aria-hidden="true" />
      <div className="pointer-events-none fixed inset-0 mesh-shell-vignette" aria-hidden="true" />
      <div className="auth-shell-grid relative z-10 mx-auto grid h-full min-h-0 w-full max-w-6xl grid-cols-1 content-center gap-4 overflow-hidden px-4 py-3 sm:gap-5 md:grid-cols-[0.68fr_1fr] md:items-center md:px-6 lg:grid-cols-[0.78fr_1fr] lg:gap-10 xl:px-8">
        <section className="mesh-pop-in min-w-0">
          <MeshiBrandLockup href="/" size={32} label={meshBrand.name} subtitle={`${meshBrand.meshi.name} is your identity`} className="text-base sm:text-lg" />
          <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-[var(--accent)]/25 bg-[var(--accent)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--accent)] sm:py-2 sm:text-sm">
            <ShieldCheck size={15} aria-hidden="true" />
            Privacy first
          </p>
          <h1 className="mt-4 text-3xl font-semibold leading-[1.04] tracking-[0] sm:mt-7 sm:text-4xl lg:text-5xl xl:text-6xl">{title}</h1>
          <p className="mt-2 max-w-md text-sm leading-6 text-[var(--text-secondary)] sm:mt-3 lg:text-base lg:leading-7">{description}</p>
          <div className="mesh-cascade mt-4 hidden max-w-md flex-wrap gap-2 text-xs font-semibold text-[var(--text-secondary)] sm:flex">
            {trustChips.map((item, index) => (
              <span
                key={item}
                className="mesh-step rounded-md px-3 py-2"
                style={{ "--i": index + 3 } as CSSProperties}
              >
                {item}
              </span>
            ))}
          </div>
        </section>

        <section className="mesh-pop-in mesh-delay-2 min-w-0">
          {children}
        </section>
      </div>
    </main>
  );
}
