import type { ReactNode } from "react";
import { AmbientBackground } from "./ambient-background";

type LandingShellProps = {
  children: ReactNode;
};

export function LandingShell({ children }: LandingShellProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--bg-primary)]">
      <AmbientBackground />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
