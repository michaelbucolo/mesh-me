"use client";

import { Children, type CSSProperties, type FormEvent, type ReactNode, useMemo, useState, useTransition } from "react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import { ArrowLeft, ArrowRight, Bell, Check, LayoutGrid, Palette, Shield, Sparkles, UserRound } from "lucide-react";
import { PaperWait } from "@/components/loading/paper-wait";
import { MESHI_FACE_IDS, MESHI_LASH_IDS } from "@/components/meshi/meshi-face";
import { MESHI_HAIR_IDS } from "@/components/meshi/meshi-hair";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  MeshiMascot,
  type MeshiAccessory,
  type MeshiBadge,
  type MeshiColor,
  type MeshiEyeStyle,
  type MeshiHair,
  type MeshiHat,
} from "@/components/meshi/meshi-mascot";
import { updateMeshiLocalPreferences } from "@/hooks/use-meshi-preferences";
import { completeOnboarding } from "@/lib/actions";
import { cn, INTEREST_TAGS } from "@/lib/utils";

type OnboardingFlowProps = {
  user: {
    email: string;
    username: string;
    displayName: string;
    bio: string;
    location: string;
  };
  meshi: {
    colorTheme: string;
    hatStyle: string;
    faceStyle: string;
    hairStyle: string;
    accessoryStyle: string;
    eyeStyle: string;
    badgeStyle: string;
  };
  meshPrivacy: {
    meshVisibility: string;
    showConnections: boolean;
    showStats: boolean;
  };
  feedPreference: {
    layout: string;
  };
  notificationPreference: {
    pushEnabled: boolean;
    emailDigest: string;
    messages: boolean;
    mentions: boolean;
    comments: boolean;
    follows: boolean;
    platformAlerts: boolean;
    productUpdates: boolean;
  };
  platformOptions: Array<{ id: string; name: string; authType: "oauth" | "manual"; connected: boolean }>;
};

const steps = [
  { id: "account", label: "Account", icon: UserRound },
  { id: "meshi", label: "Meshi", icon: Palette },
  { id: "privacy", label: "Privacy", icon: Shield },
  { id: "notifications", label: "Alerts", icon: Bell },
  { id: "style", label: "Style", icon: LayoutGrid },
  { id: "apps", label: "Apps", icon: Sparkles },
] as const;

const colors = ["blue", "purple", "pink", "green", "orange", "cyan", "gold"];
const hats = ["none", "cap", "beanie", "flower", "headphones", "crown"];
const hairs = MESHI_HAIR_IDS.slice(0, 8);
// A curated opening subset; the full set lives in Settings.
const faces = MESHI_FACE_IDS.slice(0, 6);
const eyes = MESHI_LASH_IDS;
const accessories = ["none", "glasses", "sunglasses", "monocle"];
const badges = ["none", "spark", "heart", "shield"];

const interfaceStyles = [
  { id: "simple", title: "Simple", body: "The calmest feed. Larger posts and fewer controls." },
  { id: "balanced", title: "Balanced", body: "A familiar social feed with Mesh.me controls nearby." },
  { id: "creator", title: "Creator", body: "More analytics, account controls, and cross-posting context." },
  { id: "classic", title: "Classic", body: "A family-friendly layout that feels closer to older social apps." },
];

// Shared Mesh Motion easings (typed as bezier tuples for framer).
const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];
const SPRING_LUSH: [number, number, number, number] = [0.34, 1.56, 0.64, 1];

// Directional step choreography: forward springs in from the right while the
// outgoing panel slides left; back reverses. `custom` carries the direction.
const panelVariants: Variants = {
  enter: (dir: number) => ({ opacity: 0, x: dir >= 0 ? 44 : -44, scale: 0.985 }),
  center: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 360, damping: 30, mass: 0.8 },
  },
  exit: (dir: number) => ({
    opacity: 0,
    x: dir >= 0 ? -44 : 44,
    scale: 0.985,
    transition: { duration: 0.2, ease: EASE_OUT },
  }),
};

export function OnboardingFlow({
  user,
  meshi,
  meshPrivacy,
  feedPreference,
  notificationPreference,
  platformOptions,
}: OnboardingFlowProps) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const reduce = useReducedMotion();
  const [account, setAccount] = useState({
    username: user.username,
    displayName: user.displayName,
    bio: user.bio,
    location: user.location,
  });
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [meshiState, setMeshiState] = useState({
    colorTheme: meshi.colorTheme,
    hatStyle: meshi.hatStyle,
    faceStyle: meshi.faceStyle,
    hairStyle: meshi.hairStyle,
    accessoryStyle: meshi.accessoryStyle,
    eyeStyle: meshi.eyeStyle,
    badgeStyle: meshi.badgeStyle,
  });
  const [privacy, setPrivacy] = useState({
    meshVisibility: meshPrivacy.meshVisibility,
    showConnections: meshPrivacy.showConnections,
    showStats: meshPrivacy.showStats,
    // Findable and alive by default — these two silently defaulting the other
    // way meant every account that finished onboarding vanished from
    // discovery AND from live presence (nobody could ever see anyone's Meshi).
    // Content stays private via meshVisibility; both toggles remain right
    // here for anyone who wants to opt out.
    showInDiscovery: true,
    hideActivityStatus: false,
    readReceipts: false,
  });
  const [notifications, setNotifications] = useState({
    pushEnabled: notificationPreference.pushEnabled,
    emailDigest: notificationPreference.emailDigest,
    messages: notificationPreference.messages,
    mentions: notificationPreference.mentions,
    comments: notificationPreference.comments,
    follows: notificationPreference.follows,
    platformAlerts: notificationPreference.platformAlerts,
    productUpdates: notificationPreference.productUpdates,
  });
  const [interfaceStyle, setInterfaceStyle] = useState(feedPreference.layout);
  const [selectedApps, setSelectedApps] = useState<string[]>([]);
  const [quickMerge, setQuickMerge] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const currentStep = steps[step];
  const progress = useMemo(() => Math.round(((step + 1) / steps.length) * 100), [step]);
  const canContinue = account.username.trim().length >= 3 && account.displayName.trim().length > 0;

  function toggleApp(id: string) {
    setSelectedApps((current) => (
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    ));
  }

  function toggleInterest(tag: string) {
    setSelectedInterests((current) => (
      current.includes(tag)
        ? current.filter((item) => item !== tag)
        : current.length >= 12
          ? current
          : [...current, tag]
    ));
  }

  async function requestNotificationPermission() {
    if (!("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    setNotifications((current) => ({ ...current, pushEnabled: permission === "granted" }));
  }

  function next() {
    if (step === 0 && !canContinue) {
      setStatus("Choose a display name and a username with at least three characters.");
      return;
    }
    setStatus(null);
    setDirection(1);
    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  function back() {
    setStatus(null);
    setDirection(-1);
    setStep((current) => Math.max(current - 1, 0));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const formData = new FormData();
    formData.set("username", account.username);
    formData.set("displayName", account.displayName);
    formData.set("bio", account.bio);
    formData.set("location", account.location);
    selectedInterests.forEach((tag) => formData.append("interests", tag));
    formData.set("meshiColor", meshiState.colorTheme);
    formData.set("meshiHat", meshiState.hatStyle);
    formData.set("meshiFace", meshiState.faceStyle);
    formData.set("meshiHair", meshiState.hairStyle);
    formData.set("meshiAccessory", meshiState.accessoryStyle);
    formData.set("meshiEyes", meshiState.eyeStyle);
    formData.set("meshiBadge", meshiState.badgeStyle);
    formData.set("meshVisibility", privacy.meshVisibility);
    formData.set("showConnections", String(privacy.showConnections));
    formData.set("showStats", String(privacy.showStats));
    formData.set("showInDiscovery", String(privacy.showInDiscovery));
    formData.set("hideActivityStatus", String(privacy.hideActivityStatus));
    formData.set("readReceipts", String(privacy.readReceipts));
    formData.set("pushEnabled", String(notifications.pushEnabled));
    formData.set("emailDigest", notifications.emailDigest);
    formData.set("notifyMessages", String(notifications.messages));
    formData.set("notifyMentions", String(notifications.mentions));
    formData.set("notifyComments", String(notifications.comments));
    formData.set("notifyFollows", String(notifications.follows));
    formData.set("notifyPlatformAlerts", String(notifications.platformAlerts));
    formData.set("notifyProductUpdates", String(notifications.productUpdates));
    formData.set("interfaceStyle", interfaceStyle);
    selectedApps.forEach((id) => formData.append("platforms", id));
    formData.set("quickMerge", String(quickMerge && selectedApps.length > 0));

    updateMeshiLocalPreferences({
      color: meshiState.colorTheme as MeshiColor,
      hat: meshiState.hatStyle as MeshiHat,
      face: meshiState.faceStyle,
      hair: meshiState.hairStyle as MeshiHair,
      accessory: meshiState.accessoryStyle as MeshiAccessory,
      eye: meshiState.eyeStyle as MeshiEyeStyle,
      badge: meshiState.badgeStyle as MeshiBadge,
    });

    startTransition(async () => {
      setStatus(null);
      const result = await completeOnboarding(formData);
      if (result && typeof result === "object" && "error" in result) {
        setStatus(String(result.error));
      }
    });
  }

  return (
    <main className="onboarding-shell h-dvh max-h-dvh min-h-0 overflow-hidden bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* Below lg the two children stack, and without an explicit row template
          the rows fought over a fixed h-full: measured at 390×844, the card row
          compressed onto the aside (85px overlap swallowing its footer) and the
          step panel shrank to a ~90px strip that clipped the Username field
          mid-input. auto + minmax(0,1fr): the header takes its height, the card
          gets the remainder and scrolls inside itself. */}
      <form onSubmit={submit} className="onboarding-grid mx-auto grid h-full min-h-0 w-full max-w-6xl grid-rows-[auto_minmax(0,1fr)] gap-4 overflow-hidden px-4 py-4 lg:grid-cols-[17rem_minmax(0,1fr)] lg:grid-rows-1 lg:px-8">
        <aside className="mesh-surface h-fit rounded-lg p-4 lg:sticky lg:top-4">
          <div className="flex items-center gap-3">
            <motion.div
              key={step}
              initial={{ y: 0 }}
              animate={{ y: [0, -12, 0] }}
              transition={{ duration: 0.5, ease: SPRING_LUSH, times: [0, 0.42, 1] }}
              className="shrink-0"
            >
              <MeshiMascot
                size={54}
                color={meshiState.colorTheme as MeshiColor}
                hat={meshiState.hatStyle as MeshiHat}
                face={meshiState.faceStyle}
                hair={meshiState.hairStyle as MeshiHair}
                accessory={meshiState.accessoryStyle as MeshiAccessory}
                eyeStyle={meshiState.eyeStyle as MeshiEyeStyle}
                badge={meshiState.badgeStyle as MeshiBadge}
                prop={currentStep.id === "notifications" ? "bell" : currentStep.id === "privacy" ? "shield" : currentStep.id === "apps" ? "compass" : "none"}
                animate
                showGlow={false}
              />
            </motion.div>
            <div>
              <p className="text-sm font-semibold">Mesh.me setup</p>
              <p className="text-xs text-[var(--text-muted)]">{progress}% complete</p>
            </div>
          </div>
          <div className="relative mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
            <motion.div
              className="relative h-full overflow-hidden rounded-full bg-[var(--accent)]"
              animate={{ width: `${progress}%` }}
              transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 220, damping: 26, mass: 0.7 }}
            >
              {!reduce && (
                <motion.span
                  key={step}
                  aria-hidden="true"
                  className="absolute inset-y-0 left-0 w-16"
                  style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.7), transparent)" }}
                  initial={{ x: "-110%" }}
                  animate={{ x: "280%" }}
                  transition={{ duration: 0.75, ease: EASE_OUT, delay: 0.08 }}
                />
              )}
            </motion.div>
          </div>
          {/* On a phone this six-button menu plus the note below cost ~410 of
              844px before any setup content appeared. Next/Back walk the same
              steps and the progress bar stays; the full menu is a desktop
              luxury. */}
          <nav className="mt-4 hidden gap-1 lg:grid" aria-label="Onboarding steps">
            {steps.map((item, index) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setDirection(index >= step ? 1 : -1);
                    setStep(index);
                  }}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-md px-3 text-left text-sm font-semibold transition",
                    index === step ? "bg-[var(--accent-subtle)] text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]",
                  )}
                  data-testid={`onboarding-step-${item.id}`}
                >
                  <Icon size={17} aria-hidden="true" />
                  {item.label}
                </button>
              );
            })}
          </nav>
          <p className="mt-4 hidden rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)]/70 p-3 text-xs leading-5 text-[var(--text-secondary)] lg:block">
            Privacy-first defaults are already on. Setup only decides how your world starts.
          </p>
        </aside>

        <section className="mesh-surface onboarding-card flex min-h-0 flex-col overflow-hidden rounded-lg p-4 md:p-5" data-testid="onboarding-flow">
          <header className="shrink-0 flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border-primary)] pb-4">
            <div>
              <p className="text-xs font-semibold mesh-eyebrow text-[var(--text-muted)]">Your World, Your Way</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-[0] md:text-4xl">{currentStep.label}</h1>
            </div>
            <div className="rounded-full border border-[var(--border-primary)] bg-[var(--bg-primary)]/70 px-3 py-2 text-xs font-semibold text-[var(--text-secondary)]">
              {user.email}
            </div>
          </header>

          {status && (
            <div className="mt-4 rounded-md border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm font-semibold text-[var(--danger)]" role="alert">
              {status}
            </div>
          )}

          <div className="onboarding-step-panel mt-4 min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-1">
            <AnimatePresence mode="wait" custom={direction} initial={false}>
              <motion.div
                key={currentStep.id}
                custom={direction}
                variants={panelVariants}
                initial="enter"
                animate="center"
                exit="exit"
              >
            {currentStep.id === "account" && (
              <StepShell title="Start with the basics" body="Pick the public identity people will recognize. You can change this later.">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2 text-sm font-semibold">
                    Username
                    <Input
                      value={account.username}
                      onChange={(event) => setAccount((current) => ({ ...current, username: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") }))}
                      data-testid="onboarding-username"
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-semibold">
                    Display name
                    <Input value={account.displayName} onChange={(event) => setAccount((current) => ({ ...current, displayName: event.target.value }))} />
                  </label>
                  <label className="grid gap-2 text-sm font-semibold md:col-span-2">
                    Bio
                    <Textarea value={account.bio} onChange={(event) => setAccount((current) => ({ ...current, bio: event.target.value }))} maxLength={160} rows={3} />
                  </label>
                  <label className="grid gap-2 text-sm font-semibold">
                    Location
                    <Input value={account.location} onChange={(event) => setAccount((current) => ({ ...current, location: event.target.value }))} placeholder="Optional" />
                  </label>
                </div>
                <PickerGroup label="Interests">
                  {INTEREST_TAGS.map((tag) => (
                    <ChoiceButton key={tag} active={selectedInterests.includes(tag)} onClick={() => toggleInterest(tag)}>
                      {tag}
                    </ChoiceButton>
                  ))}
                </PickerGroup>
              </StepShell>
            )}

            {currentStep.id === "meshi" && (
              <StepShell title="Create your Meshi" body="Meshi is your character, logo, and companion across Mesh.me. Keep it simple and recognizable.">
                <div className="grid gap-5 lg:grid-cols-[16rem_minmax(0,1fr)]">
                  <div className="grid place-items-center rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)]/70 p-6">
                    <MeshiMascot
                      size={132}
                      color={meshiState.colorTheme as MeshiColor}
                      hat={meshiState.hatStyle as MeshiHat}
                      face={meshiState.faceStyle}
                      hair={meshiState.hairStyle as MeshiHair}
                      accessory={meshiState.accessoryStyle as MeshiAccessory}
                      eyeStyle={meshiState.eyeStyle as MeshiEyeStyle}
                      badge={meshiState.badgeStyle as MeshiBadge}
                      animate
                      interactive
                    />
                  </div>
                  <div className="grid gap-4">
                    <PickerGroup label="Color">
                      {colors.map((color) => (
                        <GraphicChoice key={color} active={meshiState.colorTheme === color} label={color} onClick={() => setMeshiState((current) => ({ ...current, colorTheme: color }))}>
                          <MeshiMascot
                            size={30}
                            color={color as MeshiColor}
                            hat={meshiState.hatStyle as MeshiHat}
                            face={meshiState.faceStyle}
                            hair={meshiState.hairStyle as MeshiHair}
                            accessory={meshiState.accessoryStyle as MeshiAccessory}
                            eyeStyle={meshiState.eyeStyle as MeshiEyeStyle}
                            badge={meshiState.badgeStyle as MeshiBadge}
                            animate={false}
                            showGlow={false}
                          />
                        </GraphicChoice>
                      ))}
                    </PickerGroup>
                    <PickerGroup label="Hair">
                      {hairs.map((hair) => (
                        <GraphicChoice key={hair} active={meshiState.hairStyle === hair} label={hair} onClick={() => setMeshiState((current) => ({ ...current, hairStyle: hair }))}>
                          <MeshiMascot
                            size={30}
                            color={meshiState.colorTheme as MeshiColor}
                            hat={meshiState.hatStyle as MeshiHat}
                            face={meshiState.faceStyle}
                            hair={hair as MeshiHair}
                            accessory={meshiState.accessoryStyle as MeshiAccessory}
                            eyeStyle={meshiState.eyeStyle as MeshiEyeStyle}
                            badge={meshiState.badgeStyle as MeshiBadge}
                            animate={false}
                            showGlow={false}
                          />
                        </GraphicChoice>
                      ))}
                    </PickerGroup>
                    <PickerGroup label="Hat">
                      {hats.map((hat) => (
                        <GraphicChoice key={hat} active={meshiState.hatStyle === hat} label={hat} onClick={() => setMeshiState((current) => ({ ...current, hatStyle: hat }))}>
                          <MeshiMascot
                            size={30}
                            color={meshiState.colorTheme as MeshiColor}
                            hat={hat as MeshiHat}
                            face={meshiState.faceStyle}
                            hair={meshiState.hairStyle as MeshiHair}
                            accessory={meshiState.accessoryStyle as MeshiAccessory}
                            eyeStyle={meshiState.eyeStyle as MeshiEyeStyle}
                            badge={meshiState.badgeStyle as MeshiBadge}
                            animate={false}
                            showGlow={false}
                          />
                        </GraphicChoice>
                      ))}
                    </PickerGroup>
                    <PickerGroup label="Eyes">
                      {eyes.map((eye) => (
                        <GraphicChoice key={eye} active={meshiState.eyeStyle === eye} label={eye} onClick={() => setMeshiState((current) => ({ ...current, eyeStyle: eye }))}>
                          <MeshiMascot
                            size={30}
                            color={meshiState.colorTheme as MeshiColor}
                            hat={meshiState.hatStyle as MeshiHat}
                            face={meshiState.faceStyle}
                            hair={meshiState.hairStyle as MeshiHair}
                            accessory={meshiState.accessoryStyle as MeshiAccessory}
                            eyeStyle={eye as MeshiEyeStyle}
                            badge={meshiState.badgeStyle as MeshiBadge}
                            animate={false}
                            showGlow={false}
                          />
                        </GraphicChoice>
                      ))}
                    </PickerGroup>
                    <PickerGroup label="Accessories">
                      {accessories.map((accessory) => (
                        <GraphicChoice key={accessory} active={meshiState.accessoryStyle === accessory} label={accessory} onClick={() => setMeshiState((current) => ({ ...current, accessoryStyle: accessory }))}>
                          <MeshiMascot
                            size={30}
                            color={meshiState.colorTheme as MeshiColor}
                            hat={meshiState.hatStyle as MeshiHat}
                            face={meshiState.faceStyle}
                            hair={meshiState.hairStyle as MeshiHair}
                            accessory={accessory as MeshiAccessory}
                            eyeStyle={meshiState.eyeStyle as MeshiEyeStyle}
                            badge={meshiState.badgeStyle as MeshiBadge}
                            animate={false}
                            showGlow={false}
                          />
                        </GraphicChoice>
                      ))}
                    </PickerGroup>
                    <PickerGroup label="Badges">
                      {badges.map((badge) => (
                        <GraphicChoice key={badge} active={meshiState.badgeStyle === badge} label={badge} onClick={() => setMeshiState((current) => ({ ...current, badgeStyle: badge }))}>
                          <MeshiMascot
                            size={30}
                            color={meshiState.colorTheme as MeshiColor}
                            hat={meshiState.hatStyle as MeshiHat}
                            face={meshiState.faceStyle}
                            hair={meshiState.hairStyle as MeshiHair}
                            accessory={meshiState.accessoryStyle as MeshiAccessory}
                            eyeStyle={meshiState.eyeStyle as MeshiEyeStyle}
                            badge={badge as MeshiBadge}
                            animate={false}
                            showGlow={false}
                          />
                        </GraphicChoice>
                      ))}
                    </PickerGroup>
                    <PickerGroup label="Mood">
                      {faces.map((face) => (
                        <ChoiceButton key={face} active={meshiState.faceStyle === face} onClick={() => setMeshiState((current) => ({ ...current, faceStyle: face }))}>
                          {face}
                        </ChoiceButton>
                      ))}
                    </PickerGroup>
                  </div>
                </div>
              </StepShell>
            )}

            {currentStep.id === "privacy" && (
              <StepShell title="Choose your privacy defaults" body="Mesh.me starts private. Open only what you mean to share.">
                <div className="grid gap-3 md:grid-cols-3">
                  {[
                    { id: "private", title: "Private", body: "Only you see your Mesh." },
                    { id: "friends", title: "Friends", body: "Mutual connections can see selected branches." },
                    { id: "public", title: "Public", body: "Your profile and public Mesh can be discovered." },
                  ].map((option) => (
                    <motion.button
                      key={option.id}
                      type="button"
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setPrivacy((current) => ({ ...current, meshVisibility: option.id }))}
                      aria-pressed={privacy.meshVisibility === option.id}
                      className={cn("mesh-choice rounded-md p-4 text-left", privacy.meshVisibility === option.id && "mesh-choice-selected")}
                    >
                      <span className="flex items-center justify-between gap-2 text-base font-semibold">
                        {option.title}
                        {privacy.meshVisibility === option.id && (
                          <Check size={16} className="animate-mesh-pop shrink-0 text-[var(--accent-text)]" aria-hidden="true" />
                        )}
                      </span>
                      <span className="mt-2 block text-sm leading-6 text-[var(--text-secondary)]">{option.body}</span>
                    </motion.button>
                  ))}
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <Toggle label="Show me in discovery" value={privacy.showInDiscovery} onChange={(value) => setPrivacy((current) => ({ ...current, showInDiscovery: value }))} />
                  <Toggle label="Show Mesh connections" value={privacy.showConnections} onChange={(value) => setPrivacy((current) => ({ ...current, showConnections: value }))} />
                  <Toggle label="Show Mesh stats" value={privacy.showStats} onChange={(value) => setPrivacy((current) => ({ ...current, showStats: value }))} />
                  <Toggle label="Read receipts" value={privacy.readReceipts} onChange={(value) => setPrivacy((current) => ({ ...current, readReceipts: value }))} />
                  <Toggle label="Hide activity status" value={privacy.hideActivityStatus} onChange={(value) => setPrivacy((current) => ({ ...current, hideActivityStatus: value }))} />
                </div>
              </StepShell>
            )}

            {currentStep.id === "notifications" && (
              <StepShell title="Set notification rules" body="Mesh.me should reduce noise, not add more. Security alerts always stay on.">
                <div className="grid gap-3 md:grid-cols-2">
                  <Toggle label="Messages" value={notifications.messages} onChange={(value) => setNotifications((current) => ({ ...current, messages: value }))} />
                  <Toggle label="Mentions" value={notifications.mentions} onChange={(value) => setNotifications((current) => ({ ...current, mentions: value }))} />
                  <Toggle label="Comments" value={notifications.comments} onChange={(value) => setNotifications((current) => ({ ...current, comments: value }))} />
                  <Toggle label="Follows" value={notifications.follows} onChange={(value) => setNotifications((current) => ({ ...current, follows: value }))} />
                  <Toggle label="Platform alerts" value={notifications.platformAlerts} onChange={(value) => setNotifications((current) => ({ ...current, platformAlerts: value }))} />
                  <Toggle label="Product updates" value={notifications.productUpdates} onChange={(value) => setNotifications((current) => ({ ...current, productUpdates: value }))} />
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_13rem]">
                  <label className="grid gap-2 text-sm font-semibold">
                    Email digest
                    <select value={notifications.emailDigest} onChange={(event) => setNotifications((current) => ({ ...current, emailDigest: event.target.value }))} className="simple-input h-11 px-3 text-sm">
                      <option value="off">Off</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                    </select>
                  </label>
                  <Button type="button" variant="secondary" onClick={requestNotificationPermission} className="self-end">
                    Ask for push permission
                  </Button>
                </div>
              </StepShell>
            )}

            {currentStep.id === "style" && (
              <StepShell title="Pick your starting layout" body="This controls the first Feed experience. The Mesh stays available from the main dashboard.">
                <div className="grid gap-3 md:grid-cols-2">
                  {interfaceStyles.map((option) => (
                    <motion.button
                      key={option.id}
                      type="button"
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setInterfaceStyle(option.id)}
                      aria-pressed={interfaceStyle === option.id}
                      className={cn("mesh-choice rounded-md p-4 text-left", interfaceStyle === option.id && "mesh-choice-selected")}
                    >
                      <span className="flex items-center justify-between gap-2 text-base font-semibold">
                        {option.title}
                        {interfaceStyle === option.id && (
                          <Check size={16} className="animate-mesh-pop shrink-0 text-[var(--accent-text)]" aria-hidden="true" />
                        )}
                      </span>
                      <span className="mt-2 block text-sm leading-6 text-[var(--text-secondary)]">{option.body}</span>
                    </motion.button>
                  ))}
                </div>
              </StepShell>
            )}

            {currentStep.id === "apps" && (
              <StepShell title="What apps do you use?" body="Pick the platforms you're already on. Mesh.me brings them into one place — and we'll help you connect them right after setup.">
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {platformOptions.map((platform) => {
                    const active = selectedApps.includes(platform.id);
                    return (
                      <motion.button
                        key={platform.id}
                        type="button"
                        whileTap={{ scale: 0.97 }}
                        onClick={() => toggleApp(platform.id)}
                        aria-pressed={active}
                        className={cn("mesh-choice min-h-20 rounded-md px-4 py-3 text-left transition", active && "mesh-choice-selected")}
                        data-testid={`onboarding-app-${platform.id}`}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="block text-sm font-semibold">{platform.name}</span>
                          {active && <Check size={15} className="animate-mesh-pop text-[var(--accent-text)]" aria-hidden="true" />}
                        </span>
                        <span className="mt-1 block text-xs text-[var(--text-muted)]">
                          {platform.connected ? "Already connected" : platform.authType === "oauth" ? "One-tap connect" : "Add manually"}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
                <div className="mt-4 grid gap-3">
                  <p className="text-xs text-[var(--text-muted)]">
                    {selectedApps.length > 0 ? `${selectedApps.length} selected` : "Optional — you can skip and add apps later."}
                  </p>
                  <Toggle label="Help me connect these right after setup" value={quickMerge} onChange={setQuickMerge} />
                </div>
              </StepShell>
            )}
              </motion.div>
            </AnimatePresence>
          </div>

          <footer className="mt-4 flex shrink-0 flex-col-reverse gap-3 border-t border-[var(--border-primary)] pt-4 sm:flex-row sm:items-center sm:justify-between">
            <Button type="button" variant="secondary" onClick={back} disabled={step === 0 || isPending}>
              <ArrowLeft size={16} aria-hidden="true" />
              Back
            </Button>
            {/* Only the first step (your name) is load-bearing — every later
                step edits a setting that already has a sensible default and a
                home in Settings. Making people walk all six before seeing the
                product is time-to-value spent dressing a mascot; this exit
                appears the moment the required part is done. */}
            {step > 0 && step < steps.length - 1 && (
              <button
                type="submit"
                disabled={isPending}
                data-testid="onboarding-skip-finish"
                className="ds-focus-ring text-xs font-semibold text-[var(--text-muted)] underline-offset-4 hover:text-[var(--text-primary)] hover:underline sm:mr-auto sm:ml-4"
              >
                Skip the rest — everything here can be changed later in Settings
              </button>
            )}
            {step < steps.length - 1 ? (
              // DISTINCT `key`s ON PURPOSE. Without them React sees one <Button>
              // at this tree position across every step and reconciles the SAME
              // DOM node in place — so on the last-but-one step the node's
              // `type` mutates from "button" to "submit" underneath the click
              // that is still being processed, and the browser's default action
              // submits the whole form. That skipped the Apps step and the
              // explicit "Finish setup" consent for everyone who walked the
              // wizard with Next. Different keys force an unmount/remount, so the
              // clicked node is only ever the Next button it was drawn as.
              <Button key="onboarding-next" type="button" onClick={next} disabled={isPending} data-testid="onboarding-next">
                Next
                <ArrowRight size={16} aria-hidden="true" />
              </Button>
            ) : (
              <Button key="onboarding-finish" type="submit" disabled={isPending} data-testid="onboarding-finish">
                {isPending ? <PaperWait size="sm" /> : <Check size={16} aria-hidden="true" />}
                Finish setup
              </Button>
            )}
          </footer>
        </section>
      </form>
    </main>
  );
}

function StepShell({ title, body, children }: { title: string; body: string; children: ReactNode }) {
  // Stagger the incoming panel's fields via the shared aurora cascade — each
  // block rises on its own delayed beat (self-guarded for reduced motion).
  const blocks = Children.toArray(children);
  return (
    <div className="mesh-cascade-soft grid gap-5">
      <div style={{ "--i": 0 } as CSSProperties}>
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">{body}</p>
      </div>
      {blocks.map((block, index) => (
        <div key={index} style={{ "--i": index + 1 } as CSSProperties}>
          {block}
        </div>
      ))}
    </div>
  );
}

function PickerGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-2">
      <p className="text-sm font-semibold">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function ChoiceButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.94 }}
      animate={active ? { scale: [1, 1.09, 1] } : { scale: 1 }}
      transition={{ duration: 0.34, ease: SPRING_LUSH }}
      aria-pressed={active}
      className={cn("mesh-choice rounded-full px-3 py-2 text-sm font-semibold capitalize", active && "mesh-choice-selected")}
    >
      {children}
    </motion.button>
  );
}

function GraphicChoice({ active, label, onClick, children }: { active: boolean; label: string; onClick: () => void; children: ReactNode }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.92 }}
      className={cn("mesh-choice relative grid min-w-[4.75rem] justify-items-center gap-1 rounded-md px-3 py-2 text-xs font-semibold capitalize", active && "mesh-choice-selected")}
      aria-pressed={active}
    >
      {/* Selected-pop: the preview springs with an overshoot and a brand ring
          bursts outward. The swatch preview itself stays animate={false}. */}
      <motion.span
        className="relative grid place-items-center"
        animate={active ? { scale: [1, 1.18, 0.94, 1] } : { scale: 1 }}
        transition={{ duration: 0.42, ease: SPRING_LUSH }}
      >
        {children}
        <AnimatePresence>
          {active && (
            <motion.span
              key="selected-ring"
              aria-hidden="true"
              className="pointer-events-none absolute inset-[-7px] rounded-full"
              style={{ border: "2px solid var(--accent)" }}
              initial={{ opacity: 0.85, scale: 0.45 }}
              animate={{ opacity: 0, scale: 1.6 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.55, ease: EASE_OUT }}
            />
          )}
        </AnimatePresence>
      </motion.span>
      <span>{label}</span>
    </motion.button>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={cn("mesh-choice flex min-h-12 items-center justify-between gap-3 rounded-md px-3 py-2 text-left", value && "mesh-choice-selected")}
      aria-pressed={value}
    >
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block text-xs text-[var(--text-muted)]">{value ? "On" : "Off"}</span>
      </span>
      {/* Real sliding knob: track fills accent-green with a glow when on, knob
          springs left↔right. */}
      <motion.span
        aria-hidden="true"
        className="relative flex h-6 w-11 shrink-0 items-center rounded-full px-0.5"
        animate={{
          backgroundColor: value ? "rgba(16,185,129,0.95)" : "rgba(148,163,184,0.32)",
          boxShadow: value ? "0 0 12px 1px rgba(16,185,129,0.5)" : "0 0 0 0 rgba(16,185,129,0)",
        }}
        transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <motion.span
          className="h-5 w-5 rounded-full bg-white shadow-md"
          animate={{ x: value ? 20 : 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      </motion.span>
    </button>
  );
}
