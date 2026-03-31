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
    description: "I'm Meshi, your personal guide to the mesh. Let me show you how everything works so you feel right at home.",
    mood: "excited",
    icon: Sparkles,
  },
  {
    title: "The Mesh — your digital universe",
    description: "The Mesh is an interactive constellation of everything connected to you — people, communities, platforms, and interests. It's your home base.",
    mood: "excited",
    icon: Eye,
    detail: "Click any node to interact with it. You can message people, view posts, join communities, and manage platforms — all from the Mesh. Click on someone to zoom into their mesh too!",
  },
  {
    title: "MeChat — all messages, one place",
    description: "MeChat unifies your conversations across every connected platform into one encrypted inbox. Message anyone, anywhere, from mesh.me.",
    mood: "love",
    icon: Sparkles,
    detail: "When you connect platforms like Instagram, Discord, or X, your DMs sync here. Everything is end-to-end encrypted. Your conversations stay yours.",
  },
  {
    title: "Your Feed — your internet",
    description: "Your feed shows posts from people you follow on mesh.me AND across all connected platforms. One feed for your whole internet.",
    mood: "happy",
    icon: Eye,
    detail: "You can customize the feed layout (card, grid, vertical, compact), filter by platform, and even cross-post — create once, share everywhere.",
  },
  {
    title: "Your privacy comes first",
    description: "mesh.me never sells your data. We store only what's needed to run your account — and you can delete everything at any time.",
    mood: "cool",
    icon: Shield,
    detail: "No tracking cookies, no ad profiles, no data brokers. You control what's visible. Everything defaults to private until you choose otherwise.",
  },
  {
    title: "Explore & MeshPro",
    description: "Discover new people and communities on Explore. MeshPro ($4.99/mo) unlocks extras like custom cosmetics, analytics, and my personality customization!",
    mood: "wink",
    icon: Fingerprint,
    detail: "Nearly everything is free forever. MeshPro just adds fun extras — Digital Footprint Scanner, mesh cosmetics, advanced analytics, and more.",
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
    message: "Control exactly what notifications you get and how. mesh.me intelligently summarizes notifications so you get the important stuff without the noise.",
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
  "mesh-privacy": {
    message: "Control exactly who can see your mesh! Set it to private (only you), friends-only (mutual follows), or public. You can even override visibility per branch — show your communities but hide your platforms, for example.",
    mood: "cool",
  },
  "alter-egos": {
    message: "Alter egos let you have multiple identities on mesh.me — a professional profile, a creative persona, or an anonymous account. Each has its own mesh, feed, and messages!",
    mood: "wink",
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
