"use client";

import { updateMeshiPreference, getUserUnlockedCosmetics } from "@/lib/actions";
import { useState, useTransition, useEffect, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Sparkles, Crown, ArrowRight, Lock, Trophy, Palette, Shirt, ScanFace, WandSparkles } from "lucide-react";
import {
  MeshiMascot,
  type MeshiMood,
  type MeshiHat,
  type MeshiColor,
  type MeshiEyeStyle,
  ACHIEVEMENT_TITLES,
  type MeshiHair,
  type MeshiAccessory,
  type MeshiBadge,
  type MeshiOutfit,
} from "@/components/meshi/meshi-mascot";
import { updateMeshiLocalPreferences, useMeshiPreferences } from "@/hooks/use-meshi-preferences";
import { SettingsCard, SettingsCardHeader } from "./settings-primitives";

interface MeshiTabProps {
  showSuccess: (msg: string) => void;
  isMeshPro?: boolean;
}

interface OptionGridCardProps {
  title: string;
  icon: ReactNode;
  columns?: string;
  children: ReactNode;
}

function OptionGridCard({ title, icon, columns = "grid-cols-4", children }: OptionGridCardProps) {
  return (
    <SettingsCard>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <SettingsCardHeader title={title} className="mb-0" />
      </div>
      <div className={`grid ${columns} gap-3`}>{children}</div>
    </SettingsCard>
  );
}

export function MeshiTab({ showSuccess, isMeshPro = false }: MeshiTabProps) {
  const [, startTransition] = useTransition();
  const { color, hat, face, hair, accessory, eye, badge, outfit, enabled, title, refresh } = useMeshiPreferences();

  const [meshiHat, setMeshiHat] = useState<MeshiHat>(hat);
  const [meshiFace, setMeshiFace] = useState<MeshiMood>(face);
  const [meshiColor, setMeshiColor] = useState<MeshiColor>(color);
  const [meshiHair, setMeshiHair] = useState<MeshiHair>(hair);
  const [meshiAccessory, setMeshiAccessory] = useState<MeshiAccessory>(accessory);
  const [meshiEye, setMeshiEye] = useState<MeshiEyeStyle>(eye);
  const [meshiBadge, setMeshiBadge] = useState<MeshiBadge>(badge);
  const [meshiOutfit, setMeshiOutfit] = useState<MeshiOutfit>(outfit);
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

  const BASIC_COLORS: MeshiColor[] = ["blue", "purple", "green"];
  const PRO_COLORS: MeshiColor[] = ["pink", "orange", "cyan", "gold", "rainbow", "crimson", "midnight", "rose", "emerald", "arctic", "obsidian"];
  const PRO_HATS: MeshiHat[] = ["none", "tophat", "beanie", "cap", "party", "crown", "flower", "headphones", "halo", "wizard", "astronaut", "pirate", "chef"];
  const PRO_FACES: MeshiMood[] = ["happy", "excited", "thinking", "sleepy", "surprised", "love", "cool", "wink", "searching", "learning", "celebrating", "shy", "giggle"];
  const PRO_HAIRS: MeshiHair[] = ["none", "fluffy", "bangs", "spikes", "curls"];
  const PRO_EYES: MeshiEyeStyle[] = ["regular", "lashes"];
  const PRO_ACCESSORIES: MeshiAccessory[] = ["none", "glasses", "sunglasses", "monocle"];
  const PRO_BADGES: MeshiBadge[] = ["none", "spark", "heart", "shield", "verified", "creator", "founder"];
  const PRO_OUTFITS: MeshiOutfit[] = ["none", "scarf", "hoodie", "jacket", "overalls", "cape", "spacesuit"];

  const resetToSaved = () => {
    setMeshiHat(hat);
    setMeshiFace(face);
    setMeshiColor(color);
    setMeshiHair(hair);
    setMeshiAccessory(accessory);
    setMeshiEye(eye);
    setMeshiBadge(badge);
    setMeshiOutfit(outfit);
    setMeshiEnabled(enabled);
    setActiveTitle(title);
    showSuccess("Reset to your saved Meshi settings");
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <SettingsCard className="overflow-hidden">
        <div className="absolute inset-0 opacity-30 pointer-events-none" style={{ background: "radial-gradient(circle at top right, var(--accent-subtle), transparent 50%)" }} />
        <div className="relative">
          <div className="flex flex-col items-center text-center">
            <MeshiMascot size={86} mood={meshiFace} hat={meshiHat} color={meshiColor} hair={meshiHair} accessory={meshiAccessory} eyeStyle={meshiEye} badge={meshiBadge} outfit={meshiOutfit} speaking={false} />
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mt-3 mb-1">Meshi Studio</h2>
            <p className="text-xs text-[var(--text-muted)] max-w-sm">
              Make Meshi look and feel like you.
            </p>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg p-2 bg-[var(--bg-tertiary)]">
              <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Plan</p>
              <p className="text-xs font-semibold text-[var(--text-primary)]">{isMeshPro ? "MeshPro" : "Basic"}</p>
            </div>
            <div className="rounded-lg p-2 bg-[var(--bg-tertiary)]">
              <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Unlocked Faces</p>
              <p className="text-xs font-semibold text-[var(--text-primary)]">{1 + unlockedFaces.length}</p>
            </div>
            <div className="rounded-lg p-2 bg-[var(--bg-tertiary)]">
              <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Unlocked Titles</p>
              <p className="text-xs font-semibold text-[var(--text-primary)]">{unlockedTitles.length}</p>
            </div>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Enable Meshi</h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Show your floating Meshi companion across the platform.</p>
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
          {isMeshPro && (
            <>
              <OptionGridCard title="Expression" icon={<ScanFace className="h-3.5 w-3.5 text-[var(--accent)]" />}>
                {[...PRO_FACES, ...(unlockedFaces.includes("synergy1017") ? (["synergy1017"] as MeshiMood[]) : [])].map((faceOption) => (
                  <button
                    key={faceOption}
                    onClick={() => {
                      setMeshiFace(faceOption);
                      updateMeshiLocalPreferences({ face: faceOption });
                    }}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all ${meshiFace === faceOption ? "ring-2 ring-[var(--accent)] bg-[var(--accent-subtle)]" : "glass-surface hover:bg-[var(--bg-tertiary)]"}`}
                  >
                    <MeshiMascot size={36} mood={faceOption} color={meshiColor} hat={meshiHat} hair={meshiHair} accessory={meshiAccessory} eyeStyle={meshiEye} badge={meshiBadge} outfit={meshiOutfit} animate={false} showGlow={false} />
                    <span className="text-[10px] text-[var(--text-secondary)] capitalize">{faceOption}</span>
                  </button>
                ))}
              </OptionGridCard>

              <OptionGridCard title="Hair" icon={<Shirt className="h-3.5 w-3.5 text-[var(--accent)]" />} columns="grid-cols-5">
                {PRO_HAIRS.map((hairOption) => (
                  <button
                    key={hairOption}
                    onClick={() => {
                      setMeshiHair(hairOption);
                      updateMeshiLocalPreferences({ hair: hairOption });
                    }}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all ${meshiHair === hairOption ? "ring-2 ring-[var(--accent)] bg-[var(--accent-subtle)]" : "glass-surface hover:bg-[var(--bg-tertiary)]"}`}
                  >
                    <MeshiMascot size={36} mood={meshiFace} hair={hairOption} accessory={meshiAccessory} eyeStyle={meshiEye} hat={meshiHat} color={meshiColor} badge={meshiBadge} outfit={meshiOutfit} animate={false} showGlow={false} />
                    <span className="text-[10px] text-[var(--text-secondary)] capitalize">{hairOption}</span>
                  </button>
                ))}
              </OptionGridCard>

              <OptionGridCard title="Eyes" icon={<ScanFace className="h-3.5 w-3.5 text-[var(--accent)]" />} columns="grid-cols-2">
                {PRO_EYES.map((eyeOption) => (
                  <button
                    key={eyeOption}
                    onClick={() => {
                      setMeshiEye(eyeOption);
                      updateMeshiLocalPreferences({ eye: eyeOption });
                    }}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all ${meshiEye === eyeOption ? "ring-2 ring-[var(--accent)] bg-[var(--accent-subtle)]" : "glass-surface hover:bg-[var(--bg-tertiary)]"}`}
                  >
                    <MeshiMascot size={36} mood={meshiFace} hair={meshiHair} accessory={meshiAccessory} eyeStyle={eyeOption} hat={meshiHat} color={meshiColor} badge={meshiBadge} outfit={meshiOutfit} animate={false} showGlow={false} />
                    <span className="text-[10px] text-[var(--text-secondary)] capitalize">{eyeOption}</span>
                  </button>
                ))}
              </OptionGridCard>

              <OptionGridCard title="Accessories" icon={<WandSparkles className="h-3.5 w-3.5 text-[var(--accent)]" />} columns="grid-cols-5">
                {PRO_ACCESSORIES.map((accessoryOption) => (
                  <button
                    key={accessoryOption}
                    onClick={() => {
                      setMeshiAccessory(accessoryOption);
                      updateMeshiLocalPreferences({ accessory: accessoryOption });
                    }}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all ${meshiAccessory === accessoryOption ? "ring-2 ring-[var(--accent)] bg-[var(--accent-subtle)]" : "glass-surface hover:bg-[var(--bg-tertiary)]"}`}
                  >
                    <MeshiMascot size={36} mood={meshiFace} hair={meshiHair} accessory={accessoryOption} eyeStyle={meshiEye} hat={meshiHat} color={meshiColor} badge={meshiBadge} outfit={meshiOutfit} animate={false} showGlow={false} />
                    <span className="text-[10px] text-[var(--text-secondary)] capitalize">{accessoryOption}</span>
                  </button>
                ))}
              </OptionGridCard>

              <OptionGridCard title="Badges" icon={<Trophy className="h-3.5 w-3.5 text-amber-400" />} columns="grid-cols-4">
                {PRO_BADGES.map((badgeOption) => (
                  <button
                    key={badgeOption}
                    onClick={() => {
                      setMeshiBadge(badgeOption);
                      updateMeshiLocalPreferences({ badge: badgeOption });
                    }}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all ${meshiBadge === badgeOption ? "ring-2 ring-amber-400 bg-amber-400/10" : "glass-surface hover:bg-[var(--bg-tertiary)]"}`}
                  >
                    <MeshiMascot size={36} mood={meshiFace} hair={meshiHair} accessory={meshiAccessory} eyeStyle={meshiEye} hat={meshiHat} color={meshiColor} badge={badgeOption} outfit={meshiOutfit} animate={false} showGlow={false} />
                    <span className="text-[10px] text-[var(--text-secondary)] capitalize">{badgeOption}</span>
                  </button>
                ))}
              </OptionGridCard>

              <OptionGridCard title="Outfits" icon={<Shirt className="h-3.5 w-3.5 text-[var(--accent)]" />} columns="grid-cols-4">
                {PRO_OUTFITS.map((outfitOption) => (
                  <button
                    key={outfitOption}
                    onClick={() => {
                      setMeshiOutfit(outfitOption);
                      updateMeshiLocalPreferences({ outfit: outfitOption });
                    }}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all ${meshiOutfit === outfitOption ? "ring-2 ring-[var(--accent)] bg-[var(--accent-subtle)]" : "glass-surface hover:bg-[var(--bg-tertiary)]"}`}
                  >
                    <MeshiMascot size={36} mood={meshiFace} hair={meshiHair} accessory={meshiAccessory} eyeStyle={meshiEye} hat={meshiHat} color={meshiColor} badge={meshiBadge} outfit={outfitOption} animate={false} showGlow={false} />
                    <span className="text-[10px] text-[var(--text-secondary)] capitalize">{outfitOption}</span>
                  </button>
                ))}
              </OptionGridCard>

              <OptionGridCard title="Hat" icon={<Crown className="h-3.5 w-3.5 text-amber-400" />}>
                {PRO_HATS.map((hatOption) => (
                  <button
                    key={hatOption}
                    onClick={() => {
                      setMeshiHat(hatOption);
                      updateMeshiLocalPreferences({ hat: hatOption });
                    }}
                    className={`relative flex flex-col items-center gap-2 p-3 rounded-xl transition-all ${meshiHat === hatOption ? "ring-2 ring-amber-400 bg-amber-400/10" : "glass-surface hover:bg-[var(--bg-tertiary)]"}`}
                  >
                    <MeshiMascot size={36} mood={meshiFace} hair={meshiHair} accessory={meshiAccessory} eyeStyle={meshiEye} hat={hatOption} color={meshiColor} badge={meshiBadge} outfit={meshiOutfit} animate={false} showGlow={false} />
                    <span className="text-[10px] text-[var(--text-secondary)] capitalize">{hatOption}</span>
                  </button>
                ))}
              </OptionGridCard>
            </>
          )}

          <SettingsCard>
            <div className="flex items-center gap-2 mb-3">
              <Palette className="h-3.5 w-3.5 text-[var(--accent)]" />
              <SettingsCardHeader title="Color" className="mb-0" />
            </div>
            <div className="grid grid-cols-4 gap-3">
              {BASIC_COLORS.map((colorOption) => (
                <button
                  key={colorOption}
                  onClick={() => {
                    setMeshiColor(colorOption);
                    updateMeshiLocalPreferences({ color: colorOption });
                  }}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all ${meshiColor === colorOption ? "ring-2 ring-[var(--accent)] bg-[var(--accent-subtle)]" : "glass-surface hover:bg-[var(--bg-tertiary)]"}`}
                >
                  <MeshiMascot size={36} mood={meshiFace} hair={meshiHair} accessory={meshiAccessory} eyeStyle={meshiEye} hat={meshiHat} color={colorOption} badge={meshiBadge} outfit={meshiOutfit} animate={false} showGlow={false} />
                  <span className="text-[10px] text-[var(--text-secondary)] capitalize">{colorOption}</span>
                </button>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-[var(--border-primary)]">
              <div className="flex items-center gap-2 mb-3">
                <Crown className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-xs font-semibold text-amber-400">MeshPro Palette</span>
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
                      !isMeshPro ? "opacity-50 cursor-not-allowed" : meshiColor === colorOption ? "ring-2 ring-amber-400 bg-amber-400/10" : "glass-surface hover:bg-[var(--bg-tertiary)]"
                    }`}
                  >
                    {!isMeshPro && <Lock className="absolute top-1.5 right-1.5 h-3 w-3 text-[var(--text-muted)]" />}
                    <MeshiMascot size={36} mood={meshiFace} hair={meshiHair} accessory={meshiAccessory} eyeStyle={meshiEye} hat={meshiHat} color={colorOption} badge={meshiBadge} outfit={meshiOutfit} animate={false} showGlow={false} />
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
            <p className="text-xs text-[var(--text-muted)] mb-4">Choose any unlocked title to appear under Meshi in supported views.</p>
            <div className="space-y-2 max-h-80 overflow-auto pr-1">
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
                      !unlocked ? "opacity-40 cursor-not-allowed" : activeTitle === key ? "ring-2 ring-amber-400 bg-amber-400/10" : "glass-surface hover:bg-[var(--bg-tertiary)]"
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
                  await updateMeshiPreference({
                    faceStyle: meshiFace,
                    hatStyle: meshiHat,
                    colorTheme: meshiColor,
                    hairStyle: meshiHair,
                    accessoryStyle: meshiAccessory,
                    eyeStyle: meshiEye,
                    badgeStyle: meshiBadge,
                    outfitStyle: meshiOutfit,
                  });
                  updateMeshiLocalPreferences({
                    face: meshiFace,
                    hat: meshiHat,
                    color: meshiColor,
                    hair: meshiHair,
                    accessory: meshiAccessory,
                    eye: meshiEye,
                    badge: meshiBadge,
                    outfit: meshiOutfit,
                  });
                  refresh();
                  showSuccess("Meshi saved");
                });
              }}
              className="flex-[1.25] py-3 rounded-xl brand-button text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all"
            >
              <Sparkles className="h-4 w-4" />
              Save Meshi
            </button>
          </div>

          <SettingsCard className="mt-6">
            <div className="flex items-center gap-2 mb-1">
              <Crown className="h-4 w-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">App Logo</h3>
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded text-amber-400 bg-amber-400/10">MeshPro</span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mb-4">Use your current Meshi build as your personal logo across supported surfaces.</p>
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
                  <MeshiMascot size={36} mood={meshiFace} color={meshiColor} hair={meshiHair} accessory={meshiAccessory} eyeStyle={meshiEye} hat={meshiHat} badge={meshiBadge} outfit={meshiOutfit} animate showGlow={false} bouncy />
                </div>
              </div>
            </div>
            {isMeshPro ? (
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
            ) : (
              <button
                disabled
                className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 opacity-50 cursor-not-allowed"
                style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border-primary)", color: "var(--text-muted)" }}
              >
                <Lock className="h-3.5 w-3.5" />
                Upgrade to MeshPro to set custom app logo
              </button>
            )}
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
