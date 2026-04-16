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
  viewportPosition: { vx: number; vy: number };
  isOnline?: boolean;
}

/** Node position info for generating offline sleeping Meshis */
interface UserNodeInfo {
  userId: string;
  username: string;
  displayName: string;
  x: number;
  y: number;
}

/** Viewport conversion info — needed to map viewport-relative positions to world coords */
interface ViewportInfo {
  zoom: number;
  panX: number;
  panY: number;
  centerX: number;
  centerY: number;
  canvasWidth: number;
  canvasHeight: number;
}

interface LiveMeshiPresenceProps {
  viewingMesh: string | null;
  myMeshiColor: MeshiColor;
  myMeshiHat: MeshiHat;
  myMeshiPosition?: { x: number; y: number };
  myMeshiMood?: string;
  /** Viewport info for converting between world and viewport-relative coords */
  viewportInfo?: ViewportInfo;
  /** User nodes on the mesh — used to generate offline sleeping Meshis */
  userNodes?: UserNodeInfo[];
  onInteract?: (presence: MeshiPresence) => void;
  onRemoteMeshisChange?: (meshis: RemoteMeshi[]) => void;
}

/** Convert world coordinates to viewport-relative (0-1 range) */
function worldToViewport(
  worldX: number, worldY: number, vp: ViewportInfo,
): { vx: number; vy: number } {
  const screenX = (worldX - vp.centerX) * vp.zoom + vp.canvasWidth / 2 + vp.panX;
  const screenY = (worldY - vp.centerY) * vp.zoom + vp.canvasHeight / 2 + vp.panY;
  return {
    vx: vp.canvasWidth > 0 ? screenX / vp.canvasWidth : 0.5,
    vy: vp.canvasHeight > 0 ? screenY / vp.canvasHeight : 0.5,
  };
}

/** Convert viewport-relative (0-1 range) to world coordinates */
function viewportToWorld(
  vx: number, vy: number, vp: ViewportInfo,
): { x: number; y: number } {
  const screenX = vx * vp.canvasWidth;
  const screenY = vy * vp.canvasHeight;
  return {
    x: (screenX - vp.canvasWidth / 2 - vp.panX) / vp.zoom + vp.centerX,
    y: (screenY - vp.canvasHeight / 2 - vp.panY) / vp.zoom + vp.centerY,
  };
}

export function LiveMeshiPresence({
  viewingMesh, myMeshiColor, myMeshiHat,
  myMeshiPosition, myMeshiMood, viewportInfo, userNodes,
  onInteract, onRemoteMeshisChange,
}: LiveMeshiPresenceProps) {
  const [presences, setPresences] = useState<MeshiPresence[]>([]);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const positionRef = useRef(myMeshiPosition || { x: 400, y: 300 });
  const moodRef = useRef(myMeshiMood || "exploring");
  const userNodesRef = useRef<UserNodeInfo[]>(userNodes || []);
  const viewportInfoRef = useRef<ViewportInfo>(viewportInfo || {
    zoom: 0.65, panX: 0, panY: 0, centerX: 400, centerY: 300, canvasWidth: 800, canvasHeight: 600,
  });

  // Keep refs in sync
  useEffect(() => {
    if (myMeshiPosition) positionRef.current = myMeshiPosition;
  }, [myMeshiPosition]);
  useEffect(() => {
    if (myMeshiMood) moodRef.current = myMeshiMood;
  }, [myMeshiMood]);
  useEffect(() => {
    if (userNodes) userNodesRef.current = userNodes;
  }, [userNodes]);
  useEffect(() => {
    if (viewportInfo) viewportInfoRef.current = viewportInfo;
  }, [viewportInfo]);

  // Send heartbeat with viewport-relative position
  const sendHeartbeat = useCallback(async () => {
    try {
      const vp = viewportInfoRef.current;
      const pos = positionRef.current;
      // Convert world position to viewport-relative (0-1)
      const vpPos = worldToViewport(pos.x, pos.y, vp);

      await fetch("/api/mesh/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meshiColor: myMeshiColor,
          meshiHat: myMeshiHat,
          meshiMood: moodRef.current,
          position: pos,
          viewportPosition: vpPos,
          viewingMesh,
        }),
      });
    } catch { /* silently fail */ }
  }, [myMeshiColor, myMeshiHat, viewingMesh]);

  // Poll for other users' presences and merge with offline Meshis from nodes
  const pollPresences = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (viewingMesh) params.set("meshOwner", viewingMesh);
      // Pass connected user IDs so API can return any online connected user
      const nodes = userNodesRef.current;
      if (nodes.length > 0) {
        params.set("connectedIds", nodes.map((n) => n.userId).join(","));
      }
      const res = await fetch(`/api/mesh/presence?${params}`);
      if (res.ok) {
        const data = await res.json();
        const list: MeshiPresence[] = data.presences || [];
        setPresences(list.filter((p) => p.isOnline));

        // Build remote Meshis: online users from presence + offline sleeping Meshis from nodes
        if (onRemoteMeshisChange) {
          const vp = viewportInfoRef.current;
          const onlineUserIds = new Set(list.map((p) => p.userId));

          // Online Meshis — convert viewport-relative position to world coords
          const onlineMeshis: RemoteMeshi[] = list.map((p) => {
            // Use viewport-relative position to place Meshi at the same screen position
            const vpPos = p.viewportPosition || { vx: 0.5, vy: 0.5 };
            const worldPos = viewportToWorld(vpPos.vx, vpPos.vy, vp);

            return {
              userId: p.userId,
              username: p.username,
              displayName: p.displayName,
              x: worldPos.x,
              y: worldPos.y,
              color: p.meshiColor,
              hat: p.meshiHat,
              mood: (p.meshiMood as RemoteMeshi["mood"]) || "happy",
              isOnline: p.isOnline !== false,
            };
          });

          // Offline sleeping Meshis — positioned near their user node
          const offlineMeshis: RemoteMeshi[] = nodes
            .filter((n) => !onlineUserIds.has(n.userId))
            .map((n) => ({
              userId: n.userId,
              username: n.username,
              displayName: n.displayName,
              // Position slightly below-right of their node (sleeping at home)
              x: n.x + 12,
              y: n.y + 18,
              color: "blue",
              hat: "none",
              mood: "sleeping" as RemoteMeshi["mood"],
              isOnline: false,
            }));

          onRemoteMeshisChange([...onlineMeshis, ...offlineMeshis]);
        }
      }
    } catch { /* silently fail */ }
  }, [viewingMesh, onRemoteMeshisChange]);

  // Start heartbeat (3s) and polling (2s) — faster for more real-time feel
  useEffect(() => {
    const heartbeat = setInterval(sendHeartbeat, 3000);
    const poll = setInterval(pollPresences, 2000);
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

  const onlinePresences = presences.filter((p) => p.isOnline);

  if (onlinePresences.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-20 right-4 z-40 flex flex-col items-end gap-2">
      {/* Presence count badge */}
      <div className="pointer-events-auto flex items-center gap-2 rounded-2xl px-3 py-1.5 glass-card text-xs">
        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-[var(--text-secondary)] font-medium">
          {onlinePresences.length} {onlinePresences.length === 1 ? "Meshi" : "Meshis"} online
        </span>
      </div>

      {/* Individual Meshi presences */}
      <AnimatePresence>
        {onlinePresences.slice(0, 5).map((presence, i) => (
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

      {onlinePresences.length > 5 && (
        <div className="text-[10px] text-[var(--text-muted)] pr-2">
          +{onlinePresences.length - 5} more
        </div>
      )}
    </div>
  );
}
