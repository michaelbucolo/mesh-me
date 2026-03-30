"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, ChevronLeft, Shield, Eye, Fingerprint, Sparkles, Lock } from "lucide-react";
import { MeshiMascot, type MeshiMood } from "./meshi-mascot";

interface GuideStep {
  title: string;
  description: string;
  mood: MeshiMood;
  icon: React.ElementType;
  detail?: string;
}

const ONBOARDING_STEPS: GuideStep[] = [
  {
    title: "Welcome to mesh.me!",
    description: "I'm Meshi, your personal guide to the mesh. Let me show you how mesh.me keeps you safe and connected.",
    mood: "excited",
    icon: Sparkles,
  },
  {
    title: "Your privacy comes first",
    description: "mesh.me never sells your data. We store only what's needed to run your account — and you can delete everything at any time.",
    mood: "cool",
    icon: Shield,
    detail: "We store: your username, email (for login), posts you create, and who you follow. That's it. No tracking cookies, no ad profiles, no data brokers.",
  },
  {
    title: "You control what's visible",
    description: "Only you decide who sees your profile, posts, and connections. Everything defaults to private until you choose otherwise.",
    mood: "happy",
    icon: Eye,
    detail: "Your privacy settings let you control visibility for your profile, posts, follower list, connected platforms, and more.",
  },
  {
    title: "Zero-knowledge AI",
    description: "I help you search and organize your mesh, but I never store our conversations or your personal data. Everything I do is index-based.",
    mood: "wink",
    icon: Lock,
    detail: "Unlike other AI assistants, I don't learn from your data, don't build profiles, and don't share anything with third parties.",
  },
  {
    title: "Your digital footprint",
    description: "mesh.me helps you see and manage your entire online presence in one place. The Mesh is your visual map of the internet — your internet.",
    mood: "love",
    icon: Fingerprint,
    detail: "Connect your social accounts, and mesh.me becomes your unified dashboard. One internet. One you.",
  },
];

const SETTINGS_TIPS: Record<string, { message: string; mood: MeshiMood }> = {
  profile: {
    message: "This is where you make mesh.me yours! Your display name, bio, and avatar are visible to others based on your privacy settings.",
    mood: "happy",
  },
  interests: {
    message: "Interests help me find relevant content and people for your mesh. I use these to improve search results — nothing more!",
    mood: "thinking",
  },
  customize: {
    message: "Make your mesh uniquely you! Choose your accent color and theme. These are just for your own experience.",
    mood: "excited",
  },
  notifications: {
    message: "Control exactly what notifications you get and how. mesh.me uses AI to summarize notifications so you get the important stuff without the noise.",
    mood: "cool",
  },
  privacy: {
    message: "Your privacy is our #1 priority. Here you control who sees what. Everything defaults to maximum privacy.",
    mood: "cool",
  },
  security: {
    message: "Keep your account safe! Strong passwords and regular security checks help protect your digital identity.",
    mood: "cool",
  },
  "security-hub": {
    message: "The Security Hub lets you manage content across all your platforms, export your data, and scan for vulnerabilities.",
    mood: "thinking",
  },
  footprint: {
    message: "Your Digital Footprint shows everywhere you exist online. mesh.me helps you see the full picture — and take control of it.",
    mood: "excited",
  },
  blocked: {
    message: "Blocked users can't see your profile, posts, or send you messages. Your safety always comes first.",
    mood: "happy",
  },
  meshpro: {
    message: "MeshPro adds fun extras like customizing me (give me a hat!), mesh cosmetics, and advanced footprint scanning. Nearly everything on mesh.me is free — Pro is just a little bonus!",
    mood: "love",
  },
  meshi: {
    message: "This is my customization page! MeshPro members can give me hats, change my color, and pick my face. I'll look however you want!",
    mood: "love",
  },
  cosmetics: {
    message: "Mesh cosmetics let you personalize how your mesh looks to others. Add particle effects, custom node styles, and more!",
    mood: "excited",
  },
  achievements: {
    message: "Achievements are titles you earn through milestones. The first 1 million verified users get the exclusive Pioneer title!",
    mood: "excited",
  },
};

interface MeshiOnboardingGuideProps {
  onComplete?: () => void;
}

export function MeshiOnboardingGuide({ onComplete }: MeshiOnboardingGuideProps) {
  const [step, setStep] = useState(0);
  const [showDetail, setShowDetail] = useState(false);
  const currentStep = ONBOARDING_STEPS[step];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md mx-auto"
    >
      <div className="glass-card rounded-2xl p-6 relative overflow-hidden">
        {/* Progress bar */}
        <div className="flex gap-1.5 mb-6">
          {ONBOARDING_STEPS.map((_, i) => (
            <div
              key={i}
              className="h-1 flex-1 rounded-full transition-all duration-500"
              style={{
                background: i <= step ? "var(--accent)" : "var(--bg-tertiary)",
                opacity: i <= step ? 1 : 0.5,
              }}
            />
          ))}
        </div>

        {/* Meshi */}
        <div className="flex justify-center mb-4">
          <MeshiMascot
            size={64}
            mood={currentStep.mood}
            color="blue"
            speaking={true}
          />
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="text-center"
          >
            <div className="flex items-center justify-center gap-2 mb-2">
              <currentStep.icon className="h-4 w-4" style={{ color: "var(--accent)" }} />
              <h3 className="text-base font-semibold text-[var(--text-primary)]">{currentStep.title}</h3>
            </div>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-3">{currentStep.description}</p>

            {currentStep.detail && (
              <>
                <button
                  onClick={() => setShowDetail(!showDetail)}
                  className="text-[11px] text-[var(--accent)] hover:underline mb-2"
                >
                  {showDetail ? "Show less" : "Tell me more"}
                </button>
                <AnimatePresence>
                  {showDetail && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="text-xs text-[var(--text-muted)] leading-relaxed px-4"
                    >
                      {currentStep.detail}
                    </motion.p>
                  )}
                </AnimatePresence>
              </>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={() => { setStep(Math.max(0, step - 1)); setShowDetail(false); }}
            disabled={step === 0}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>

          {step < ONBOARDING_STEPS.length - 1 ? (
            <button
              onClick={() => { setStep(step + 1); setShowDetail(false); }}
              className="flex items-center gap-1 px-4 py-1.5 rounded-lg text-sm brand-button text-white font-medium"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={onComplete}
              className="flex items-center gap-1 px-4 py-1.5 rounded-lg text-sm brand-button text-white font-medium"
            >
              <Sparkles className="h-4 w-4" />
              Enter the Mesh
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// Settings helper tip from Meshi
export function MeshiSettingsTip({ tab }: { tab: string }) {
  const [dismissed, setDismissed] = useState(false);
  const tip = SETTINGS_TIPS[tab];

  if (!tip || dismissed) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex items-start gap-3 p-3 rounded-xl bg-[var(--accent)]/5 border border-[var(--accent)]/10 mb-4"
    >
      <MeshiMascot size={32} mood={tip.mood} color="blue" animate={false} showGlow={false} />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{tip.message}</p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors shrink-0"
      >
        <X className="h-3 w-3" />
      </button>
    </motion.div>
  );
}
