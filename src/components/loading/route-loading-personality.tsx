import { MeshiLoader } from "@/components/meshi/meshi-loader";
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
        "loading-personality-shell flex min-h-full min-w-0 flex-1",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-loading-personality={personality}
    >
      <p className="sr-only">{loading.ariaLabel ?? `Loading ${loading.title}`}</p>
      <MeshiLoader
        title={loading.title}
        subtitle={loading.subtitle}
        mode={loading.mode}
        fullHeight={surface === "public"}
      />
    </section>
  );
}
