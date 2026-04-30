"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardCopy, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LegacyAppKey } from "@/lib/super-app-migration";

type PlannerResult = {
  generatedAt: string;
  overallScore: number;
  plan: Array<{
    app: LegacyAppKey;
    label: string;
    replacementArea: string;
    readinessGate: number;
    currentScore: number;
    readyToReplace: boolean;
    blockers: string[];
    nextSteps: string[];
  }>;
};

const DEFAULT_SELECTION: LegacyAppKey[] = ["youtube", "instagram", "tiktok", "discord", "whatsapp"];

export function MigrationPlanner({ apps }: { apps: Array<{ key: LegacyAppKey; label: string }> }) {
  const appKeys = useMemo(() => apps.map((app) => app.key), [apps]);
  const [selectedApps, setSelectedApps] = useState<LegacyAppKey[]>(DEFAULT_SELECTION);
  const [loading, setLoading] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PlannerResult | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem("meshme.migration-planner.apps");
    if (!stored) {
      setSelectedApps(DEFAULT_SELECTION.filter((key) => appKeys.includes(key)));
      return;
    }

    const parsed = stored
      .split(",")
      .filter((value): value is LegacyAppKey => appKeys.includes(value as LegacyAppKey));

    setSelectedApps(parsed.length > 0 ? parsed : appKeys.slice(0, Math.min(5, appKeys.length)));
  }, [appKeys]);

  useEffect(() => {
    window.localStorage.setItem("meshme.migration-planner.apps", selectedApps.join(","));
  }, [selectedApps]);

  async function generatePlan() {
    setLoading(true);
    setError(null);
    setCopyState("idle");

    try {
      const response = await fetch("/api/super-app/migration-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apps: selectedApps }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data?.error || "Failed to generate migration plan");
        setLoading(false);
        return;
      }

      setResult(data);
    } catch {
      setError("Unable to reach migration planner. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function toggleApp(key: LegacyAppKey) {
    setSelectedApps((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  }

  function selectAllApps() {
    setSelectedApps(appKeys);
  }

  function clearAllApps() {
    setSelectedApps([]);
  }

  async function copyPlan() {
    if (!result) return;

    const lines = result.plan.map((item) => {
      const status = item.readyToReplace ? "Ready now" : "Needs work";
      return `- ${item.label}: ${status} (${item.currentScore}/${item.readinessGate})`;
    });
    const payload = [
      "Mesh.me migration plan",
      `Generated: ${new Date(result.generatedAt).toLocaleString()}`,
      `Account replacement score: ${result.overallScore}/100`,
      "",
      ...lines,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(payload);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)]/64 px-3 py-2 text-xs text-[var(--text-secondary)]">
        <p>
          Selected apps: <span className="font-semibold text-[var(--text-primary)]">{selectedApps.length}</span>
        </p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={selectAllApps} className="mesh-pressable rounded-md border border-[var(--border-primary)] px-2 py-1 text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]">
            Select all
          </button>
          <button type="button" onClick={clearAllApps} className="mesh-pressable rounded-md border border-[var(--border-primary)] px-2 py-1 text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]">
            Clear all
          </button>
        </div>
      </div>

      <div className="grid max-h-[22rem] gap-2 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
        {apps.map((app) => (
          <label
            key={app.key}
            className={`mesh-pressable flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition ${
              selectedApps.includes(app.key)
                ? "border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-primary)]"
                : "border-[var(--border-primary)] bg-[var(--bg-primary)]/50 text-[var(--text-secondary)]"
            }`}
          >
            <input
              type="checkbox"
              checked={selectedApps.includes(app.key)}
              onChange={() => toggleApp(app.key)}
              className="h-4 w-4 rounded border-[var(--border-primary)] bg-[var(--bg-primary)]"
            />
            {app.label}
          </label>
        ))}
      </div>

      <Button onClick={generatePlan} disabled={loading || selectedApps.length === 0} className="w-full sm:w-auto">
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Generate migration plan
      </Button>

      {error ? <p className="text-sm text-red-200">{error}</p> : null}

      {result ? (
        <div className="space-y-3">
          <div className="rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)]/64 px-3 py-2 text-xs text-[var(--text-secondary)]">
            Generated {new Date(result.generatedAt).toLocaleString()} - Readiness baseline {result.overallScore}/100
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" onClick={copyPlan} className="h-8 text-xs">
              <ClipboardCopy className="mr-1 h-3.5 w-3.5" />
              Copy summary
            </Button>
            {copyState === "copied" ? <p className="text-xs text-emerald-200">Copied to clipboard.</p> : null}
            {copyState === "failed" ? <p className="text-xs text-red-200">Clipboard unavailable in this browser.</p> : null}
          </div>

          {result.plan.map((item) => (
            <article key={item.app} className="rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)]/64 p-3 text-sm text-[var(--text-primary)]">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="font-semibold">{item.label}</p>
                <span className="text-xs text-[var(--text-secondary)]">
                  {item.currentScore}/{item.readinessGate}
                </span>
              </div>

              <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-secondary)]">
                <div
                  className={`h-full rounded-full ${item.readyToReplace ? "bg-emerald-300" : "bg-amber-300"}`}
                  style={{ width: `${Math.min(100, Math.round((item.currentScore / item.readinessGate) * 100))}%` }}
                />
              </div>

              {item.readyToReplace ? (
                <div className="space-y-2">
                  <p className="flex items-center gap-1 text-emerald-200"><CheckCircle2 className="h-4 w-4" /> Ready to replace now.</p>
                  <ul className="list-disc pl-5 text-xs text-emerald-100/90">
                    {item.nextSteps.slice(0, 2).map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="flex items-center gap-1 text-amber-200"><AlertTriangle className="h-4 w-4" /> Not ready yet.</p>
                  <ul className="list-disc pl-5 text-xs text-[var(--text-secondary)]">
                    {item.blockers.slice(0, 3).map((blocker) => (
                      <li key={blocker}>{blocker}</li>
                    ))}
                  </ul>
                  <div className="rounded-md border border-[var(--border-primary)] bg-[var(--bg-secondary)]/50 px-2 py-1.5">
                    <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-[var(--text-primary)]">
                      <Sparkles className="h-3.5 w-3.5" />
                      Fastest next step
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">{item.nextSteps[0]}</p>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}
