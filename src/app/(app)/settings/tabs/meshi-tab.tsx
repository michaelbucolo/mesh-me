"use client";

import { updateMeshiPreference, getUserUnlockedCosmetics } from "@/lib/actions";
import { useState, useTransition, useEffect } from "react";
import { motion } from "framer-motion";
import { Sparkles, Crown, ArrowRight, Lock, Trophy } from "lucide-react";
import { MeshiMascot, type MeshiMood, type MeshiHat, type MeshiColor, ACHIEVEMENT_TITLES } from "@/components/meshi/meshi-mascot";
import { updateMeshiLocalPreferences, useMeshiPreferences } from "@/hooks/use-meshi-preferences";
import { SettingsCard, SettingsCardHeader } from "./settings-primitives";

interface MeshiTabProps {
  showSuccess: (msg: string) => void;
  isMeshPro?: boolean;
}

export function MeshiTab({ showSuccess, isMeshPro = false }: MeshiTabProps) {
  const [, startTransition] = useTransition();
  const { color, hat, face, enabled, title, refresh } = useMeshiPreferences();

  const [meshiHat, setMeshiHat] = useState<MeshiHat>(hat);
  const [meshiFace, setMeshiFace] = useState<MeshiMood>(face);
  const [meshiColor, setMeshiColor] = useState<MeshiColor>(color);
  const [meshiEnabled, setMeshiEnabled] = useState(enabled);
  const [unlockedFaces, setUnlockedFaces] = useState<string[]>([]);
  const [unlockedTitles, setUnlockedTitles] = useState<string[]>([]);
  const [activeTitle, setActiveTitle] = useState<string>(title);

  useEffect(() => {
    getUserUnlockedCosmetics().then((result) => {
      if (result.cosmetics) {
        setUnlockedFaces(result.cosmetics.filter((c) => c.type === "face").map((c) => c.value));
        setUnlockedTitles(result.cosmetics.filter((c) => c.type === "title").map((c) => c.value));
      }
    });
  }, []);

  const FREE_HATS: MeshiHat[] = ["none", "tophat", "beanie", "cap", "party"];
  const PRO_HATS: MeshiHat[] = ["crown", "flower", "headphones", "halo", "wizard", "astronaut", "pirate", "chef"];
  const FREE_COLORS: MeshiColor[] = ["blue", "purple", "pink", "green", "orange"];
  const PRO_COLORS: MeshiColor[] = ["cyan", "gold", "rainbow", "crimson", "midnight", "rose", "emerald", "arctic", "obsidian"];

  const resetToSaved = () => {
    setMeshiHat(hat);
    setMeshiFace(face);
    setMeshiColor(color);
    setMeshiEnabled(enabled);
    setActiveTitle(title);
    showSuccess("Reset to your saved Meshi settings");
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="text-center mb-6">
        <MeshiMascot size={80} mood={meshiFace} hat={meshiHat} color={meshiColor} speaking={false} />
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mt-4 mb-1">Meshi <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded text-white ml-1" style={{ background: "var(--accent)" }}>Beta</span></h2>
        <p className="text-sm text-[var(--text-muted)]">Your personal assistant for navigating the mesh</p>
      </div>

      <SettingsCard>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Enable Meshi</h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Show the floating Meshi assistant across the app</p>
          </div>
          <button
            onClick={() => {
              const newVal = !meshiEnabled;
              setMeshiEnabled(newVal);
              updateMeshiLocalPreferences({ enabled: newVal });
              showSuccess(newVal ? "Meshi enabled" : "Meshi disabled");
            }}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${meshiEnabled ? "bg-[var(--accent)]" : "bg-[var(--bg-tertiary)]"}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${meshiEnabled ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>
      </SettingsCard>

      {meshiEnabled && (
        <>
          <div className="text-center mb-2">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Customize Meshi</h3>
            <p className="text-[10px] text-[var(--accent)] mt-1 flex items-center justify-center gap-1">
              <Sparkles className="h-3 w-3" /> MeshPro feature
            </p>
          </div>

          <SettingsCard>
            <SettingsCardHeader title="Expression" className="mb-3" />
            <div className="grid grid-cols-4 gap-3">
              {(["happy", "excited", "thinking", "sleepy", "surprised", "love", "cool", "wink", ...(unlockedFaces.includes("synergy1017") ? ["synergy1017" as MeshiMood] : [])] as MeshiMood[]).map((faceOption) => (
                <button
                  key={faceOption}
                  onClick={() => {
                    setMeshiFace(faceOption);
                    updateMeshiLocalPreferences({ face: faceOption });
                  }}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all ${meshiFace === faceOption ? "ring-2 ring-[var(--accent)] bg-[var(--accent-subtle)]" : "glass-surface hover:bg-[var(--bg-tertiary)]"}`}
                >
                  <MeshiMascot size={36} mood={faceOption} color={meshiColor} animate={false} showGlow={false} />
                  <span className="text-[10px] text-[var(--text-secondary)] capitalize">{faceOption}</span>
                </button>
              ))}
            </div>
          </SettingsCard>

          <SettingsCard>
            <SettingsCardHeader title="Hat" className="mb-3" />
            <div className="grid grid-cols-4 gap-3">
              {FREE_HATS.map((hatOption) => (
                <button
                  key={hatOption}
                  onClick={() => {
                    setMeshiHat(hatOption);
                    updateMeshiLocalPreferences({ hat: hatOption });
                  }}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all ${meshiHat === hatOption ? "ring-2 ring-[var(--accent)] bg-[var(--accent-subtle)]" : "glass-surface hover:bg-[var(--bg-tertiary)]"}`}
                >
                  <MeshiMascot size={36} mood={meshiFace} hat={hatOption} color={meshiColor} animate={false} showGlow={false} />
                  <span className="text-[10px] text-[var(--text-secondary)] capitalize">{hatOption}</span>
                </button>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-[var(--border-primary)]">
              <div className="flex items-center gap-2 mb-3">
                <Crown className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-xs font-semibold text-amber-400">MeshPro Exclusive</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {PRO_HATS.map((hatOption) => (
                  <button
                    key={hatOption}
                    onClick={() => {
                      if (!isMeshPro) return;
                      setMeshiHat(hatOption);
                      updateMeshiLocalPreferences({ hat: hatOption });
                    }}
                    disabled={!isMeshPro}
                    className={`relative flex flex-col items-center gap-2 p-3 rounded-xl transition-all ${
                      !isMeshPro ? "opacity-50 cursor-not-allowed" :
                      meshiHat === hatOption ? "ring-2 ring-amber-400 bg-amber-400/10" : "glass-surface hover:bg-[var(--bg-tertiary)]"
                    }`}
                  >
                    {!isMeshPro && <Lock className="absolute top-1.5 right-1.5 h-3 w-3 text-[var(--text-muted)]" />}
                    <MeshiMascot size={36} mood={meshiFace} hat={hatOption} color={meshiColor} animate={false} showGlow={false} />
                    <span className="text-[10px] text-[var(--text-secondary)] capitalize">{hatOption}</span>
                  </button>
                ))}
              </div>
            </div>
          </SettingsCard>

          <SettingsCard>
            <SettingsCardHeader title="Color" className="mb-3" />
            <div className="grid grid-cols-4 gap-3">
              {FREE_COLORS.map((colorOption) => (
                <button
                  key={colorOption}
                  onClick={() => {
                    setMeshiColor(colorOption);
                    updateMeshiLocalPreferences({ color: colorOption });
                  }}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all ${meshiColor === colorOption ? "ring-2 ring-[var(--accent)] bg-[var(--accent-subtle)]" : "glass-surface hover:bg-[var(--bg-tertiary)]"}`}
                >
                  <MeshiMascot size={36} mood={meshiFace} hat={meshiHat} color={colorOption} animate={false} showGlow={false} />
                  <span className="text-[10px] text-[var(--text-secondary)] capitalize">{colorOption}</span>
                </button>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-[var(--border-primary)]">
              <div className="flex items-center gap-2 mb-3">
                <Crown className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-xs font-semibold text-amber-400">MeshPro Exclusive</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {PRO_COLORS.map((colorOption) => (
                  <button
                    key={colorOption}
                    onClick={() => {
                      if (!isMeshPro) return;
                      setMeshiColor(colorOption);
                      updateMeshiLocalPreferences({ color: colorOption });
                    }}
                    disabled={!isMeshPro}
                    className={`relative flex flex-col items-center gap-2 p-3 rounded-xl transition-all ${
                      !isMeshPro ? "opacity-50 cursor-not-allowed" :
                      meshiColor === colorOption ? "ring-2 ring-amber-400 bg-amber-400/10" : "glass-surface hover:bg-[var(--bg-tertiary)]"
                    }`}
                  >
                    {!isMeshPro && <Lock className="absolute top-1.5 right-1.5 h-3 w-3 text-[var(--text-muted)]" />}
                    <MeshiMascot size={36} mood={meshiFace} hat={meshiHat} color={colorOption} animate={false} showGlow={false} />
                    <span className="text-[10px] text-[var(--text-secondary)] capitalize">{colorOption}</span>
                  </button>
                ))}
              </div>
            </div>
          </SettingsCard>

          <SettingsCard>
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="h-4 w-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Title</h3>
            </div>
            <p className="text-xs text-[var(--text-muted)] mb-4">Earn titles through achievements. Your title appears below your Meshi.</p>
            <div className="space-y-2">
              <button
                onClick={() => {
                  setActiveTitle("");
                  updateMeshiLocalPreferences({ title: "" });
                  showSuccess("Title removed");
                }}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${!activeTitle ? "ring-2 ring-[var(--accent)] bg-[var(--accent-subtle)]" : "glass-surface hover:bg-[var(--bg-tertiary)]"}`}
              >
                <span className="text-xs text-[var(--text-secondary)]">No title</span>
              </button>
              {Object.entries(ACHIEVEMENT_TITLES).map(([key, info]) => {
                const unlocked = unlockedTitles.includes(key);
                return (
                  <button
                    key={key}
                    onClick={() => {
                      if (!unlocked) return;
                      setActiveTitle(key);
                      updateMeshiLocalPreferences({ title: key });
                      showSuccess(`Title set to "${info.title}"`);
                    }}
                    disabled={!unlocked}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${
                      !unlocked ? "opacity-40 cursor-not-allowed" :
                      activeTitle === key ? "ring-2 ring-amber-400 bg-amber-400/10" : "glass-surface hover:bg-[var(--bg-tertiary)]"
                    }`}
                  >
                    {!unlocked && <Lock className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0" />}
                    {unlocked && <Trophy className="h-3.5 w-3.5 text-amber-400 shrink-0" />}
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-[var(--text-primary)] block">{info.title}</span>
                      <span className="text-[10px] text-[var(--text-muted)]">{info.description}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </SettingsCard>

          <div className="flex items-center gap-2">
            <button
              onClick={resetToSaved}
              className="flex-1 py-3 rounded-xl border border-[var(--border-primary)] text-[var(--text-secondary)] font-semibold text-sm hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all"
            >
              Reset to Saved
            </button>
            <button
              onClick={() => {
                startTransition(async () => {
                  await updateMeshiPreference({ faceStyle: meshiFace, hatStyle: meshiHat, colorTheme: meshiColor });
                  updateMeshiLocalPreferences({ face: meshiFace, hat: meshiHat, color: meshiColor });
                  refresh();
                  showSuccess("Meshi preferences saved!");
                });
              }}
              className="flex-[1.25] py-3 rounded-xl brand-button text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all"
            >
              <Sparkles className="h-4 w-4" />
              Save Meshi Preferences
            </button>
          </div>

          <SettingsCard className="mt-6">
            <div className="flex items-center gap-2 mb-1">
              <Crown className="h-4 w-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">App Logo</h3>
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded text-amber-400 bg-amber-400/10">MeshPro</span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mb-4">
              Replace the default app logo with your customized Meshi. Your personalized Meshi appears in the sidebar, favicon, and throughout the app.
            </p>
            <div className="flex items-center gap-4 mb-4 p-3 rounded-xl" style={{ background: "var(--bg-tertiary)" }}>
              <div className="flex flex-col items-center gap-1">
                <span className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider">Default</span>
                <div className="p-2 rounded-xl" style={{ background: "var(--bg-primary)", border: "1px solid var(--border-primary)" }}>
                  <MeshiMascot size={36} mood="happy" color="blue" hat="none" animate={false} showGlow={false} />
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-[var(--text-muted)]" />
              <div className="flex flex-col items-center gap-1">
                <span className="text-[9px] text-amber-400 uppercase tracking-wider font-bold">Your Logo</span>
                <div className="p-2 rounded-xl ring-2 ring-amber-400/30" style={{ background: "var(--bg-primary)", border: "1px solid rgba(251,191,36,0.3)" }}>
                  <MeshiMascot size={36} mood={meshiFace} color={meshiColor} hat={meshiHat} animate showGlow={false} bouncy />
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                updateMeshiLocalPreferences({ appLogo: "custom", appLogoColor: meshiColor });
                showSuccess("App logo updated to your custom Meshi!");
              }}
              className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all"
              style={{ background: "linear-gradient(135deg, rgba(251,191,36,0.15), rgba(234,179,8,0.08))", border: "1px solid rgba(251,191,36,0.25)", color: "#fbbf24" }}
            >
              <Crown className="h-3.5 w-3.5" />
              Use Custom Meshi as App Logo
            </button>
            <button
              onClick={() => {
                updateMeshiLocalPreferences({ appLogo: "default", appLogoColor: "blue" });
                showSuccess("App logo reset to default");
              }}
              className="w-full py-2 rounded-xl text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors mt-2"
            >
              Reset to Default Logo
            </button>
          </SettingsCard>
        </>
      )}
    </motion.div>
  );
}
