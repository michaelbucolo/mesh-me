"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MousePointer2, ZoomIn, Filter, Waypoints, Sparkles, ArrowRight } from "lucide-react";
import { MeshiMascot } from "@/components/meshi/meshi-mascot";

const TUTORIAL_STEPS = [
  {
    icon: Waypoints,
    title: "Welcome to your Mesh",
    description:
      "This is your digital universe — a living map of your connections, communities, and content across the internet.",
    tip: "Each circle (node) represents a person, community, tag, post, or connected platform.",
    mood: "excited" as const,
  },
  {
    icon: MousePointer2,
    title: "Interact with nodes",
    description:
      "Click any node to see details. Double-click to dive into that person's profile, community, or post.",
    tip: "Your node is the large one in the center with a glowing ring around it.",
    mood: "happy" as const,
  },
  {
    icon: ZoomIn,
    title: "Navigate the canvas",
    description:
      "Scroll to zoom in and out. Click and drag the background to pan around. Use the zoom controls on the right.",
    tip: "Zoom in to see smaller nodes and discover hidden connections.",
    mood: "thinking" as const,
  },
  {
    icon: Filter,
    title: "Filter your view",
    description:
      "Use the filter pills at the top to show only people, communities, interests, posts, or platforms.",
    tip: "Each filter shows a count badge so you know how many nodes of that type exist.",
    mood: "wink" as const,
  },
  {
    icon: Sparkles,
    title: "Meet Meshi",
    description:
      "Meshi is your AI companion. Click the floating character in the bottom-right corner for quick actions, navigation, and to ask questions.",
    tip: "Meshi learns about your mesh over time and can answer questions about your connections!",
    mood: "love" as const,
  },
];

export function MeshTutorial() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const seen = localStorage.getItem("mesh-tutorial-seen");
    if (!seen) {
      // Small delay so the canvas loads first
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem("mesh-tutorial-seen", "true");
  };

  const handleNext = () => {
    if (step < TUTORIAL_STEPS.length - 1) {
      setStep(step + 1);
    } else {
      handleDismiss();
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  if (!visible) return null;

  const current = TUTORIAL_STEPS[step];
  const isLast = step === TUTORIAL_STEPS.length - 1;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      >
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-primary)",
          }}
        >
          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 z-10 p-1.5 rounded-lg transition-colors hover:bg-[var(--bg-tertiary)]"
            style={{ color: "var(--text-muted)" }}
            aria-label="Skip tutorial"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-1.5 pt-4 pb-2">
            {TUTORIAL_STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className="h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: i === step ? 24 : 8,
                  background:
                    i === step ? "var(--accent)" : "var(--bg-tertiary)",
                }}
              />
            ))}
          </div>

          {/* Content */}
          <div className="px-6 pb-6 pt-2 text-center">
            <div className="flex flex-col items-center gap-3 mb-4">
              <MeshiMascot
                size={48}
                mood={current.mood}
                color="blue"
                interactive
                animate
              />
              <div
                className="h-12 w-12 rounded-xl flex items-center justify-center"
                style={{
                  background: "var(--accent-subtle)",
                  color: "var(--accent)",
                }}
              >
                <current.icon className="h-6 w-6" />
              </div>
            </div>

            <h2
              className="text-lg font-bold mb-2"
              style={{ color: "var(--text-primary)" }}
            >
              {current.title}
            </h2>
            <p
              className="text-sm leading-relaxed mb-3"
              style={{ color: "var(--text-tertiary)" }}
            >
              {current.description}
            </p>
            <div
              className="text-xs px-4 py-2.5 rounded-xl mb-5"
              style={{
                background: "var(--bg-tertiary)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border-primary)",
              }}
            >
              <span style={{ color: "var(--accent)" }}>Tip: </span>
              {current.tip}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between">
              <button
                onClick={handleBack}
                className="text-xs font-medium transition-colors px-3 py-2 rounded-lg"
                style={{
                  color: step > 0 ? "var(--text-secondary)" : "transparent",
                  pointerEvents: step > 0 ? "auto" : "none",
                }}
              >
                Back
              </button>

              <span
                className="text-[10px] font-medium"
                style={{ color: "var(--text-muted)" }}
              >
                {step + 1} of {TUTORIAL_STEPS.length}
              </span>

              <button
                onClick={handleNext}
                className="brand-button text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-lg"
              >
                {isLast ? "Start exploring" : "Next"}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
