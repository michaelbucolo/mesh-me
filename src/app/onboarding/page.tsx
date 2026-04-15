"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { completeOnboarding } from "@/lib/actions";
import { INTEREST_TAGS } from "@/lib/utils";
import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { ArrowRight, ArrowLeft, Check, Globe } from "lucide-react";
import { MeshiMascot } from "@/components/meshi/meshi-mascot";
import { MeshBackground } from "@/components/mesh-background";
import { useMeshiPreferences } from "@/hooks/use-meshi-preferences";

const SOCIAL_PLATFORMS = [
  { id: "instagram", name: "Instagram", color: "#E4405F", icon: "IG" },
  { id: "youtube", name: "YouTube", color: "#FF0000", icon: "YT" },
  { id: "tiktok", name: "TikTok", color: "#69C9D0", icon: "TT" },
  { id: "twitter", name: "X / Twitter", color: "#1DA1F2", icon: "X" },
  { id: "twitch", name: "Twitch", color: "#9146FF", icon: "TW" },
  { id: "spotify", name: "Spotify", color: "#1DB954", icon: "SP" },
  { id: "soundcloud", name: "SoundCloud", color: "#FF5500", icon: "SC" },
  { id: "linkedin", name: "LinkedIn", color: "#0A66C2", icon: "LI" },
  { id: "github", name: "GitHub", color: "#8B5CF6", icon: "GH" },
  { id: "discord", name: "Discord", color: "#5865F2", icon: "DC" },
  { id: "snapchat", name: "Snapchat", color: "#FFFC00", icon: "SN" },
  { id: "pinterest", name: "Pinterest", color: "#E60023", icon: "PI" },
  { id: "reddit", name: "Reddit", color: "#FF4500", icon: "RD" },
  { id: "facebook", name: "Facebook", color: "#1877F2", icon: "FB" },
  { id: "threads", name: "Threads", color: "#ffffff", icon: "TH" },
  { id: "bluesky", name: "Bluesky", color: "#0085FF", icon: "BS" },
];

const TOTAL_STEPS = 3;

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const meshiPrefs = useMeshiPreferences();
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  const toggleInterest = (tag: string) => {
    setSelectedInterests((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const togglePlatform = (id: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleFinish = () => {
    const formData = new FormData();
    formData.set("bio", bio);
    formData.set("location", location);
    selectedInterests.forEach((tag) => formData.append("interests", tag));
    selectedPlatforms.forEach((p) => formData.append("platforms", p));

    startTransition(async () => {
      await completeOnboarding(formData);
    });
  };

  const steps = [
    // Step 0: Welcome + Bio & Location (combined for speed)
    <div key="welcome-bio" className="space-y-6 animate-fade-in max-w-md mx-auto w-full">
      <div className="text-center mb-2">
        <MeshiMascot size={56} mood="excited" color={meshiPrefs.color} hat={meshiPrefs.hat} speaking animate bouncy />
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-[var(--text-primary)] mt-4 mb-2">Welcome to the Mesh</h1>
        <p className="text-sm text-[var(--text-tertiary)]">Tell people a bit about yourself</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Bio</label>
        <Textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Creator, dreamer, builder..."
          rows={3}
          maxLength={160}
        />
        <p className="text-xs text-[var(--text-muted)] mt-1">{bio.length}/160</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Location <span className="text-[var(--text-muted)] font-normal">(optional)</span></label>
        <Input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="City, Country"
        />
      </div>
      <Button onClick={() => setStep(1)} variant="gradient" className="w-full">
        Next <ArrowRight className="h-4 w-4 ml-1" />
      </Button>
    </div>,

    // Step 1: Interests
    <div key="interests" className="space-y-6 animate-fade-in max-w-lg mx-auto w-full">
      <div className="text-center mb-2">
        <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">What are you into?</h2>
        <p className="text-sm text-[var(--text-tertiary)]">Pick at least 3 — this helps you find your people</p>
      </div>
      <div className="flex flex-wrap gap-2 justify-center">
        {INTEREST_TAGS.map((tag) => (
          <button
            key={tag}
            onClick={() => toggleInterest(tag)}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium border transition-all duration-200",
              selectedInterests.includes(tag)
                ? "bg-[var(--accent-muted)] border-[var(--accent)] text-[var(--accent)]"
                : "bg-[var(--bg-tertiary)] border-[var(--border-primary)] text-[var(--text-tertiary)] hover:border-[var(--border-secondary)] hover:text-[var(--text-secondary)]"
            )}
          >
            {tag}
          </button>
        ))}
      </div>
      <p className="text-center text-sm text-[var(--text-muted)]">{selectedInterests.length} selected</p>
      <div className="flex gap-3">
        <Button onClick={() => setStep(0)} variant="ghost" className="flex-shrink-0"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
        <Button onClick={() => setStep(2)} variant="gradient" className="flex-1" disabled={selectedInterests.length < 3}>
          Next <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>,

    // Step 2: Connect Social Accounts + Finish
    <div key="accounts" className="space-y-6 animate-fade-in max-w-lg mx-auto w-full">
      <div className="text-center mb-2">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: "var(--accent-subtle)", border: "1px solid var(--accent-muted)" }}>
          <Globe className="h-7 w-7" style={{ color: "var(--accent)" }} />
        </div>
        <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Connect your world</h2>
        <p className="text-sm text-[var(--text-tertiary)]">Link your accounts to build your mesh — add more anytime</p>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
        {SOCIAL_PLATFORMS.map((platform) => (
          <button
            key={platform.id}
            onClick={() => togglePlatform(platform.id)}
            className={cn(
              "relative flex flex-col items-center gap-1.5 rounded-xl p-3 text-xs font-medium transition-all duration-200 border",
              selectedPlatforms.includes(platform.id)
                ? "border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--text-primary)]"
                : "border-[var(--border-primary)] bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:border-[var(--border-hover)] hover:text-[var(--text-secondary)]"
            )}
          >
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[10px] font-bold text-white"
              style={{ backgroundColor: platform.color }}
            >
              {platform.icon}
            </div>
            <span className="truncate w-full text-center">{platform.name}</span>
            {selectedPlatforms.includes(platform.id) && (
              <div className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--accent)]">
                <Check className="h-2.5 w-2.5 text-white" />
              </div>
            )}
          </button>
        ))}
      </div>

      {selectedPlatforms.length > 0 && (
        <p className="text-center text-sm text-[var(--text-muted)]">
          {selectedPlatforms.length} platform{selectedPlatforms.length !== 1 ? "s" : ""} selected — you&apos;ll connect them after setup
        </p>
      )}

      <div className="flex gap-3">
        <Button onClick={() => setStep(1)} variant="ghost" className="flex-shrink-0"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
        <Button
          onClick={handleFinish}
          variant="gradient"
          disabled={isPending}
          className="flex-1"
        >
          {isPending ? "Building your mesh..." : "Enter the Mesh"}
        </Button>
      </div>
    </div>,
  ];

  return (
    <div className="relative min-h-screen bg-[var(--bg-primary)] flex items-center justify-center px-4 sm:px-6">
      <MeshBackground density={50} className="opacity-30" />
      <div className="pointer-events-none absolute inset-0">
        <div className="float-orb absolute left-[10%] top-[20%] h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle,rgba(45,127,249,0.1),transparent_60%)]" />
        <div className="float-orb-delayed absolute right-[10%] bottom-[20%] h-[350px] w-[350px] rounded-full bg-[radial-gradient(circle,rgba(0,198,251,0.08),transparent_55%)]" />
      </div>

      <div className="relative z-10 w-full max-w-xl py-10">
        {/* Progress bar */}
        <div className="flex gap-1.5 mb-10 max-w-xs mx-auto">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <div
              key={i}
              className={cn(
                "h-1 flex-1 rounded-full transition-all duration-500",
                i < step ? "bg-[var(--accent)]" : i === step ? "bg-[var(--accent)] animate-pulse-glow" : "bg-[var(--bg-tertiary)]"
              )}
            />
          ))}
        </div>

        {steps[step]}
      </div>
    </div>
  );
}
