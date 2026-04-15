"use client";

import { updateMeshiPreference, getMeshiPreference, getUserUnlockedCosmetics } from "@/lib/actions";
import { useState, useTransition, useEffect } from "react";
import { motion } from "framer-motion";
import { Sparkles, Crown, ArrowRight } from "lucide-react";
import { MeshiMascot, type MeshiMood, type MeshiHat, type MeshiColor } from "@/components/meshi/meshi-mascot";

interface MeshiTabProps {
  showSuccess: (msg: string) => void;
}

export function MeshiTab({ showSuccess }: MeshiTabProps) {
  const [, startTransition] = useTransition();
  const [meshiHat, setMeshiHat] = useState<MeshiHat>("none");
  const [meshiFace, setMeshiFace] = useState<MeshiMood>("happy");
  const [meshiColor, setMeshiColor] = useState<MeshiColor>("blue");
  const [meshiEnabled, setMeshiEnabled] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("meshiEnabled") !== "false";
    }
    return true;
  });
  const [unlockedFaces, setUnlockedFaces] = useState<string[]>([]);

  useEffect(() => {
    getMeshiPreference().then((pref) => {
      if (pref) {
        if (pref.faceStyle) setMeshiFace(pref.faceStyle as MeshiMood);
        if (pref.hatStyle) setMeshiHat(pref.hatStyle as MeshiHat);
        if (pref.colorTheme) setMeshiColor(pref.colorTheme as MeshiColor);
      }
    }).catch(() => {});
    getUserUnlockedCosmetics().then((result) => {
      if (result.cosmetics) {
        setUnlockedFaces(result.cosmetics.filter((c) => c.type === "face").map((c) => c.value));
      }
    });
  }, []);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="text-center mb-6">
        <MeshiMascot size={80} mood={meshiFace} hat={meshiHat} color={meshiColor} speaking={false} />
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mt-4 mb-1">Meshi <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded text-white ml-1" style={{ background: "var(--accent)" }}>Beta</span></h2>
        <p className="text-sm text-[var(--text-muted)]">Your personal assistant for navigating the mesh</p>
      </div>

      {/* Enable / Disable Meshi */}
      <div className="glass-card rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Enable Meshi</h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Show the floating Meshi assistant across the app</p>
          </div>
          <button
            onClick={() => {
              const newVal = !meshiEnabled;
              setMeshiEnabled(newVal);
              localStorage.setItem("meshiEnabled", String(newVal));
              window.dispatchEvent(new StorageEvent("storage", { key: "meshiEnabled", newValue: String(newVal) }));
              showSuccess(newVal ? "Meshi enabled" : "Meshi disabled");
            }}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${meshiEnabled ? "bg-[var(--accent)]" : "bg-[var(--bg-tertiary)]"}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${meshiEnabled ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>
      </div>

      {/* Customize section */}
      {meshiEnabled && (
        <>
          <div className="text-center mb-2">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Customize Meshi</h3>
            <p className="text-[10px] text-[var(--accent)] mt-1 flex items-center justify-center gap-1">
              <Sparkles className="h-3 w-3" /> MeshPro feature
            </p>
          </div>

          {/* Face style */}
          <div className="glass-card rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Expression</h3>
            <div className="grid grid-cols-4 gap-3">
              {(["happy", "excited", "thinking", "sleepy", "surprised", "love", "cool", "wink", ...(unlockedFaces.includes("synergy1017") ? ["synergy1017" as MeshiMood] : [])] as MeshiMood[]).map((face) => (
                <button
                  key={face}
                  onClick={() => { setMeshiFace(face); localStorage.setItem("meshiFace", face); }}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all ${meshiFace === face ? "ring-2 ring-[var(--accent)] bg-[var(--accent-subtle)]" : "glass-surface hover:bg-[var(--bg-tertiary)]"}`}
                >
                  <MeshiMascot size={36} mood={face} color={meshiColor} animate={false} showGlow={false} />
                  <span className="text-[10px] text-[var(--text-secondary)] capitalize">{face}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Hat style */}
          <div className="glass-card rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Hat</h3>
            <div className="grid grid-cols-4 gap-3">
              {(["none", "tophat", "crown", "beanie", "cap", "party", "flower"] as MeshiHat[]).map((hat) => (
                <button
                  key={hat}
                  onClick={() => { setMeshiHat(hat); localStorage.setItem("meshiHat", hat); }}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all ${meshiHat === hat ? "ring-2 ring-[var(--accent)] bg-[var(--accent-subtle)]" : "glass-surface hover:bg-[var(--bg-tertiary)]"}`}
                >
                  <MeshiMascot size={36} mood={meshiFace} hat={hat} color={meshiColor} animate={false} showGlow={false} />
                  <span className="text-[10px] text-[var(--text-secondary)] capitalize">{hat}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Color theme */}
          <div className="glass-card rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Color</h3>
            <div className="grid grid-cols-4 gap-3">
              {(["blue", "purple", "pink", "green", "orange", "cyan", "gold", "rainbow"] as MeshiColor[]).map((color) => (
                <button
                  key={color}
                  onClick={() => { setMeshiColor(color); localStorage.setItem("meshiColor", color); }}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all ${meshiColor === color ? "ring-2 ring-[var(--accent)] bg-[var(--accent-subtle)]" : "glass-surface hover:bg-[var(--bg-tertiary)]"}`}
                >
                  <MeshiMascot size={36} mood={meshiFace} hat={meshiHat} color={color} animate={false} showGlow={false} />
                  <span className="text-[10px] text-[var(--text-secondary)] capitalize">{color}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Save Preferences Button */}
          <button
            onClick={() => {
              startTransition(async () => {
                await updateMeshiPreference({ faceStyle: meshiFace, hatStyle: meshiHat, colorTheme: meshiColor });
                localStorage.setItem("meshiFace", meshiFace);
                localStorage.setItem("meshiHat", meshiHat);
                localStorage.setItem("meshiColor", meshiColor);
                window.dispatchEvent(new StorageEvent("storage", { key: "meshiFace", newValue: meshiFace }));
                window.dispatchEvent(new StorageEvent("storage", { key: "meshiHat", newValue: meshiHat }));
                window.dispatchEvent(new StorageEvent("storage", { key: "meshiColor", newValue: meshiColor }));
                showSuccess("Meshi preferences saved!");
              });
            }}
            className="w-full py-3 rounded-xl brand-button text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all"
          >
            <Sparkles className="h-4 w-4" />
            Save Meshi Preferences
          </button>

          {/* App Logo Customization */}
          <div className="glass-card rounded-2xl p-5 mt-6">
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
                localStorage.setItem("meshiAppLogo", "custom");
                localStorage.setItem("meshiAppLogoColor", meshiColor);
                window.dispatchEvent(new StorageEvent("storage", { key: "meshiAppLogo", newValue: "custom" }));
                window.dispatchEvent(new StorageEvent("storage", { key: "meshiAppLogoColor", newValue: meshiColor }));
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
                localStorage.setItem("meshiAppLogo", "default");
                localStorage.removeItem("meshiAppLogoColor");
                window.dispatchEvent(new StorageEvent("storage", { key: "meshiAppLogo", newValue: "default" }));
                window.dispatchEvent(new StorageEvent("storage", { key: "meshiAppLogoColor", newValue: "blue" }));
                showSuccess("App logo reset to default");
              }}
              className="w-full py-2 rounded-xl text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors mt-2"
            >
              Reset to Default Logo
            </button>
          </div>
        </>
      )}
    </motion.div>
  );
}
