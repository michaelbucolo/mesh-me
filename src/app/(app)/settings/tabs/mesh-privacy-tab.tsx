"use client";

import { Button } from "@/components/ui/button";
import { updateMeshPrivacy, optIntoGlobalMesh, optOutOfGlobalMesh, updateGlobalMeshBranches } from "@/lib/actions";
import { getMeshPrivacy, getGlobalMeshStatus } from "@/lib/queries";
import { useState, useTransition, useEffect } from "react";
import { motion } from "framer-motion";
import { Eye, Activity, Globe, Users, Heart, Check } from "lucide-react";

interface MeshPrivacyTabProps {
  showSuccess: (msg: string) => void;
  showError: (msg: string) => void;
}

function parseRecord(value: unknown): Record<string, string> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.fromEntries(
      Object.entries(value).filter(
        (entry): entry is [string, string] => typeof entry[0] === "string" && typeof entry[1] === "string"
      )
    );
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return Object.fromEntries(
          Object.entries(parsed).filter(
            (entry): entry is [string, string] => typeof entry[0] === "string" && typeof entry[1] === "string"
          )
        );
      }
    } catch {
      return {};
    }
  }

  return {};
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === "string");
      }
    } catch {
      return [];
    }
  }

  return [];
}

export function MeshPrivacyTab({ showSuccess, showError }: MeshPrivacyTabProps) {
  const [isPending, startTransition] = useTransition();
  const [meshVisibility, setMeshVisibility] = useState<string>("friends");
  const [branchOverrides, setBranchOverrides] = useState<Record<string, string>>({});
  const [showConnections, setShowConnections] = useState(true);
  const [showStats, setShowStats] = useState(false);
  const [globalMeshActive, setGlobalMeshActive] = useState(false);
  const [globalMeshBranches, setGlobalMeshBranches] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!loaded) {
      Promise.all([getMeshPrivacy(), getGlobalMeshStatus()]).then(([privacy, globalStatus]) => {
        if (privacy) {
          setMeshVisibility(privacy.meshVisibility);
          setBranchOverrides(parseRecord(privacy.branchOverrides));
          setShowConnections(privacy.showConnections);
          setShowStats(privacy.showStats);
        }
        if (globalStatus) {
          setGlobalMeshActive(globalStatus.isActive);
          setGlobalMeshBranches(parseStringArray(globalStatus.sharedBranches));
        }
        setLoaded(true);
      }).catch(() => setLoaded(true));
    }
  }, [loaded]);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Mesh Privacy Controls</h2>
      <p className="text-sm text-[var(--text-muted)] mb-6">Control who can see your mesh, your connections, and your data. Privacy is our #1 priority.</p>

      {!loaded ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--accent)" }} />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Overall Mesh Visibility */}
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
              <Eye className="h-4 w-4" style={{ color: "var(--accent)" }} /> Overall Mesh Visibility
            </h3>
            <p className="text-xs text-[var(--text-muted)] mb-3">Who can see your mesh visualization and connections?</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "private", label: "Private", desc: "Only you can see your mesh" },
                { id: "friends", label: "Friends Only", desc: "Mutual followers can view" },
                { id: "public", label: "Public", desc: "Anyone can see your mesh" },
                { id: "partial", label: "Custom", desc: "Per-branch visibility below" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setMeshVisibility(opt.id)}
                  className={`p-3 rounded-xl text-left transition-all border ${meshVisibility === opt.id ? "border-[var(--accent)] bg-[var(--accent)]/5" : "border-[var(--border-primary)] hover:border-[var(--border-secondary)]"}`}
                >
                  <p className={`text-sm font-medium ${meshVisibility === opt.id ? "text-[var(--accent)]" : "text-[var(--text-primary)]"}`}>{opt.label}</p>
                  <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Per-Branch Visibility */}
          {(meshVisibility === "partial" || meshVisibility === "public") && (
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                <Activity className="h-4 w-4" style={{ color: "var(--accent)" }} /> Per-Branch Visibility
              </h3>
              <p className="text-xs text-[var(--text-muted)] mb-3">Override visibility for each branch of your mesh.</p>
              <div className="space-y-2">
                {[
                  { key: "people", label: "People", icon: Users },
                  { key: "communities", label: "Communities", icon: Users },
                  { key: "interests", label: "Interests", icon: Heart },
                  { key: "platforms", label: "Connected Platforms", icon: Globe },
                ].map((branch) => {
                  const Icon = branch.icon;
                  const current = branchOverrides[branch.key] || meshVisibility;
                  return (
                    <div key={branch.key} className="flex items-center justify-between py-2.5 px-3 rounded-xl border border-[var(--border-primary)]">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-[var(--text-muted)]" />
                        <span className="text-sm text-[var(--text-primary)]">{branch.label}</span>
                      </div>
                      <select
                        value={current}
                        onChange={(e) => setBranchOverrides((prev) => ({ ...prev, [branch.key]: e.target.value }))}
                        className="text-xs px-2 py-1 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)]"
                      >
                        <option value="private">Private</option>
                        <option value="friends">Friends</option>
                        <option value="public">Public</option>
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Additional Privacy Toggles */}
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Additional Controls</h3>
            <div className="space-y-1">
              <div className="flex items-center justify-between py-3 border-b border-[var(--border-primary)]">
                <div>
                  <span className="text-sm text-[var(--text-primary)] block font-medium">Show connections</span>
                  <span className="text-xs text-[var(--text-muted)]">Let others see the lines between your mesh nodes</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowConnections(!showConnections)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${showConnections ? "bg-[var(--accent)]" : "bg-[var(--bg-hover)]"}`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${showConnections ? "right-0.5" : "left-0.5"}`} />
                </button>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-[var(--border-primary)]">
                <div>
                  <span className="text-sm text-[var(--text-primary)] block font-medium">Show stats</span>
                  <span className="text-xs text-[var(--text-muted)]">Display follower counts and mesh stats to viewers</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowStats(!showStats)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${showStats ? "bg-[var(--accent)]" : "bg-[var(--bg-hover)]"}`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${showStats ? "right-0.5" : "left-0.5"}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Save Mesh Privacy */}
          <Button
            onClick={() => {
              startTransition(async () => {
                const result = await updateMeshPrivacy({ meshVisibility, branchOverrides, showConnections, showStats });
                if (result && "error" in result) showError(result.error || "Failed to update mesh privacy");
                else showSuccess("Mesh privacy settings saved");
              });
            }}
            disabled={isPending}
          >
            {isPending ? "Saving..." : "Save Mesh Privacy"}
          </Button>

          {/* Global Mesh Section */}
          <div className="pt-6 border-t border-[var(--border-primary)]">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-2">
              <Globe className="h-4 w-4" style={{ color: "var(--accent)" }} /> Global Mesh
            </h3>
            <p className="text-xs text-[var(--text-muted)] mb-4">
              Opt-in to share parts of your mesh with the world. Choose which branches are visible on the global mesh. You can withdraw anytime.
            </p>
            <div className="flex items-center justify-between py-3 mb-4 border-b border-[var(--border-primary)]">
              <div>
                <span className="text-sm text-[var(--text-primary)] block font-medium">Join Global Mesh</span>
                <span className="text-xs text-[var(--text-muted)]">Share selected branches with everyone</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const newState = !globalMeshActive;
                  setGlobalMeshActive(newState);
                  startTransition(async () => {
                    if (newState) { await optIntoGlobalMesh(globalMeshBranches); showSuccess("Joined Global Mesh!"); }
                    else { await optOutOfGlobalMesh(); showSuccess("Left Global Mesh"); }
                  });
                }}
                className={`relative w-11 h-6 rounded-full transition-colors ${globalMeshActive ? "bg-[var(--accent)]" : "bg-[var(--bg-hover)]"}`}
              >
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${globalMeshActive ? "right-0.5" : "left-0.5"}`} />
              </button>
            </div>

            {globalMeshActive && (
              <div className="space-y-2">
                <p className="text-xs text-[var(--text-muted)] mb-2">Select which branches to share:</p>
                {[
                  { key: "people", label: "People (connections)", icon: Users },
                  { key: "communities", label: "Communities", icon: Users },
                  { key: "interests", label: "Interests", icon: Heart },
                  { key: "platforms", label: "Connected Platforms", icon: Globe },
                ].map((branch) => {
                  const Icon = branch.icon;
                  const isShared = globalMeshBranches.includes(branch.key);
                  return (
                    <button
                      key={branch.key}
                      onClick={() => {
                        const updated = isShared ? globalMeshBranches.filter((b) => b !== branch.key) : [...globalMeshBranches, branch.key];
                        setGlobalMeshBranches(updated);
                        startTransition(async () => { await updateGlobalMeshBranches(updated); });
                      }}
                      className={`w-full flex items-center gap-3 py-2.5 px-3 rounded-xl border transition-all ${isShared ? "border-[var(--accent)] bg-[var(--accent)]/5" : "border-[var(--border-primary)] hover:border-[var(--border-secondary)]"}`}
                    >
                      <Icon className={`h-4 w-4 ${isShared ? "text-[var(--accent)]" : "text-[var(--text-muted)]"}`} />
                      <span className={`text-sm ${isShared ? "text-[var(--accent)] font-medium" : "text-[var(--text-secondary)]"}`}>{branch.label}</span>
                      {isShared && <Check className="h-3.5 w-3.5 ml-auto text-[var(--accent)]" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
