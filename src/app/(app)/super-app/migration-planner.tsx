"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
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

export function MigrationPlanner({ apps }: { apps: Array<{ key: LegacyAppKey; label: string }> }) {
  const [selectedApps, setSelectedApps] = useState<LegacyAppKey[]>(["wechat", "messenger", "imessage"]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PlannerResult | null>(null);

  async function generatePlan() {
    setLoading(true);
    setError(null);

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
    setLoading(false);
  }

  function toggleApp(key: LegacyAppKey) {
    setSelectedApps((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2">
        {apps.map((app) => (
          <label key={app.key} className="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-900/30 px-3 py-2 text-sm text-slate-100">
            <input
              type="checkbox"
              checked={selectedApps.includes(app.key)}
              onChange={() => toggleApp(app.key)}
              className="h-4 w-4 rounded border-white/20 bg-slate-900"
            />
            {app.label}
          </label>
        ))}
      </div>

      <Button onClick={generatePlan} disabled={loading || selectedApps.length === 0} className="w-full sm:w-auto">
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Generate migration plan
      </Button>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      {result ? (
        <div className="space-y-3">
          {result.plan.map((item) => (
            <article key={item.app} className="rounded-xl border border-white/10 bg-slate-900/30 p-3 text-sm text-slate-100">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="font-semibold">{item.label}</p>
                <span className="text-xs text-slate-300">
                  {item.currentScore}/{item.readinessGate}
                </span>
              </div>

              {item.readyToReplace ? (
                <p className="flex items-center gap-1 text-emerald-300"><CheckCircle2 className="h-4 w-4" /> Ready to replace now.</p>
              ) : (
                <div className="space-y-2">
                  <p className="flex items-center gap-1 text-amber-300"><AlertTriangle className="h-4 w-4" /> Not ready yet.</p>
                  <ul className="list-disc pl-5 text-xs text-slate-300">
                    {item.blockers.slice(0, 3).map((blocker) => (
                      <li key={blocker}>{blocker}</li>
                    ))}
                  </ul>
                </div>
              )}
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}
