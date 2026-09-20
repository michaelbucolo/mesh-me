"use client";

import { useState, useSyncExternalStore } from "react";
import { Bookmark, Check, MousePointer2, Send, Smartphone, Sparkles, Volume2 } from "lucide-react";
import { feedback, type FeedbackKind } from "@/lib/feedback";
import { areVisualEffectsEnabled, getSoundLevel, isHapticsEnabled, setHapticsEnabled, setSoundLevel, setVisualEffectsEnabled, subscribeInteractionPreferences } from "@/lib/interaction-preferences";
import { isSoundEnabled, setSoundEnabled } from "@/lib/sound";
import { celebrate } from "@/lib/celebration";

const previews = [
  { name: "Tap", kind: "select", icon: MousePointer2 },
  { name: "Save", kind: "save", icon: Bookmark },
  { name: "Send", kind: "send", icon: Send },
] as const;

export function FeedbackSettings() {
  const sound = useSyncExternalStore(subscribeInteractionPreferences, isSoundEnabled, () => false);
  const haptics = useSyncExternalStore(subscribeInteractionPreferences, isHapticsEnabled, () => true);
  const level = useSyncExternalStore(subscribeInteractionPreferences, getSoundLevel, () => 0.4);
  const visualEffects = useSyncExternalStore(subscribeInteractionPreferences, areVisualEffectsEnabled, () => true);
  const [preview, setPreview] = useState<{ kind: FeedbackKind; count: number }>({ kind: "select", count: 0 });

  const tryFeedback = (kind: FeedbackKind, anchor: HTMLButtonElement) => {
    setPreview((current) => ({ kind, count: current.count + 1 }));
    feedback(kind);
    if (kind === "save" || kind === "send") celebrate({ kind, anchor });
  };

  return (
    <section className="mesh-feedback-settings" aria-labelledby="feedback-title">
      <div>
        <h3 id="feedback-title" className="text-base font-semibold">Sound & feel</h3>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">Small details, your way. Saved on this device.</p>
      </div>
      <div className="mesh-feedback-preview" aria-label="Preview interaction feedback">
        {previews.map(({ name, kind, icon: Icon }) => (
          <button key={kind} type="button" data-feedback="off" className="mesh-feedback-sample" onClick={(event) => tryFeedback(kind, event.currentTarget)} aria-label={`Preview ${name.toLowerCase()} feedback`}>
            <span key={preview.kind === kind ? preview.count : 0} className={preview.kind === kind && preview.count > 0 ? "mesh-feedback-sample-icon is-playing" : "mesh-feedback-sample-icon"}>
              <Icon size={22} aria-hidden="true" />
            </span>
            <span>{name}</span>
          </button>
        ))}
        <span className="mesh-feedback-preview-label">Try a touch</span>
      </div>
      <div className="mesh-feedback-row">
        <Volume2 size={18} aria-hidden="true" />
        <div><label id="sound-label">Interface sounds</label><p id="sound-description">Quiet, short tones. Pause while your media plays.</p></div>
        <button type="button" role="switch" aria-checked={sound} aria-labelledby="sound-label" aria-describedby="sound-description" data-feedback="off" className="mesh-feedback-switch" onClick={() => { setSoundEnabled(!sound); if (!sound) feedback("select"); }}>
          <span>{sound ? <Check size={12} aria-hidden="true" /> : null}</span>
        </button>
      </div>
      {sound && <div className="mesh-feedback-volume">
        <label htmlFor="interface-volume">Volume</label>
        <input id="interface-volume" type="range" min="0" max="100" step="5" value={Math.round(level * 100)} onChange={(event) => setSoundLevel(Number(event.target.value) / 100)} onPointerUp={() => feedback("select")} onKeyUp={(event) => { if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) feedback("select"); }} />
        <output htmlFor="interface-volume">{Math.round(level * 100)}%</output>
      </div>}
      <div className="mesh-feedback-row">
        <Sparkles size={18} aria-hidden="true" />
        <div><label id="effects-label">Particle effects</label><p id="effects-description">A little spark when something lands. Respects Reduce Motion.</p></div>
        <button type="button" role="switch" aria-checked={visualEffects} aria-labelledby="effects-label" aria-describedby="effects-description" className="mesh-feedback-switch" onClick={() => setVisualEffectsEnabled(!visualEffects)}>
          <span>{visualEffects ? <Check size={12} aria-hidden="true" /> : null}</span>
        </button>
      </div>
      <div className="mesh-feedback-row">
        <Smartphone size={18} aria-hidden="true" />
        <div><label id="haptics-label">Haptic feedback</label><p id="haptics-description">Gentle taps on supported devices.</p></div>
        <button type="button" role="switch" aria-checked={haptics} aria-labelledby="haptics-label" aria-describedby="haptics-description" data-feedback="off" className="mesh-feedback-switch" onClick={() => { setHapticsEnabled(!haptics); if (!haptics) feedback("select"); }}>
          <span>{haptics ? <Check size={12} aria-hidden="true" /> : null}</span>
        </button>
      </div>
      <p className="text-xs leading-relaxed text-[var(--text-muted)]">Animations follow your device’s Reduce Motion setting.</p>
    </section>
  );
}
