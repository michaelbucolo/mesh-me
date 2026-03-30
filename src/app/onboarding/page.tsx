"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { completeOnboarding } from "@/lib/actions";
import { INTEREST_TAGS } from "@/lib/utils";
import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { ArrowRight, Sparkles } from "lucide-react";
import { MeshiOnboardingGuide } from "@/components/meshi/meshi-guide";
import { MeshiMascot } from "@/components/meshi/meshi-mascot";

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  const toggleInterest = (tag: string) => {
    setSelectedInterests((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleFinish = () => {
    const formData = new FormData();
    formData.set("bio", bio);
    formData.set("location", location);
    selectedInterests.forEach((tag) => formData.append("interests", tag));

    startTransition(async () => {
      await completeOnboarding(formData);
    });
  };

  const [showMeshiGuide, setShowMeshiGuide] = useState(true);

  const steps = [
    // Step 0: Welcome (with Meshi guide)
    <div key="welcome" className="text-center space-y-6 animate-fade-in">
      {showMeshiGuide ? (
        <MeshiOnboardingGuide onComplete={() => setShowMeshiGuide(false)} />
      ) : (
        <>
          <MeshiMascot size={64} mood="excited" color="blue" speaking />
          <h1 className="font-display text-3xl font-bold text-[var(--text-primary)]">Welcome to the Mesh</h1>
          <p className="text-[var(--text-tertiary)] text-lg max-w-md mx-auto">
            Meshi showed you the ropes. Now let&apos;s make this yours!
          </p>
          <Button onClick={() => setStep(1)} variant="gradient" size="lg">
            Let&apos;s go <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </>
      )}
    </div>,

    // Step 1: Bio & Location
    <div key="bio" className="space-y-6 animate-fade-in max-w-md mx-auto w-full">
      <div className="text-center mb-2">
        <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Tell us about yourself</h2>
        <p className="text-[var(--text-tertiary)]">A short bio so people know who they&apos;re meshing with</p>
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
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Location (optional)</label>
        <Input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="City, Country"
        />
      </div>
      <div className="flex gap-3 justify-end">
        <Button onClick={() => setStep(0)} variant="ghost">Back</Button>
        <Button onClick={() => setStep(2)} variant="gradient">
          Next <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>,

    // Step 2: Interests
    <div key="interests" className="space-y-6 animate-fade-in max-w-lg mx-auto w-full">
      <div className="text-center mb-2">
        <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">What are you into?</h2>
        <p className="text-[var(--text-tertiary)]">Pick at least 3 — this helps you find your people</p>
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
      <div className="flex gap-3 justify-end">
        <Button onClick={() => setStep(1)} variant="ghost">Back</Button>
        <Button
          onClick={handleFinish}
          variant="gradient"
          disabled={isPending}
        >
          {isPending ? "Building your mesh..." : "Enter the Mesh"}
        </Button>
      </div>
    </div>,
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] mesh-bg flex items-center justify-center px-6">
      <div className="w-full max-w-xl">
        {/* Progress bar */}
        <div className="flex gap-2 mb-12 max-w-xs mx-auto">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={cn(
                "h-1 flex-1 rounded-full transition-all duration-300",
                i <= step ? "bg-[var(--accent)]" : "bg-[var(--bg-tertiary)]"
              )}
            />
          ))}
        </div>

        {steps[step]}
      </div>
    </div>
  );
}
