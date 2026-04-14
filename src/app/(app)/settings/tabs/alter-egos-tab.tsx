"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useTransition, useEffect } from "react";
import { motion } from "framer-motion";
import { Users, Trash2 } from "lucide-react";
import type { AlterEgo } from "./types";

interface AlterEgosTabProps {
  showSuccess: (msg: string) => void;
}

export function AlterEgosTab({ showSuccess }: AlterEgosTabProps) {
  const [isPending, startTransition] = useTransition();
  const [alterEgos, setAlterEgos] = useState<AlterEgo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [newEgoUsername, setNewEgoUsername] = useState("");
  const [newEgoDisplayName, setNewEgoDisplayName] = useState("");
  const [newEgoBio, setNewEgoBio] = useState("");
  const [alterEgoError, setAlterEgoError] = useState("");
  const [deletingEgoId, setDeletingEgoId] = useState<string | null>(null);

  useEffect(() => {
    if (!loaded) {
      fetch("/api/account/alter-egos").then((r) => r.json()).then((data) => {
        if (data.alterEgos) setAlterEgos(data.alterEgos);
        setLoaded(true);
      }).catch(() => setLoaded(true));
    }
  }, [loaded]);

  const handleCreate = () => {
    if (!newEgoUsername.trim() || !newEgoDisplayName.trim()) {
      setAlterEgoError("Username and display name are required");
      return;
    }
    setAlterEgoError("");
    startTransition(async () => {
      const res = await fetch("/api/account/alter-egos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: newEgoUsername.trim().toLowerCase(), displayName: newEgoDisplayName.trim(), bio: newEgoBio.trim() || null }),
      });
      const data = await res.json();
      if (data.error) setAlterEgoError(data.error);
      else if (data.alterEgo) {
        setAlterEgos((prev) => [...prev, data.alterEgo]);
        setNewEgoUsername(""); setNewEgoDisplayName(""); setNewEgoBio("");
        showSuccess("Alter ego created!");
      }
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const res = await fetch(`/api/account/alter-egos?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setAlterEgos((prev) => prev.filter((e) => e.id !== id));
        setDeletingEgoId(null);
        showSuccess("Alter ego removed");
      }
    });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3" style={{ background: "var(--accent-subtle)" }}>
          <Users className="h-7 w-7" style={{ color: "var(--accent)" }} />
        </div>
        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-1">Alter Egos</h2>
        <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
          Create separate personas for different parts of your online presence. Each alter ego appears as a distinct node in your mesh.
        </p>
      </div>

      {/* Create new alter ego */}
      <div className="glass-card rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Create New Persona</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Username</label>
            <Input value={newEgoUsername} onChange={(e) => setNewEgoUsername(e.target.value)} placeholder="e.g. btv_gaming" className="text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Display Name</label>
            <Input value={newEgoDisplayName} onChange={(e) => setNewEgoDisplayName(e.target.value)} placeholder="e.g. BTV" className="text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Bio (optional)</label>
            <Input value={newEgoBio} onChange={(e) => setNewEgoBio(e.target.value)} placeholder="What is this persona about?" className="text-sm" />
          </div>
          {alterEgoError && <p className="text-xs text-red-400">{alterEgoError}</p>}
          <Button onClick={handleCreate} variant="gradient" className="w-full" disabled={isPending}>Create Alter Ego</Button>
        </div>
      </div>

      {/* Existing alter egos */}
      <div className="glass-card rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">
          Your Personas {alterEgos.length > 0 && <span className="text-[var(--text-muted)] font-normal">({alterEgos.length})</span>}
        </h3>
        {!loaded ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : alterEgos.length === 0 ? (
          <div className="text-center py-8">
            <Users className="h-8 w-8 mx-auto mb-2 text-[var(--text-muted)]" />
            <p className="text-sm text-[var(--text-muted)]">No alter egos yet</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">Create one above to separate different parts of your online identity</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alterEgos.map((ego) => (
              <div key={ego.id} className="flex items-center gap-3 p-3 rounded-xl glass-surface">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ background: "var(--accent)" }}>
                  {ego.displayName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)] truncate">{ego.displayName}</p>
                  <p className="text-xs text-[var(--text-muted)] truncate">@{ego.username}</p>
                  {ego.bio && <p className="text-xs text-[var(--text-tertiary)] mt-0.5 truncate">{ego.bio}</p>}
                </div>
                {deletingEgoId === ego.id ? (
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleDelete(ego.id)} className="text-xs px-2 py-1 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors" disabled={isPending}>Confirm</button>
                    <button onClick={() => setDeletingEgoId(null)} className="text-xs px-2 py-1 rounded-lg glass-surface text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setDeletingEgoId(ego.id)} className="text-xs text-[var(--text-muted)] hover:text-red-400 transition-colors p-1">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl p-4 text-center" style={{ background: "var(--accent-subtle)", border: "1px solid var(--accent-muted)" }}>
        <p className="text-xs text-[var(--text-muted)]">
          Alter egos appear as separate nodes in your mesh, connected to your main identity.
          They help you organize different aspects of your online presence — like gaming, music, or professional accounts.
        </p>
      </div>
    </motion.div>
  );
}
