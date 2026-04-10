import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { MeshBackground } from "@/components/mesh-background";
import { MeshEntry } from "@/components/mesh-entry";
import { Sparkles, ShieldCheck, Zap, Users, Orbit } from "lucide-react";

const valueProps = [
  {
    icon: Sparkles,
    title: "One identity",
    description: "Unify your digital presence into a living map that stays up to date.",
  },
  {
    icon: ShieldCheck,
    title: "Privacy-first",
    description: "No ads, no data selling, and control over what you connect and share.",
  },
  {
    icon: Zap,
    title: "Instant discovery",
    description: "Find people, communities, and ideas through your mesh in seconds.",
  },
];

const proofPoints = [
  { icon: Users, label: "Creator-first networking" },
  { icon: Orbit, label: "Cross-platform identity graph" },
  { icon: ShieldCheck, label: "Private by default" },
];

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user?.onboarded) redirect("/mesh");

  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--bg-primary)]">
      <MeshBackground density={95} />
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_15%_20%,rgba(45,127,249,0.16),transparent_42%),radial-gradient(circle_at_85%_10%,rgba(0,198,251,0.16),transparent_35%),radial-gradient(circle_at_50%_100%,rgba(45,127,249,0.12),transparent_45%)]" />

      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-7xl grid-cols-1 gap-8 px-4 py-8 md:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12 lg:px-12 lg:py-12">
        <section className="flex flex-col justify-center rounded-3xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-6 backdrop-blur-xl md:p-10">
          <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-[var(--accent-muted)] bg-[var(--accent-subtle)] px-3 py-1.5 text-xs font-semibold text-[var(--accent)]">
            <Sparkles className="h-3.5 w-3.5" />
            Reimagined mesh.me experience
          </div>
          <h1 className="font-display text-4xl font-semibold leading-tight text-[var(--text-primary)] md:text-6xl">
            Your internet,
            <span className="gradient-text"> connected intelligently.</span>
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-[var(--text-secondary)] md:text-base">
            mesh.me is the new social operating system for creators and communities. Build your digital graph,
            connect every platform, and explore your universe with AI-native navigation.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            {proofPoints.map((point) => (
              <div
                key={point.label}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] px-3 py-1.5 text-[11px] font-medium text-[var(--text-secondary)]"
              >
                <point.icon className="h-3.5 w-3.5 text-[var(--accent)]" />
                {point.label}
              </div>
            ))}
          </div>

          <div className="mt-8 grid gap-3 md:grid-cols-3">
            {valueProps.map((item) => (
              <div key={item.title} className="rounded-2xl border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-4">
                <item.icon className="h-4 w-4 text-[var(--accent)]" />
                <p className="mt-3 text-sm font-semibold text-[var(--text-primary)]">{item.title}</p>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="flex items-center justify-center">
          <div className="w-full max-w-xl">
            <MeshEntry />
          </div>
        </section>
      </div>
    </div>
  );
}
