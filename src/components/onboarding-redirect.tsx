"use client";

import { useEffect } from "react";

export function OnboardingRedirect() {
  useEffect(() => {
    window.location.replace("/onboarding");
  }, []);

  return (
    <main className="grid h-dvh min-h-0 place-items-center overflow-hidden bg-[var(--bg-primary)] px-6 py-6 text-[var(--text-primary)]">
      <div className="mx-auto max-w-sm rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-5">
        <p className="text-sm font-medium">Taking you to setup...</p>
      </div>
    </main>
  );
}
