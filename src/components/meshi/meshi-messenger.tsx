"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, X, CheckCircle, Loader2 } from "lucide-react";
import { MeshiMascot } from "./meshi-mascot";
import { sendMessage } from "@/lib/actions";
import { useMeshiPreferences } from "@/hooks/use-meshi-preferences";

type DeliveryPhase = "idle" | "composing" | "traveling" | "delivered";

interface MeshiMessengerProps {
  recipientId: string;
  recipientName: string;
  recipientUsername: string;
  onClose: () => void;
  onSent?: () => void;
}

export function MeshiMessenger({ recipientId, recipientName, recipientUsername, onClose, onSent }: MeshiMessengerProps) {
  const [message, setMessage] = useState("");
  const [phase, setPhase] = useState<DeliveryPhase>("composing");
  const meshiPrefs = useMeshiPreferences();
  const [error, setError] = useState<string | null>(null);

  const handleSend = useCallback(async () => {
    if (!message.trim()) return;
    setPhase("traveling");
    setError(null);

    try {
      const formData = new FormData();
      formData.set("content", message.trim());
      formData.set("recipientId", recipientId);
      const result = await sendMessage(formData);
      if (result && "error" in result) {
        setError(result.error as string);
        setPhase("composing");
        return;
      }

      // Delivery animation
      setTimeout(() => {
        setPhase("delivered");
        setTimeout(() => {
          onSent?.();
          onClose();
        }, 2000);
      }, 2000);
    } catch {
      setError("Failed to deliver message. Try again!");
      setPhase("composing");
    }
  }, [message, recipientId, onClose, onSent]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: "spring", damping: 20 }}
          className="relative w-[340px] rounded-2xl overflow-hidden shadow-2xl"
          style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-primary)" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-[var(--border-primary)]">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Send via Meshi
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                to @{recipientUsername}
              </p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4">
            {/* Composing phase */}
            {phase === "composing" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="flex justify-center mb-4">
                  <MeshiMascot mood="love" size={48} color={meshiPrefs.color} hat={meshiPrefs.hat} />
                </div>
                <p className="text-xs text-center text-[var(--text-muted)] mb-3">
                  Meshi will carry your message to {recipientName}
                </p>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={`Write a message for ${recipientName}...`}
                  className="w-full bg-[var(--bg-tertiary)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] rounded-xl p-3 resize-none outline-none border border-[var(--border-primary)] focus:border-[var(--accent)] transition-colors"
                  rows={3}
                  maxLength={500}
                  autoFocus
                />
                {error && (
                  <p className="text-xs text-red-400 mt-2">{error}</p>
                )}
                <div className="flex items-center justify-between mt-3">
                  <span className="text-[10px] text-[var(--text-muted)]">{message.length}/500</span>
                  <button
                    onClick={handleSend}
                    disabled={!message.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-40"
                    style={{ background: message.trim() ? "var(--brand-gradient, var(--accent))" : "var(--bg-tertiary)" }}
                  >
                    <Send className="h-3.5 w-3.5" />
                    Send
                  </button>
                </div>
              </motion.div>
            )}

            {/* Traveling phase — Meshi animation */}
            {phase === "traveling" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-8 flex flex-col items-center"
              >
                <motion.div
                  animate={{
                    x: [0, 30, -20, 40, 0],
                    y: [0, -15, 5, -10, 0],
                    rotate: [0, 5, -5, 3, 0],
                  }}
                  transition={{ duration: 2, ease: "easeInOut" }}
                >
                  <MeshiMascot mood="excited" size={56} color={meshiPrefs.color} hat={meshiPrefs.hat} prop="heart" />
                </motion.div>

                {/* Travel trail */}
                <div className="flex items-center gap-1 mt-4">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <motion.div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: "var(--accent)" }}
                      animate={{ opacity: [0.2, 1, 0.2] }}
                      transition={{ duration: 0.6, delay: i * 0.12, repeat: Infinity }}
                    />
                  ))}
                </div>

                <p className="text-sm text-[var(--text-secondary)] mt-3 font-medium">
                  Delivering to {recipientName}...
                </p>
                <div className="flex items-center gap-1.5 mt-1 text-xs text-[var(--text-muted)]">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Meshi is on the way
                </div>
              </motion.div>
            )}

            {/* Delivered phase */}
            {phase === "delivered" && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-8 flex flex-col items-center"
              >
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 0.5 }}
                >
                  <MeshiMascot mood="celebrating" size={56} color={meshiPrefs.color} hat={meshiPrefs.hat} />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="flex items-center gap-1.5 mt-4"
                >
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                  <span className="text-sm font-medium text-emerald-400">Delivered!</span>
                </motion.div>

                <p className="text-xs text-[var(--text-muted)] mt-1">
                  {recipientName} will see your message
                </p>
              </motion.div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
