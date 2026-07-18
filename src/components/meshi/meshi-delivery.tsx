"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X } from "lucide-react";
import {
  MeshiMascot,
  type MeshiAccessory,
  type MeshiBadge,
  type MeshiColor,
  type MeshiEyeStyle,
  type MeshiHair,
  type MeshiHat,
  type MeshiOutfit,
} from "./meshi-mascot";
import { useMeshiPreferences } from "@/hooks/use-meshi-preferences";
import { shouldHideGlobalMeshi } from "@/lib/meshi-routes";
import { impactFeedback } from "@/lib/native/haptics";

// When someone asks their Meshi to carry a message to you, the mesh writes a
// meshi_delivery notification. This component is the arrival: the sender's
// Meshi walks onto your screen wearing their cosmetics, hands over the words,
// and leaves once you've seen them.

interface Delivery {
  id: string;
  fromUser: string;
  fromUsername: string;
  message: string;
  meshiColor: string;
  meshiHat: string;
  meshiHair: string;
  meshiAccessory: string;
  meshiEyeStyle: string;
  meshiBadge: string;
  meshiOutfit: string;
  timestamp: number;
}

const INITIAL_FETCH_DELAY_MS = 5000;
const POLL_INTERVAL_MS = 90_000;

export function MeshiDelivery() {
  const prefs = useMeshiPreferences();
  const pathname = usePathname();
  const [queue, setQueue] = useState<Delivery[]>([]);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const fetchingRef = useRef(false);

  const hidden = !prefs.enabled || shouldHideGlobalMeshi(pathname);

  const fetchDeliveries = useCallback(async () => {
    if (fetchingRef.current || typeof document === "undefined" || document.hidden) return;
    fetchingRef.current = true;
    try {
      const res = await fetch("/api/meshi/deliveries");
      if (!res.ok) return;
      const data = (await res.json().catch(() => null)) as { deliveries?: Delivery[] } | null;
      const incoming = (data?.deliveries || []).filter(
        (d) => d && d.id && d.message && !seenIdsRef.current.has(d.id),
      );
      if (incoming.length === 0) return;
      incoming.forEach((d) => seenIdsRef.current.add(d.id));
      setQueue((prev) => [...prev, ...incoming]);
      void impactFeedback("LIGHT");
    } catch {
      // Deliveries are ambient — a failed poll just waits for the next one.
    } finally {
      fetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (hidden) return;
    const initial = window.setTimeout(() => void fetchDeliveries(), INITIAL_FETCH_DELAY_MS);
    const interval = window.setInterval(() => void fetchDeliveries(), POLL_INTERVAL_MS);
    const onVisible = () => {
      if (!document.hidden) void fetchDeliveries();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [hidden, fetchDeliveries]);

  const current = queue[0] ?? null;

  const dismissCurrent = useCallback(() => {
    if (!current) return;
    setQueue((prev) => prev.slice(1));
    // Mark read only after it was actually displayed, so a delivery can never
    // silently disappear before the recipient saw it.
    void fetch("/api/meshi/deliveries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [current.id] }),
    }).catch(() => {});
  }, [current]);

  if (hidden) return null;

  return (
    <AnimatePresence>
      {current && (
        <motion.div
          key={current.id}
          data-meshi-avoid="true"
          initial={{ opacity: 0, x: -160, y: 24 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={{ opacity: 0, x: -80, y: 40, scale: 0.9 }}
          transition={{ type: "spring", damping: 22, stiffness: 240 }}
          className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-3 z-50 flex max-w-[320px] items-end gap-2 sm:bottom-6 sm:left-6"
          role="status"
          aria-live="polite"
        >
          <motion.div
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            className="shrink-0"
          >
            <MeshiMascot
              size={52}
              mood="love"
              color={current.meshiColor as MeshiColor}
              hat={current.meshiHat as MeshiHat}
              hair={current.meshiHair as MeshiHair}
              accessory={current.meshiAccessory as MeshiAccessory}
              eyeStyle={current.meshiEyeStyle as MeshiEyeStyle}
              badge={current.meshiBadge as MeshiBadge}
              outfit={current.meshiOutfit as MeshiOutfit}
              showGlow
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.25, type: "spring", damping: 20, stiffness: 280 }}
            className="mb-2 rounded-2xl rounded-bl-sm border border-[var(--border-primary)] bg-[var(--bg-elevated)] px-3.5 py-2.5 shadow-xl"
          >
            <div className="mb-1 flex items-center justify-between gap-3">
              <p className="text-[10px] font-semibold text-[var(--accent)]">
                {current.fromUser}&apos;s Meshi has a message for you
              </p>
              <button
                type="button"
                onClick={dismissCurrent}
                aria-label="Dismiss Meshi delivery"
                className="rounded-md p-0.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-secondary)]"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            <p className="max-h-24 overflow-y-auto text-xs leading-relaxed text-[var(--text-primary)]">
              {current.message}
            </p>
            <div className="mt-2 flex items-center gap-1.5">
              <Link
                href="/messages"
                onClick={dismissCurrent}
                className="flex items-center gap-1 rounded-lg brand-button px-2.5 py-1 text-[11px] font-semibold text-white shadow transition-all hover:shadow-md"
              >
                <MessageCircle className="h-3 w-3" />
                Reply in MeChat
              </Link>
              <button
                type="button"
                onClick={dismissCurrent}
                className="rounded-lg bg-[var(--bg-tertiary)] px-2.5 py-1 text-[11px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]"
              >
                Got it
              </button>
              {queue.length > 1 && (
                <span className="ml-auto text-[10px] text-[var(--text-muted)]">+{queue.length - 1} more</span>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
