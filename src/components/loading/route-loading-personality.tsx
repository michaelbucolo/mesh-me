import { MeshiFunLoadingScreen } from "@/components/meshi/meshi-loading";
import { getLoadingPersonality, type LoadingPersonalityKey } from "@/lib/loading-personality";
import { cn } from "@/lib/utils";

interface RouteLoadingPersonalityProps {
  personality?: LoadingPersonalityKey;
  surface?: "public" | "app";
  className?: string;
}

export function RouteLoadingPersonality({
  personality = "app",
  surface = "app",
  className,
}: RouteLoadingPersonalityProps) {
  const loading = getLoadingPersonality(personality);

  return (
    <section
      className={cn(
        "loading-personality-shell flex min-h-full min-w-0 items-center justify-center bg-[var(--bg-primary)] px-4 py-6 text-[var(--text-primary)]",
        surface === "public" && "h-dvh overflow-hidden",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-loading-personality={personality}
    >
      <p className="sr-only">{loading.ariaLabel ?? `Loading ${loading.title}`}</p>
      <MeshiFunLoadingScreen
        title={loading.title}
        subtitle={loading.subtitle}
        mode={loading.mode}
        progressLabel={loading.progressLabel}
        steps={[...loading.steps]}
      />
    </section>
  );
}
