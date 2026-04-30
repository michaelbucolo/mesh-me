import type { Metadata } from "next";
import { PlatformSuite } from "@/components/platform/platform-suite";
import { getSupportedLegacyApps } from "@/lib/super-app-migration";
import { MigrationPlanner } from "./migration-planner";

export const metadata: Metadata = { title: "Super App Replacement" };

export default function SuperAppPage() {
  const apps = getSupportedLegacyApps();

  return (
    <PlatformSuite
      section="super-app"
      afterWorkspace={
        <section className="mesh-surface mesh-pop-in mesh-delay-2 rounded-lg p-4 md:p-5">
          <div className="mb-4 max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">Top app replacement planner</p>
            <h2 className="mt-2 text-xl font-black text-[var(--text-primary)]">Plan which apps Mesh.me can replace first.</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              Select the apps you use every day. Mesh.me compares them against your current account readiness, security setup,
              connected platforms, posting, messaging, and migration progress.
            </p>
          </div>
          <MigrationPlanner apps={apps} />
        </section>
      }
    />
  );
}
