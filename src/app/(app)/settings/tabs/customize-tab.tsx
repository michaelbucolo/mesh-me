"use client";

import { Button } from "@/components/ui/button";
import { useMemo, useState, useTransition } from "react";
import { motion } from "framer-motion";
import { Paintbrush, Layout, Globe, Crown, SunMoon } from "lucide-react";
import { THEME_OPTIONS, FEED_LAYOUTS } from "./types";
import { useTheme } from "@/components/theme-provider";

interface CustomizeTabProps {
  selectedLayout: string;
  setSelectedLayout: (v: string) => void;
  isMeshPro: boolean;
}

export function CustomizeTab({ selectedLayout, setSelectedLayout, isMeshPro }: CustomizeTabProps) {
  const [isPending] = useTransition();
  const { mode, setMode, preset, setPreset, customTheme, setCustomTheme, clearCustomTheme } = useTheme();
  const [draft, setDraft] = useState({
    accent: customTheme?.accent ?? "#ff2d55",
    bgPrimary: customTheme?.bgPrimary ?? "#09090b",
    bgSecondary: customTheme?.bgSecondary ?? "#111113",
    textPrimary: customTheme?.textPrimary ?? "#fafafa",
    textSecondary: customTheme?.textSecondary ?? "#a1a1aa",
    borderPrimary: customTheme?.borderPrimary ?? "#3f3f46",
  });

  const appearanceModes = useMemo(() => [
    { id: "dark", label: "Dark" },
    { id: "light", label: "Light" },
    { id: "system", label: "System" },
  ], []);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Customize your experience</h2>
        <p className="text-sm text-[var(--text-muted)] mb-6">Make mesh.me feel like yours</p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
          <SunMoon className="h-4 w-4" style={{ color: "var(--accent)" }} /> Appearance mode
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {appearanceModes.map((appearanceMode) => (
            <button
              key={appearanceMode.id}
              onClick={() => setMode(appearanceMode.id as "light" | "dark" | "system")}
              className={`p-3 rounded-xl border text-sm font-medium transition-all ${
                mode === appearanceMode.id
                  ? "bg-[var(--accent-subtle)] border-[var(--accent)] text-[var(--text-primary)]"
                  : "glass-surface hover:border-[var(--border-hover)] text-[var(--text-secondary)]"
              }`}
            >
              {appearanceMode.label}
            </button>
          ))}
        </div>
      </div>

      {/* Theme selection */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
          <Paintbrush className="h-4 w-4" style={{ color: "var(--accent)" }} /> Color scheme
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {THEME_OPTIONS.map((theme) => (
            <button
              key={theme.id}
              onClick={() => setPreset(theme.id as "default" | "instagram" | "ocean" | "sunset" | "forest" | "mono")}
              className={`p-4 rounded-xl border-2 transition-all text-left ${
                preset === theme.id
                  ? "bg-[var(--accent-subtle)] border-[var(--accent)]"
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

      <div className="rounded-2xl border p-4 space-y-4" style={{ borderColor: "var(--border-primary)", background: "var(--bg-secondary)" }}>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <Crown className="h-4 w-4" style={{ color: "var(--accent)" }} /> MeshPro custom color studio
          </h3>
          {!isMeshPro && <span className="text-[10px] rounded-full px-2 py-1 font-semibold text-white" style={{ background: "var(--brand-gradient)" }}>PRO</span>}
        </div>
        <p className="text-xs text-[var(--text-muted)]">
          MeshPro users can tune every core color token and make the whole product uniquely theirs.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Object.entries(draft).map(([key, value]) => (
            <label key={key} className="space-y-2">
              <span className="text-xs text-[var(--text-secondary)] capitalize">{key.replace(/[A-Z]/g, " $&")}</span>
              <input
                type="color"
                value={value}
                disabled={!isMeshPro}
                onChange={(e) => setDraft((prev) => ({ ...prev, [key]: e.target.value }))}
                className="w-full h-10 rounded-lg border border-[var(--border-primary)] bg-transparent disabled:opacity-50"
              />
            </label>
          ))}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" disabled={!isMeshPro} onClick={() => setCustomTheme(draft)}>
            Apply custom colors
          </Button>
          <Button variant="ghost" disabled={!isMeshPro || !customTheme} onClick={clearCustomTheme}>
            Reset to preset
          </Button>
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
        {isPending ? "Saving..." : "Preferences auto-save instantly"}
      </Button>
    </motion.div>
  );
}
