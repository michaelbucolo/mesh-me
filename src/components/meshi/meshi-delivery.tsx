"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MeshiMascot, type MeshiAccessory, type MeshiBadge, type MeshiColor, type MeshiEyeStyle, type MeshiHair, type MeshiHat, type MeshiOutfit } from "./meshi-mascot";
import { Check } from "lucide-react";

interface DeliveryNotification {
  id: string;
  fromUser: string;
  fromUsername: string;
  message: string;
  meshiColor: MeshiColor;
  meshiHat: MeshiHat;
  meshiHair?: MeshiHair;
  meshiAccessory?: MeshiAccessory;
  meshiEyeStyle?: MeshiEyeStyle;
  meshiBadge?: MeshiBadge;
  meshiOutfit?: MeshiOutfit;
  timestamp: number;
}

interface MeshiDeliveryProps {
  myMeshiColor: MeshiColor;
  myMeshiHat: MeshiHat;
  myMeshiHair?: MeshiHair;
  myMeshiAccessory?: MeshiAccessory;
  myMeshiEyeStyle?: MeshiEyeStyle;
  myMeshiBadge?: MeshiBadge;
  myMeshiOutfit?: MeshiOutfit;
}

export function MeshiDelivery({
  myMeshiColor,
  myMeshiHat,
  myMeshiHair = "none",
  myMeshiAccessory = "none",
  myMeshiEyeStyle = "regular",
  myMeshiBadge = "none",
  myMeshiOutfit = "none",
}: MeshiDeliveryProps) {
  const [deliveries, setDeliveries] = useState<DeliveryNotification[]>([]);
  const [activeDelivery, setActiveDelivery] = useState<DeliveryNotification | null>(null);
  const [deliveryPhase, setDeliveryPhase] = useState<"traveling" | "arriving" | "delivered" | null>(null);
  const seenIds = useRef<Set<string>>(new Set());

  // Poll for new Meshi deliveries
  const checkDeliveries = useCallback(async () => {
    try {
      const res = await fetch("/api/meshi/deliveries");
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.deliveries && data.deliveries.length > 0) {
          setDeliveries(prev => {
            const newOnes = data.deliveries.filter((d: DeliveryNotification) => !seenIds.current.has(d.id));
            for (const d of newOnes) seenIds.current.add(d.id);
            return [...prev, ...newOnes];
          });
        }
      }
    } catch { /* silently fail */ }
  }, []);

  useEffect(() => {
    const initTimer = setTimeout(() => checkDeliveries(), 0);
    const interval = setInterval(checkDeliveries, 20000);
    return () => {
      clearTimeout(initTimer);
      clearInterval(interval);
    };
  }, [checkDeliveries]);

  // Dequeue the next delivery when idle
  useEffect(() => {
    if (activeDelivery || deliveries.length === 0) return;
    const next = deliveries[0];
    // Use functional updates and batch via microtask to avoid synchronous cascading renders
    queueMicrotask(() => {
      setActiveDelivery(next);
      setDeliveries(prev => prev.slice(1));
      setDeliveryPhase("traveling");
    });
  }, [activeDelivery, deliveries]);

  // Phase transitions — runs when activeDelivery changes (not when deliveries changes)
  useEffect(() => {
    if (!activeDelivery) return;

    const t1 = setTimeout(() => setDeliveryPhase("arriving"), 1500);
    const t2 = setTimeout(() => setDeliveryPhase("delivered"), 2500);
    const t3 = setTimeout(() => {
      // Mark this delivery as read on the server after the animation completes
      fetch("/api/meshi/deliveries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [activeDelivery.id] }),
      }).catch(() => { /* best-effort */ });
      setDeliveryPhase(null);
      setActiveDelivery(null);
    }, 6000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [activeDelivery]);

  if (!activeDelivery || !deliveryPhase) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 pointer-events-none z-[60]">
        {/* Traveling Meshi with envelope */}
        {deliveryPhase === "traveling" && (
          <motion.div
            initial={{ x: -80, y: "50%", opacity: 0 }}
            animate={{ x: "calc(50vw - 24px)", y: "40%", opacity: 1 }}
            transition={{ duration: 1.2, ease: "easeInOut" }}
            className="absolute"
          >
            <div className="relative">
              <MeshiMascot
                size={48}
                color={activeDelivery.meshiColor || myMeshiColor}
                hat={activeDelivery.meshiHat || myMeshiHat}
                hair={activeDelivery.meshiHair || myMeshiHair}
                accessory={activeDelivery.meshiAccessory || myMeshiAccessory}
                eyeStyle={activeDelivery.meshiEyeStyle || myMeshiEyeStyle}
                badge={activeDelivery.meshiBadge || myMeshiBadge}
                outfit={activeDelivery.meshiOutfit || myMeshiOutfit}
                mood="excited"
                animate
                showGlow
                bouncy
                prop="envelope"
              />
            </div>
          </motion.div>
        )}

        {/* Arrival + Message reveal */}
        {(deliveryPhase === "arriving" || deliveryPhase === "delivered") && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -20 }}
            className="absolute left-1/2 top-1/3 -translate-x-1/2 pointer-events-auto"
          >
            <div className="glass-card rounded-2xl p-4 shadow-2xl max-w-[300px]">
              <div className="flex items-center gap-3 mb-3">
                <MeshiMascot
                  size={36}
                  color={activeDelivery.meshiColor || myMeshiColor}
                  hat={activeDelivery.meshiHat || myMeshiHat}
                  hair={activeDelivery.meshiHair || myMeshiHair}
                  accessory={activeDelivery.meshiAccessory || myMeshiAccessory}
                  eyeStyle={activeDelivery.meshiEyeStyle || myMeshiEyeStyle}
                  badge={activeDelivery.meshiBadge || myMeshiBadge}
                  outfit={activeDelivery.meshiOutfit || myMeshiOutfit}
                  mood="love"
                  animate
                  showGlow={false}
                  bouncy
                />
                <div>
                  <p className="text-xs font-semibold text-[var(--text-primary)]">
                    {activeDelivery.fromUser}
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)]">
                    @{activeDelivery.fromUsername} via Meshi
                  </p>
                </div>
                {deliveryPhase === "delivered" && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="ml-auto"
                  >
                    <div className="bg-emerald-500/20 rounded-full p-1">
                      <Check className="h-3 w-3 text-emerald-400" />
                    </div>
                  </motion.div>
                )}
              </div>
              <div className="bg-[var(--bg-tertiary)] rounded-xl px-3 py-2">
                <p className="text-sm text-[var(--text-primary)] leading-relaxed">
                  {activeDelivery.message}
                </p>
              </div>
              <p className="text-[9px] text-[var(--text-muted)] mt-2 text-center">
                Delivered by Meshi
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </AnimatePresence>
  );
}

// ─── Outgoing delivery animation (when YOU send via Meshi) ────

interface MeshiSendAnimationProps {
  isActive: boolean;
  recipientName: string;
  meshiColor: MeshiColor;
  meshiHat: MeshiHat;
  meshiHair?: MeshiHair;
  meshiAccessory?: MeshiAccessory;
  meshiEyeStyle?: MeshiEyeStyle;
  meshiBadge?: MeshiBadge;
  meshiOutfit?: MeshiOutfit;
  onComplete: () => void;
}

export function MeshiSendAnimation({
  isActive,
  recipientName,
  meshiColor,
  meshiHat,
  meshiHair = "none",
  meshiAccessory = "none",
  meshiEyeStyle = "regular",
  meshiBadge = "none",
  meshiOutfit = "none",
  onComplete,
}: MeshiSendAnimationProps) {
  const [phase, setPhase] = useState<"pickup" | "traveling" | "done" | null>(null);

  useEffect(() => {
    if (!isActive) {
      const resetTimer = setTimeout(() => setPhase(null), 0);
      return () => clearTimeout(resetTimer);
    }

    const startTimer = setTimeout(() => setPhase("pickup"), 0);
    const t1 = setTimeout(() => setPhase("traveling"), 1000);
    const t2 = setTimeout(() => setPhase("done"), 2500);
    const t3 = setTimeout(() => {
      setPhase(null);
      onComplete();
    }, 3500);

    return () => {
      clearTimeout(startTimer);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [isActive, onComplete]);

  if (!phase) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 pointer-events-none z-[60]"
      >
        {phase === "pickup" && (
          <motion.div
            className="absolute bottom-20 right-20"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <div className="flex items-center gap-2">
              <MeshiMascot size={40} color={meshiColor} hat={meshiHat} hair={meshiHair} accessory={meshiAccessory} eyeStyle={meshiEyeStyle} badge={meshiBadge} outfit={meshiOutfit} mood="excited" animate showGlow={false} bouncy prop="envelope" />
              <motion.div
                initial={{ x: -10, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                className="glass-card rounded-xl px-3 py-1.5"
              >
                <p className="text-[11px] text-[var(--text-primary)]">
                  On my way to {recipientName}!
                </p>
              </motion.div>
            </div>
          </motion.div>
        )}

        {phase === "traveling" && (
          <motion.div
            initial={{ x: "80vw", y: "70vh" }}
            animate={{ x: "-10vw", y: "30vh" }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
            className="absolute"
          >
            <div className="relative">
              <MeshiMascot size={36} color={meshiColor} hat={meshiHat} hair={meshiHair} accessory={meshiAccessory} eyeStyle={meshiEyeStyle} badge={meshiBadge} outfit={meshiOutfit} mood="happy" animate showGlow bouncy prop="envelope" />
            </div>
          </motion.div>
        )}

        {phase === "done" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          >
            <div className="glass-card rounded-2xl px-4 py-3 flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-400" />
              <p className="text-sm text-[var(--text-primary)]">
                Delivered to {recipientName}!
              </p>
            </div>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
