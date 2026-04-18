"use client";

import { useMemo, useState } from "react";
import { Lightbulb, Rocket, Sparkles, TrendingDown, TrendingUp, Minus } from "lucide-react";
import type { InnovationBrief } from "@/lib/innovation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface InnovationStudioProps {
  brief: InnovationBrief;
  displayName: string;
}

export function InnovationStudio({ brief, displayName }: InnovationStudioProps) {
  const [experimentsPerWeek, setExperimentsPerWeek] = useState(2);
  const [collaborationDepth, setCollaborationDepth] = useState(40);

  const projection = useMemo(() => {
    const growth = Math.round(experimentsPerWeek * 6 + collaborationDepth * 0.7);
    const velocity = growth > 50 ? "High" : growth > 30 ? "Medium" : "Early";
    return { growth, velocity };
  }, [experimentsPerWeek, collaborationDepth]);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-6 shadow-[var(--shadow-lg)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Innovation Studio</p>
            <h1 className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">Build your next growth leap, {displayName}</h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">
              We analyzed your momentum and surfaced high-signal opportunities. Run micro-experiments, simulate outcomes,
              and turn insights into repeatable growth systems.
            </p>
          </div>
          <Button className="gap-2">
            <Rocket className="h-4 w-4" />
            Launch experiment sprint
          </Button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {brief.metrics.map((metric) => (
          <Card key={metric.label} className="border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-4">
            <p className="text-xs text-[var(--text-muted)]">{metric.label}</p>
            <p className="mt-2 text-3xl font-semibold text-[var(--text-primary)]">{metric.value}</p>
            <p className="mt-2 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              {metric.trend === "up" ? (
                <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
              ) : metric.trend === "down" ? (
                <TrendingDown className="h-3.5 w-3.5 text-rose-400" />
              ) : (
                <Minus className="h-3.5 w-3.5 text-amber-300" />
              )}
              {metric.delta}
            </p>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card className="border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-5">
          <div className="mb-4 flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-300" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Prioritized opportunities</h2>
          </div>
          <div className="space-y-3">
            {brief.recommendations.map((item) => (
              <article key={item.title} className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/40 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-medium text-[var(--text-primary)]">{item.title}</h3>
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                    Impact {item.impact}
                  </span>
                  <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-300">
                    Effort {item.effort}
                  </span>
                </div>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">{item.description}</p>
              </article>
            ))}
          </div>
        </Card>

        <Card className="border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-5">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-300" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">What-if simulator</h2>
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="text-xs text-[var(--text-muted)]">Experiments / week: {experimentsPerWeek}</span>
              <input
                type="range"
                min={1}
                max={7}
                value={experimentsPerWeek}
                onChange={(e) => setExperimentsPerWeek(Number(e.target.value))}
                className="mt-2 w-full"
              />
            </label>

            <label className="block">
              <span className="text-xs text-[var(--text-muted)]">Collaboration depth: {collaborationDepth}%</span>
              <input
                type="range"
                min={10}
                max={100}
                step={5}
                value={collaborationDepth}
                onChange={(e) => setCollaborationDepth(Number(e.target.value))}
                className="mt-2 w-full"
              />
            </label>
          </div>

          <div className="mt-5 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/50 p-4">
            <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Projected 30-day uplift</p>
            <p className="mt-1 text-3xl font-semibold text-[var(--text-primary)]">+{projection.growth}%</p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">Innovation velocity: {projection.velocity}</p>
          </div>

          <div className="mt-4">
            <p className="text-xs text-[var(--text-muted)]">Current strengths</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {brief.topTags.length > 0 ? (
                brief.topTags.map((tag) => (
                  <span
                    key={tag}
                    className={cn(
                      "rounded-full border border-[var(--glass-border)] px-2.5 py-1 text-xs text-[var(--text-secondary)]",
                    )}
                  >
                    #{tag}
                  </span>
                ))
              ) : (
                <span className="text-xs text-[var(--text-muted)]">No top tags yet — your next post can define one.</span>
              )}
            </div>
            <p className="mt-3 text-xs text-[var(--text-muted)]">Peak publishing window: {brief.peakPostingWindow} (UTC)</p>
          </div>
        </Card>
      </section>
    </div>
  );
}
