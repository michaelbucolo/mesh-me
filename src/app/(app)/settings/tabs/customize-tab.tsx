"use client";

import { Button } from "@/components/ui/button";
import { useTransition } from "react";
import { motion } from "framer-motion";
import { Paintbrush, Layout, Globe } from "lucide-react";
import { MeshiSettingsTip } from "@/components/meshi/meshi-guide";
import { THEME_OPTIONS, FEED_LAYOUTS } from "./types";

interface CustomizeTabProps {
  selectedTheme: string;
  setSelectedTheme: (v: string) => void;
  selectedLayout: string;
  setSelectedLayout: (v: string) => void;
}

export function CustomizeTab({ selectedTheme, setSelectedTheme, selectedLayout, setSelectedLayout }: CustomizeTabProps) {
  const [isPending] = useTransition();

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <MeshiSettingsTip tab="customize" />
      <div>
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Customize your experience</h2>
        <p className="text-sm text-[var(--text-muted)] mb-6">Make mesh.me feel like yours</p>
      </div>

      {/* Theme selection */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
          <Paintbrush className="h-4 w-4" style={{ color: "var(--accent)" }} /> Theme
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {THEME_OPTIONS.map((theme) => (
            <button
              key={theme.id}
              onClick={() => setSelectedTheme(theme.id)}
              className={`p-4 rounded-xl border-2 transition-all text-left ${
                selectedTheme === theme.id
                  ? "bg-[var(--bg-tertiary)] border-[var(--accent)]"
                  : "glass-surface hover:border-[var(--glass-border)]"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: theme.bg, border: "1px solid rgba(255,255,255,0.1)" }} />
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: theme.accent }} />
              </div>
              <span className="text-sm font-medium text-[var(--text-primary)]">{theme.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Feed layout preference */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
          <Layout className="h-4 w-4" style={{ color: "var(--accent)" }} /> Default feed layout
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {FEED_LAYOUTS.map((layout) => (
            <button
              key={layout.id}
              onClick={() => setSelectedLayout(layout.id)}
              className={`p-3 rounded-xl border-2 transition-all text-left ${
                selectedLayout === layout.id
                  ? "bg-[var(--bg-tertiary)] border-[var(--accent)]"
                  : "glass-surface hover:border-[var(--glass-border)]"
              }`}
            >
              <span className="text-sm font-medium text-[var(--text-primary)] block">{layout.label}</span>
              <span className="text-xs text-[var(--text-muted)]">{layout.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Mesh density */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
          <Globe className="h-4 w-4" style={{ color: "var(--accent)" }} /> Background mesh
        </h3>
        <div className="flex items-center justify-between py-3 border-b border-[var(--border-primary)]">
          <div>
            <span className="text-sm text-[var(--text-primary)] block font-medium">Show constellation mesh</span>
            <span className="text-xs text-[var(--text-muted)]">Animated node background across the app</span>
          </div>
          <button type="button" className="relative w-11 h-6 bg-[var(--accent)] rounded-full transition-colors">
            <div className="absolute top-0.5 right-0.5 w-5 h-5 bg-white rounded-full shadow-sm" />
          </button>
        </div>
        <div className="flex items-center justify-between py-3 border-b border-[var(--border-primary)]">
          <div>
            <span className="text-sm text-[var(--text-primary)] block font-medium">Reduced motion</span>
            <span className="text-xs text-[var(--text-muted)]">Minimize animations for accessibility</span>
          </div>
          <button type="button" className="relative w-11 h-6 bg-[var(--bg-hover)] rounded-full transition-colors">
            <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm" />
          </button>
        </div>
      </div>

      <Button variant="gradient" disabled={isPending}>
        {isPending ? "Saving..." : "Save preferences"}
      </Button>
    </motion.div>
  );
}
