"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MeshiMini, type MeshiAccessory, type MeshiBadge, type MeshiColor, type MeshiEyeStyle, type MeshiHair, type MeshiHat, type MeshiMood, type MeshiOutfit } from "./meshi-mascot";
import type { RemoteMeshi } from "@/components/mesh/meshi-on-mesh";

interface MeshiPresence {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  meshiColor: string;
  meshiHat: string;
  meshiHair?: string;
  meshiAccessory?: string;
  meshiEyeStyle?: string;
  meshiBadge?: string;
  meshiOutfit?: string;
  meshiMood: string;
  position: { x: number; y: number };
  viewportPosition: { vx: number; vy: number };
  velocity?: number;
  activity?: "idle" | "traveling" | "exploring";
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
  myMeshiHair?: MeshiHair;
  myMeshiAccessory?: MeshiAccessory;
  myMeshiEyeStyle?: MeshiEyeStyle;
  myMeshiBadge?: MeshiBadge;
  myMeshiOutfit?: MeshiOutfit;
  myMeshiPosition?: { x: number; y: number };
  myMeshiMood?: string;
  /** Viewport info for converting between world and viewport-relative coords */
  viewportInfo?: ViewportInfo;
  /** User nodes on the mesh — used to generate offline sleeping Meshis */
  userNodes?: UserNodeInfo[];
  enabled?: boolean;
  onInteract?: (presence: MeshiPresence) => void;
  onRemoteMeshisChange?: (meshis: RemoteMeshi[]) => void;
  onSummaryChange?: (summary: { totalOnline: number; sameMeshOnline: number; connectedOnline: number }) => void;
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
  viewingMesh, myMeshiColor, myMeshiHat, myMeshiHair = "none", myMeshiAccessory = "none", myMeshiEyeStyle = "regular",
  myMeshiBadge = "none", myMeshiOutfit = "none", myMeshiPosition, myMeshiMood, viewportInfo, userNodes,
  enabled = true,
  onInteract, onRemoteMeshisChange, onSummaryChange,
}: LiveMeshiPresenceProps) {
  const [presences, setPresences] = useState<MeshiPresence[]>([]);
  const [isPageVisible, setIsPageVisible] = useState(true);
  const [isOnline, setIsOnline] = useState(
    () => (typeof navigator === "undefined" ? true : navigator.onLine),
  );
  const [syncHealth, setSyncHealth] = useState<"live" | "degraded" | "offline">("live");
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const positionRef = useRef(myMeshiPosition || { x: 400, y: 300 });
  const moodRef = useRef(myMeshiMood || "exploring");
  const userNodesRef = useRef<UserNodeInfo[]>(userNodes || []);
  const viewportInfoRef = useRef<ViewportInfo>(viewportInfo || {
    zoom: 0.65, panX: 0, panY: 0, centerX: 400, centerY: 300, canvasWidth: 800, canvasHeight: 600,
  });
  const failureCountRef = useRef(0);
  const lastHeartbeatRef = useRef<{ x: number; y: number; at: number } | null>(null);

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
      const now = Date.now();
      const last = lastHeartbeatRef.current;
      let velocity = 0;
      if (last) {
        const dt = Math.max(1, now - last.at) / 1000;
        const dx = pos.x - last.x;
        const dy = pos.y - last.y;
        velocity = Math.sqrt(dx * dx + dy * dy) / dt;
      }
      const activity: "idle" | "traveling" | "exploring" = velocity > 85 ? "traveling" : velocity > 12 ? "exploring" : "idle";
      // Convert world position to viewport-relative (0-1)
      const vpPos = worldToViewport(pos.x, pos.y, vp);

      await fetch("/api/mesh/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meshiColor: myMeshiColor,
          meshiHat: myMeshiHat,
          meshiHair: myMeshiHair,
          meshiAccessory: myMeshiAccessory,
          meshiEyeStyle: myMeshiEyeStyle,
          meshiBadge: myMeshiBadge,
          meshiOutfit: myMeshiOutfit,
          meshiMood: moodRef.current,
          position: pos,
          viewportPosition: vpPos,
          viewingMesh,
          velocity,
          activity,
        }),
      });
      lastHeartbeatRef.current = { x: pos.x, y: pos.y, at: now };
      failureCountRef.current = 0;
      setSyncHealth("live");
    } catch {
      failureCountRef.current += 1;
      setSyncHealth(failureCountRef.current > 2 ? "degraded" : "live");
    }
  }, [myMeshiColor, myMeshiHat, myMeshiHair, myMeshiAccessory, myMeshiEyeStyle, myMeshiBadge, myMeshiOutfit, viewingMesh]);

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
        const data = await res.json().catch(() => ({}));
        const list: MeshiPresence[] = data.presences || [];
        if (data.summary && onSummaryChange) onSummaryChange(data.summary);
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
              hair: p.meshiHair || "none",
              accessory: p.meshiAccessory || "none",
              eyeStyle: p.meshiEyeStyle || "regular",
              badge: p.meshiBadge || "none",
              outfit: p.meshiOutfit || "none",
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
        failureCountRef.current = 0;
        setSyncHealth("live");
      }
    } catch {
      failureCountRef.current += 1;
      setSyncHealth(failureCountRef.current > 2 ? "degraded" : "live");
    }
  }, [viewingMesh, onRemoteMeshisChange, onSummaryChange]);

  // Start heartbeat (3s) and polling (2s) — faster for more real-time feel
  useEffect(() => {
    if (!enabled || !isPageVisible || !isOnline) {
      return;
    }
    const connection = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection;
    const isSlowNetwork = connection?.effectiveType === "2g" || connection?.effectiveType === "slow-2g";
    const heartbeatMs = isSlowNetwork ? 5500 : 3000;
    const pollMs = isSlowNetwork ? 3800 : 2000;
    const heartbeat = setInterval(sendHeartbeat, heartbeatMs);
    const poll = setInterval(pollPresences, pollMs);
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
  }, [enabled, isOnline, isPageVisible, sendHeartbeat, pollPresences]);

  useEffect(() => {
    const onVisibility = () => setIsPageVisible(document.visibilityState === "visible");
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setSyncHealth("live");
    };
    const handleOffline = () => {
      setIsOnline(false);
      setSyncHealth("offline");
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Clean up presence only on true component unmount (empty deps)
  useEffect(() => {
    return () => {
      fetch("/api/mesh/presence", { method: "DELETE" }).catch(() => {});
    };
  }, []);

  const onlinePresences = presences.filter((p) => p.isOnline);

  if (!enabled || onlinePresences.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-20 right-4 z-40 flex flex-col items-end gap-2">
      {/* Presence count badge */}
      <div className="pointer-events-auto flex items-center gap-2 rounded-2xl px-3 py-1.5 glass-card text-xs">
        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-[var(--text-secondary)] font-medium">
          {onlinePresences.length} {onlinePresences.length === 1 ? "Meshi" : "Meshis"} online
        </span>
        <span
          className={
            "text-[9px] uppercase tracking-wide " + (
              syncHealth === "live"
                ? "text-green-400"
                : syncHealth === "degraded"
                  ? "text-amber-400"
                  : "text-red-400"
            )
          }
        >
          {syncHealth}
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
                  hair={(presence.meshiHair || "none") as MeshiHair}
                  accessory={(presence.meshiAccessory || "none") as MeshiAccessory}
                  eyeStyle={(presence.meshiEyeStyle || "regular") as MeshiEyeStyle}
                  badge={(presence.meshiBadge || "none") as MeshiBadge}
                  outfit={(presence.meshiOutfit || "none") as MeshiOutfit}
                  mood={(presence.meshiMood as MeshiMood) || "happy"}
                />
              </motion.div>
              <div className="flex flex-col items-start">
                <span className="text-[10px] text-[var(--text-primary)] font-medium leading-tight">
                  {presence.displayName}
                </span>
                <span className="text-[9px] text-[var(--text-muted)] leading-tight">
                  @{presence.username}{" "}
                  {presence.activity ? `· ${presence.activity}` : ""}
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
