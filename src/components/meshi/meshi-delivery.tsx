"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MeshiMascot, type MeshiColor, type MeshiHat } from "./meshi-mascot";
import { Mail, Check } from "lucide-react";

interface DeliveryNotification {
  id: string;
  fromUser: string;
  fromUsername: string;
  message: string;
  meshiColor: MeshiColor;
  meshiHat: MeshiHat;
  timestamp: number;
}

interface MeshiDeliveryProps {
  myMeshiColor: MeshiColor;
  myMeshiHat: MeshiHat;
}

export function MeshiDelivery({ myMeshiColor, myMeshiHat }: MeshiDeliveryProps) {
  const [deliveries, setDeliveries] = useState<DeliveryNotification[]>([]);
  const [activeDelivery, setActiveDelivery] = useState<DeliveryNotification | null>(null);
  const [deliveryPhase, setDeliveryPhase] = useState<"traveling" | "arriving" | "delivered" | null>(null);

  // Poll for new Meshi deliveries
  const checkDeliveries = useCallback(async () => {
    try {
      const res = await fetch("/api/meshi/deliveries");
      if (res.ok) {
        const data = await res.json();
        if (data.deliveries && data.deliveries.length > 0) {
          setDeliveries(prev => {
            const existingIds = new Set(prev.map(d => d.id));
            const newOnes = data.deliveries.filter((d: DeliveryNotification) => !existingIds.has(d.id));
            return [...prev, ...newOnes];
          });
        }
      }
    } catch { /* silently fail */ }
  }, []);

  useEffect(() => {
    const initTimer = setTimeout(() => checkDeliveries(), 0);
    const interval = setInterval(checkDeliveries, 10000);
    return () => {
      clearTimeout(initTimer);
      clearInterval(interval);
    };
  }, [checkDeliveries]);

  // Process delivery queue
  useEffect(() => {
    if (activeDelivery || deliveries.length === 0) return;

    const t0 = setTimeout(() => {
      const next = deliveries[0];
      setActiveDelivery(next);
      setDeliveries(prev => prev.slice(1));
      setDeliveryPhase("traveling");
    }, 0);

    // Phase transitions
    const t1 = setTimeout(() => setDeliveryPhase("arriving"), 1500);
    const t2 = setTimeout(() => setDeliveryPhase("delivered"), 2500);
    const t3 = setTimeout(() => {
      setDeliveryPhase(null);
      setActiveDelivery(null);
    }, 6000);

    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [activeDelivery, deliveries]);

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
                mood="excited"
                animate
                showGlow
                bouncy
              />
              <motion.div
                className="absolute -top-2 -right-2"
                animate={{ rotate: [0, 10, -10, 0], y: [0, -2, 0] }}
                transition={{ duration: 0.6, repeat: Infinity }}
              >
                <div className="bg-amber-400 rounded-lg p-1">
                  <Mail className="h-3.5 w-3.5 text-black" />
                </div>
              </motion.div>
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
  onComplete: () => void;
}

export function MeshiSendAnimation({ isActive, recipientName, meshiColor, meshiHat, onComplete }: MeshiSendAnimationProps) {
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
              <MeshiMascot size={40} color={meshiColor} hat={meshiHat} mood="excited" animate showGlow={false} bouncy />
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
              <MeshiMascot size={36} color={meshiColor} hat={meshiHat} mood="happy" animate showGlow bouncy />
              <motion.div
                className="absolute -top-1 -right-1"
                animate={{ rotate: [0, 15, -15, 0] }}
                transition={{ duration: 0.4, repeat: Infinity }}
              >
                <div className="bg-amber-400 rounded p-0.5">
                  <Mail className="h-2.5 w-2.5 text-black" />
                </div>
              </motion.div>
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
