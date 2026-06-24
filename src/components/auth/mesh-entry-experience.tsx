"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CSSProperties, FormEvent } from "react";
import { useCallback, useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { flushSync } from "react-dom";
import { ArrowRight, Eye, EyeOff, Loader2, LockKeyhole, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { AnimatePresence, motion, type Transition, useReducedMotion } from "framer-motion";
import { finalizeSignInForEntry, requestPasswordReset, resolveEntryIdentity, signInForEntry, signUp } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import {
  MeshiMascot,
  type MeshiAccessory,
  type MeshiBadge,
  type MeshiColor,
  type MeshiEyeStyle,
  type MeshiHair,
  type MeshiHat,
  type MeshiMood,
  type MeshiOutfit,
  type MeshiProp,
} from "@/components/meshi/meshi-mascot";
import { cn } from "@/lib/utils";

type EntryStage = "identity" | "password" | "signup" | "reset";
type EntryState = "idle" | "connecting" | "failed" | "unlocking";
type MeshiEntranceState = "idle" | "arriving" | "handoff" | "settled";
type IdentityKind = "empty" | "email" | "phone" | "username" | "invalid";

type MeshEntryExperienceProps = {
  nextPath?: string | null;
};

type SignupDraft = {
  email: string;
  username: string;
  phone: string;
};

type EntryMeshiAppearance = {
  color: MeshiColor;
  hat: MeshiHat;
  face: MeshiMood;
  hair: MeshiHair;
  accessory: MeshiAccessory;
  eye: MeshiEyeStyle;
  badge: MeshiBadge;
  outfit: MeshiOutfit;
};

type EntryMeshiPreview = {
  username: string;
  displayName: string;
  meshi: EntryMeshiAppearance;
};

type EntryNode = {
  id: string;
  x: number;
  y: number;
  r: number;
  glow: number;
  drift: number;
};

const USERNAME_PREVIEW_PATTERN = /^[a-z0-9_]{2,24}$/;
const EMAIL_ENTRY_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_ENTRY_PATTERN = /^@?[a-z0-9_]{2,30}$/i;
const PHONE_ENTRY_PATTERN = /^[+\d\s().-]+$/;

const DEFAULT_ENTRY_MESHI: EntryMeshiAppearance = {
  color: "blue",
  hat: "none",
  face: "happy",
  hair: "none",
  accessory: "none",
  eye: "regular",
  badge: "none",
  outfit: "none",
};

function getUsernamePreviewCandidate(value: string) {
  const raw = value.trim();
  if (!raw || raw.includes("@")) return null;

  const phoneLike = /^[+\d\s().-]+$/.test(raw) && raw.replace(/[^\d]/g, "").length >= 7;
  if (phoneLike) return null;

  const normalized = raw.replace(/^@+/, "").toLowerCase();
  return USERNAME_PREVIEW_PATTERN.test(normalized) ? normalized : null;
}

function getEntryIdentityValidation(value: string): {
  ok: boolean;
  kind: IdentityKind;
  normalized: string;
  helper: string;
  message: string;
  inputMode: "email" | "tel" | "text";
  label: string;
} {
  const raw = value.trim();

  if (!raw) {
    return {
      ok: false,
      kind: "empty",
      normalized: "",
      helper: "Use your username, email, or phone number.",
      message: "Enter your username, email, or phone number.",
      inputMode: "email",
      label: "Identity",
    };
  }

  if (raw.length > 96) {
    return {
      ok: false,
      kind: "invalid",
      normalized: raw,
      helper: "Keep this under 96 characters.",
      message: "That identity is too long.",
      inputMode: "text",
      label: "Too long",
    };
  }

  const lowered = raw.toLowerCase();
  const digits = raw.replace(/[^\d]/g, "");

  if (raw.includes("@")) {
    const ok = EMAIL_ENTRY_PATTERN.test(lowered);
    return {
      ok,
      kind: ok ? "email" : "invalid",
      normalized: lowered,
      helper: ok ? "Email detected." : "Use a full email address, like you@example.com.",
      message: ok ? "" : "Enter a valid email address.",
      inputMode: "email",
      label: ok ? "Email" : "Check email",
    };
  }

  if (PHONE_ENTRY_PATTERN.test(raw) && digits.length >= 7) {
    return {
      ok: true,
      kind: "phone",
      normalized: raw.replace(/[^\d+]/g, ""),
      helper: "Phone number detected.",
      message: "",
      inputMode: "tel",
      label: "Phone",
    };
  }

  if (PHONE_ENTRY_PATTERN.test(raw) && /\d/.test(raw)) {
    return {
      ok: false,
      kind: "invalid",
      normalized: raw,
      helper: "Phone numbers need at least 7 digits.",
      message: "Enter a valid phone number.",
      inputMode: "tel",
      label: "Check phone",
    };
  }

  if (!USERNAME_ENTRY_PATTERN.test(raw)) {
    return {
      ok: false,
      kind: "invalid",
      normalized: lowered,
      helper: "Usernames use letters, numbers, and underscores.",
      message: "Enter a valid username, email, or phone number.",
      inputMode: "text",
      label: "Check entry",
    };
  }

  const username = lowered.replace(/^@+/, "");
  return {
    ok: true,
    kind: "username",
    normalized: username,
    helper: "Username detected.",
    message: "",
    inputMode: "text",
    label: "Username",
  };
}

function isMeshiPreviewPayload(value: unknown): value is {
  found: true;
  username: string;
  displayName: string;
  meshi: Record<string, string>;
} {
  if (!value || typeof value !== "object") return false;
  const payload = value as Record<string, unknown>;
  return (
    payload.found === true &&
    typeof payload.username === "string" &&
    typeof payload.displayName === "string" &&
    Boolean(payload.meshi) &&
    typeof payload.meshi === "object"
  );
}

function precise(value: number) {
  return Number(value.toFixed(2));
}

function createEntryNodes() {
  const nodes: EntryNode[] = [];
  const counts = [154, 136, 154, 136];
  const pushNode = (x: number, y: number, index: number) => {
    const glow = 0.24 + ((index * 17) % 50) / 100;
    nodes.push({
      id: `n${index + 1}`,
      x: precise(x),
      y: precise(y),
      r: precise(0.017 + ((index * 13) % 8) / 1000),
      glow: precise(glow),
      drift: precise(((index * 29) % 100) / 100),
    });
  };

  let index = 0;
  counts.forEach((count, side) => {
    for (let step = 0; step < count; step += 1) {
      const t = count === 1 ? 0 : step / (count - 1);
      const wave = Math.sin((index + 1) * 1.73);
      const counter = Math.cos((index + 1) * 0.91);
      const depth = 5.4 + Math.abs(Math.sin((index + 8) * 0.77)) * 8.4;
      if (side === 0) pushNode(-12 + t * 124 + wave * 1.9, -7.5 + counter * depth, index);
      if (side === 1) pushNode(107.5 + wave * depth, -12 + t * 124 + counter * 2.1, index);
      if (side === 2) pushNode(112 - t * 124 + wave * 1.9, 107.5 + counter * depth, index);
      if (side === 3) pushNode(-7.5 + wave * depth, 112 - t * 124 + counter * 2.1, index);
      index += 1;
    }
  });

  return nodes;
}

const EDGE_NODES = createEntryNodes();

const EDGE_LINKS = EDGE_NODES.flatMap((node, index) => {
  const links: Array<[string, string]> = [[node.id, EDGE_NODES[(index + 1) % EDGE_NODES.length].id]];
  if (index % 2 === 0) links.push([node.id, EDGE_NODES[(index + 2) % EDGE_NODES.length].id]);
  if (index % 5 === 0) links.push([node.id, EDGE_NODES[(index + 7) % EDGE_NODES.length].id]);
  if (index % 13 === 0) links.push([node.id, EDGE_NODES[(index + 19) % EDGE_NODES.length].id]);
  return links;
});

const CONNECTION_IDS = Array.from({ length: 28 }, (_, index) => {
  const nodeIndex = (Math.floor((index / 28) * EDGE_NODES.length) + 4) % EDGE_NODES.length;
  return EDGE_NODES[nodeIndex].id;
});
const MESHI_STRING_ANCHORS = [
  { x: 47.1, y: 36.6 },
  { x: 49.2, y: 35.4 },
  { x: 51.2, y: 35.6 },
  { x: 53.1, y: 36.9 },
  { x: 54.0, y: 39.1 },
  { x: 53.2, y: 41.4 },
  { x: 51.1, y: 42.7 },
  { x: 48.8, y: 42.6 },
  { x: 46.8, y: 41.3 },
  { x: 45.9, y: 39.1 },
  { x: 46.3, y: 37.4 },
  { x: 50.0, y: 39.0 },
];
const MESHI_CONNECTION_CORE = { x: 50, y: 39 };

const AMBIENT_SPARKS = Array.from({ length: 220 }, (_, index) => {
  const side = index % 4;
  const t = ((index * 23) % 100) / 100;
  const wave = Math.sin((index + 4) * 1.17);
  if (side === 0) return { x: precise(-10 + t * 120), y: precise(-4 + wave * 10), r: precise(0.022 + (index % 5) * 0.008) };
  if (side === 1) return { x: precise(104 + wave * 10), y: precise(-10 + t * 120), r: precise(0.022 + (index % 5) * 0.008) };
  if (side === 2) return { x: precise(110 - t * 120), y: precise(104 + wave * 10), r: precise(0.022 + (index % 5) * 0.008) };
  return { x: precise(-4 + wave * 10), y: precise(110 - t * 120), r: precise(0.022 + (index % 5) * 0.008) };
});

const BORDER_SWEEPS = [
  "M -9 8 C 18 -4 38 10 61 -1 S 94 8 109 -6",
  "M 106 -4 C 92 25 111 42 101 61 S 111 92 94 109",
  "M 110 92 C 80 103 62 91 39 104 S 6 94 -10 108",
  "M -6 105 C 8 82 -10 58 -1 38 S -10 8 8 -8",
  "M -8 22 C 22 15 37 26 54 17 S 87 25 109 16",
  "M 84 -8 C 91 20 79 42 91 65 S 82 94 103 111",
];

const DESTINATION_LABELS: Record<string, string> = {
  analytics: "Analytics",
  communities: "Communities",
  "connected-accounts": "Connected accounts",
  "content-hub": "Content Hub",
  explore: "Explore",
  feed: "Feed",
  marketplace: "Marketplace",
  mesh: "The Mesh",
  "meshi-voice": "Meshi Voice",
  meshpro: "Mesh Pro",
  messages: "MeChat",
  notifications: "Notifications",
  profile: "Profile",
  search: "Search",
  settings: "Settings",
  spaces: "Spaces",
  "super-app": "Super App",
  vault: "Vault",
};

function nodeById(id: string) {
  return EDGE_NODES.find((node) => node.id === id) ?? EDGE_NODES[0];
}

function meshPath(from: { x: number; y: number }, to: { x: number; y: number }, bend: number) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const controlX = midX - (dy / length) * bend;
  const controlY = midY + (dx / length) * bend;
  return `M ${from.x} ${from.y} Q ${controlX.toFixed(2)} ${controlY.toFixed(2)} ${to.x} ${to.y}`;
}

function MeshConstellation({
  progress,
  failed,
  typing,
  unlocking,
}: {
  progress: number;
  failed: boolean;
  typing: boolean;
  unlocking: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const stringProgress = unlocking ? 1 : typing || failed ? progress : 0;
  const liveProgress = Math.max(0, Math.min(1, stringProgress));
  const connectionOpacity = unlocking ? 0.98 : typing ? Math.max(0.34, liveProgress * 0.96) : Math.max(0.08, liveProgress);

  return (
    <div className="mesh-entry-constellation" aria-hidden="true">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
        <defs>
          <filter id="mesh-entry-soft-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="0.9" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="mesh-entry-node" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="white" stopOpacity="1" />
            <stop offset="45%" stopColor="#93c5fd" stopOpacity="0.96" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="mesh-entry-line" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#e0f2fe" stopOpacity="0.34" />
            <stop offset="55%" stopColor="#60a5fa" stopOpacity="0.78" />
            <stop offset="100%" stopColor="#f8fafc" stopOpacity="0.3" />
          </linearGradient>
          <linearGradient id="mesh-entry-string-live" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#93c5fd" stopOpacity="0" />
            <stop offset="34%" stopColor="#dbeafe" stopOpacity="0.58" />
            <stop offset="70%" stopColor="#38bdf8" stopOpacity="0.92" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.42" />
          </linearGradient>
          <linearGradient id="mesh-entry-fail" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#fecaca" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#f87171" stopOpacity="0.56" />
          </linearGradient>
          <linearGradient id="mesh-entry-rail" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#bfdbfe" stopOpacity="0" />
            <stop offset="18%" stopColor="#dbeafe" stopOpacity="0.28" />
            <stop offset="52%" stopColor="#60a5fa" stopOpacity="0.42" />
            <stop offset="84%" stopColor="#bae6fd" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#bfdbfe" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="mesh-entry-core" cx="50%" cy="39%" r="30%">
            <stop offset="0%" stopColor="#dbeafe" stopOpacity="0.22" />
            <stop offset="70%" stopColor="#60a5fa" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#020617" stopOpacity="0" />
          </radialGradient>
          <mask id="mesh-entry-border-mask">
            <rect x="-12" y="-12" width="124" height="124" fill="white" />
            <ellipse cx="50" cy="46" rx="29" ry="35" fill="black" opacity="0.82" />
            <ellipse cx="50" cy="46" rx="37" ry="43" fill="black" opacity="0.24" />
          </mask>
        </defs>

        <g mask="url(#mesh-entry-border-mask)">
          <rect x="-10" y="-10" width="120" height="120" rx="11" fill="none" stroke="url(#mesh-entry-rail)" strokeWidth="0.1" vectorEffect="non-scaling-stroke" />
          <circle cx="50" cy="39" r="20" fill="url(#mesh-entry-core)" />

          {BORDER_SWEEPS.map((path, index) => (
            <path
              key={`sweep-${index}`}
              d={path}
              className="mesh-entry-sweep-line"
              vectorEffect="non-scaling-stroke"
              style={{ animationDelay: `${index * 740}ms` }}
            />
          ))}

          {EDGE_LINKS.map(([fromId, toId], index) => {
            const from = nodeById(fromId);
            const to = nodeById(toId);
            return (
              <path
                key={`${fromId}-${toId}`}
                d={meshPath(from, to, ((index % 5) - 2) * 0.92)}
                className={cn("mesh-entry-edge-line", index % 13 === 0 && "mesh-entry-edge-line-strong")}
                vectorEffect="non-scaling-stroke"
                style={{ animationDelay: `${index * 22}ms` }}
              />
            );
          })}
        </g>

        {CONNECTION_IDS.map((id, index) => {
          const node = nodeById(id);
          const anchor = typing || unlocking || failed ? MESHI_STRING_ANCHORS[index % MESHI_STRING_ANCHORS.length] : MESHI_CONNECTION_CORE;
          const revealStart = (index / CONNECTION_IDS.length) * 0.78;
          const revealProgress = unlocking || failed ? 1 : Math.max(0, Math.min(1, (liveProgress - revealStart) / 0.24));
          const isVisible = revealProgress > 0 || unlocking || failed;
          const path = meshPath(node, anchor, index % 2 === 0 ? 2.8 : -2.8);
          const lineOpacity = isVisible ? connectionOpacity * Math.min(1, revealProgress * 1.35) : 0;
          return (
            <g key={`connection-${id}`}>
              <motion.path
                d={path}
                className={cn(
                  "mesh-entry-connection-string",
                  (typing || unlocking) && "mesh-entry-connection-string-active",
                  failed && "mesh-entry-connection-string-failed",
                )}
                stroke={failed ? "url(#mesh-entry-fail)" : "url(#mesh-entry-line)"}
                strokeWidth={failed ? 0.12 : 0.06 + liveProgress * (typing ? 0.14 : 0.08)}
                strokeDasharray={failed ? "0.18 0.82" : typing ? "1.45 0.7" : undefined}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                initial={false}
                animate={{
                  opacity: failed ? [0.84, 0.5, 0.2] : lineOpacity,
                  pathLength: failed ? [1, 0.34, 0.14] : revealProgress,
                  pathOffset: failed ? [0, 0.08, 0.18] : 0,
                }}
                transition={{
                  duration: reduceMotion ? 0.01 : failed ? 0.34 : 0.32,
                  ease: "easeOut",
                  delay: reduceMotion ? 0 : failed ? index * 0.006 : index * 0.014,
                }}
              />
              <motion.path
                d={path}
                className="mesh-entry-connection-current"
                stroke="url(#mesh-entry-string-live)"
                strokeWidth={0.1 + liveProgress * 0.12}
                strokeDasharray="0.18 2.2"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                initial={false}
                animate={{
                  opacity: typing && isVisible && !failed ? 0.16 + liveProgress * 0.54 : 0,
                  pathLength: revealProgress,
                }}
                transition={{
                  duration: reduceMotion ? 0.01 : 0.22,
                  ease: "easeOut",
                  delay: reduceMotion ? 0 : index * 0.012,
                }}
              />
            </g>
          );
        })}

        {(typing || unlocking) && !failed ? MESHI_STRING_ANCHORS.map((anchor, index) => (
          <motion.circle
            key={`meshi-string-anchor-${anchor.x}-${anchor.y}`}
            cx={anchor.x}
            cy={anchor.y}
            r={0.12 + liveProgress * 0.24}
            fill="#dbeafe"
            initial={false}
            animate={{
              opacity: liveProgress > index / MESHI_STRING_ANCHORS.length ? 0.22 + liveProgress * 0.58 : 0,
              scale: reduceMotion ? 1 : [0.86, 1.32, 0.94, 1],
            }}
            transition={{
              duration: reduceMotion ? 0.01 : 1.1,
              repeat: reduceMotion ? 0 : Infinity,
              ease: "easeInOut",
              delay: index * 0.08,
            }}
          />
        )) : null}

        {(typing || unlocking) && !failed ? (
          <motion.g className="mesh-entry-meshi-link-core">
            <motion.circle
              cx={MESHI_CONNECTION_CORE.x}
              cy={MESHI_CONNECTION_CORE.y}
              r={1.6 + liveProgress * 3.8}
              fill="none"
              stroke="#dbeafe"
              strokeWidth={0.08 + liveProgress * 0.1}
              initial={false}
              animate={{
                opacity: reduceMotion ? 0.18 + liveProgress * 0.26 : [0.18 + liveProgress * 0.22, 0.36 + liveProgress * 0.26, 0.18 + liveProgress * 0.22],
                scale: reduceMotion ? 1 : [0.96, 1.08, 0.96],
              }}
              transition={{ duration: reduceMotion ? 0.01 : 1.45, repeat: reduceMotion ? 0 : Infinity, ease: "easeInOut" }}
            />
            <motion.circle
              cx={MESHI_CONNECTION_CORE.x}
              cy={MESHI_CONNECTION_CORE.y}
              r={0.4 + liveProgress * 0.68}
              fill="#ffffff"
              initial={false}
              animate={{ opacity: 0.32 + liveProgress * 0.5 }}
              transition={{ duration: reduceMotion ? 0.01 : 0.18 }}
            />
          </motion.g>
        ) : null}

        {AMBIENT_SPARKS.map((spark, index) => (
          <circle
            key={`spark-${spark.x}-${spark.y}`}
            cx={spark.x}
            cy={spark.y}
            r={spark.r}
            fill="#dbeafe"
            className="mesh-entry-spark"
            style={{ animationDelay: `${index * 210}ms` }}
          />
        ))}

        <g mask="url(#mesh-entry-border-mask)" filter={unlocking ? "url(#mesh-entry-soft-glow)" : undefined}>
          {EDGE_NODES.map((node, index) => (
            <g
              key={node.id}
              className="mesh-entry-node"
              style={{
                animationDelay: `${index * 31}ms`,
                "--entry-node-drift": `${node.drift}`,
              } as CSSProperties}
            >
              <circle className="mesh-entry-node-halo" cx={node.x} cy={node.y} r={node.r * (unlocking ? 6.2 : 4.1)} fill="url(#mesh-entry-node)" opacity={0.1 + node.glow * 0.18} />
              <circle className="mesh-entry-node-core" cx={node.x} cy={node.y} r={node.r * (unlocking ? 1.62 : 1.03)} fill="#f8fafc" opacity={0.62 + node.glow * 0.22} />
            </g>
          ))}
        </g>

        {unlocking && !reduceMotion ? (
          <motion.g className="mesh-entry-unlock-bloom">
            {[0, 1, 2].map((index) => (
              <motion.circle
                key={`unlock-bloom-${index}`}
                cx="50"
                cy="39"
                r={2.4 + index * 1.2}
                fill="none"
                stroke={index === 0 ? "#ffffff" : "#dbeafe"}
                strokeWidth={0.18 - index * 0.035}
                initial={{ opacity: 0.74 - index * 0.14, scale: 0.36 }}
                animate={{ opacity: 0, scale: 8.4 + index * 2.4 }}
                transition={{ duration: 0.9 + index * 0.18, ease: "easeOut", delay: index * 0.08 }}
              />
            ))}
            {MESHI_STRING_ANCHORS.map((anchor, index) => (
              <motion.path
                key={`unlock-ray-${anchor.x}-${anchor.y}`}
                d={`M ${MESHI_CONNECTION_CORE.x} ${MESHI_CONNECTION_CORE.y} L ${anchor.x + (anchor.x - MESHI_CONNECTION_CORE.x) * 3.2} ${anchor.y + (anchor.y - MESHI_CONNECTION_CORE.y) * 3.2}`}
                stroke="#dbeafe"
                strokeWidth="0.08"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                initial={{ opacity: 0, pathLength: 0 }}
                animate={{ opacity: [0, 0.62, 0], pathLength: [0, 1, 1] }}
                transition={{ duration: 0.78, ease: "easeOut", delay: index * 0.018 }}
              />
            ))}
          </motion.g>
        ) : null}
      </svg>
    </div>
  );
}

export function MeshEntryExperience({ nextPath }: MeshEntryExperienceProps) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const identityHelpId = useId();
  const identityMessageId = useId();
  const passwordHelpId = useId();
  const passwordMessageId = useId();
  const resetMessageId = useId();
  const [stage, setStage] = useState<EntryStage>("identity");
  const [entryState, setEntryState] = useState<EntryState>("idle");
  const [identifier, setIdentifier] = useState("");
  const [identityTouched, setIdentityTouched] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [resetUrl, setResetUrl] = useState("");
  const [resetReturnStage, setResetReturnStage] = useState<"identity" | "password">("identity");
  const [signupDraft, setSignupDraft] = useState<SignupDraft>({ email: "", username: "", phone: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [meshiPreview, setMeshiPreview] = useState<EntryMeshiPreview | null>(null);
  const [previewState, setPreviewState] = useState<"idle" | "looking" | "found">("idle");
  const [meshiEntrance, setMeshiEntrance] = useState<MeshiEntranceState>("idle");
  const [isHydrated, setIsHydrated] = useState(false);
  const [isPending, startTransition] = useTransition();
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const meshiAnchorRef = useRef<HTMLDivElement>(null);
  const meshiEntranceKeyRef = useRef("");
  const requestedMeshiEntranceRef = useRef<MeshiEntranceState | null>(null);

  const passwordProgress = useMemo(() => {
    if (stage !== "password") return 0;
    if (password.length === 0) return 0;
    return Math.min(1, Math.max(0.12, password.length / 12));
  }, [password.length, stage]);

  const constellationProgress = stage === "signup" ? 0.34 : stage === "reset" ? 0.42 : entryState === "unlocking" ? 1 : passwordProgress;
  const isPasswordTyping = stage === "password" && password.length > 0 && entryState !== "failed";
  const identityValidation = useMemo(() => getEntryIdentityValidation(identifier), [identifier]);
  const identityHasError = stage === "identity" && Boolean(message || (identityTouched && !identityValidation.ok));
  const identityStatus = message || (identityTouched && !identityValidation.ok ? identityValidation.message : "");
  const passwordStatus = stage === "password"
    ? message || (passwordTouched && password.length === 0 ? "Enter your password." : "")
    : "";
  const passwordHasError = stage === "password" && Boolean(passwordStatus);

  const destinationLabel = useMemo(() => {
    if (!nextPath) return null;
    const segment = nextPath.split(/[?#]/)[0].split("/").filter(Boolean)[0];
    return segment ? DESTINATION_LABELS[segment] || "your last page" : null;
  }, [nextPath]);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const previewDisplayName = meshiPreview?.displayName?.trim() || meshiPreview?.username || "you";
  const activeMeshi = meshiPreview?.meshi ?? DEFAULT_ENTRY_MESHI;
  const shouldShowEntryMeshi = stage !== "identity" || Boolean(meshiPreview);
  const visibleMeshiKey = shouldShowEntryMeshi
    ? stage === "identity"
      ? `identity:${meshiPreview?.username ?? "preview"}`
      : `${stage}:${identifier || meshiPreview?.username || "default"}`
    : "";

  const meshiNote = useMemo(() => {
    if (stage === "identity") return meshiPreview ? `Hi ${previewDisplayName}. I found your Meshi.` : "";
    if (entryState === "failed") return stage === "signup" || stage === "reset" ? "I can fix this with you." : "Connection dropped. Try again.";
    if (entryState === "unlocking") return stage === "signup" ? "Opening your Mesh..." : "Reconnecting your world...";
    if (stage === "reset") return resetSent ? "Check your inbox." : "I can help recover your Mesh.";
    if (stage === "signup") return "I will help you build your Mesh.";
    return meshiPreview ? `Hi ${previewDisplayName}. Let's reconnect.` : "I found you. Let's reconnect.";
  }, [entryState, meshiPreview, previewDisplayName, resetSent, stage]);

  const loadMeshiPreview = useCallback(async (rawIdentifier: string, signal?: AbortSignal) => {
    const username = getUsernamePreviewCandidate(rawIdentifier);
    if (!username) {
      setMeshiPreview(null);
      setPreviewState("idle");
      return null;
    }

    setPreviewState("looking");

    try {
      const response = await fetch(`/api/auth/meshi-preview?username=${encodeURIComponent(username)}`, {
        headers: { Accept: "application/json" },
        signal,
      });

      if (!response.ok) throw new Error("Meshi preview unavailable");

      const payload: unknown = await response.json().catch(() => null);
      if (signal?.aborted) return null;

      if (!isMeshiPreviewPayload(payload)) {
        setMeshiPreview(null);
        setPreviewState("idle");
        return null;
      }

      const preview: EntryMeshiPreview = {
        username: payload.username,
        displayName: payload.displayName,
        meshi: {
          color: payload.meshi.color as MeshiColor,
          hat: payload.meshi.hat as MeshiHat,
          face: payload.meshi.face as MeshiMood,
          hair: payload.meshi.hair as MeshiHair,
          accessory: payload.meshi.accessory as MeshiAccessory,
          eye: payload.meshi.eye as MeshiEyeStyle,
          badge: (payload.meshi.badge || "none") as MeshiBadge,
          outfit: (payload.meshi.outfit || "none") as MeshiOutfit,
        },
      };

      setMeshiPreview(preview);
      setPreviewState("found");
      return preview;
    } catch {
      if (!signal?.aborted) {
        setMeshiPreview(null);
        setPreviewState("idle");
      }
      return null;
    }
  }, []);

  useEffect(() => {
    if (stage !== "identity") return;

    const username = getUsernamePreviewCandidate(identifier);
    if (!username) {
      setMeshiPreview(null);
      setPreviewState("idle");
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void loadMeshiPreview(username, controller.signal);
    }, 260);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [identifier, loadMeshiPreview, stage]);

  useEffect(() => {
    if (!visibleMeshiKey) {
      meshiEntranceKeyRef.current = "";
      requestedMeshiEntranceRef.current = null;
      setMeshiEntrance("idle");
      return;
    }

    if (visibleMeshiKey !== meshiEntranceKeyRef.current) {
      meshiEntranceKeyRef.current = visibleMeshiKey;
      setMeshiEntrance(requestedMeshiEntranceRef.current ?? "arriving");
      requestedMeshiEntranceRef.current = null;
    }
  }, [visibleMeshiKey]);

  useEffect(() => {
    let meshiPos: { x: number; y: number } | null = null;
    if (meshiAnchorRef.current) {
      const rect = meshiAnchorRef.current.getBoundingClientRect();
      meshiPos = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }

    window.dispatchEvent(new CustomEvent("mesh-activity", {
      detail: {
        field: stage === "password" ? "password" : null,
        totalChars: stage === "password" ? password.length : 0,
        meshiPos,
      },
    }));
  }, [password.length, stage, entryState]);

  useEffect(() => {
    if (entryState === "unlocking") {
      window.dispatchEvent(new CustomEvent("mesh-converge"));
    }
  }, [entryState]);

  const beginPasswordStep = () => {
    const validation = getEntryIdentityValidation(identifier);
    const nextIdentifier = validation.normalized;

    setIdentityTouched(true);

    if (!validation.ok) {
      setMessage(validation.message);
      setEntryState("idle");
      requestedMeshiEntranceRef.current = null;
      return;
    }

    setIdentifier(nextIdentifier);
    setMessage("");
    setEntryState("connecting");
    requestedMeshiEntranceRef.current = meshiPreview ? "handoff" : "arriving";
    const previewPromise = loadMeshiPreview(nextIdentifier);
    startTransition(async () => {
      const result = await resolveEntryIdentity(nextIdentifier);
      if (result?.error) {
        setEntryState("failed");
        setMessage(result.error);
        return;
      }

      if (result?.mode === "sign-up") {
        setMeshiPreview(null);
        setPreviewState("idle");
        setSignupDraft(result.prefill);
        setStage("signup");
        setEntryState("idle");
        requestedMeshiEntranceRef.current = "arriving";
        return;
      }

      await previewPromise;
      setEntryState("connecting");
      setStage("password");
      window.setTimeout(() => passwordInputRef.current?.focus(), reduceMotion ? 40 : 420);
    });
  };

  const submitPassword = (formData: FormData) => {
    const submittedPassword = formData.get("password");
    setPasswordTouched(true);
    if (typeof submittedPassword !== "string" || submittedPassword.length === 0) {
      setEntryState("idle");
      setMessage("Enter your password.");
      window.setTimeout(() => passwordInputRef.current?.focus(), 80);
      return;
    }

    setMessage("");
    setEntryState("connecting");
    startTransition(async () => {
      const result = await signInForEntry(formData);
      if (result?.error) {
        setEntryState("failed");
        setMessage(
          result.error === "Invalid email or password"
            ? "That password didn't work. Try again."
            : result.error,
        );
        window.setTimeout(() => passwordInputRef.current?.focus(), 120);
        return;
      }

      flushSync(() => {
        setEntryState("unlocking");
      });
      const sessionFormData = new FormData();
      formData.forEach((value, key) => sessionFormData.append(key, value));
      window.setTimeout(() => {
        startTransition(async () => {
          const sessionResult = await finalizeSignInForEntry(sessionFormData);
          if (sessionResult?.error) {
            setEntryState("failed");
            setMessage(
              sessionResult.error === "Invalid email or password"
                ? "That password didn't work. Try again."
                : sessionResult.error,
            );
            window.setTimeout(() => passwordInputRef.current?.focus(), 120);
            return;
          }
          router.push(sessionResult.redirectTo || result.redirectTo || "/mesh");
        });
      }, reduceMotion ? 180 : 1080);
    });
  };

  const submitSignup = (formData: FormData) => {
    setMessage("");
    setEntryState("unlocking");
    startTransition(async () => {
      const result = await signUp(formData);
      if (result?.error) {
        setEntryState("failed");
        setMessage(result.error);
      }
    });
  };

  const openResetStep = () => {
    const emailCandidate = identityValidation.kind === "email" ? identityValidation.normalized : "";
    setResetEmail(emailCandidate);
    setResetSent(false);
    setResetUrl("");
    setResetReturnStage(stage === "password" ? "password" : "identity");
    setPasswordTouched(false);
    setMessage("");
    setEntryState("idle");
    requestedMeshiEntranceRef.current = shouldShowEntryMeshi ? "handoff" : "arriving";
    setStage("reset");
  };

  const submitResetRequest = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = resetEmail.trim().toLowerCase();

    if (!EMAIL_ENTRY_PATTERN.test(normalizedEmail)) {
      setResetSent(false);
      setResetUrl("");
      setEntryState("idle");
      setMessage("Enter the email connected to your Mesh.");
      return;
    }

    setResetEmail(normalizedEmail);
    setMessage("");
    setResetSent(false);
    setResetUrl("");
    setEntryState("connecting");
    startTransition(async () => {
      const result = await requestPasswordReset(normalizedEmail);
      if (result?.error) {
        setEntryState("failed");
        setMessage(result.error);
        return;
      }

      setEntryState("idle");
      setResetSent(true);
      setMessage("");
      setResetUrl(result && "resetUrl" in result && typeof result.resetUrl === "string" ? result.resetUrl : "");
    });
  };

  const openInlineSignup = () => {
    const nextIdentifier = identifier.trim();
    const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextIdentifier.toLowerCase());
    const phone = nextIdentifier && !looksLikeEmail && nextIdentifier.replace(/[^\d+]/g, "").length >= 7
      ? nextIdentifier.replace(/[^\d+]/g, "")
      : "";
    const username = nextIdentifier && !looksLikeEmail && !phone
      ? nextIdentifier.toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_").slice(0, 24)
      : "";

    setSignupDraft({
      email: looksLikeEmail ? nextIdentifier.toLowerCase() : "",
      username,
      phone,
    });
    setPassword("");
    setMessage("");
    setEntryState("idle");
    setMeshiPreview(null);
    setPreviewState("idle");
    requestedMeshiEntranceRef.current = shouldShowEntryMeshi ? "handoff" : "arriving";
    setStage("signup");
  };

  const meshiEntranceActive = (meshiEntrance === "arriving" || meshiEntrance === "handoff")
    && shouldShowEntryMeshi
    && entryState !== "failed"
    && entryState !== "unlocking";
  const meshiHoverActive = shouldShowEntryMeshi && !meshiEntranceActive && entryState !== "failed" && entryState !== "unlocking";
  const meshiMood = entryState === "failed"
    ? "surprised"
    : entryState === "unlocking"
      ? "celebrating"
      : meshiEntranceActive
        ? "excited"
        : stage === "reset"
          ? "thinking"
        : stage === "signup"
          ? "thinking"
          : activeMeshi.face;
  const meshiProp: MeshiProp = isPasswordTyping || entryState === "unlocking" ? "keyboard" : stage === "reset" ? "envelope" : "none";
  const stepLabel = stage === "identity" ? "Identify" : stage === "password" ? "Unlock" : stage === "reset" ? "Reset" : "Create";
  const meshiWrapAnimate = !shouldShowEntryMeshi
    ? {
        opacity: 0,
        x: reduceMotion ? 0 : -560,
        y: reduceMotion ? 12 : -170,
        scale: reduceMotion ? 0.98 : 0.72,
        rotate: reduceMotion ? 0 : -16,
      }
    : entryState === "failed"
      ? {
          opacity: 1,
          x: reduceMotion ? 0 : [0, -8, 8, -5, 5, 0],
          y: reduceMotion ? 0 : [0, 3, -2, 0],
          scale: reduceMotion ? 1 : [1, 0.94, 1.04, 1],
          rotate: reduceMotion ? 0 : [0, -4, 3, 0],
        }
      : entryState === "unlocking"
        ? {
            opacity: 1,
            x: 0,
            y: reduceMotion ? 0 : [0, -4, -10],
            scale: reduceMotion ? 1 : [1, 1.08, 1.2],
            rotate: 0,
          }
        : meshiEntrance === "handoff"
          ? {
              opacity: 1,
              x: reduceMotion ? 0 : [0, 16, -8, 0],
              y: reduceMotion ? 0 : [0, -18, 4, 0],
              scale: reduceMotion ? 1 : [1, 1.08, 0.98, 1],
              rotate: reduceMotion ? 0 : [0, 4, -2, 0],
            }
          : meshiEntrance === "arriving"
            ? {
                opacity: 1,
                x: reduceMotion ? 0 : [-560, 24, -8, 0],
                y: reduceMotion ? 0 : [-170, -22, 5, 0],
                scale: reduceMotion ? 1 : [0.72, 1.08, 0.98, 1],
                rotate: reduceMotion ? 0 : [-16, 6, -2, 0],
              }
            : {
                opacity: 1,
                x: 0,
                y: 0,
                scale: 1,
                rotate: 0,
              };
  const meshiWrapTransition: Transition = reduceMotion
    ? { duration: 0.01 }
    : entryState === "failed"
      ? { duration: 0.38, ease: "easeOut" }
      : entryState === "unlocking"
        ? { duration: 0.62, ease: "easeInOut" }
        : meshiEntranceActive
          ? { duration: meshiEntrance === "handoff" ? 0.54 : 0.86, ease: "easeOut", times: [0, 0.58, 0.82, 1] }
          : { duration: 0.24, ease: "easeOut" };
  const meshiBodyAnimate = reduceMotion || !meshiHoverActive
    ? undefined
    : {
        y: [0, -5, 0, 3, 0],
        rotate: [0, -0.9, 0, 0.8, 0],
      };

  return (
    <main
      className="mesh-entry h-dvh max-h-dvh min-h-0 overflow-hidden bg-[#030712] text-white"
      data-entry-stage={stage}
      data-entry-state={entryState}
      data-entry-ready={isHydrated ? "true" : "false"}
      data-password-typing={isPasswordTyping ? "true" : "false"}
      data-testid="mesh-entry"
    >
      <MeshConstellation
        progress={constellationProgress}
        failed={entryState === "failed"}
        typing={isPasswordTyping}
        unlocking={entryState === "unlocking"}
      />

      <div className="mesh-entry-depth pointer-events-none absolute inset-0" />
      <AnimatePresence>
        {entryState === "unlocking" ? (
          <motion.div
            key="mesh-entry-world-open"
            className="mesh-entry-world-open pointer-events-none absolute inset-0"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.08 }}
            transition={{ duration: reduceMotion ? 0.01 : 0.48, ease: "easeOut" }}
            aria-hidden="true"
          />
        ) : null}
        {entryState === "failed" && stage === "password" ? (
          <motion.div
            key="mesh-entry-failure-flash"
            className="mesh-entry-failure-flash pointer-events-none absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0.01 : 0.46, ease: "easeOut" }}
            aria-hidden="true"
          />
        ) : null}
      </AnimatePresence>

      <section className="relative z-10 flex h-full min-h-0 items-center justify-center px-4 py-3 sm:px-5">
        <div className="mesh-entry-panel w-full max-w-[30rem]">
          <div className="mesh-entry-brand-shell mb-6 text-center sm:mb-8">
            <Link href="/" className="brand-wordmark inline-flex text-xl font-bold text-white" aria-label="mesh.me home">
              mesh<span className="brand-wordmark-accent">.me</span>
            </Link>
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.28em] text-blue-100/55">Your World, Your Way</p>
            <div className="mesh-entry-stage-row mt-4" aria-label={`Current step: ${stepLabel}`}>
              {["Identify", stage === "signup" ? "Create" : stage === "reset" ? "Reset" : "Unlock", "Enter"].map((label, index) => {
                const active = label === stepLabel || (entryState === "unlocking" && label === "Enter");
                const completed = stage !== "identity" && index === 0;
                return (
                  <span key={`${label}-${index}`} className={cn("mesh-entry-stage-pill", active && "mesh-entry-stage-pill-active", completed && "mesh-entry-stage-pill-done")}>
                    {label}
                  </span>
                );
              })}
            </div>
          </div>

          <div className={cn("mesh-entry-flow relative", stage === "identity" ? "min-h-[25rem]" : stage === "signup" ? "min-h-[45rem]" : stage === "reset" ? "min-h-[35rem]" : "min-h-[32rem]")}>
            <motion.div
              ref={meshiAnchorRef}
              className={cn(
                "mesh-entry-meshi-wrap",
                stage === "identity" && "pointer-events-none",
                meshiEntranceActive && "mesh-entry-meshi-wrap-entering",
                meshiHoverActive && "mesh-entry-meshi-wrap-alive",
                entryState === "unlocking" && "mesh-entry-meshi-wrap-unlocking",
                entryState === "failed" && "mesh-entry-meshi-wrap-failed",
              )}
              initial={false}
              animate={meshiWrapAnimate}
              transition={meshiWrapTransition}
              onAnimationComplete={() => {
                if (meshiEntrance === "arriving" || meshiEntrance === "handoff") setMeshiEntrance("settled");
              }}
              aria-hidden={!shouldShowEntryMeshi}
              data-meshi-prop={meshiProp}
              data-testid="entry-meshi"
            >
              <motion.div
                className="mesh-entry-meshi-body"
                animate={meshiBodyAnimate}
                transition={{ duration: 4.4, repeat: Infinity, ease: "easeInOut" }}
              >
                <MeshiMascot
                  size={96}
                  color={activeMeshi.color}
                  mood={meshiMood}
                  hat={activeMeshi.hat}
                  hair={activeMeshi.hair}
                  accessory={activeMeshi.accessory}
                  eyeStyle={activeMeshi.eye}
                  badge={activeMeshi.badge}
                  outfit={activeMeshi.outfit}
                  prop={meshiProp}
                  showGlow
                  bouncy={entryState !== "failed"}
                  interactive={stage !== "identity"}
                />
              </motion.div>
              <AnimatePresence mode="wait">
                {meshiNote ? (
                  <motion.p
                    key={meshiNote}
                    initial={{ opacity: 0, y: reduceMotion ? 0 : 6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: reduceMotion ? 0 : -4, scale: 0.98 }}
                    transition={{ duration: reduceMotion ? 0.01 : 0.18, ease: "easeOut" }}
                    className="mesh-entry-meshi-note"
                  >
                    {meshiNote}
                  </motion.p>
                ) : null}
              </AnimatePresence>
            </motion.div>

            <AnimatePresence mode="wait">
            {stage === "identity" ? (
              <motion.div
                key="identity-entry"
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: reduceMotion ? 0 : -18, scale: reduceMotion ? 1 : 0.985 }}
                transition={{ duration: reduceMotion ? 0.01 : 0.28, ease: "easeOut" }}
              >
                <motion.form
                  action="#"
                  onSubmit={(event) => {
                    event.preventDefault();
                    beginPasswordStep();
                  }}
                  className="mesh-entry-card mesh-entry-identity-form space-y-5"
                  data-testid="entry-identity-form"
                  noValidate
                >
                  <div className="space-y-2 text-center">
                    <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-blue-100/15 bg-blue-100/8 text-blue-100">
                      <UserRound className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <h1 className="text-4xl font-bold tracking-[0] text-white sm:text-5xl">Who are you?</h1>
                    <p className="text-sm text-blue-100/62">Sign in or create your Mesh from one place.</p>
                  </div>
                  <label className="block" htmlFor="mesh-entry-identity">
                    <span className="sr-only">Username, email, or phone number</span>
                    <input
                      id="mesh-entry-identity"
                      value={identifier}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        const nextPreviewUsername = getUsernamePreviewCandidate(nextValue);
                        setIdentifier(nextValue);
                        setResetSent(false);
                        setResetUrl("");
                        if (meshiPreview && nextPreviewUsername !== meshiPreview.username) {
                          setMeshiPreview(null);
                          setPreviewState(nextPreviewUsername ? "looking" : "idle");
                        }
                        if (message) setMessage("");
                        if (entryState === "failed") setEntryState("idle");
                      }}
                      onBlur={() => setIdentityTouched(true)}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          event.preventDefault();
                          setIdentifier("");
                          setIdentityTouched(false);
                          setMeshiPreview(null);
                          setPreviewState("idle");
                          setMessage("");
                          setEntryState("idle");
                        }
                      }}
                      autoComplete="username"
                      autoCapitalize="none"
                      autoCorrect="off"
                      enterKeyHint="next"
                      spellCheck={false}
                      inputMode={identityValidation.inputMode}
                      className={cn("mesh-entry-input", identityHasError && "mesh-entry-input-invalid")}
                      placeholder="Username, email, or phone"
                      aria-invalid={identityHasError}
                      aria-describedby={identityHasError ? `${identityHelpId} ${identityMessageId}` : identityHelpId}
                      maxLength={96}
                      required
                      data-identity-kind={identityValidation.kind}
                      data-testid="entry-identity-input"
                    />
                    <span id={identityHelpId} className="mesh-entry-identity-meta">
                      <span>{identityValidation.helper}</span>
                      <span className={cn("mesh-entry-identity-type", identityValidation.ok && "mesh-entry-identity-type-ready")}>
                        {identityValidation.label}
                      </span>
                    </span>
                  </label>
                  <AnimatePresence mode="wait">
                    {meshiPreview ? (
                      <motion.p
                        key="meshi-preview-found"
                        initial={{ opacity: 0, y: reduceMotion ? 0 : 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: reduceMotion ? 0 : -3 }}
                        transition={{ duration: reduceMotion ? 0.01 : 0.16, ease: "easeOut" }}
                        className="text-center text-xs font-semibold text-blue-100/72"
                        data-testid="entry-meshi-preview-ready"
                      >
                        Hi {previewDisplayName}. Your Meshi is ready.
                      </motion.p>
                    ) : previewState === "looking" ? (
                      <motion.p
                        key="meshi-preview-looking"
                        initial={{ opacity: 0, y: reduceMotion ? 0 : 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: reduceMotion ? 0 : -3 }}
                        transition={{ duration: reduceMotion ? 0.01 : 0.16, ease: "easeOut" }}
                        className="text-center text-xs font-semibold text-blue-100/46"
                      >
                      Looking for your Meshi...
                      </motion.p>
                    ) : null}
                  </AnimatePresence>
                  <AnimatePresence mode="wait">
                    {identityStatus ? (
                      <motion.p
                        id={identityMessageId}
                        key={identityStatus}
                        initial={{ opacity: 0, y: reduceMotion ? 0 : -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: reduceMotion ? 0 : -4 }}
                        transition={{ duration: reduceMotion ? 0.01 : 0.16, ease: "easeOut" }}
                        className="mesh-entry-message"
                        role="alert"
                      >
                        {identityStatus}
                      </motion.p>
                    ) : null}
                  </AnimatePresence>
                  <Button
                    type="button"
                    size="lg"
                    className="mesh-entry-primary w-full"
                    disabled={isPending || !isHydrated}
                    onClick={beginPasswordStep}
                    data-testid="entry-continue-button"
                  >
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                    Continue
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <button
                    type="button"
                    onClick={openInlineSignup}
                    className="mesh-entry-secondary-button w-full"
                    data-testid="entry-open-signup-button"
                  >
                    New here? Create your Mesh
                  </button>
                  <div className="mesh-entry-trust-row" aria-label="Mesh.me account protections">
                    <span><ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Private</span>
                    <span><LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" /> Secure</span>
                    <span><Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Yours</span>
                  </div>
                </motion.form>
              </motion.div>
            ) : null}
            </AnimatePresence>

            {stage === "password" ? (
              <motion.div
                initial={{ opacity: 0, y: reduceMotion ? 128 : 154, scale: 0.98 }}
                animate={{ opacity: 1, y: 128, scale: 1 }}
                transition={{ duration: reduceMotion ? 0.01 : 0.38, ease: "easeOut" }}
                className="absolute inset-x-0 top-0"
              >
                <form action={submitPassword} className="mesh-entry-card space-y-5" data-testid="entry-password-form" noValidate>
                  <input type="hidden" name="email" value={identifier} />
                  <label className="sr-only" htmlFor="mesh-entry-password-username">Username</label>
                  <input
                    id="mesh-entry-password-username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    value={identifier}
                    readOnly
                    tabIndex={-1}
                    className="sr-only"
                  />
                  {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}
                  <div className="space-y-1 text-center">
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-blue-100/15 bg-blue-100/8 text-blue-100">
                      <LockKeyhole className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-[0] text-white">Welcome back</h1>
                    <p className="text-sm text-blue-100/62">Enter your password to reconnect.</p>
                    <p className="mx-auto max-w-[18rem] truncate text-xs font-semibold text-blue-100/42">{identifier}</p>
                    {destinationLabel ? (
                      <p className="text-xs font-semibold text-blue-100/42">Then open {destinationLabel}.</p>
                    ) : null}
                  </div>
                  <label className="block" htmlFor="mesh-entry-password">
                    <span className="sr-only">Password</span>
                    <span className="relative block">
                      <input
                        ref={passwordInputRef}
                        id="mesh-entry-password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(event) => {
                          setPassword(event.target.value);
                          if (entryState === "failed") setEntryState("connecting");
                          if (message) setMessage("");
                        }}
                        onBlur={() => setPasswordTouched(true)}
                        autoComplete="current-password"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        maxLength={128}
                        className={cn("mesh-entry-input pr-12", passwordHasError && "mesh-entry-input-invalid")}
                        placeholder="Enter your password"
                        aria-invalid={passwordHasError}
                        aria-describedby={passwordHasError ? `${passwordHelpId} ${passwordMessageId}` : passwordHelpId}
                        required
                        data-testid="entry-password-input"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((value) => !value)}
                        className="absolute right-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-blue-100/72 transition hover:bg-white/8 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-200/70"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </span>
                    <span id={passwordHelpId} className="mesh-entry-password-meta">
                      <span>Verified securely on Mesh.me.</span>
                      <button type="button" onClick={openResetStep} className="mesh-entry-text-button" data-testid="entry-forgot-password-button">
                        Forgot password?
                      </button>
                    </span>
                  </label>
                  <div className="mesh-entry-progress" aria-hidden="true">
                    <motion.span
                      animate={{ width: `${Math.round((entryState === "unlocking" ? 1 : passwordProgress) * 100)}%` }}
                      transition={{ duration: reduceMotion ? 0.01 : 0.18 }}
                      className={cn(entryState === "failed" && "mesh-entry-progress-failed")}
                    />
                  </div>
                  {passwordStatus ? <p id={passwordMessageId} className="mesh-entry-message" role="alert">{passwordStatus}</p> : null}
                  <Button type="submit" size="lg" className="mesh-entry-primary w-full" disabled={isPending} data-testid="entry-submit-button">
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                    Enter my world
                  </Button>
                  <button
                    type="button"
                    onClick={() => {
                      setStage("identity");
                      setPassword("");
                      setPasswordTouched(false);
                      setMessage("");
                      setEntryState("idle");
                      setPreviewState(meshiPreview ? "found" : "idle");
                    }}
                    className="w-full text-center text-xs font-semibold text-blue-100/55 transition hover:text-blue-100"
                  >
                    Use a different identity
                  </button>
                </form>
              </motion.div>
            ) : null}

            {stage === "reset" ? (
              <motion.div
                initial={{ opacity: 0, y: reduceMotion ? 128 : 154, scale: 0.98 }}
                animate={{ opacity: 1, y: 128, scale: 1 }}
                transition={{ duration: reduceMotion ? 0.01 : 0.38, ease: "easeOut" }}
                className="absolute inset-x-0 top-0"
              >
                <form onSubmit={submitResetRequest} className="mesh-entry-card space-y-5" data-testid="entry-reset-form" noValidate>
                  <div className="space-y-1 text-center">
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-blue-100/15 bg-blue-100/8 text-blue-100">
                      <LockKeyhole className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-[0] text-white">Reset password</h1>
                    <p className="text-sm text-blue-100/62">Enter the email connected to your Mesh.</p>
                    <p className="mx-auto max-w-[20rem] text-xs font-semibold text-blue-100/42">
                      If the email exists, we will send a secure reset link.
                    </p>
                  </div>

                  <label className="block" htmlFor="mesh-entry-reset-email">
                    <span className="sr-only">Email address</span>
                    <input
                      id="mesh-entry-reset-email"
                      name="email"
                      type="email"
                      value={resetEmail}
                      onChange={(event) => {
                        setResetEmail(event.target.value);
                        setResetSent(false);
                        setResetUrl("");
                        if (message) setMessage("");
                        if (entryState === "failed") setEntryState("idle");
                      }}
                      autoComplete="email"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      inputMode="email"
                      className={cn("mesh-entry-input", message && !resetSent && "mesh-entry-input-invalid")}
                      placeholder="you@example.com"
                      aria-invalid={Boolean(message && !resetSent)}
                      aria-describedby={resetMessageId}
                      required
                      data-testid="entry-reset-email"
                    />
                  </label>

                  {resetSent ? (
                    <p id={resetMessageId} className="mesh-entry-message mesh-entry-message-success" role="status">
                      Check your inbox for a reset link.
                    </p>
                  ) : message ? (
                    <p id={resetMessageId} className="mesh-entry-message" role="alert">
                      {message}
                    </p>
                  ) : (
                    <p id={resetMessageId} className="mesh-entry-reset-hint">
                      Reset requests are rate-limited and do not reveal whether an account exists.
                    </p>
                  )}

                  {resetUrl ? (
                    <Link href={resetUrl} className="mesh-entry-secondary-button w-full" data-testid="entry-dev-reset-link">
                      Open local reset link
                    </Link>
                  ) : null}

                  <Button type="submit" size="lg" className="mesh-entry-primary w-full" disabled={isPending} data-testid="entry-reset-submit-button">
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                    Send reset link
                  </Button>

                  <button
                    type="button"
                    onClick={() => {
                      setMessage("");
                      setResetSent(false);
                      setResetUrl("");
                      setEntryState("idle");
                      setStage(resetReturnStage);
                      if (resetReturnStage === "password") {
                        window.setTimeout(() => passwordInputRef.current?.focus(), 80);
                      }
                    }}
                    className="w-full text-center text-xs font-semibold text-blue-100/55 transition hover:text-blue-100"
                    data-testid="entry-reset-back-button"
                  >
                    Back to sign in
                  </button>
                </form>
              </motion.div>
            ) : null}

            {stage === "signup" ? (
              <motion.div
                initial={{ opacity: 0, y: reduceMotion ? 128 : 154, scale: 0.98 }}
                animate={{ opacity: 1, y: 128, scale: 1 }}
                transition={{ duration: reduceMotion ? 0.01 : 0.38, ease: "easeOut" }}
                className="absolute inset-x-0 top-0"
              >
                <form action={submitSignup} className="mesh-entry-card space-y-4" data-testid="entry-signup-form">
                  <div className="space-y-1 text-center">
                    <h1 className="text-2xl font-bold tracking-[0] text-white">Create your Mesh</h1>
                    <p className="text-sm text-blue-100/62">This identity is new here. Set up your account now.</p>
                  </div>

                  <label className="block" htmlFor="mesh-entry-display-name">
                    <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-blue-100/55">Name</span>
                    <input
                      id="mesh-entry-display-name"
                      name="displayName"
                      type="text"
                      autoComplete="name"
                      className="mesh-entry-input mesh-entry-input-left"
                      placeholder="Your name"
                      required
                      data-testid="entry-signup-display-name"
                    />
                  </label>

                  <label className="block" htmlFor="mesh-entry-signup-username">
                    <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-blue-100/55">Username</span>
                    <input
                      id="mesh-entry-signup-username"
                      name="username"
                      type="text"
                      autoComplete="username"
                      defaultValue={signupDraft.username}
                      className="mesh-entry-input mesh-entry-input-left"
                      placeholder="username"
                      required
                      data-testid="entry-signup-username"
                    />
                  </label>

                  <label className="block" htmlFor="mesh-entry-signup-email">
                    <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-blue-100/55">Email</span>
                    <input
                      id="mesh-entry-signup-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      defaultValue={signupDraft.email}
                      className="mesh-entry-input mesh-entry-input-left"
                      placeholder="you@example.com"
                      required
                      data-testid="entry-signup-email"
                    />
                  </label>

                  {signupDraft.phone ? (
                    <label className="block" htmlFor="mesh-entry-signup-phone">
                      <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-blue-100/55">Phone</span>
                      <input
                        id="mesh-entry-signup-phone"
                        name="phone"
                        type="tel"
                        autoComplete="tel"
                        defaultValue={signupDraft.phone}
                        className="mesh-entry-input mesh-entry-input-left"
                        placeholder="Phone number"
                        data-testid="entry-signup-phone"
                      />
                    </label>
                  ) : (
                    <input type="hidden" name="phone" value="" />
                  )}

                  <label className="block" htmlFor="mesh-entry-signup-password">
                    <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-blue-100/55">Password</span>
                    <span className="relative block">
                      <input
                        id="mesh-entry-signup-password"
                        name="password"
                        type={showSignupPassword ? "text" : "password"}
                        autoComplete="new-password"
                        minLength={12}
                        className="mesh-entry-input mesh-entry-input-left pr-12"
                        placeholder="12+ chars with number and symbol"
                        required
                        data-testid="entry-signup-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSignupPassword((value) => !value)}
                        className="absolute right-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-blue-100/72 transition hover:bg-white/8 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-200/70"
                        aria-label={showSignupPassword ? "Hide password" : "Show password"}
                      >
                        {showSignupPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </span>
                  </label>

                  {message ? <p className="mesh-entry-message" role="alert">{message}</p> : null}

                  <Button type="submit" size="lg" className="mesh-entry-primary w-full" disabled={isPending} data-testid="entry-create-account-button">
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                    Create my Mesh
                  </Button>

                  <button
                    type="button"
                    onClick={() => {
                      setStage("identity");
                      setPassword("");
                      setMessage("");
                      setEntryState("idle");
                      setMeshiPreview(null);
                      setPreviewState("idle");
                    }}
                    className="w-full text-center text-xs font-semibold text-blue-100/55 transition hover:text-blue-100"
                  >
                    I already have an account
                  </button>
                </form>
              </motion.div>
            ) : null}
          </div>

          <nav className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-3 text-xs font-semibold text-blue-100/58">
            <button type="button" onClick={openInlineSignup} className="transition hover:text-white">Create account</button>
            <button type="button" onClick={openResetStep} className="transition hover:text-white">Forgot password?</button>
            <Link href="/privacy" className="transition hover:text-white">Privacy</Link>
            <Link href="/terms" className="transition hover:text-white">Terms</Link>
          </nav>

          <div className="mt-6 flex items-center justify-center gap-2 text-xs font-semibold text-emerald-100/72">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Private by default. No ads. No data selling.
          </div>
        </div>
      </section>
    </main>
  );
}
