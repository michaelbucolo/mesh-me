"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MeshiMini, type MeshiColor, type MeshiHat, type MeshiMood } from "./meshi-mascot";
import type { RemoteMeshi } from "@/components/mesh/meshi-on-mesh";

interface MeshiPresence {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  meshiColor: string;
  meshiHat: string;
  meshiMood: string;
  position: { x: number; y: number };
}

interface LiveMeshiPresenceProps {
  viewingMesh: string | null;
  myMeshiColor: MeshiColor;
  myMeshiHat: MeshiHat;
  myMeshiPosition?: { x: number; y: number };
  myMeshiMood?: string;
  onInteract?: (presence: MeshiPresence) => void;
  onRemoteMeshisChange?: (meshis: RemoteMeshi[]) => void;
}

export function LiveMeshiPresence({
  viewingMesh, myMeshiColor, myMeshiHat,
  myMeshiPosition, myMeshiMood,
  onInteract, onRemoteMeshisChange,
}: LiveMeshiPresenceProps) {
  const [presences, setPresences] = useState<MeshiPresence[]>([]);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const positionRef = useRef(myMeshiPosition || { x: 400, y: 300 });
  const moodRef = useRef(myMeshiMood || "exploring");

  // Keep position/mood refs in sync
  useEffect(() => {
    if (myMeshiPosition) positionRef.current = myMeshiPosition;
  }, [myMeshiPosition]);
  useEffect(() => {
    if (myMeshiMood) moodRef.current = myMeshiMood;
  }, [myMeshiMood]);

  // Send heartbeat with actual Meshi canvas coordinates
  const sendHeartbeat = useCallback(async () => {
    try {
      await fetch("/api/mesh/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meshiColor: myMeshiColor,
          meshiHat: myMeshiHat,
          meshiMood: moodRef.current,
          position: positionRef.current,
          viewingMesh,
        }),
      });
    } catch { /* silently fail */ }
  }, [myMeshiColor, myMeshiHat, viewingMesh]);

  // Poll for other users' presences
  const pollPresences = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (viewingMesh) params.set("meshOwner", viewingMesh);
      const res = await fetch(`/api/mesh/presence?${params}`);
      if (res.ok) {
        const data = await res.json();
        const list: MeshiPresence[] = data.presences || [];
        setPresences(list);

        // Convert to RemoteMeshi format for canvas rendering
        if (onRemoteMeshisChange) {
          const remoteMeshis: RemoteMeshi[] = list.map((p) => ({
            userId: p.userId,
            username: p.username,
            displayName: p.displayName,
            x: p.position.x,
            y: p.position.y,
            color: p.meshiColor,
            hat: p.meshiHat,
            mood: (p.meshiMood as RemoteMeshi["mood"]) || "happy",
          }));
          onRemoteMeshisChange(remoteMeshis);
        }
      }
    } catch { /* silently fail */ }
  }, [viewingMesh, onRemoteMeshisChange]);

  // Start heartbeat and polling — restarts when callbacks change (prop updates)
  useEffect(() => {
    const heartbeat = setInterval(sendHeartbeat, 10000);
    const poll = setInterval(pollPresences, 5000);
    heartbeatRef.current = heartbeat;
    pollRef.current = poll;

    // Trigger initial calls via microtask to avoid direct setState in effect
    const initTimer = setTimeout(() => {
      sendHeartbeat();
      pollPresences();
    }, 0);

    return () => {
      clearTimeout(initTimer);
      clearInterval(heartbeat);
      clearInterval(poll);
    };
  }, [sendHeartbeat, pollPresences]);

  // Clean up presence only on true component unmount (empty deps)
  useEffect(() => {
    return () => {
      fetch("/api/mesh/presence", { method: "DELETE" }).catch(() => {});
    };
  }, []);

  if (presences.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-20 right-4 z-40 flex flex-col items-end gap-2">
      {/* Presence count badge */}
      <div className="pointer-events-auto flex items-center gap-2 rounded-2xl px-3 py-1.5 glass-card text-xs">
        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-[var(--text-secondary)] font-medium">
          {presences.length} {presences.length === 1 ? "Meshi" : "Meshis"} nearby
        </span>
      </div>

      {/* Individual Meshi presences */}
      <AnimatePresence>
        {presences.slice(0, 5).map((presence, i) => (
          <motion.div
            key={presence.userId}
            initial={{ opacity: 0, x: 20, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.8 }}
            transition={{ delay: i * 0.1 }}
            className="pointer-events-auto"
          >
            <button
              onClick={() => onInteract?.(presence)}
              className="flex items-center gap-2 rounded-2xl px-3 py-2 glass-card hover:bg-[var(--glass-card-hover)] transition-all cursor-pointer"
            >
              <motion.div
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 2 + i * 0.3, repeat: Infinity }}
              >
                <MeshiMini
                  size={24}
                  color={presence.meshiColor as MeshiColor}
                  hat={presence.meshiHat as MeshiHat}
                  mood={(presence.meshiMood as MeshiMood) || "happy"}
                />
              </motion.div>
              <div className="flex flex-col items-start">
                <span className="text-[10px] text-[var(--text-primary)] font-medium leading-tight">
                  {presence.displayName}
                </span>
                <span className="text-[9px] text-[var(--text-muted)] leading-tight">
                  @{presence.username}
                </span>
              </div>
            </button>
          </motion.div>
        ))}
      </AnimatePresence>

      {presences.length > 5 && (
        <div className="text-[10px] text-[var(--text-muted)] pr-2">
          +{presences.length - 5} more
        </div>
      )}
    </div>
  );
}
